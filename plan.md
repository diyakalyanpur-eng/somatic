# Somatic (FARM) — Development Plan (Updated)

## 1) Objectives
- ✅ **Clinical MVP completed (legacy):** FastAPI + MongoDB backend, rPPG/Three.js scanner, multi-patient mode, QRISK3, AI narrative caching.
- ✅ **Major pivot to Somatic (React shell):** React UI is now a **mind-body wellness companion** with dark mode and Somatic screens: **Onboarding, Home, Scan, Results, Reflect, History, Profile**.
- ✅ **User model (single-user, local-only):** First name captured on onboarding and stored in **localStorage** (no PII sent to backend).
- ✅ **Somatic visuals:** Deep space black `#0A0A0F`, rose `#E8445A`, amber `#F5C87A`; 3D heart is prominent on Home/Scan/Results.
- ✅ **Somatic scan alignment shipped (P0):** The legacy clinical scanner page was rewritten into a **Somatic-themed scan experience** (`/aisteth.html` + `/public/aisteth/main.js`) that:
  - does **not** reference clinical DOM IDs (QRISK3/BMI/Townsend/profile sheet)
  - saves a **snapshot** to backend and navigates to **`/results/:id`**
- ✅ **On-demand insight (Somatic):** `POST /api/insight` added; Results screen includes “Get a deeper insight” and renders Louise Hay–inspired wellness reflection via **Mistral**.
- 🟨 **Storage pivot (planned):** Transition persistence from MongoDB → **Firestore (documents) + Cloud Storage (media)**.
  - Constraint: credentials will be added by the user later; do not block current functionality.
- 🟨 **Manual live camera test:** Validate rPPG/PPG flow on a real phone (hardware-dependent).
- 🟨 **Hybrid expansion:** Add a separate opt-in surface, **Health Insights**, to re-introduce **risk scoring + clinical-style recommendations** while keeping Somatic as primary wellness UX.
  - No FDA/MHRA clearance claims.
  - BP-from-camera is not presented as measurement; any estimate is explicitly directional.

---

## 2) Implementation Steps

### Phase 1 — Core POC (Isolation: Mistral + Mongo round-trip) [Legacy]
**Why:** External AI + strict backend contract + nested document shapes.

**User stories (POC)**
1. ✅ As a developer, I can call Mistral with the real key and receive non-empty text.
2. ✅ As a developer, I can insert and retrieve an assessment document with nested shape.
3. ✅ As a developer, I can insert and retrieve a snapshot record (including optional full samples).
4. ✅ As a developer, I can insert and retrieve session logs.
5. ✅ As a developer, I can assert API serialization format (UUID ids, ISO timestamps).

**Steps (implemented)**
- ✅ Added `MISTRAL_KEY` to `/app/backend/.env`.
- ✅ Created `/app/backend/scripts/poc_core.py` and validated Mongo + Mistral.

**Acceptance (met)**
- ✅ `python scripts/poc_core.py` exits 0 and prints `POC PASS`.

---

### Phase 2 — V1 App Development (Backend + React shell + static scan page) [Legacy]

#### Phase 2A — Backend: FastAPI contract parity
**Status:** ✅ done.

#### Phase 2B — Static scan page: preserve vanilla JS + GLB path patch (Legacy scanner)
**Status:** ✅ done originally, then superseded by Phase 6 rewrite.

#### Phase 2C — React shell: onboarding + history (Legacy)
**Status:** superseded by Somatic UI pivot.

---

### Phase 3 — Enhancements Delivered (multi-patient + AI caching + redesign + 3D polish) [Legacy]
**Status:** ✅ Completed; deprecated by Somatic pivot (do not expand).

---

### Phase 4 — Product Pivot: Somatic React UI (Wellness) ✅
**What shipped**
- ✅ New React routes/pages:
  - `/onboarding`, `/` (Home), `/scan`, `/results/:id`, `/reflect(/:id)`, `/history`, `/profile`.
- ✅ New theme applied (deep black/rose/amber).
- ✅ 3D heart component (`BeatingHeart3D`) uses rose glow and appears prominently.
- ✅ Single-user onboarding gate using `localStorage` profile (`somatic.profile`).

