import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Save, Info } from "lucide-react";
import { toast } from "sonner";
import { getHealthProfile, setHealthProfile } from "@/lib/wellness";

const REGIONS = [
  { v: "uk", l: "United Kingdom" },
  { v: "europe", l: "Europe (ESC)" },
  { v: "india", l: "India / South Asia" },
  { v: "global", l: "Other / Global" },
];
const ETHNICITIES = [
  { v: "white_or_unknown", l: "White or unknown" },
  { v: "indian", l: "Indian" },
  { v: "pakistani", l: "Pakistani" },
  { v: "bangladeshi", l: "Bangladeshi" },
  { v: "other_asian", l: "Other Asian" },
  { v: "black_caribbean", l: "Black Caribbean" },
  { v: "black_african", l: "Black African" },
  { v: "chinese", l: "Chinese" },
  { v: "other", l: "Other" },
];
const SCORE2_REGIONS = [
  { v: "low", l: "Low-risk (e.g., UK, FR, NL, ES)" },
  { v: "moderate", l: "Moderate-risk (default)" },
  { v: "high", l: "High-risk" },
  { v: "very_high", l: "Very-high-risk" },
];
const SMOKING = [
  { v: "non", l: "Non-smoker" },
  { v: "ex", l: "Ex-smoker" },
  { v: "light", l: "Light (<10/day)" },
  { v: "moderate", l: "Moderate (10–19/day)" },
  { v: "heavy", l: "Heavy (20+/day)" },
];
const DIABETES = [
  { v: "none", l: "None" },
  { v: "type1", l: "Type 1" },
  { v: "type2", l: "Type 2" },
];

const defaultProfile = {
  region: "india",
  ethnicity: "indian",
  who_subregion: "sear_d",
  score2_region: "moderate",
  age: "",
  sex: "male",
  sbp: "",
  bmi: "",
  total_cholesterol: "",
  hdl: "",
  chol_hdl_ratio: "",
  smoking: "non",
  diabetes_type: "none",
  family_history: false,
  treated_hypertension: false,
  ckd: false,
  af: false,
  ra: false,
};

