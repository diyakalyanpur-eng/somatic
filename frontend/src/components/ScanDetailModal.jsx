import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Heart, Wind, Droplet, Activity, AlertTriangle, Info, Sparkles } from "lucide-react";

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); } catch { return iso; }
}
function band(qrisk) {
  if (qrisk == null || Number.isNaN(qrisk)) return { label: "Unknown", color: "#9FB8B0" };
  if (qrisk < 5) return { label: "Low risk", color: "#22D3A4" };
  if (qrisk < 10) return { label: "Borderline", color: "#06B6D4" };
  if (qrisk < 20) return { label: "Moderate", color: "#F59E0B" };
  return { label: "High", color: "#FF6E76" };
}

function qriskFactors(profile) {
  if (!profile) return [];
  const items = [];
  if (profile.age != null) items.push({ key: "Age", val: profile.age, weight: profile.age >= 60 ? 0.85 : profile.age >= 45 ? 0.6 : 0.3 });
  if (profile.sex) items.push({ key: "Sex", val: profile.sex, weight: profile.sex === "male" ? 0.55 : 0.4 });
  if (profile.smoking) {
    const s = profile.smoking;
    const w = s === "heavy" ? 0.95 : s === "moderate" ? 0.75 : s === "light" ? 0.55 : s === "ex" ? 0.3 : 0.1;
    items.push({ key: "Smoking", val: s, weight: w });
  }
  if (profile.sbp) items.push({ key: "SBP", val: `${profile.sbp} mmHg`, weight: profile.sbp >= 160 ? 0.9 : profile.sbp >= 140 ? 0.7 : profile.sbp >= 130 ? 0.5 : 0.25 });
  if (profile.bmi) items.push({ key: "BMI", val: profile.bmi, weight: profile.bmi >= 30 ? 0.8 : profile.bmi >= 25 ? 0.55 : 0.25 });
  if (profile.cholHdl) items.push({ key: "Chol/HDL", val: profile.cholHdl, weight: profile.cholHdl >= 5 ? 0.8 : profile.cholHdl >= 4 ? 0.6 : 0.3 });
  const flags = ["type2Dm", "type1Dm", "af", "ckd", "familyHistory", "treatedHtn", "migraine", "ra"];
  flags.forEach((k) => {
    if (profile[k]) items.push({ key: k, val: "yes", weight: 0.7 });
  });
  return items.sort((a, b) => b.weight - a.weight);
}