---

### Phase 5 — Somatic Backend Foundations ✅
**Already available**
- ✅ `GET /api/affirmations`, `GET /api/affirmations/today`
- ✅ `POST /api/journal`, `GET /api/journal`
- ✅ `POST /api/practice`, `GET /api/streak`
- ✅ `POST /api/notify-me`
- ✅ Snapshots: `POST /api/snapshot`, `GET /api/snapshots`, `GET /api/snapshots/:id`

---

### Phase 6 — Somatic Pivot Alignment (P0) ✅ COMPLETED
**Goal:** End-to-end Somatic loop: **Measure → Understand → Practice → Repeat**.

**What shipped**
- ✅ `/aisteth.html` rewritten into Somatic scan UI (Face/Finger, countdown ring, Somatic HUD)
- ✅ `/public/aisteth/main.js` rewritten lean; clinical logic removed
- ✅ Snapshot save + redirect to `/results/:id`
- ✅ `POST /api/insight` (Louise Hay–inspired reflection) + Results UI integration
- ✅ Testing completed (iteration_6 report: backend 17/17, frontend core flows pass)

**Known limitation (explicit)**
- 🟨 Live camera signal quality requires manual phone testing.

---

### Phase 7 — Hybrid Expansion: **Health Insights** (P1) ✅ COMPLETED
**Why:** Provide optional risk scoring and test/lifestyle recommendations without replacing the Somatic wellness core.

**Product principle**
- Somatic remains the default, gentle wellness companion.
- **Health Insights is explicitly opt-in** and uses a different tone: factual, cautious, non-alarming.
- All outputs include: “Not a diagnosis. Consider speaking with a clinician.”

#### Phase 7A — UX: Add a dedicated “Health Insights” tab/section
**User stories**
1. As a user, I can opt into Health Insights from the main navigation.
2. As a user, I can enter a minimal health profile needed for risk scoring.
3. As a user, I can see a risk summary + recommended tests + lifestyle changes.
4. As a user, I can still access Louise-Hay-inspired affirmations that are framed as wellness support.

**Implementation steps**
- Add a new route and navigation item:
  - `GET /health` (or `/insights/health`) — Health Insights home
  - `GET /health/profile` — data entry form
  - `GET /health/report/:id` — report viewer
- Keep Somatic tone separation via UI labels:
  - “Wellness Reflection” (Somatic)
  - “Health Insights (opt-in)” (risk + recommendations)

#### Phase 7B — Data model (single-user, no PII)
**Constraints**
- First name stays local-only.
- Do not send full identity to backend.

**Data structures**
- LocalStorage (client):
  - `somatic.healthProfile` — user-entered risk inputs
- Backend (DB):
  - `health_reports` collection (Mongo for now; later Firestore)
    - `{ id, created_at, snapshotId?, inputs, risk, recommendations, aiAnalysis }`

#### Phase 7C — Risk engines: QRISK3 + SCORE2 + WHO/ISH (auto-routing)
**Decision (confirmed):** implement **QRISK3 + SCORE2 + WHO/ISH** with auto-routing by country/ethnicity, and allow a **Mistral “regional adjustment” note** when appropriate.

**User stories**
1. As a user, I can choose my region/country and ethnicity.
2. As a user, the app selects an appropriate risk model and explains what model was used.
3. As a user, I see uncertainty/limitations clearly (especially when inputs are missing).

**Implementation steps**
- Implement model selection rules (v1):
  - UK (or user selects QRISK): QRISK3
  - Europe (ESC region selection): SCORE2 / SCORE2-OP (age-dependent)
  - India: WHO/ISH charts (regional band) + explanation of limitations
- Create backend endpoint:
  - `POST /api/health/risk` → computes structured risk output
- Ensure traceability:
  - Response includes `{ modelUsed, inputsUsed, missingInputs, limitations[] }`

#### Phase 7D — Mistral single-call Health Analysis (structured)
**Decision (confirmed):** single-call Mistral analysis.

**User stories**
1. As a user, I can tap “Generate Health Insights” and receive:
   - risk explanation (plain language)
   - 3 tests to consider
   - 3 lifestyle changes
   - 2 Louise-Hay-inspired affirmations + “why this makes sense” explanation
