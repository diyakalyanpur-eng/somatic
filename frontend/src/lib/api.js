import axios from "axios";

// Vite exposes env vars via import.meta.env (prefix: VITE_).
// The vite.config.js also allows REACT_APP_ prefix for backward compat.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";
export const API = `${BACKEND_URL}/api`;

const defaultHeaders = {};
// If VITE_API_KEY is baked in at build time, use it immediately and persist it.
const buildApiKey = import.meta.env.VITE_API_KEY;
if (buildApiKey) {
  defaultHeaders["X-API-Key"] = buildApiKey;
  try { localStorage.setItem("somatic.apiKey", buildApiKey); } catch {}
}

export const http = axios.create({ baseURL: API, timeout: 30000, headers: defaultHeaders });

// Runtime key fallback — reads window.__somatic.apiKey (from /config.js, loaded async)
// or localStorage at request-time, so a cold-start or async script load never blocks the app.
// If VITE_API_KEY was already set above this is a no-op (header already on the instance).
if (!buildApiKey) {
  http.interceptors.request.use((cfg) => {
    const key = window.__somatic?.apiKey
             || localStorage.getItem("somatic.apiKey")
             || "";
    if (key) {
      cfg.headers["X-API-Key"] = key;
      // Persist so subsequent requests and standalone pages always have it.
      try { localStorage.setItem("somatic.apiKey", key); } catch {}
    }
    return cfg;
  });
}

export const getStats = async () => (await http.get("/stats")).data;
export const listSnapshots = async (opts = {}) => (await http.get("/snapshots", { params: opts })).data;
export const getSnapshot = async (id) => (await http.get(`/snapshots/${id}`)).data;
export const listAssessments = async (opts = {}) => (await http.get("/assessments", { params: opts })).data;
export const getAffirmationToday = async () => (await http.get("/affirmations/today")).data;
export const listAffirmations = async () => (await http.get("/affirmations")).data;
export const getStreak = async () => (await http.get("/streak")).data;
export const logPractice = async (kind, extra = {}) => (await http.post("/practice", { kind, ...extra })).data;
export const createJournal = async (payload) => (await http.post("/journal", payload)).data;
export const listJournal = async () => (await http.get("/journal")).data;
export const notifyMe = async (feature, email) => (await http.post("/notify-me", { feature, email })).data;
export const generateNarrative = async (payload) => (await http.post("/narrative", payload)).data;
export const generateInsight = async (payload) => (await http.post("/insight", payload)).data;

// Health Insights (Phase 7)
export const listRiskModels = async () => (await http.get("/health/models")).data;
export const computeHealthRisk = async (inputs) => (await http.post("/health/risk", inputs)).data;
export const analyzeHealth = async (payload) => (await http.post("/health/analyze", payload)).data;
export const listHealthReports = async (opts = {}) => (await http.get("/health/reports", { params: opts })).data;
export const conditionAffirmation = async (payload) => (await http.post("/affirmations/condition", payload)).data;
