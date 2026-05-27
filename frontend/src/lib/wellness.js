// Local wellness helpers — profile (localStorage), latest BPM, scan summary.

const PROFILE_KEY = "somatic.profile";
const LAST_BPM_KEY = "somatic.lastBpm";
const LAST_HRV_KEY = "somatic.lastHrv";

export function getProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"); } catch { return null; }
}
export function setProfile(p) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch {}
}
export function clearProfile() {
  try { localStorage.removeItem(PROFILE_KEY); } catch {}
}

export function getLatestBpm() {
  try { const v = parseInt(localStorage.getItem(LAST_BPM_KEY) || "", 10); return Number.isFinite(v) ? v : null; } catch { return null; }
}
export function setLatestVitals({ bpm, hrv_ms }) {
  try {
    if (bpm != null) localStorage.setItem(LAST_BPM_KEY, String(bpm));
    if (hrv_ms != null) localStorage.setItem(LAST_HRV_KEY, String(hrv_ms));
  } catch {}
}
export function getLatestHrv() {
  try { const v = parseInt(localStorage.getItem(LAST_HRV_KEY) || "", 10); return Number.isFinite(v) ? v : null; } catch { return null; }
}

export function nervousSystemState(hrv_ms) {
  if (hrv_ms == null) return { key: "unknown", label: "Listening", emoji: "⚪", color: "#8A8280", tone: "neutral", blurb: "We need a scan to read your nervous system state." };
  if (hrv_ms >= 60) return { key: "calm", label: "Calm & Regulated", emoji: "🟢", color: "#7DD3A0", tone: "good", blurb: "Your nervous system is in a soft, open place. A beautiful moment to root in gratitude." };
  if (hrv_ms >= 40) return { key: "mild", label: "Mildly Elevated", emoji: "🟡", color: "#F5C87A", tone: "ok", blurb: "There's a little background hum today. A few slow breaths can settle the edges." };
  if (hrv_ms >= 20) return { key: "moderate", label: "Moderately Stressed", emoji: "🟠", color: "#F5A972", tone: "warn", blurb: "Your body is carrying some load. This is an invitation to pause, not a judgment." };
  return { key: "high", label: "High Load — Rest Recommended", emoji: "🔴", color: "#E8445A", tone: "bad", blurb: "Your system is pulling hard. Give yourself permission to slow down today." };
}

export function emotionalReflection(state, bpm, hrv) {
  const map = {
    calm: "A regulated heart often signals that you've been kind to yourself today. Notice what choices brought you here — and let your body remember them.",
    mild: "A slightly elevated nervous system may carry quiet anticipation or unprocessed thought. There is no urgency to fix it — only an invitation to notice.",
    moderate: "High stress load often accompanies patterns of over-responsibility or fear of loss. This is not a judgment — it's an invitation to pause.",
    high: "Your body is asking you to slow down. Old patterns of striving and not-enoughness can show up here. Consider what would feel like permission, not push.",
    unknown: "Once we hear your heart, we can offer a gentle reflection.",
  };
  return map[state.key] || map.unknown;
}

export function timeAwareGreeting(name) {
  const h = new Date().getHours();
  const n = name ? `, ${name}` : "";
  if (h < 5) return `Resting hours${n}`;
  if (h < 12) return `Good morning${n}`;
  if (h < 17) return `Good afternoon${n}`;
  if (h < 21) return `Good evening${n}`;
  return `Soft night${n}`;
}

// ── Health Insights (Phase 7) ─────────────────────────────
const HEALTH_PROFILE_KEY = "somatic.healthProfile";
const HEALTH_OPTIN_KEY = "somatic.healthOptedIn";

export function getHealthProfile() {
  try { return JSON.parse(localStorage.getItem(HEALTH_PROFILE_KEY) || "null"); } catch { return null; }
}
export function setHealthProfile(p) {
  try { localStorage.setItem(HEALTH_PROFILE_KEY, JSON.stringify(p)); } catch {}
}
export function clearHealthProfile() {
  try { localStorage.removeItem(HEALTH_PROFILE_KEY); } catch {}
}
export function isHealthOptedIn() {
  try { return localStorage.getItem(HEALTH_OPTIN_KEY) === "1"; } catch { return false; }
}
export function setHealthOptedIn(v) {
  try { localStorage.setItem(HEALTH_OPTIN_KEY, v ? "1" : "0"); } catch {}
}