2. As a user, the output avoids alarmist language and avoids pretending to be a clinician.

**Implementation steps**
- Backend endpoint:
  - `POST /api/health/analyze`
  - Input: `{ snapshotId?, vitals, riskResult, manualInputs, region, ethnicity }`
  - Output: `{ ok, analysis: { summary, tests[], lifestyle[], affirmations[] } }`
- Prompting rules:
  - Always include “not medical advice” line.
  - Explicitly state when values are self-reported.
  - Louise Hay content is **inspired/paraphrased**, not quoted.

#### Phase 7E — Louise Hay–inspired condition affirmations (generated)
**Decision (confirmed):** Mistral generates **Louise-Hay-inspired** affirmations per condition + explanation.

**Implementation steps**
- Define a small controlled vocabulary of “conditions” (e.g., stress, hypertension-risk, elevated risk score, sleep issues) to avoid over-medicalization.
- Add endpoint:
  - `POST /api/affirmations/condition`
  - Input: `{ conditionKey, context }`
  - Output: `{ ok, affirmations: [{ text, rationale, beliefPattern }] }`

#### Phase 7F — BP/cholesterol handling (honest + useful)
**Decisions (confirmed)**
- Users can enter “last remembered” BP and cholesterol values.
- No false claims: camera-based BP is not treated as a clinical measurement.

**Implementation steps (P1)**
- Add fields to Health Profile:
  - BP (SBP/DBP, last known)
  - Total cholesterol + HDL (or ratio)
  - Meds flags (statin, antihypertensive) if relevant for risk models
- Provide “unknown” option; risk computations should report missing inputs.

#### Phase 7G — Research follow-up: camera-based BP estimate (P2 / deferred)
**Explicitly deferred** per your request to do it later as research-grade.

**Rationale**
- Accurate BP from PPG/rPPG generally requires calibration and/or validated models.

**Implementation outline (later)**
- Add an optional “BP estimate” feature:
  - user enters cuff BP as anchor
  - model estimates relative changes; clearly labeled “directional estimate”
- Only enable behind a feature flag.

---

### Phase 8 — Storage Migration: Firestore + Cloud Storage (P1) 🟨
**Goal:** Switch persistence from Mongo to Firestore/Storage once credentials are supplied.

**Implementation steps**
- Add `firebase-admin` + `google-cloud-storage` to backend deps.
- Implement a repository abstraction (`MongoRepo` / `FirestoreRepo`) and choose based on env var.
- Migrate collections:
  - snapshots, journals, practice logs, health reports, narratives (insight cache)

---

## 3) Next Actions
1. ✅ (Done) Somatic scan alignment, snapshot routing, on-demand insight.
2. 🟨 **Manual phone test** of `/aisteth.html` (Face + Finger) in real lighting.
3. 🟨 Build **Phase 7A–7D** Health Insights MVP:
   - new Health Insights screens
   - risk engine endpoint(s)
   - single-call Mistral analysis endpoint
4. 🟨 Add Health Profile form and localStorage persistence for inputs.
5. 🟨 Defer camera-based BP estimation to Phase 7G.
6. 🟨 When ready, provide Firebase credentials and proceed with Phase 8 migration.

---

## 4) Success Criteria
- ✅ Somatic remains the primary UX: onboarding → home → scan → results → reflect → history.
- ✅ Scanner is stable, Somatic-themed, saves snapshots, routes to Results.
- ✅ On-demand “Get Insight” returns Louise Hay–inspired text and avoids diagnostic language.
- 🟨 Manual phone test confirms: permissions, stable readings, heart pulse sync, clean teardown.
- 🟨 Health Insights (opt-in) ships:
  - user-entered profile + region/ethnicity
  - risk model selection (QRISK3/SCORE2/WHO-ISH) with transparency
  - Mistral single-call structured output: tests + lifestyle + affirmations (inspired/paraphrased)
  - clear disclaimers and no regulatory/medical device claims
- 🟨 Storage can migrate to Firestore/Cloud Storage when credentials are provided, without frontend contract changes.