export function ScanDetailModal({ open, onClose, payload }) {
  if (!payload) return null;
  const { snapshot, assessment, item } = payload;
  const fused = snapshot?.fused || {
    bpm: assessment?.vitals?.hr,
    hrv_ms: assessment?.vitals?.hrv_ms,
    spo2: assessment?.vitals?.spo2,
    brpm: assessment?.vitals?.brpm,
    quality: assessment?.vitals?.quality,
  };
  const qrisk = assessment?.qrisk3Score;
  const b = band(qrisk);
  const factors = qriskFactors(assessment?.profile);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="max-w-2xl bg-[#0B1E22] border border-[#13343A] p-0 overflow-hidden"
        data-testid="scan-detail-modal"
      >
        <DialogHeader className="p-5 border-b border-[#13343A]">
          <DialogTitle className="display text-lg font-semibold tracking-tight">
            {item?.kind === "snapshot" ? "Camera scan" : "Assessment"}
            <span className="ml-2 text-xs font-normal text-[#9FB8B0]">{fmtDate(item?.created_at)}</span>
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="overview" className="px-5 pt-3">
          <TabsList className="bg-[#04121A] border border-[#13343A]">
            <TabsTrigger value="overview" data-testid="scan-detail-tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="qrisk" data-testid="scan-detail-tab-qrisk">QRISK3</TabsTrigger>
            <TabsTrigger value="factors" data-testid="scan-detail-tab-factors">Factors</TabsTrigger>
            <TabsTrigger value="narrative" data-testid="scan-detail-tab-narrative">Narrative</TabsTrigger>
          </TabsList>
          <ScrollArea className="max-h-[60vh]">
            <TabsContent value="overview" className="py-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Vital icon={<Heart className="w-4 h-4 text-[#22D3A4]" />} label="HR" value={fused?.bpm != null ? `${fused.bpm}` : "—"} unit="bpm" />
                <Vital icon={<Activity className="w-4 h-4 text-[#06B6D4]" />} label="HRV" value={fused?.hrv_ms != null ? `${fused.hrv_ms}` : "—"} unit="ms" />
                <Vital icon={<Droplet className="w-4 h-4 text-[#06B6D4]" />} label="SpO₂" value={fused?.spo2 != null ? `${fused.spo2}` : "—"} unit="%" />
                <Vital icon={<Wind className="w-4 h-4 text-[#22D3A4]" />} label="Resp" value={fused?.brpm != null ? `${fused.brpm}` : "—"} unit="/min" />
              </div>
              {fused?.quality != null && (
                <div className="mt-4 rounded-xl bg-[#04121A] border border-[#13343A] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#9FB8B0]">Signal quality</span>
                    <span className="text-xs text-[#E6FBF3] font-medium">{Math.round((fused.quality || 0) * 100)}%</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-[#13343A] overflow-hidden">
                    <div className="h-full bg-[#22D3A4]" style={{ width: `${Math.min(100, Math.max(0, (fused.quality || 0) * 100))}%` }} />
                  </div>
                </div>
              )}
              {assessment?.profile && (
                <div className="mt-4 rounded-xl bg-[#04121A] border border-[#13343A] p-3">
                  <div className="text-xs uppercase tracking-wider text-[#6F8B83]">Profile</div>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <KV label="Age" value={assessment.profile.age} />
                    <KV label="Sex" value={assessment.profile.sex} />
                    <KV label="BMI" value={assessment.profile.bmi} />
                    <KV label="SBP" value={assessment.profile.sbp} />
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="qrisk" className="py-4">
              {qrisk == null ? (
                <Empty icon={<Info className="w-4 h-4" />} text="No QRISK3 score recorded for this scan." />
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl bg-[#04121A] border border-[#13343A] p-4">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <div className="text-xs uppercase tracking-wider text-[#6F8B83]">10-year CVD risk</div>
                        <div className="display text-3xl font-semibold mt-1" style={{ color: b.color }}>{Number(qrisk).toFixed(1)}%</div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium border" style={{ borderColor: b.color, color: b.color }}>{b.label}</span>
                    </div>
                    <RiskGauge value={qrisk} />
                  </div>
                  {assessment?.recommendations?.length > 0 && (
                    <div className="rounded-xl bg-[#04121A] border border-[#13343A] p-4">
                      <div className="text-xs uppercase tracking-wider text-[#6F8B83]">Recommendations</div>
                      <ul className="mt-2 space-y-1.5">
                        {assessment.recommendations.map((r, i) => (
                          <li key={i} className="text-sm text-[#E6FBF3] flex items-start gap-2">
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#22D3A4] shrink-0" />
                            {typeof r === "string" ? r : `[${r.priority?.toUpperCase()}] ${r.test} (${r.area})`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="factors" className="py-4">
              {factors.length === 0 ? (
                <Empty icon={<Info className="w-4 h-4" />} text="No risk factor breakdown available." />
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-[#9FB8B0]">Relative contribution of each tracked factor to the overall risk picture.</p>
                  {factors.map((f, i) => (
                    <div key={i} className="rounded-xl bg-[#04121A] border border-[#13343A] p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-[#E6FBF3]">{prettify(f.key)}</div>
                        <div className="text-xs text-[#9FB8B0]">{String(f.val)}</div>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-[#13343A] overflow-hidden">
                        <div className="h-full" style={{ width: `${Math.round(f.weight * 100)}%`, background: f.weight > 0.65 ? "#FF6E76" : f.weight > 0.45 ? "#F59E0B" : "#22D3A4" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="narrative" className="py-4">
              {assessment?.aiNarrative ? (
                <div className="rounded-xl bg-[#04121A] border border-[#13343A] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#22D3A4]" />
                    <div className="text-xs uppercase tracking-wider text-[#6F8B83]">AI clinical narrative · Mistral</div>
                  </div>
                  <p className="text-sm text-[#E6FBF3] whitespace-pre-wrap leading-relaxed">{assessment.aiNarrative}</p>
                </div>
              ) : (
                <Empty icon={<AlertTriangle className="w-4 h-4 text-[#F59E0B]" />} text="No AI narrative for this scan yet." />
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
        <div className="px-5 py-3 border-t border-[#13343A] flex justify-end">
          <button
            onClick={onClose}
            className="h-9 px-3 rounded-lg text-sm bg-[#0F2027] border border-[#13343A] hover:bg-[#13343A] transition-[background-color]"
            data-testid="scan-detail-close-button"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RiskGauge({ value }) {
  const pct = Math.min(100, Math.max(0, value * 3));
  return (
    <div className="mt-4">
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "linear-gradient(90deg,#22D3A4 0%,#22D3A4 33%,#F59E0B 66%,#FF6E76 100%)" }}>
        <div className="h-full bg-[#04121A]" style={{ marginLeft: `${pct}%`, width: `${100 - pct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-[#6F8B83]">
        <span>Low</span><span>Moderate</span><span>High</span>
      </div>
    </div>
  );
}
function Vital({ icon, label, value, unit }) {
  return (
    <div className="rounded-xl bg-[#04121A] border border-[#13343A] p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-[#9FB8B0]">{icon}{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="display text-xl font-semibold">{value}</span>
        <span className="text-[11px] text-[#6F8B83]">{unit}</span>
      </div>
    </div>
  );
}
function KV({ label, value }) {
  return (
    <div>
      <div className="text-[11px] text-[#6F8B83]">{label}</div>
      <div className="text-sm text-[#E6FBF3] font-medium">{value ?? "—"}</div>
    </div>
  );
}
function Empty({ icon, text }) {
  return (
    <div className="rounded-xl bg-[#04121A] border border-[#13343A] p-6 text-center">
      <div className="mx-auto w-9 h-9 rounded-xl bg-[#0F2027] border border-[#13343A] grid place-items-center">{icon}</div>
      <div className="mt-3 text-sm text-[#9FB8B0]">{text}</div>
    </div>
  );
}
function prettify(key) {
  const map = { type2Dm: "Type 2 diabetes", type1Dm: "Type 1 diabetes", af: "Atrial fibrillation", ckd: "CKD", familyHistory: "Family history", treatedHtn: "Treated hypertension", migraine: "Migraine", ra: "Rheumatoid arthritis" };
  return map[key] || key;
}
