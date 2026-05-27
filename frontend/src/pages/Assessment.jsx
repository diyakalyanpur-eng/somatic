import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, Activity, Droplet, Wind, Camera, Sparkles, ChevronRight, ArrowLeft, ScanLine, Save, Calculator, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import BeatingHeart3D from "@/components/BeatingHeart3D";
import {
  calcQRISK3, riskBand, generateRecs, bmiFromHW,
  ETHNICITY_OPTIONS, SMOKING_OPTIONS, BOOL_KEYS, CONDITION_LABELS,
} from "@/lib/qrisk3";
import { getPatient, http } from "@/lib/api";

function band(q) { return riskBand(q); }

const CONSUMER_FRIENDLY_RECS = {
  urgent: { tag: "See a doctor soon", color: "#FF6E76" },
  soon: { tag: "Worth booking", color: "#F59E0B" },
  routine: { tag: "Good to know", color: "#22D3A4" },
};

export default function Assessment() {
  const { id: patientId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);

  // ── Profile state (consumer language inputs) ──
  const [form, setForm] = useState({
    age: 45,
    sex: "male",
    ethnicity: "white",
    height: 172,
    weight: 72,
    sbp: 128,
    cholHdl: 4.2,
    smoking: "never",
    townsend: 0,
    type1Dm: false, type2Dm: false, af: false, treatedHtn: false,
    familyHistory: false, ckd: false, ra: false, sle: false,
    severeMental: false, erectileDysfunction: false,
    corticosteroids: false, migraine: false, atypicalAp: false,
  });

  // ── Vitals (from scan or manual) ──
  const [vitals, setVitals] = useState({ hr: 72, hrv_ms: 42, spo2: 98, brpm: 14 });

  // ── Result ──
  const [result, setResult] = useState(null); // { qrisk, recs }
  const [aiText, setAiText] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load patient context if linked
  useEffect(() => {
    if (!patientId) return;
    (async () => {
      try {
        const d = await getPatient(patientId);
        setPatient(d.row);
        // Prefill from patient where possible
        setForm((f) => ({
          ...f,
          sex: (d.row.sex && d.row.sex !== "other") ? d.row.sex : f.sex,
          ethnicity: mapEthnicity(d.row.ethnicity) || f.ethnicity,
        }));
        // Use latest snapshot vitals if any
        const t = d.trend || [];
        if (t.length) {
          const v = t[t.length - 1];
          setVitals({ hr: v.bpm ?? 72, hrv_ms: v.hrv ?? 42, spo2: v.spo2 ?? 98, brpm: v.brpm ?? 14 });
        }
      } catch { /* silent */ }
    })();
  }, [patientId]);

  const bmi = useMemo(() => bmiFromHW(form.height, form.weight), [form.height, form.weight]);

  const handleCalculate = () => {
    const profile = {
      ...form,
      bmi: bmi ?? 27,
      smoking: form.smoking,
    };
    const qrisk = calcQRISK3(profile);
    const recs = generateRecs(profile, qrisk, vitals);
    setResult({ qrisk, recs, profile });
    setAiText(null);
    setTimeout(() => document.getElementById("result-card")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  const handleAi = async () => {
    if (!result) return;
    setAiBusy(true);
    try {
      const { data } = await http.post("/narrative", {
        profile: { ...result.profile, age: form.age, sex: form.sex, ethnicity: form.ethnicity, bmi: bmi, sbp: form.sbp, cholHdl: form.cholHdl, smoking: form.smoking },
        vitals,
        qrisk3Score: result.qrisk,
        recommendations: result.recs,
      });
      setAiText(data.text);
    } catch (e) {
      toast.error("AI insights unavailable right now");
    } finally { setAiBusy(false); }
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await http.post("/save-assessment", {
        profile: { ...result.profile, age: form.age, sex: form.sex, ethnicity: form.ethnicity, bmi: bmi, heightCm: form.height, weightKg: form.weight, sbp: form.sbp, cholHdl: form.cholHdl, smoking: form.smoking, patientId },
        patientId,
        vitals,
        qrisk3Score: result.qrisk,
        recommendations: result.recs,
        aiNarrative: aiText,
      });
      toast.success("Assessment saved to history");
      navigate(patientId ? `/patients/${patientId}` : "/history");
    } catch (e) {
      toast.error("Save failed");
    } finally { setSaving(false); }
  };

  const ribbon = band(result?.qrisk);

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 h-[260px] bg-top-band pointer-events-none" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">

        <button
          type="button"
          onClick={() => navigate(patientId ? `/patients/${patientId}` : "/")}
          className="inline-flex items-center gap-1.5 text-sm text-[#9FB8B0] hover:text-[#E6FBF3] mb-4"
          data-testid="assess-back"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* Left: hero with beating heart + live vitals */}
          <div className="lg:col-span-5 lg:sticky lg:top-20">
            <div className="rounded-3xl bg-[#0B1E22] border border-[#13343A] p-5 sm:p-6 overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-[#6F8B83]">Digital Twin</div>
                  <h2 className="display text-xl font-semibold tracking-tight">Your beating heart</h2>
                </div>
                {patient && (
                  <span className="text-[10px] font-mono tracking-wider px-2 py-1 rounded-full bg-[#04121A] border border-[#13343A] text-[#9FB8B0]">
                    {patient.code || "PT-?"}
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center justify-center" data-testid="assess-heart-wrap">
                <BeatingHeart3D bpm={vitals.hr || 72} hrv={vitals.hrv_ms || 42} size={300} />
              </div>
              <div className="mt-2 text-center">
                <div className="display text-5xl font-semibold tracking-tight" data-testid="assess-hero-hr">{vitals.hr ?? 72}</div>
                <div className="text-[11px] uppercase tracking-wider text-[#9FB8B0]">bpm · beating in sync with your heart</div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Vital icon={<Heart className="w-3.5 h-3.5 text-[#22D3A4]" />} label="HR" value={`${vitals.hr ?? "—"} bpm`} />
                <Vital icon={<Activity className="w-3.5 h-3.5 text-[#06B6D4]" />} label="HRV" value={`${vitals.hrv_ms ?? "—"} ms`} />
                <Vital icon={<Droplet className="w-3.5 h-3.5 text-[#06B6D4]" />} label="SpO₂" value={`${vitals.spo2 ?? "—"}%`} />
                <Vital icon={<Wind className="w-3.5 h-3.5 text-[#22D3A4]" />} label="Resp" value={`${vitals.brpm ?? "—"}/min`} />
              </div>
              <div className="mt-4 rounded-xl bg-[#04121A] border border-[#13343A] p-3">
                <div className="text-[11px] uppercase tracking-wider text-[#6F8B83] mb-1.5">Set your heart rate</div>
                <input
                  type="range" min="40" max="180" value={vitals.hr ?? 72}
                  onChange={(e) => setVitals(v => ({ ...v, hr: parseInt(e.target.value, 10) }))}
                  className="w-full accent-[#22D3A4]"
                  data-testid="assess-hr-slider"
                />
                <div className="flex justify-between text-[10px] text-[#6F8B83] mt-1"><span>40</span><span>110</span><span>180</span></div>
              </div>
              <button
                onClick={() => {
                  const u = new URLSearchParams();
                  if (patient?.id) u.set("patientId", patient.id);
                  if (patient?.code) u.set("patientCode", patient.code);
                  window.location.href = `/aisteth.html${u.toString() ? `?${u}` : ""}`;
                }}
                className="mt-3 w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-xl bg-[#0F2027] border border-[#13343A] hover:bg-[#13343A] text-sm"
                data-testid="assess-live-scan"
              >
                <Camera className="w-4 h-4" /> Or run a 30-second camera scan
              </button>
            </div>
          </div>

          {/* Right: questionnaire + result */}
          <div className="lg:col-span-7 space-y-5">
            <div className="rounded-3xl bg-[#0B1E22] border border-[#13343A] p-5 sm:p-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="inline-flex items-center gap-1.5 mb-1 px-2 py-0.5 rounded-full border border-[#13343A] bg-[#04121A] text-[10px] uppercase tracking-wider text-[#9FB8B0]">
                    <ShieldCheck className="w-3 h-3 text-[#22D3A4]" /> Anonymous · plain-language
                  </div>
                  <h2 className="display text-2xl font-semibold tracking-tight">Your 10-year heart-risk check</h2>
                  <p className="mt-1 text-sm text-[#9FB8B0]">A few quick questions — we'll show your QRISK3 score and what it means in plain language.</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Age">
                  <NumberStepper value={form.age} min={25} max={84} onChange={(v) => setForm(f => ({ ...f, age: v }))} testId="assess-age" />
                </Field>
                <Field label="Sex at birth">
                  <div className="flex gap-2">
                    {[["male","Male"],["female","Female"]].map(([v,l]) => (
                      <button key={v} onClick={() => setForm(f => ({ ...f, sex: v }))} className={pillClass(form.sex === v)} data-testid={`assess-sex-${v}`}>{l}</button>
                    ))}
                  </div>
                </Field>
                <Field label="Ethnicity">
                  <select value={form.ethnicity} onChange={(e) => setForm(f => ({ ...f, ethnicity: e.target.value }))} className="select" data-testid="assess-ethnicity">
                    {ETHNICITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                <Field label="Smoking">
                  <select value={form.smoking} onChange={(e) => setForm(f => ({ ...f, smoking: e.target.value }))} className="select" data-testid="assess-smoking">
                    {SMOKING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                <Field label="Height (cm)">
                  <input type="number" value={form.height} onChange={(e) => setForm(f => ({ ...f, height: parseFloat(e.target.value) || 0 }))} className="input" data-testid="assess-height" />
                </Field>
                <Field label="Weight (kg)">
                  <input type="number" value={form.weight} onChange={(e) => setForm(f => ({ ...f, weight: parseFloat(e.target.value) || 0 }))} className="input" data-testid="assess-weight" />
                </Field>
                <Field label={`BMI ${bmi != null ? `— ${bmi}` : ""}`}>
                  <div className="h-10 px-3 rounded-lg bg-[#04121A] border border-[#13343A] flex items-center text-sm text-[#9FB8B0]">
                    {bmi != null ? `Auto-calculated: ${bmi} kg/m²` : "Enter height and weight"}
                  </div>
                </Field>
                <Field label="Systolic BP (mmHg)">
                  <input type="number" value={form.sbp} onChange={(e) => setForm(f => ({ ...f, sbp: parseFloat(e.target.value) || 0 }))} className="input" data-testid="assess-sbp" />
                </Field>
                <Field label="Cholesterol / HDL ratio">
                  <input type="number" step="0.1" value={form.cholHdl} onChange={(e) => setForm(f => ({ ...f, cholHdl: parseFloat(e.target.value) || 0 }))} className="input" data-testid="assess-cholhdl" />
                </Field>
              </div>

              <div className="mt-5">
                <div className="text-xs uppercase tracking-wider text-[#9FB8B0] mb-2">Anything that applies (tap to toggle)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {BOOL_KEYS.map((k) => {
                    const hidden = k === "erectileDysfunction" && form.sex !== "male";
                    if (hidden) return null;
                    const on = !!form[k];
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, [k]: !f[k] }))}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm border transition-colors ${on ? "bg-[#0F2027] border-[#22D3A4]/60 text-[#E6FBF3]" : "bg-[#04121A] border-[#13343A] text-[#9FB8B0] hover:bg-[#0F2027]"}`}
                        data-testid={`assess-cond-${k}`}
                      >
                        <span className={`w-4 h-4 rounded-sm border ${on ? "bg-[#22D3A4] border-[#22D3A4]" : "border-[#13343A]"}`} />
                        {CONDITION_LABELS[k]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={handleCalculate}
                className="mt-6 w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-[#22D3A4] text-[#04121A] hover:bg-[#3FE8B9] font-semibold scan-cta-shadow"
                data-testid="assess-calculate"
              >
                <Calculator className="w-4 h-4" /> Calculate my 10-year risk
              </button>
              <p className="mt-2 text-[11px] text-[#6F8B83] text-center">This is an estimate based on QRISK3. It's not a diagnosis.</p>
            </div>

            {result && (
              <motion.div
                id="result-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="rounded-3xl bg-[#0B1E22] border border-[#13343A] p-5 sm:p-6"
                data-testid="assess-result-card"
              >
                <div className="flex items-baseline justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-[#6F8B83]">Your 10-year cardiovascular risk</div>
                    <div className="display text-5xl sm:text-6xl font-semibold mt-1" style={{ color: ribbon.color }} data-testid="assess-result-score">
                      {result.qrisk}<span className="text-2xl">%</span>
                    </div>
                  </div>
                  <span className="px-3 py-1.5 rounded-full text-sm font-semibold border" style={{ borderColor: ribbon.color, color: ribbon.color }} data-testid="assess-result-band">
                    {ribbon.label}
                  </span>
                </div>
                <RiskGauge value={result.qrisk} />
                <p className="mt-3 text-sm text-[#E6FBF3]" data-testid="assess-result-advice">{ribbon.advice}</p>

                {result.recs?.length > 0 && (
                  <div className="mt-5">
                    <div className="text-xs uppercase tracking-wider text-[#9FB8B0] mb-2">What we suggest</div>
                    <ul className="space-y-2" data-testid="assess-recs">
                      {result.recs.map((r, i) => {
                        const tag = CONSUMER_FRIENDLY_RECS[r.priority] || CONSUMER_FRIENDLY_RECS.routine;
                        return (
                          <li key={i} className="rounded-xl bg-[#04121A] border border-[#13343A] p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium text-[#E6FBF3]">{r.test}</div>
                                <div className="text-[11px] text-[#9FB8B0] mt-0.5">{r.area}</div>
                              </div>
                              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border" style={{ borderColor: tag.color, color: tag.color }}>{tag.tag}</span>
                            </div>
                            <p className="mt-1.5 text-[12px] text-[#9FB8B0]">{r.reason}</p>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                <div className="mt-5 rounded-2xl bg-[#04121A] border border-[#13343A] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#22D3A4]" />
                      <div className="text-sm font-semibold">AI insights</div>
                      <span className="text-[10px] text-[#6F8B83]">powered by Mistral</span>
                    </div>
                    <button
                      onClick={handleAi}
                      disabled={aiBusy}
                      className="h-9 px-3 rounded-lg text-xs bg-[#0F2027] border border-[#22D3A4] text-[#22D3A4] hover:bg-[#13343A] disabled:opacity-50"
                      data-testid="assess-ai-run"
                    >
                      {aiBusy ? "Thinking…" : aiText ? "Regenerate" : "Get AI insights"}
                    </button>
                  </div>
                  <div className="mt-3 min-h-[80px] text-sm text-[#E6FBF3] whitespace-pre-wrap leading-relaxed" data-testid="assess-ai-body">
                    {aiText || <span className="text-[#6F8B83] text-[13px]">Tap to generate a plain-language summary of your result with practical next steps.</span>}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-[#22D3A4] text-[#04121A] hover:bg-[#3FE8B9] font-semibold disabled:opacity-50"
                    data-testid="assess-save"
                  >
                    <Save className="w-4 h-4" /> {saving ? "Saving…" : patient ? "Save to patient" : "Save to history"}
                  </button>
                  <button
                    onClick={() => navigate(patient ? `/patients/${patient.id}` : "/history")}
                    className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-[#0F2027] border border-[#13343A] hover:bg-[#13343A] text-sm"
                  >
                    {patient ? "Back to patient" : "Open history"} <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function pillClass(active) {
  return `h-10 px-4 rounded-xl text-sm font-medium border transition-colors ${active ? "bg-[#0F2027] border-[#22D3A4] text-[#E6FBF3]" : "bg-[#04121A] border-[#13343A] text-[#9FB8B0] hover:bg-[#0F2027]"}`;
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs text-[#9FB8B0] uppercase tracking-wider">{label}</span>
      <div className="mt-1">{children}</div>
      <style>{`.input, .select { background:#04121A; color:#E6FBF3; border:1px solid #13343A; border-radius:10px; padding:8px 12px; width:100%; height:40px; font-family:inherit; font-size:14px; }`}</style>
    </label>
  );
}

function Vital({ icon, label, value }) {
  return (
    <div className="rounded-xl bg-[#04121A] border border-[#13343A] p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#6F8B83]">{icon}{label}</div>
      <div className="mt-1 display text-sm font-semibold">{value}</div>
    </div>
  );
}

function NumberStepper({ value, min = 0, max = 999, onChange, testId }) {
  return (
    <div className="inline-flex items-center gap-2" data-testid={testId}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className="w-10 h-10 rounded-lg bg-[#04121A] border border-[#13343A] text-lg">−</button>
      <span className="display text-xl font-semibold min-w-[44px] text-center">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} className="w-10 h-10 rounded-lg bg-[#04121A] border border-[#13343A] text-lg">+</button>
    </div>
  );
}

function RiskGauge({ value }) {
  const pct = Math.min(100, Math.max(0, value * 3));
  return (
    <div className="mt-4">
      <div className="relative h-3 rounded-full overflow-hidden" style={{ background: "linear-gradient(90deg, #22D3A4 0%, #22D3A4 33%, #F59E0B 66%, #FF6E76 100%)" }}>
        <div className="absolute top-0 bottom-0 right-0 bg-[#04121A]/85" style={{ left: `${pct}%` }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-1 h-5 bg-[#E6FBF3] rounded-full shadow-[0_0_0_2px_#04121A]" style={{ left: `calc(${pct}% - 2px)` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-[#6F8B83]">
        <span>Low</span><span>Borderline</span><span>Moderate</span><span>High</span>
      </div>
    </div>
  );
}

function mapEthnicity(s) {
  if (!s) return null;
  const k = s.toLowerCase();
  if (k.includes("white")) return "white";
  if (k.includes("indian")) return "indian";
  if (k.includes("pakistani")) return "pakistani";
  if (k.includes("bangla")) return "bangladeshi";
  if (k.includes("chinese")) return "chinese";
  if (k.includes("asian")) return "other_asian";
  if (k.includes("caribbean")) return "black_caribbean";
  if (k.includes("african")) return "black_african";
  return "other";
}
