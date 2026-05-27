// Port of the QRISK3 algorithm from main.js to React-side JS.
// Used by the consumer Assessment page so risk calculation is not gated
// behind a successful rPPG camera lock.

export const ETHNICITY_OPTIONS = [
  { value: "white", label: "White / not stated" },
  { value: "indian", label: "Indian" },
  { value: "pakistani", label: "Pakistani" },
  { value: "bangladeshi", label: "Bangladeshi" },
  { value: "other_asian", label: "Other Asian" },
  { value: "black_caribbean", label: "Black Caribbean" },
  { value: "black_african", label: "Black African" },
  { value: "chinese", label: "Chinese" },
  { value: "other", label: "Mixed / other" },
];

export const SMOKING_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "ex", label: "Ex-smoker" },
  { value: "light", label: "Light (<10/day)" },
  { value: "moderate", label: "Moderate (10–19/day)" },
  { value: "heavy", label: "Heavy (≥20/day)" },
];

export const BOOL_KEYS = [
  "type1Dm","type2Dm","af","treatedHtn","familyHistory","ckd",
  "ra","sle","severeMental","erectileDysfunction","corticosteroids","migraine","atypicalAp",
];

export const CONDITION_LABELS = {
  type1Dm: "Type 1 diabetes",
  type2Dm: "Type 2 diabetes",
  af: "Atrial fibrillation",
  treatedHtn: "Treated hypertension",
  familyHistory: "Family history of heart disease (parent < 60)",
  ckd: "Chronic kidney disease",
  ra: "Rheumatoid arthritis",
  sle: "Lupus (SLE)",
  severeMental: "Severe mental illness",
  erectileDysfunction: "Erectile dysfunction",
  corticosteroids: "Long-term steroid use",
  migraine: "Migraine",
  atypicalAp: "Atypical antipsychotic",
};

const QCOEFF = {
  male: {
    age: 0.0672,
    ethnicity: { white: 0, indian: 0.3070, pakistani: 0.2790, bangladeshi: 0.5430, chinese: -0.2490, other_asian: 0.1630, black_caribbean: -0.1729, black_african: -0.5329, other: -0.0798 },
    smoking: { never: 0, ex: 0.1885, light: 0.5996, moderate: 0.7318, heavy: 0.8764 },
    sbp: 0.0102, chol_hdl: 0.1532, bmi: 0.0181, townsend: 0.0292,
    type1Dm: 1.3531, type2Dm: 0.8574, af: 0.8838, treatedHtn: 0.5098,
    familyHistory: 0.4533, ckd: 0.4580, ra: 0.2521, sle: 0.7525,
    severeMental: 0.2756, erectileDysfunction: 0.3359,
    corticosteroids: 0.5499, migraine: 0.3012, atypicalAp: 0.1335,
    baseline: 0.977268,
  },
  female: {
    age: 0.0688,
    ethnicity: { white: 0, indian: 0.2942, pakistani: 0.4024, bangladeshi: 0.4050, chinese: -0.1860, other_asian: 0.1630, black_caribbean: -0.3562, black_african: -0.4108, other: -0.0250 },
    smoking: { never: 0, ex: 0.1528, light: 0.5673, moderate: 0.7351, heavy: 0.8786 },
    sbp: 0.0133, chol_hdl: 0.1841, bmi: 0.0283, townsend: 0.0332,
    type1Dm: 1.7860, type2Dm: 1.1237, af: 1.2029, treatedHtn: 0.5765,
    familyHistory: 0.4583, ckd: 0.6847, ra: 0.2165, sle: 0.7589,
    severeMental: 0.2736, erectileDysfunction: 0,
    corticosteroids: 0.6103, migraine: 0.3012, atypicalAp: 0.1335,
    baseline: 0.988876,
  },
};

export function bmiFromHW(heightCm, weightKg) {
  const h = parseFloat(heightCm), w = parseFloat(weightKg);
  if (!(h > 0) || !(w > 0)) return null;
  return Math.round((w / Math.pow(h / 100, 2)) * 10) / 10;
}

