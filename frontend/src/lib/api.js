import axios from "axios";

// Vite exposes env vars via import.meta.env (prefix: VITE_).
// The vite.config.js also allows REACT_APP_ prefix for backward compat.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";
export const API = `${BACKEND_URL}/api`;

const defaultHeaders = {};
// Attach API key — must match API_KEY in backend/.env.
const apiKey = import.meta.env.VITE_API_KEY;
if (apiKey) {
  defaultHeaders["X-API-Key"] = apiKey;
}

export const http = axios.create({ baseURL: API, timeout: 30000, headers: defaultHeaders });

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
