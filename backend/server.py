"""AiSteth FastAPI backend.

Ports the Node/Express API surface 1:1 + Phase-3 extensions:
  - Multi-patient mode (`/api/patients` CRUD + summary + trends)
  - AI narrative cache (hash-keyed Mistral cache: `/api/narrative`)

Persistence: Firestore (USE_FIRESTORE=true) or MongoDB via Motor.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import secrets
import socket
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware

from risk import qrisk3, score2, who_ish, route_and_run, list_models

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ.get("MONGO_URL", "")
DB_NAME = os.environ.get("DB_NAME", "test_database")
MISTRAL_KEY = os.environ.get("MISTRAL_KEY", "")
# Default to localhost origins only — override via CORS_ORIGINS env var
CORS_ORIGINS = os.environ.get(
    "CORS_ORIGINS", "http://localhost:3000,http://localhost:3001"
).split(",")
# Simple shared-secret auth. Set API_KEY in .env; leave blank to disable (dev only).
API_KEY = os.environ.get("API_KEY", "")
USE_FIRESTORE = os.environ.get("USE_FIRESTORE", "").lower() in ("1", "true", "yes")

# ── Database setup ─────────────────────────────────────────────────────────
_mongo_client = None

if USE_FIRESTORE:
    from storage.firestore_db import get_firestore_db
    db = get_firestore_db()
else:
    from motor.motor_asyncio import AsyncIOMotorClient
    if not MONGO_URL:
        raise RuntimeError("MONGO_URL env var is required when USE_FIRESTORE is not set")
    _mongo_client = AsyncIOMotorClient(MONGO_URL)
    db = _mongo_client[DB_NAME]

assessments_col = db["assessments"]
snapshots_col = db["snapshots"]
logs_col = db["session_logs"]
patients_col = db["patients"]
narratives_col = db["narratives"]

# ── App lifespan ───────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield  # startup is handled at module level
    # Shutdown — close DB connections cleanly
    if _mongo_client:
        _mongo_client.close()
    elif USE_FIRESTORE:
        await db.close()


app = FastAPI(title="AiSteth API", lifespan=lifespan)
api = APIRouter(prefix="/api")

# ── API key middleware ─────────────────────────────────────────────────────

class _APIKeyMiddleware(BaseHTTPMiddleware):
    """Protect all /api/* routes with an X-API-Key header when API_KEY is set."""

    async def dispatch(self, request: Request, call_next):
        # Always let CORS preflight (OPTIONS) through — browsers send these
        # before every cross-origin request and they carry no auth headers.
        if API_KEY and request.method != "OPTIONS" and request.url.path.startswith("/api/"):
            provided = request.headers.get("X-API-Key", "")
            # Use constant-time comparison to prevent timing attacks
            if not secrets.compare_digest(provided.encode(), API_KEY.encode()):
                return JSONResponse(
                    {"ok": False, "error": "Unauthorized — missing or invalid X-API-Key"},
                    status_code=401,
                )
        return await call_next(request)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger("aisteth")


# ── Helpers ────────────────────────────────────────────────

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if doc is None:
        return None
    doc.pop("_id", None)
    return doc


def _strip_snapshot(d: Dict[str, Any]) -> Dict[str, Any]:
    """Drop heavy `samples` arrays for listings."""
    def shrink(side: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not side:
            return None
        samples = side.get("samples")
        return {
            "result": side.get("result"),
            "samples": (len(samples) if isinstance(samples, list) else (samples or 0)),
        }

    return {
        "id": d.get("id"),
        "created_at": d.get("created_at"),
        "assessmentId": d.get("assessmentId"),
        "patientId": d.get("patientId"),
        "fused": d.get("fused"),
        "face": shrink(d.get("face")),
        "finger": shrink(d.get("finger")),
    }


def _narrative_key(payload: Dict[str, Any]) -> str:
    """Stable hash of (profile + vitals + qrisk3Score) for cache lookups."""
    canonical = {
        "profile": payload.get("profile") or {},
        "vitals": payload.get("vitals") or {},
        "qrisk3Score": payload.get("qrisk3Score"),
        "recommendations": payload.get("recommendations") or [],
    }
    raw = json.dumps(canonical, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()


# ── Routes ────────────────────────────────────────────────

@api.get("/")
async def root() -> Dict[str, Any]:
    return {"ok": True, "service": "aisteth", "version": "1.1.0"}


@api.get("/local-ip")
async def local_ip() -> Dict[str, Any]:
    try:
        host = socket.gethostbyname(socket.gethostname())
    except Exception:
        host = None
    return {"ip": host}


@api.get("/config")
async def config() -> Dict[str, Any]:
    # Never expose secret keys to the client — return only non-sensitive flags.
    return {"mistralEnabled": bool(MISTRAL_KEY)}


# ── Assessments ───────────────────────────────────────────

@api.post("/save-assessment")
async def save_assessment(request: Request) -> Dict[str, Any]:
    body = await request.json()
    record = {"id": str(uuid.uuid4()), "created_at": now_iso(), **body}
    # Surface patientId at top-level too for indexing convenience.
    if record.get("profile") and record["profile"].get("patientId"):
        record["patientId"] = record["profile"]["patientId"]
    await assessments_col.insert_one(dict(record))
    p = record.get("profile") or {}
    v = record.get("vitals") or {}
    logger.info(
        "assessment saved id=%s patient=%s qrisk3=%s hr=%s",
        record["id"][:8], record.get("patientId"),
        record.get("qrisk3Score"), v.get("hr"),
    )
    return {"ok": True, "id": record["id"]}


@api.get("/assessments")
async def list_assessments(
    limit: int = Query(100, le=1000),
    offset: int = 0,
    patientId: Optional[str] = None,
) -> Dict[str, Any]:
    q: Dict[str, Any] = {}
    if patientId:
        q = {"$or": [{"patientId": patientId}, {"profile.patientId": patientId}]}
    cursor = (
        assessments_col.find(q, {"_id": 0})
        .sort("created_at", -1)
        .skip(max(offset, 0))
        .limit(min(limit, 1000))
    )
    rows = [r async for r in cursor]
    total = await assessments_col.count_documents(q)
    return {"ok": True, "total": total, "rows": rows}


@api.get("/assessments/patient/{patient_id}")
async def list_assessments_patient(patient_id: str) -> Dict[str, Any]:
    q = {"$or": [{"patientId": patient_id}, {"profile.patientId": patient_id}]}
    cursor = assessments_col.find(q, {"_id": 0}).sort("created_at", -1)
    rows = [r async for r in cursor]
    return {"ok": True, "total": len(rows), "rows": rows}


@api.get("/assessments/{aid}")
async def get_assessment(aid: str) -> Dict[str, Any]:
    doc = await assessments_col.find_one({"id": aid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True, "row": doc}


# ── Snapshots ─────────────────────────────────────────────

@api.post("/snapshot")
async def save_snapshot(request: Request) -> Dict[str, Any]:
    body = await request.json()
    fused = body.get("fused") or {}
    if not fused:
        raise HTTPException(status_code=400, detail="Missing fused result")
    record = {
        "id": str(uuid.uuid4()),
        "created_at": now_iso(),
        "mode": body.get("mode"),            # 'face' | 'finger' | 'dual'
        "deviceType": body.get("deviceType"),
        "durationSec": body.get("durationSec"),
        "assessmentId": body.get("assessmentId"),
        "patientId": body.get("patientId"),
        "fused": fused,
        "face": body.get("face"),
        "finger": body.get("finger"),
    }
    try:
        await snapshots_col.insert_one(dict(record))
    except Exception as exc:
        logger.exception(
            "snapshot insert_one failed id=%s: %s", record["id"][:8], exc
        )
        raise HTTPException(
            status_code=500,
            detail=f"Database write failed: {type(exc).__name__}: {exc}",
        )
    logger.info(
        "snapshot saved id=%s mode=%s bpm=%s quality=%s",
        record["id"][:8], record.get("mode"),
        fused.get("bpm"), fused.get("quality"),
    )
    return {"ok": True, "id": record["id"]}


@api.get("/snapshots")
async def list_snapshots(
    limit: int = Query(50, le=500),
    offset: int = 0,
    patientId: Optional[str] = None,
) -> Dict[str, Any]:
    q: Dict[str, Any] = {}
    if patientId:
        q = {"patientId": patientId}
    cursor = (
        snapshots_col.find(q, {"_id": 0})
        .sort("created_at", -1)
        .skip(max(offset, 0))
        .limit(min(limit, 500))
    )
    rows = [_strip_snapshot(r) async for r in cursor]
    total = await snapshots_col.count_documents(q)
    return {"ok": True, "total": total, "rows": rows}


@api.get("/snapshots/{sid}")
async def get_snapshot(sid: str) -> Dict[str, Any]:
    doc = await snapshots_col.find_one({"id": sid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True, "row": doc}


# ── Logs ──────────────────────────────────────────────────

@api.post("/logs")
async def save_log(request: Request) -> Dict[str, Any]:
    body = await request.json()
    lines = body.get("lines")
    if not isinstance(lines, list) or not lines:
        raise HTTPException(status_code=400, detail="lines must be a non-empty array")
    record = {
        "id": str(uuid.uuid4()),
        "created_at": now_iso(),
        "snapshotId": body.get("snapshotId"),
        "assessmentId": body.get("assessmentId"),
        "deviceType": body.get("deviceType"),
        "userAgent": body.get("userAgent"),
        "lineCount": len(lines),
        "lines": lines,
    }
    await logs_col.insert_one(dict(record))
    return {"ok": True, "id": record["id"]}


@api.get("/logs")
async def list_logs(
    limit: int = Query(50, le=500), offset: int = 0
) -> Dict[str, Any]:
    cursor = (
        logs_col.find({}, {"_id": 0, "lines": 0})
        .sort("created_at", -1)
        .skip(max(offset, 0))
        .limit(min(limit, 500))
    )
    rows = [r async for r in cursor]
    total = await logs_col.count_documents({})
    return {"ok": True, "total": total, "rows": rows}


@api.get("/logs/{lid}")
async def get_log(lid: str) -> Dict[str, Any]:
    doc = await logs_col.find_one({"id": lid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True, "row": doc}


# ── Stats ─────────────────────────────────────────────────

@api.get("/stats")
async def stats() -> Dict[str, Any]:
    total = await snapshots_col.count_documents({})
    total_assessments = await assessments_col.count_documents({})
    total_patients = await patients_col.count_documents({})
    latest_doc = await snapshots_col.find_one(
        {}, {"_id": 0}, sort=[("created_at", -1)]
    )
    fused = (latest_doc or {}).get("fused") or {}
    return {
        "ok": True,
        "totalScans": total,
        "totalAssessments": total_assessments,
        "totalPatients": total_patients,
        "latestBpm": fused.get("bpm"),
        "latestHrv": fused.get("hrv_ms"),
        "latestSpo2": fused.get("spo2"),
        "latestBrpm": fused.get("brpm"),
        "latestAt": (latest_doc or {}).get("created_at"),
    }


# ── Patients (multi-patient mode) ─────────────────────────

@api.post("/patients")
async def create_patient(request: Request) -> Dict[str, Any]:
    body = await request.json()
    phone = (body.get("phone") or "").strip()
    sex = (body.get("sex") or "").strip()
    ethnicity = (body.get("ethnicity") or "").strip()
    if not phone:
        raise HTTPException(status_code=400, detail="phone is required")
    if not sex:
        raise HTTPException(status_code=400, detail="sex is required")
    if not ethnicity:
        raise HTTPException(status_code=400, detail="ethnicity is required")
    # Reject obvious identifiers leaking in (privacy-by-design)
    forbidden = {"name", "fullName", "firstName", "lastName", "email"}
    if any(k in body and body[k] for k in forbidden):
        raise HTTPException(
            status_code=400,
            detail="AiSteth does not accept names or email addresses (GDPR/HIPAA data-minimisation).",
        )
    code = _make_patient_code()
    record = {
        "id": str(uuid.uuid4()),
        "code": code,
        "created_at": now_iso(),
        "phone": phone,
        "sex": sex,
        "ethnicity": ethnicity,
        "dob": body.get("dob"),
        "notes": body.get("notes"),
        "color": body.get("color") or _pick_color(code),
    }
    await patients_col.insert_one(dict(record))
    logger.info("patient created id=%s code=%s", record["id"][:8], code)
    return {"ok": True, "row": record}


def _make_patient_code() -> str:
    """Pseudonymous identifier — no PII embedded. e.g. 'PT-9C4F2A'."""
    return "PT-" + secrets.token_hex(3).upper()


def _pick_color(seed: str) -> str:
    palette = ["#22D3A4", "#10B981", "#34D399", "#06B6D4", "#0EA5E9",
               "#F59E0B", "#F97316", "#EC4899", "#A855F7", "#8B5CF6"]
    h = sum(ord(c) for c in seed)
    return palette[h % len(palette)]


@api.get("/patients")
async def list_patients() -> Dict[str, Any]:
    cursor = patients_col.find({}, {"_id": 0}).sort("created_at", -1)
    rows = [r async for r in cursor]

    # Enrich all patients in parallel (avoids N×3 sequential DB round trips).
    async def _enrich(r: Dict[str, Any]) -> Dict[str, Any]:
        pid = r["id"]
        scan_count, assessment_count, latest = await asyncio.gather(
            snapshots_col.count_documents({"patientId": pid}),
            assessments_col.count_documents(
                {"$or": [{"patientId": pid}, {"profile.patientId": pid}]}
            ),
            snapshots_col.find_one({"patientId": pid}, {"_id": 0}, sort=[("created_at", -1)]),
        )
        r["scanCount"] = scan_count
        r["assessmentCount"] = assessment_count
        r["latestBpm"] = (latest or {}).get("fused", {}).get("bpm")
        r["latestAt"] = (latest or {}).get("created_at")
        return r

    rows = list(await asyncio.gather(*[_enrich(r) for r in rows]))
    return {"ok": True, "total": len(rows), "rows": rows}


@api.get("/patients/{pid}")
async def get_patient(pid: str) -> Dict[str, Any]:
    doc = await patients_col.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    # Build vitals trend (latest 50 snapshots) for the patient.
    cur = snapshots_col.find(
        {"patientId": pid}, {"_id": 0}
    ).sort("created_at", -1).limit(50)
    snaps = [_strip_snapshot(s) async for s in cur]
    # Latest assessment
    last_assessment = await assessments_col.find_one(
        {"$or": [{"patientId": pid}, {"profile.patientId": pid}]},
        {"_id": 0}, sort=[("created_at", -1)],
    )
    trend = [
        {
            "created_at": s.get("created_at"),
            "bpm": (s.get("fused") or {}).get("bpm"),
            "hrv": (s.get("fused") or {}).get("hrv_ms"),
            "spo2": (s.get("fused") or {}).get("spo2"),
            "brpm": (s.get("fused") or {}).get("brpm"),
            "quality": (s.get("fused") or {}).get("quality"),
        }
        for s in snaps
    ]
    return {
        "ok": True,
        "row": doc,
        "trend": list(reversed(trend)),  # oldest → newest for charts
        "scanCount": len(snaps),
        "latestAssessment": last_assessment,
    }


@api.delete("/patients/{pid}")
async def delete_patient(pid: str) -> Dict[str, Any]:
    res = await patients_col.delete_one({"id": pid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


# ── GDPR / HIPAA data-subject endpoints ───────────────────

@api.get("/patients/{pid}/export")
async def export_patient(pid: str) -> Dict[str, Any]:
    """GDPR Article 20 — data portability. Returns ALL data linked to the patient."""
    p = await patients_col.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    snaps = await snapshots_col.find({"patientId": pid}, {"_id": 0}).to_list(10_000)
    assess = await assessments_col.find(
        {"$or": [{"patientId": pid}, {"profile.patientId": pid}]}, {"_id": 0}
    ).to_list(10_000)
    return {
        "ok": True,
        "exported_at": now_iso(),
        "patient": p,
        "snapshots": snaps,
        "assessments": assess,
        "notice": "This export contains all personal data AiSteth holds for this pseudonymous patient code.",
    }


@api.post("/patients/{pid}/forget")
async def forget_patient(pid: str) -> Dict[str, Any]:
    """GDPR Article 17 — right to erasure. Cascade-deletes everything for this patient."""
    p = await patients_col.find_one({"id": pid})
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    s_res = await snapshots_col.delete_many({"patientId": pid})
    a_res = await assessments_col.delete_many(
        {"$or": [{"patientId": pid}, {"profile.patientId": pid}]}
    )
    await patients_col.delete_one({"id": pid})
    logger.info("patient erased pid=%s snaps=%s asses=%s", pid[:8], s_res.deleted_count, a_res.deleted_count)
    return {
        "ok": True,
        "deleted": {
            "patient": 1,
            "snapshots": s_res.deleted_count,
            "assessments": a_res.deleted_count,
        },
    }


@api.get("/privacy")
async def privacy_notice() -> Dict[str, Any]:
    return {
        "ok": True,
        "version": "1.1",
        "principles": [
            "Data minimisation — Somatic does not collect names. Email is only stored when a user explicitly requests a feature notification via the notify-me endpoint.",
            "Pseudonymisation — every patient is referenced by an opaque code (PT-XXXXXX).",
            "Local processing — the camera stream is processed in the browser; only computed vitals leave the device.",
            "Right to access — GET /api/patients/{id}/export returns all linked data.",
            "Right to erasure — POST /api/patients/{id}/forget cascade-deletes everything tied to a patient.",
            "Encryption in transit — all traffic is TLS.",
        ],
        "controller": "Somatic (self-hosted deployment)",
        "contact": "your-deployment-admin@example.org",
    }


# ── Somatic Wellness endpoints ────────────────────────────

AFFIRMATIONS: List[Dict[str, str]] = [
    {"text": "I am open to the healing power within me.", "theme": "healing"},
    {"text": "I release all tension. I am at peace.", "theme": "calm"},
    {"text": "I love and accept myself exactly as I am right now.", "theme": "self-love"},
    {"text": "My body is wise. I listen with kindness.", "theme": "body"},
    {"text": "I am safe. I am held. I am whole.", "theme": "safety"},
    {"text": "I trust the rhythm of my own becoming.", "theme": "trust"},
    {"text": "I breathe in calm. I breathe out what no longer serves me.", "theme": "breath"},
    {"text": "My heart knows the way home.", "theme": "intuition"},
    {"text": "I give myself permission to rest.", "theme": "rest"},
    {"text": "Every cell of my body is supported by love.", "theme": "love"},
    {"text": "I am willing to change. I am willing to grow.", "theme": "growth"},
    {"text": "I forgive myself for what I did not yet know.", "theme": "forgiveness"},
    {"text": "I deserve gentleness today.", "theme": "self-care"},
    {"text": "My past does not define my present.", "theme": "release"},
    {"text": "Joy is my birthright.", "theme": "joy"},
    {"text": "I am exactly where I need to be.", "theme": "presence"},
    {"text": "I welcome ease into my body.", "theme": "ease"},
    {"text": "I am the loving witness of my own life.", "theme": "presence"},
    {"text": "What I focus on grows. I focus on what nourishes me.", "theme": "focus"},
    {"text": "I am learning to soften, not to harden.", "theme": "softness"},
    {"text": "I let my breath be slower than my thoughts.", "theme": "breath"},
]

MIRROR_PROMPTS = [
    "I love and accept myself exactly as I am right now.",
    "I am worthy of love and belonging.",
    "I forgive myself for what I did not yet know.",
    "I am proud of how far I have come.",
    "I am allowed to take up space.",
    "I am safe in this body.",
]

JOURNAL_PROMPTS = [
    "What emotion have you been carrying today that you haven't named yet?",
    "What did your body try to tell you this week?",
    "When did you feel most yourself today?",
    "What would you say to a friend feeling what you feel right now?",
    "What are you ready to release?",
    "Where in your body do you feel the weight of today?",
]


def _ns_state(hrv_ms: Optional[float], hr: Optional[float] = None) -> Dict[str, Any]:
    """Map an HRV value to a nervous-system state. Wellness framing — never clinical."""
    if hrv_ms is None:
        return {
            "key": "unknown", "emoji": "⚪",
            "label": "Listening", "tone": "neutral",
            "blurb": "We need a scan to read your nervous system state.",
        }
    if hrv_ms >= 60:
        return {
            "key": "calm", "emoji": "🟢",
            "label": "Calm & Regulated", "tone": "good",
            "blurb": "Your nervous system is in a soft, open place. A beautiful moment to root in gratitude.",
        }
    if hrv_ms >= 40:
        return {
            "key": "mild", "emoji": "🟡",
            "label": "Mildly Elevated", "tone": "ok",
            "blurb": "There's a little background hum today. A few slow breaths can settle the edges.",
        }
    if hrv_ms >= 20:
        return {
            "key": "moderate", "emoji": "🟠",
            "label": "Moderately Stressed", "tone": "warn",
            "blurb": "Your body is carrying some load. This is an invitation to pause, not a judgment.",
        }
    return {
        "key": "high", "emoji": "🔴",
        "label": "High Load — Rest Recommended", "tone": "bad",
        "blurb": "Your system is pulling hard. Give yourself permission to slow down today.",
    }


@api.get("/affirmations")
async def list_affirmations() -> Dict[str, Any]:
    return {"ok": True, "total": len(AFFIRMATIONS), "rows": AFFIRMATIONS}


@api.get("/affirmations/today")
async def today_affirmation() -> Dict[str, Any]:
    from datetime import date
    day = date.today().toordinal()
    aff = AFFIRMATIONS[day % len(AFFIRMATIONS)]
    mirror = MIRROR_PROMPTS[day % len(MIRROR_PROMPTS)]
    journal = JOURNAL_PROMPTS[day % len(JOURNAL_PROMPTS)]
    return {"ok": True, "date": date.today().isoformat(), "affirmation": aff, "mirror": mirror, "journal": journal}


@api.post("/nervous-state")
async def nervous_state(request: Request) -> Dict[str, Any]:
    body = await request.json()
    return {"ok": True, "state": _ns_state(body.get("hrv_ms"), body.get("hr"))}


# ── Journal entries ───────────────────────────────────────

journal_col = db["journal_entries"]


@api.post("/journal")
async def create_journal(request: Request) -> Dict[str, Any]:
    body = await request.json()
    text = (body.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")
    record = {
        "id": str(uuid.uuid4()),
        "created_at": now_iso(),
        "text": text,
        "prompt": body.get("prompt"),
        "mood": body.get("mood"),
        "nsState": body.get("nsState"),
        "snapshotId": body.get("snapshotId"),
    }
    await journal_col.insert_one(dict(record))
    return {"ok": True, "row": record}


@api.get("/journal")
async def list_journal(limit: int = Query(50, le=500)) -> Dict[str, Any]:
    cursor = journal_col.find({}, {"_id": 0}).sort("created_at", -1).limit(min(limit, 500))
    rows = [r async for r in cursor]
    return {"ok": True, "total": len(rows), "rows": rows}


# ── Streak + practice tracking ────────────────────────────

practice_col = db["practice_log"]


@api.post("/practice")
async def log_practice(request: Request) -> Dict[str, Any]:
    body = await request.json()
    record = {
        "id": str(uuid.uuid4()),
        "created_at": now_iso(),
        "kind": body.get("kind") or "reflection",  # reflection|affirmation|breath|journal|scan
        "snapshotId": body.get("snapshotId"),
    }
    await practice_col.insert_one(dict(record))
    return {"ok": True, "row": record}


@api.get("/streak")
async def get_streak() -> Dict[str, Any]:
    """Compute current consecutive-day practice streak based on the practice log."""
    from datetime import datetime, timezone, timedelta
    cursor = practice_col.find({}, {"_id": 0, "created_at": 1}).sort("created_at", -1).limit(1000)
    days = set()
    async for r in cursor:
        try:
            d = datetime.fromisoformat(r["created_at"].replace("Z", "+00:00")).date()
            days.add(d.isoformat())
        except Exception:
            pass
    today = datetime.now(timezone.utc).date()
    streak = 0
    cur = today
    # If user hasn't practiced today, allow streak to start from yesterday (so the streak doesn't drop mid-day).
    if cur.isoformat() not in days and (cur - timedelta(days=1)).isoformat() in days:
        cur = cur - timedelta(days=1)
    while cur.isoformat() in days:
        streak += 1
        cur = cur - timedelta(days=1)
    return {"ok": True, "streak": streak, "totalDays": len(days), "today": today.isoformat()}


# ── Email capture (locked-feature interest) ────────────────

notify_col = db["notify_signups"]


@api.post("/notify-me")
async def notify_me(request: Request) -> Dict[str, Any]:
    body = await request.json()
    feature = (body.get("feature") or "").strip()
    email = (body.get("email") or "").strip()
    if not feature or not email or "@" not in email:
        raise HTTPException(status_code=400, detail="feature and a valid email are required")
    record = {
        "id": str(uuid.uuid4()),
        "created_at": now_iso(),
        "feature": feature,
        "email": email,
    }
    await notify_col.insert_one(dict(record))
    return {"ok": True}


# ── Narrative cache (Mistral) ─────────────────────────────

@api.post("/narrative")
async def generate_narrative(request: Request) -> Dict[str, Any]:
    """Returns a Mistral-generated clinical narrative for the given context.

    Caches by hash of (profile + vitals + qrisk3Score + recommendations).
    Body: { profile, vitals, qrisk3Score, recommendations, force?: bool }
    """
    body = await request.json()
    if not MISTRAL_KEY:
        raise HTTPException(status_code=503, detail="MISTRAL_KEY not configured")

    key = _narrative_key(body)
    force = bool(body.get("force"))

    if not force:
        cached = await narratives_col.find_one({"key": key}, {"_id": 0})
        if cached:
            logger.info("narrative cache HIT key=%s…", key[:10])
            return {
                "ok": True,
                "text": cached["text"],
                "cached": True,
                "key": key,
                "created_at": cached.get("created_at"),
            }

    profile = body.get("profile") or {}
    vitals = body.get("vitals") or {}
    qrisk = body.get("qrisk3Score")
    recs = body.get("recommendations") or []

    prompt = _build_prompt(profile, vitals, qrisk, recs)
    try:
        async with httpx.AsyncClient(timeout=45) as cli:
            r = await cli.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {MISTRAL_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "mistral-small-latest",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 420,
                    "temperature": 0.4,
                },
            )
        if r.status_code != 200:
            raise HTTPException(
                status_code=502, detail=f"Mistral HTTP {r.status_code}"
            )
        text = r.json()["choices"][0]["message"]["content"].strip()
    except HTTPException:
        raise
    except Exception as e:  # network/etc.
        raise HTTPException(status_code=502, detail=f"Mistral error: {e}")

    record = {
        "id": str(uuid.uuid4()),
        "key": key,
        "created_at": now_iso(),
        "profile": profile,
        "vitals": vitals,
        "qrisk3Score": qrisk,
        "recommendations": recs,
        "text": text,
    }
    await narratives_col.update_one(
        {"key": key}, {"$set": record}, upsert=True
    )
    logger.info("narrative cache MISS key=%s… stored", key[:10])
    return {
        "ok": True, "text": text, "cached": False,
        "key": key, "created_at": record["created_at"],
    }


# ── Somatic insight (Louise Hay-inspired, on-demand) ──────

def _nervous_system_label(hrv_ms: Optional[float]) -> str:
    if hrv_ms is None:
        return "Listening"
    if hrv_ms >= 60: return "Calm & Regulated"
    if hrv_ms >= 40: return "Mildly Elevated"
    if hrv_ms >= 20: return "Moderately Stressed"
    return "High Load — Rest Recommended"


def _build_insight_prompt(vitals: Dict[str, Any], state_key: Optional[str], context: Dict[str, Any]) -> str:
    bpm = vitals.get("bpm")
    hrv = vitals.get("hrv_ms")
    state_label = _nervous_system_label(hrv)
    intent = (context or {}).get("practiceIntent") or "general reflection"
    return (
        "You are a compassionate mind-body wellness companion inspired by the "
        "writing of Louise L. Hay. The user has just measured their heart and "
        "wants a gentle, somatic reflection — not medical advice. Write in second "
        "person ('you'), warm and direct. Avoid clinical/diagnostic language. "
        "Use 4-6 sentences. Include: (1) what the body might be communicating "
        "right now based on the nervous-system state, (2) one tender invitation "
        "for self-acceptance or self-compassion, (3) one simple somatic suggestion "
        "(breath, movement, mirror work, or pause). End with a short affirming "
        "sentence that begins with 'I '.\n\n"
        f"Heart rate: {bpm} bpm. HRV: {hrv} ms. Nervous-system state: {state_label}.\n"
        f"User intent: {intent}.\n"
        "Do not present this as medical advice."
    )


@api.post("/insight")
async def generate_insight(request: Request) -> Dict[str, Any]:
    """Generate a Louise Hay-inspired wellness reflection from vitals.

    Body: { snapshotId?, nervousSystemStateKey?, vitals: { bpm, hrv_ms }, context?: { practiceIntent } }
    Returns: { ok, text, cached, key }
    """
    if not MISTRAL_KEY:
        raise HTTPException(status_code=503, detail="MISTRAL_KEY not configured")
    body = await request.json()
    vitals = body.get("vitals") or {}
    state_key = body.get("nervousSystemStateKey")
    context = body.get("context") or {}
    snapshot_id = body.get("snapshotId")

    # Cache key: bucket bpm to 5bpm and hrv to 5ms to allow soft cache hits
    bpm_b = round((vitals.get("bpm") or 0) / 5) * 5
    hrv_b = round((vitals.get("hrv_ms") or 0) / 5) * 5
    cache_payload = {"bpm_b": bpm_b, "hrv_b": hrv_b, "state": state_key, "intent": context.get("practiceIntent")}
    key = hashlib.sha256(json.dumps(cache_payload, sort_keys=True).encode("utf-8")).hexdigest()

    if not body.get("force"):
        cached = await narratives_col.find_one({"key": key, "kind": "insight"}, {"_id": 0})
        if cached:
            return {"ok": True, "text": cached["text"], "cached": True, "key": key, "snapshotId": snapshot_id}

    prompt = _build_insight_prompt(vitals, state_key, context)
    try:
        async with httpx.AsyncClient(timeout=45) as cli:
            r = await cli.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers={"Authorization": f"Bearer {MISTRAL_KEY}", "Content-Type": "application/json"},
                json={
                    "model": "mistral-small-latest",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 360,
                    "temperature": 0.7,
                },
            )
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Mistral HTTP {r.status_code}")
        text = r.json()["choices"][0]["message"]["content"].strip()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Mistral error: {e}")

    record = {
        "id": str(uuid.uuid4()),
        "key": key,
        "kind": "insight",
        "created_at": now_iso(),
        "vitals": vitals,
        "state": state_key,
        "context": context,
        "text": text,
    }
    await narratives_col.update_one({"key": key, "kind": "insight"}, {"$set": record}, upsert=True)
    return {"ok": True, "text": text, "cached": False, "key": key, "snapshotId": snapshot_id}


def _build_prompt(
    profile: Dict[str, Any], vitals: Dict[str, Any],
    qrisk: Optional[float], recs: List[Any],
) -> str:
    rec_lines = "\n".join(
        f"- [{r.get('priority', '').upper() if isinstance(r, dict) else ''}] "
        f"{r.get('test', '') if isinstance(r, dict) else r}"
        for r in (recs or [])
    ) or "(none)"
    return (
        "You are a careful clinical decision-support assistant. Produce a calm, "
        "non-alarming 4-6 sentence narrative aimed at a patient (not a clinician), "
        "summarising the cardiovascular picture from the data below. Include: one "
        "sentence on the vitals, one on the risk score and what it means in plain "
        "language, one on the top 1-2 most important next steps, and a closing "
        "reassurance/encouragement. Do not invent values. End with: "
        "'This is not a diagnosis.'\n\n"
        f"Vitals: HR={vitals.get('hr')} bpm, HRV={vitals.get('hrv_ms')} ms, "
        f"SpO2={vitals.get('spo2')}%, RR={vitals.get('brpm')}/min.\n"
        f"Profile: age={profile.get('age')}, sex={profile.get('sex')}, "
        f"BMI={profile.get('bmi')}, SBP={profile.get('sbp')}, "
        f"Chol/HDL={profile.get('cholHdl')}, smoking={profile.get('smoking')}, "
        f"ethnicity={profile.get('ethnicity')}.\n"
        f"QRISK3 (10-yr CVD risk): {qrisk}%.\n"
        f"Recommendations:\n{rec_lines}"
    )


# ── Health Insights (hybrid, opt-in) ──────────────────────
# Risk scoring + Mistral structured analysis + Louise-Hay-inspired affirmations
# linked to conditions. Strictly framed as educational, NOT a diagnosis.

health_reports_col = db["health_reports"]


@api.get("/health/models")
async def health_models() -> Dict[str, Any]:
    return {"ok": True, "models": list_models()}


@api.post("/health/risk")
async def health_risk(request: Request) -> Dict[str, Any]:
    """Compute CV risk using QRISK3/SCORE2/WHO-ISH (router decides primary).

    Body: {
      region: 'uk'|'europe'|'india'|'south_asia'|'global',
      ethnicity: '...', age, sex, sbp, bmi, chol_hdl_ratio, total_cholesterol,
      hdl, townsend, smoking, diabetes_type, family_history (bool),
      treated_hypertension (bool), ckd, af, ra, migraine, sle,
      severe_mental_illness, corticosteroids, atypical_antipsychotics,
      erectile_dysfunction, score2_region, who_subregion
    }
    """
    body = await request.json()
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="invalid body")
    result = route_and_run(body)
    return {"ok": True, "result": result}


def _build_health_analysis_prompt(
    inputs: Dict[str, Any],
    risk_result: Dict[str, Any],
    vitals: Optional[Dict[str, Any]],
) -> str:
    primary = risk_result.get("primary") or {}
    secondary = risk_result.get("secondary") or []
    sec_lines = "\n".join(
        f"  - {s.get('modelUsed')}: {s.get('score')}% ({s.get('band')})"
        for s in secondary
    ) or "  (none)"
    vit = vitals or {}
    return (
        "You are a calm, careful health-education assistant. Produce STRICT JSON only — "
        "no preamble, no markdown fences. The user has just measured their heart "
        "and provided self-reported inputs for cardiovascular risk estimation.\n\n"
        "TONE RULES:\n"
        "- Do NOT diagnose. Do NOT prescribe.\n"
        "- Use plain language a non-clinician can understand.\n"
        "- Be non-alarming and respectful of self-reported uncertainty.\n"
        "- Tests/lifestyle are SUGGESTIONS to discuss with a clinician.\n"
        "- Affirmations are INSPIRED by Louise L. Hay's teachings (paraphrased — "
        "  do NOT quote her book verbatim). Each affirmation must include a 'rationale' "
        "  explaining the belief pattern she associated with that domain and why "
        "  the affirmation is a counter-belief.\n\n"
        "OUTPUT JSON SHAPE:\n"
        "{\n"
        '  "summary": "<2-3 sentence plain-language risk explanation referencing the model used>",\n'
        '  "tests": [ {"name":"...", "why":"...", "priority":"routine|soon|urgent"} ],   // exactly 3\n'
        '  "lifestyle": [ {"action":"...", "why":"...", "effortLevel":"low|moderate|high"} ], // exactly 3\n'
        '  "affirmations": [ {"text":"<first-person, present tense>", "beliefPattern":"<Louise-Hay-inspired underlying belief>", "rationale":"<why the affirmation counters it>"} ], // exactly 2\n'
        '  "disclaimer": "Not a diagnosis. Consider speaking with a clinician."\n'
        "}\n\n"
        f"Primary model: {primary.get('modelUsed')} → {primary.get('score')}% (band: {primary.get('band')}).\n"
        f"Secondary models for comparison:\n{sec_lines}\n"
        f"Inputs used: {primary.get('inputsUsed')}\n"
        f"Missing inputs: {primary.get('missingInputs')}\n"
        f"Vitals (from recent scan): HR={vit.get('bpm')} bpm, HRV={vit.get('hrv_ms')} ms.\n"
        f"User region: {inputs.get('region')}, ethnicity: {inputs.get('ethnicity')}.\n"
        "Return ONLY the JSON."
    )


def _safe_json_extract(text: str) -> Optional[Dict[str, Any]]:
    """Extract the first {...} JSON object from a string."""
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        pass
    # Heuristic extraction
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        return json.loads(text[start: end + 1])
    except Exception:
        return None


@api.post("/health/analyze")
async def health_analyze(request: Request) -> Dict[str, Any]:
    """Generate a structured Mistral health analysis (single call).

    Body: { inputs: {...}, vitals?: {bpm,hrv_ms}, snapshotId?, force? }
    """
    if not MISTRAL_KEY:
        raise HTTPException(status_code=503, detail="MISTRAL_KEY not configured")
    body = await request.json()
    inputs = body.get("inputs") or {}
    vitals = body.get("vitals") or {}
    snapshot_id = body.get("snapshotId")

    # 1) Compute risk first (deterministic).
    risk_result = route_and_run(inputs)

    # 2) Cache by SHA-256 of (key inputs + primary risk).
    primary = risk_result.get("primary") or {}
    cache_payload = {
        "inputs": {k: inputs.get(k) for k in [
            "region", "ethnicity", "age", "sex", "sbp", "bmi", "chol_hdl_ratio",
            "total_cholesterol", "hdl", "smoking", "diabetes_type",
            "family_history", "treated_hypertension", "ckd", "af",
        ]},
        "vitals": {"bpm_b": round((vitals.get("bpm") or 0) / 5) * 5,
                   "hrv_b": round((vitals.get("hrv_ms") or 0) / 5) * 5},
        "modelUsed": primary.get("modelUsed"),
        "scoreBucket": round((primary.get("score") or 0) / 2) * 2,  # 2% buckets
    }
    key = hashlib.sha256(json.dumps(cache_payload, sort_keys=True).encode("utf-8")).hexdigest()

    if not body.get("force"):
        cached = await narratives_col.find_one(
            {"key": key, "kind": "health_analysis"}, {"_id": 0}
        )
        if cached:
            return {
                "ok": True,
                "cached": True,
                "key": key,
                "risk": risk_result,
                "analysis": cached.get("analysis"),
                "snapshotId": snapshot_id,
            }

    # 3) Mistral call
    prompt = _build_health_analysis_prompt(inputs, risk_result, vitals)
    try:
        async with httpx.AsyncClient(timeout=60) as cli:
            r = await cli.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {MISTRAL_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "mistral-small-latest",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 900,
                    "temperature": 0.55,
                    "response_format": {"type": "json_object"},
                },
            )
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Mistral HTTP {r.status_code}: {r.text[:200]}")
        text = r.json()["choices"][0]["message"]["content"].strip()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Mistral error: {e}")

    analysis = _safe_json_extract(text) or {
        "summary": text,
        "tests": [],
        "lifestyle": [],
        "affirmations": [],
        "disclaimer": "Not a diagnosis. Consider speaking with a clinician.",
    }

    record = {
        "id": str(uuid.uuid4()),
        "key": key,
        "kind": "health_analysis",
        "created_at": now_iso(),
        "inputs": inputs,
        "vitals": vitals,
        "risk": risk_result,
        "analysis": analysis,
        "snapshotId": snapshot_id,
    }
    await narratives_col.update_one(
        {"key": key, "kind": "health_analysis"},
        {"$set": record},
        upsert=True,
    )

    # Also persist as a health_report (lightweight) for History
    report = {
        "id": str(uuid.uuid4()),
        "created_at": now_iso(),
        "snapshotId": snapshot_id,
        "region": inputs.get("region"),
        "ethnicity": inputs.get("ethnicity"),
        "primaryModel": primary.get("modelUsed"),
        "primaryScore": primary.get("score"),
        "primaryBand": primary.get("band"),
        "summary": analysis.get("summary"),
    }
    await health_reports_col.insert_one(dict(report))

    return {
        "ok": True,
        "cached": False,
        "key": key,
        "risk": risk_result,
        "analysis": analysis,
        "reportId": report["id"],
        "snapshotId": snapshot_id,
    }


@api.get("/health/reports")
async def list_health_reports(limit: int = Query(20, le=200)) -> Dict[str, Any]:
    cursor = health_reports_col.find({}, {"_id": 0}).sort("created_at", -1).limit(min(limit, 200))
    rows = [r async for r in cursor]
    return {"ok": True, "total": len(rows), "rows": rows}


# ── Louise-Hay-inspired condition affirmations (on-demand) ──

CONDITION_KEYS = {
    "stress", "anxiety", "hypertension_risk", "elevated_risk_score",
    "sleep", "burnout", "self_criticism", "low_motivation",
    "grief", "anger", "fear_of_change",
}


@api.post("/affirmations/condition")
async def condition_affirmation(request: Request) -> Dict[str, Any]:
    """Generate Louise-Hay-inspired affirmations for a given condition key.

    Body: { conditionKey: 'stress'|'hypertension_risk'|..., context?: {...} }
    Returns: { ok, affirmations: [{ text, rationale, beliefPattern }], conditionKey }
    """
    if not MISTRAL_KEY:
        raise HTTPException(status_code=503, detail="MISTRAL_KEY not configured")
    body = await request.json()
    key_input = (body.get("conditionKey") or "").lower().strip()
    if key_input not in CONDITION_KEYS:
        raise HTTPException(
            status_code=400,
            detail=f"conditionKey must be one of: {sorted(CONDITION_KEYS)}",
        )
    context = body.get("context") or {}

    # Soft cache by conditionKey + intent
    intent = (context.get("practiceIntent") or "").strip()
    cache_key = hashlib.sha256(
        json.dumps({"k": key_input, "i": intent}, sort_keys=True).encode("utf-8")
    ).hexdigest()
    if not body.get("force"):
        cached = await narratives_col.find_one(
            {"key": cache_key, "kind": "condition_affirmation"}, {"_id": 0}
        )
        if cached:
            return {
                "ok": True,
                "cached": True,
                "conditionKey": key_input,
                "affirmations": cached.get("affirmations") or [],
            }

    prompt = (
        "You are an affirmation guide INSPIRED by Louise L. Hay's teachings "
        "(do NOT quote her book verbatim — paraphrase the underlying belief patterns).\n\n"
        f"Condition: {key_input}\n"
        f"User intent: {intent or 'general support'}\n\n"
        "Return STRICT JSON only with this shape:\n"
        "{\n"
        '  "affirmations": [\n'
        '    {"text":"<first-person, present-tense, warm, 8-18 words>",\n'
        '     "beliefPattern":"<the Louise-Hay-inspired underlying limiting belief, 1 sentence>",\n'
        '     "rationale":"<why this affirmation counters the belief and why it makes sense, 1-2 sentences>"}\n'
        "  ]\n"
        "}\n\n"
        "Generate exactly 3 affirmations. Avoid clinical or diagnostic language."
    )
    try:
        async with httpx.AsyncClient(timeout=45) as cli:
            r = await cli.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {MISTRAL_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "mistral-small-latest",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 600,
                    "temperature": 0.7,
                    "response_format": {"type": "json_object"},
                },
            )
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Mistral HTTP {r.status_code}")
        text = r.json()["choices"][0]["message"]["content"].strip()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Mistral error: {e}")

    parsed = _safe_json_extract(text) or {"affirmations": []}
    affs = parsed.get("affirmations") or []

    record = {
        "id": str(uuid.uuid4()),
        "key": cache_key,
        "kind": "condition_affirmation",
        "created_at": now_iso(),
        "conditionKey": key_input,
        "context": context,
        "affirmations": affs,
    }
    await narratives_col.update_one(
        {"key": cache_key, "kind": "condition_affirmation"},
        {"$set": record},
        upsert=True,
    )
    return {"ok": True, "cached": False, "conditionKey": key_input, "affirmations": affs}


# ── App wiring ────────────────────────────────────────────

app.include_router(api)

# Note: middleware is applied in reverse order; CORS must wrap the API key check.
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*", "X-API-Key"],
)
app.add_middleware(_APIKeyMiddleware)

# ── Static file serving (production) ─────────────────────────────────────────
# In dev, Vite serves the frontend on :3000 and proxies /api to here.
# In production (Docker / Cloud Run), the built frontend is copied into ./static/
# and FastAPI serves everything from one process on $PORT.

STATIC_DIR = ROOT_DIR / "static"

if STATIC_DIR.exists():
    # Mount hashed Vite asset bundles — long cache headers are fine here
    for _sub in ("assets", "models", "aisteth"):
        _subdir = STATIC_DIR / _sub
        if _subdir.exists():
            app.mount(f"/{_sub}", StaticFiles(directory=_subdir), name=_sub)

    # SPA catch-all: serve exact files (aisteth.html, favicon, etc.) or
    # fall back to index.html so React Router handles the path client-side.
    @app.get("/{full_path:path}", include_in_schema=False)
    async def _serve_spa(full_path: str) -> FileResponse:
        target = STATIC_DIR / full_path
        if target.is_file():
            return FileResponse(target)
        return FileResponse(STATIC_DIR / "index.html")