export default function HealthProfile() {
  const navigate = useNavigate();
  const [p, setP] = useState(defaultProfile);
  useEffect(() => {
    const saved = getHealthProfile();
    if (saved) setP({ ...defaultProfile, ...saved });
  }, []);

  const update = (k, v) => setP((prev) => ({ ...prev, [k]: v }));

  const save = () => {
    // Auto-derive chol_hdl_ratio if total + hdl provided
    const total = parseFloat(p.total_cholesterol);
    const hdl = parseFloat(p.hdl);
    let ratio = p.chol_hdl_ratio;
    if (Number.isFinite(total) && Number.isFinite(hdl) && hdl > 0) {
      ratio = (total / hdl).toFixed(2);
    }
    setHealthProfile({ ...p, chol_hdl_ratio: ratio });
    toast.success("Profile saved on this device");
    navigate("/insights");
  };

  return (
    <div className="relative max-w-md mx-auto px-5 pt-3 pb-28">
      <h1 className="display text-[22px] font-semibold tracking-tight" data-testid="health-profile-title">Health profile</h1>
      <p className="mt-0.5 text-sm text-[#8A8280]">Stored only on this device. Used to estimate cardiovascular risk.</p>

      <div className="mt-4 flex items-start gap-2 rounded-2xl bg-[#13131A] border border-[#F5C87A]/30 p-3.5 text-[12px] text-[#F0EDE8]" data-testid="health-profile-disclaimer">
        <Info className="w-4 h-4 text-[#F5C87A] shrink-0 mt-0.5" />
        <span>Educational estimates only. Not a diagnosis. For BP &amp; cholesterol enter your last cuff / lab values for best accuracy.</span>
      </div>

      <Section title="Region & ethnicity">
        <Field label="Region"><Select value={p.region} onChange={(v) => update("region", v)} options={REGIONS} data-testid="hp-region" /></Field>
        <Field label="Ethnicity"><Select value={p.ethnicity} onChange={(v) => update("ethnicity", v)} options={ETHNICITIES} data-testid="hp-ethnicity" /></Field>
        {p.region === "europe" && (
          <Field label="SCORE2 region"><Select value={p.score2_region} onChange={(v) => update("score2_region", v)} options={SCORE2_REGIONS} data-testid="hp-score2-region" /></Field>
        )}
      </Section>

      <Section title="About you">
        <Field label="Age (years)"><Input type="number" value={p.age} onChange={(v) => update("age", v)} placeholder="e.g., 52" data-testid="hp-age" /></Field>
        <Field label="Sex">
          <div className="flex gap-2">
            {["male", "female"].map((s) => (
              <button key={s} type="button" onClick={() => update("sex", s)}
                      className={`flex-1 h-11 rounded-xl text-sm capitalize border transition-colors ${p.sex === s ? "bg-[#E8445A]/15 border-[#E8445A]/50 text-[#E8445A]" : "bg-[#0A0A0F] border-[#1F1F2E] text-[#F0EDE8] hover:bg-[#13131A]"}`}
                      data-testid={`hp-sex-${s}`}>{s}</button>
            ))}
          </div>
        </Field>
        <Field label="Smoking"><Select value={p.smoking} onChange={(v) => update("smoking", v)} options={SMOKING} data-testid="hp-smoking" /></Field>
      </Section>

      <Section title="Recent measurements" subtitle="From a cuff / lab where possible.">
        <Field label="Systolic BP (mmHg)"><Input type="number" value={p.sbp} onChange={(v) => update("sbp", v)} placeholder="e.g., 132" data-testid="hp-sbp" /></Field>
        <Field label="BMI (kg/m²)"><Input type="number" value={p.bmi} onChange={(v) => update("bmi", v)} placeholder="e.g., 26.5" step="0.1" data-testid="hp-bmi" /></Field>
        <Field label="Total cholesterol (mmol/L)"><Input type="number" value={p.total_cholesterol} onChange={(v) => update("total_cholesterol", v)} placeholder="e.g., 5.2" step="0.1" data-testid="hp-total-chol" /></Field>
        <Field label="HDL (mmol/L)"><Input type="number" value={p.hdl} onChange={(v) => update("hdl", v)} placeholder="e.g., 1.3" step="0.1" data-testid="hp-hdl" /></Field>
      </Section>

      <Section title="Medical history">
        <Field label="Diabetes"><Select value={p.diabetes_type} onChange={(v) => update("diabetes_type", v)} options={DIABETES} data-testid="hp-diabetes" /></Field>
        <Toggle label="Family history of CVD before 60" v={p.family_history} onChange={(b) => update("family_history", b)} testid="hp-family-history" />
        <Toggle label="Treated hypertension" v={p.treated_hypertension} onChange={(b) => update("treated_hypertension", b)} testid="hp-treated-htn" />
        <Toggle label="Chronic kidney disease" v={p.ckd} onChange={(b) => update("ckd", b)} testid="hp-ckd" />
        <Toggle label="Atrial fibrillation" v={p.af} onChange={(b) => update("af", b)} testid="hp-af" />
        <Toggle label="Rheumatoid arthritis" v={p.ra} onChange={(b) => update("ra", b)} testid="hp-ra" />
      </Section>

      <div className="mt-6 grid grid-cols-2 gap-2">
        <button onClick={() => navigate("/insights")} className="h-12 rounded-2xl bg-[#13131A] border border-[#1F1F2E] text-sm hover:bg-[#191923]" data-testid="hp-cancel">Cancel</button>
        <button onClick={save} className="h-12 rounded-2xl bg-[#E8445A] text-[#0A0A0F] font-semibold hover:bg-[#F26478] inline-flex items-center justify-center gap-1.5 scan-cta-shadow" data-testid="hp-save"><Save className="w-4 h-4" /> Save profile</button>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div className="mt-5">
      <div className="text-[10px] uppercase tracking-wider text-[#F5C87A]">{title}</div>
      {subtitle && <div className="text-[11px] text-[#8A8280] mt-1">{subtitle}</div>}
      <div className="mt-2 space-y-3 rounded-2xl bg-[#13131A] border border-[#1F1F2E] p-4">{children}</div>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-[11px] text-[#8A8280] mb-1">{label}</div>
      {children}
    </label>
  );
}
function Input({ value, onChange, ...rest }) {
  return (
    <input value={value || ""} onChange={(e) => onChange(e.target.value)}
           className="w-full h-11 px-3 rounded-xl bg-[#0A0A0F] border border-[#1F1F2E] text-[14px] text-[#F0EDE8] placeholder:text-[#6E6862] focus:outline-none focus:border-[#E8445A]/50"
           {...rest} />
  );
}
function Select({ value, onChange, options, ...rest }) {
  return (
    <select value={value || ""} onChange={(e) => onChange(e.target.value)}
            className="w-full h-11 px-3 rounded-xl bg-[#0A0A0F] border border-[#1F1F2E] text-[14px] text-[#F0EDE8] focus:outline-none focus:border-[#E8445A]/50"
            {...rest}>
      {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}
function Toggle({ label, v, onChange, testid }) {
  return (
    <button type="button" onClick={() => onChange(!v)} className="w-full flex items-center justify-between h-10 px-2" data-testid={testid}>
      <span className="text-[13px] text-[#F0EDE8]">{label}</span>
      <span className={`relative w-10 h-6 rounded-full transition-colors ${v ? "bg-[#E8445A]" : "bg-[#1F1F2E]"}`}>
        <span className={`absolute top-0.5 ${v ? "left-5" : "left-0.5"} w-5 h-5 rounded-full bg-[#F0EDE8] transition-all`} />
      </span>
    </button>
  );
}