export function calcQRISK3(p) {
  const sex = p.sex === "female" ? "female" : "male";
  const c = QCOEFF[sex];
  let s = 0;
  s += c.age      * ((p.age      ?? 50) - 50);
  s += c.ethnicity[p.ethnicity] ?? 0;
  s += c.smoking[p.smoking]     ?? 0;
  s += c.sbp      * ((p.sbp      ?? 120) - 120);
  s += c.chol_hdl * ((p.cholHdl  ?? 4.4) - 4.4);
  s += c.bmi      * ((p.bmi      ?? 27)  - 27);
  s += c.townsend * (p.townsend  ?? 0);
  BOOL_KEYS.forEach((k) => { if (p[k]) s += (c[k] || 0); });
  const raw = (1 - Math.pow(c.baseline, Math.exp(s))) * 100;
  return Math.round(Math.min(Math.max(raw, 0.1), 99.9) * 10) / 10;
}

export function riskBand(qrisk) {
  if (qrisk == null || Number.isNaN(qrisk)) return { label: "Unknown", color: "#9FB8B0", advice: "Complete the questionnaire for a personalised risk." };
  if (qrisk < 5) return { label: "Low", color: "#22D3A4", advice: "You're in the low-risk band. Keep up your healthy habits and re-check yearly." };
  if (qrisk < 10) return { label: "Borderline", color: "#06B6D4", advice: "You're borderline. Small lifestyle improvements now can keep you in the low band." };
  if (qrisk < 20) return { label: "Moderate", color: "#F59E0B", advice: "Moderate 10-year cardiovascular risk — a clinician review of lipids and BP is recommended." };
  return { label: "High", color: "#FF6E76", advice: "High 10-year risk — please discuss with a qualified clinician about a full prevention plan." };
}

export function generateRecs(p, qrisk, vitals = {}) {
  const recs = [];
  const add = (priority, area, test, reason) => recs.push({ priority, area, test, reason });
  if (qrisk >= 20) {
    add("urgent", "Cardiology", "Urgent cardiology review", `10-yr CVD risk ${qrisk}% (High) — specialist assessment is recommended.`);
    add("urgent", "Blood test", "Fasting lipid panel + hsCRP", "To assess whether cholesterol-lowering therapy is needed.");
    add("soon", "Imaging", "Echocardiogram", "Structural heart evaluation for a high-risk profile.");
  } else if (qrisk >= 10) {
    add("soon", "Blood test", "Fasting lipid panel", `10-yr CVD risk ${qrisk}% (Moderate) — baseline lipids guide preventive treatment.`);
    add("soon", "Primary care", "Home blood-pressure monitoring (7 days)", "Confirm your usual BP outside clinic before treatment decisions.");
    add("routine", "Primary care", "Lifestyle review", "Diet, activity, sleep — the biggest free wins.");
  } else {
    add("routine", "Primary care", "Annual cardiovascular check", `10-yr CVD risk ${qrisk}% (Low) — keep an eye on the basics each year.`);
  }
  if (p.af) add("urgent", "Cardiology", "Stroke-risk review for AF", "Atrial fibrillation increases stroke risk — anticoagulation may be indicated.");
  if (p.type1Dm || p.type2Dm) add("soon", "Blood test", "HbA1c + kidney function", "Diabetes — monitor glycaemic control and kidneys.");
  if (p.treatedHtn) add("soon", "Primary care", "BP control review", "Treated hypertension — confirm target BP is being reached.");
  if (p.ckd) add("soon", "Kidneys", "Renal function panel", "CKD raises cardiovascular risk — track GFR.");
  const hr = vitals.hr, sp = vitals.spo2, hrv = vitals.hrv_ms;
  if (sp != null && sp < 95) add("urgent", "Lungs", "Oxygen saturation review", `SpO₂ ${sp}% — below normal range.`);
  if (hr != null && hr > 100) add("soon", "Cardiology", "ECG + Holter", `Resting HR ${hr} bpm — persistent tachycardia.`);
  if (hr != null && hr < 50) add("soon", "Cardiology", "ECG + cardiology review", `Resting HR ${hr} bpm — bradycardia.`);
  if (hrv != null && hrv < 20) add("routine", "Cardiology", "Autonomic function review", `Low HRV (${hrv} ms) — lower autonomic tone.`);
  const seen = new Set();
  const ord = { urgent: 0, soon: 1, routine: 2 };
  return recs.filter((r) => { if (seen.has(r.test)) return false; seen.add(r.test); return true; }).sort((a, b) => ord[a.priority] - ord[b.priority]);
}
