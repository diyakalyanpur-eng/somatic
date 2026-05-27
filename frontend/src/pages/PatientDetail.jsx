import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { getPatient, setActivePatient, exportPatient, forgetPatient } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ScanLine, Heart, Activity, Droplet, Wind, Camera, Download, ShieldOff, ShieldCheck, Lock } from "lucide-react";
import { toast } from "sonner";

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); } catch { return iso; }
}
function maskPhone(p) {
  if (!p) return "—";
  const t = String(p).replace(/\s+/g, "");
  return t.length < 4 ? t : `••• ${t.slice(-4)}`;
}

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try { const d = await getPatient(id); if (mounted) setData(d); }
      catch { if (mounted) toast.error("Failed to load patient"); }
      finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [id]);

  const startScan = () => {
    if (!data?.row) return;
    setActivePatient({ id: data.row.id, code: data.row.code });
    window.location.href = `/aisteth.html?patientId=${encodeURIComponent(data.row.id)}&patientCode=${encodeURIComponent(data.row.code || "")}`;
  };

  const doExport = async () => {
    try {
      const d = await exportPatient(id);
      const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `aisteth-export-${d.patient.code}-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Export downloaded (GDPR Art. 20)");
    } catch { toast.error("Export failed"); }
  };

  const doForget = async () => {
    if (!data?.row) return;
    const code = data.row.code;
    const ans = prompt(`Permanently erase ALL data for ${code}? Type the code to confirm.`);
    if (ans !== code) return;
    try {
      const d = await forgetPatient(id);
      toast.success(`Erased · ${d.deleted.snapshots} scans, ${d.deleted.assessments} assessments`);
      navigate("/patients");
    } catch { toast.error("Erasure failed"); }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-4">
        <Skeleton className="h-10 w-1/2 bg-[#0B1E22]" />
        <Skeleton className="h-48 w-full bg-[#0B1E22]" />
        <Skeleton className="h-72 w-full bg-[#0B1E22]" />
      </div>
    );
  }
  if (!data?.row) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <button onClick={() => navigate("/patients")} className="text-sm text-[#9FB8B0]">← Back</button>
        <div className="mt-6 rounded-2xl bg-[#0B1E22] border border-[#13343A] p-8 text-center">
          <div className="text-lg font-semibold">Patient not found</div>
        </div>
      </div>
    );
  }
  const p = data.row;
  const trend = data.trend || [];
  const latest = trend[trend.length-1];
  const assessment = data.latestAssessment;

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 h-[180px] bg-top-band pointer-events-none" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <button
          type="button"
          onClick={() => navigate("/patients")}
          className="inline-flex items-center gap-1.5 text-sm text-[#9FB8B0] hover:text-[#E6FBF3] mb-4"
          data-testid="patient-detail-back"
        >
          <ArrowLeft className="w-4 h-4" /> All patients
        </button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-14 h-14 rounded-2xl grid place-items-center" style={{ background: `${p.color}22`, color: p.color, border: `1px solid ${p.color}55` }}>
              <Lock className="w-5 h-5" />
            </span>
            <div>
              <div className="inline-flex items-center gap-1.5 mb-1 px-2 py-0.5 rounded-full border border-[#13343A] bg-[#0B1E22] text-[10px] uppercase tracking-wider text-[#9FB8B0]">
                <ShieldCheck className="w-3 h-3 text-[#22D3A4]" /> Pseudonymised
              </div>
              <h1 className="display text-2xl sm:text-3xl font-mono font-semibold tracking-wider" data-testid="patient-detail-code">{p.code || "PT-?"}</h1>
              <div className="text-xs text-[#9FB8B0]">
                {p.sex || "—"} · {p.ethnicity || "—"} {p.phone ? `· ${maskPhone(p.phone)}` : ""} {p.dob ? `· b.${p.dob}` : ""}
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => navigate(`/patients/${p.id}/assess`)}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-[#22D3A4] text-[#04121A] hover:bg-[#3FE8B9] font-semibold scan-cta-shadow"
              data-testid="patient-detail-assess"
            >
              <Heart className="w-4 h-4" /> Run risk check
            </button>
            <button
              onClick={doExport}
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl bg-[#0F2027] border border-[#13343A] hover:bg-[#13343A] text-sm"
              data-testid="patient-detail-export"
              title="GDPR Art. 20 — data portability"
            >
              <Download className="w-4 h-4" /> Export
            </button>
            <button
              onClick={doForget}
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl bg-[#0F2027] border border-[#FF6E76]/40 hover:bg-[#1A0F12] text-sm text-[#FF6E76]"
              data-testid="patient-detail-forget"
              title="GDPR Art. 17 — right to erasure"
            >
              <ShieldOff className="w-4 h-4" /> Forget
            </button>
            <button
              onClick={startScan}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-[#0F2027] border border-[#13343A] hover:bg-[#13343A] text-sm"
              data-testid="patient-detail-scan"
            >
              <ScanLine className="w-4 h-4" /> Camera scan
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Vital icon={<Heart className="w-4 h-4 text-[#22D3A4]" />} label="Latest HR" value={latest?.bpm} unit="bpm" />
          <Vital icon={<Activity className="w-4 h-4 text-[#06B6D4]" />} label="HRV" value={latest?.hrv} unit="ms" />
          <Vital icon={<Droplet className="w-4 h-4 text-[#06B6D4]" />} label="SpO₂" value={latest?.spo2} unit="%" />
          <Vital icon={<Wind className="w-4 h-4 text-[#22D3A4]" />} label="Resp" value={latest?.brpm} unit="/min" />
        </div>

        <div className="mt-6 rounded-2xl bg-[#0B1E22] border border-[#13343A] p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h3 className="display text-sm font-semibold tracking-tight">Cardiac trend</h3>
            <span className="text-[11px] text-[#9FB8B0]">{trend.length} scan{trend.length === 1 ? "" : "s"}</span>
          </div>
          {trend.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto w-10 h-10 rounded-xl bg-[#04121A] border border-[#13343A] grid place-items-center">
                <Camera className="w-4 h-4 text-[#9FB8B0]" />
              </div>
              <p className="mt-3 text-sm text-[#9FB8B0]">No scans for this patient yet. Tap “New scan” to start.</p>
            </div>
          ) : (
            <div className="mt-3 h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend.map(t => ({ ...t, time: new Date(t.created_at).toLocaleDateString() }))} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#13343A" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" stroke="#6F8B83" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#6F8B83" tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ background: "#04121A", border: "1px solid #13343A", borderRadius: 12, fontSize: 12 }} labelStyle={{ color: "#9FB8B0" }} />
                  <Line type="monotone" dataKey="bpm" name="HR" stroke="#22D3A4" strokeWidth={2.5} dot={{ r: 3, fill: "#22D3A4" }} />
                  <Line type="monotone" dataKey="hrv" name="HRV" stroke="#06B6D4" strokeWidth={2} dot={{ r: 2, fill: "#06B6D4" }} />
                  <Line type="monotone" dataKey="spo2" name="SpO₂" stroke="#F59E0B" strokeWidth={2} dot={{ r: 2, fill: "#F59E0B" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {assessment && (
          <div className="mt-6 rounded-2xl bg-[#0B1E22] border border-[#13343A] p-4 sm:p-5">
            <h3 className="display text-sm font-semibold tracking-tight">Latest assessment</h3>
            <div className="mt-2 text-[11px] text-[#9FB8B0]">{fmtDate(assessment.created_at)}</div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KV label="QRISK3" value={assessment.qrisk3Score != null ? `${Number(assessment.qrisk3Score).toFixed(1)}%` : "—"} accent="#22D3A4" />
              <KV label="Age" value={assessment.profile?.age} />
              <KV label="SBP" value={assessment.profile?.sbp} />
              <KV label="BMI" value={assessment.profile?.bmi} />
            </div>
            {assessment.aiNarrative && (
              <div className="mt-3 rounded-xl bg-[#04121A] border border-[#13343A] p-3">
                <div className="text-[11px] text-[#6F8B83] uppercase tracking-wider">AI narrative · Mistral</div>
                <p className="mt-1 text-sm text-[#E6FBF3] whitespace-pre-wrap leading-relaxed">{assessment.aiNarrative}</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 rounded-2xl bg-[#0B1E22] border border-[#13343A] p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#22D3A4]" />
            <h3 className="display text-sm font-semibold tracking-tight">Data rights</h3>
          </div>
          <ul className="mt-3 text-xs text-[#9FB8B0] space-y-1.5 leading-relaxed">
            <li>• You can <span className="text-[#E6FBF3] font-medium">export</span> every record AiSteth holds for this patient as JSON (GDPR Art. 20).</li>
            <li>• You can <span className="text-[#E6FBF3] font-medium">erase</span> the patient and cascade-delete all linked scans and assessments (GDPR Art. 17 “right to be forgotten”).</li>
            <li>• Camera frames are processed locally in the browser; only derived vitals are sent to the server.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function Vital({ icon, label, value, unit }) {
  return (
    <div className="rounded-2xl bg-[#0B1E22] border border-[#13343A] p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[#9FB8B0] uppercase tracking-wider">{label}</span>
        <span className="w-7 h-7 rounded-lg bg-[#04121A] border border-[#13343A] grid place-items-center">{icon}</span>
      </div>
      <div className="mt-2 display text-2xl font-semibold tracking-tight">
        {value != null ? value : "—"}
        {value != null ? <span className="text-[11px] text-[#9FB8B0] ml-1">{unit}</span> : null}
      </div>
    </div>
  );
}
function KV({ label, value, accent }) {
  return (
    <div className="rounded-xl bg-[#04121A] border border-[#13343A] p-3">
      <div className="text-[10px] text-[#6F8B83] uppercase tracking-wider">{label}</div>
      <div className="mt-1 display text-base font-semibold" style={accent ? { color: accent } : undefined}>{value ?? "—"}</div>
    </div>
  );
}
