import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck, AlertTriangle, ListChecks, Heart, Sparkles, RefreshCw, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { getHealthProfile } from "@/lib/wellness";
import { analyzeHealth } from "@/lib/api";

const BAND_COLOR = { low: "#7DD3A0", moderate: "#F5C87A", high: "#F5A972", very_high: "#E8445A" };

export default function HealthReport() {
  const navigate = useNavigate();
  const profile = getHealthProfile();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async (force = false) => {
    if (!profile) { navigate("/insights/profile"); return; }
    setLoading(true); setError(null);
    try {
      // Latest vitals from localStorage (no PII)
      const bpm = parseInt(localStorage.getItem("somatic.lastBpm") || "", 10);
      const hrv = parseInt(localStorage.getItem("somatic.lastHrv") || "", 10);
      const vitals = {};
      if (Number.isFinite(bpm)) vitals.bpm = bpm;
      if (Number.isFinite(hrv)) vitals.hrv_ms = hrv;
      const inputs = { ...profile };
      const d = await analyzeHealth({ inputs, vitals, force });
      setData(d);
    } catch (e) {
      setError("Couldn’t generate report right now.");
      toast.error("Couldn’t generate report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { run(false); /* eslint-disable-next-line */ }, []);

  const primary = data?.risk?.primary;
  const secondary = data?.risk?.secondary || [];
  const analysis = data?.analysis;
  const bandColor = BAND_COLOR[primary?.band] || "#8A8280";

  return (
    <div className="relative max-w-md mx-auto px-5 pt-3 pb-24">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate("/insights")} className="w-9 h-9 rounded-xl bg-[#13131A] border border-[#1F1F2E] grid place-items-center hover:bg-[#191923]" data-testid="report-back">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h1 className="display text-[22px] font-semibold tracking-tight" data-testid="report-title">Your health report</h1>
      </div>
      <p className="text-sm text-[#8A8280] mt-1">Educational — not a diagnosis.</p>

      {loading && (
        <div className="mt-6 space-y-3" data-testid="report-loading">
          <div className="h-32 rounded-2xl bg-[#13131A] border border-[#1F1F2E] animate-pulse" />
          <div className="h-24 rounded-2xl bg-[#13131A] border border-[#1F1F2E] animate-pulse" />
          <div className="h-24 rounded-2xl bg-[#13131A] border border-[#1F1F2E] animate-pulse" />
        </div>
      )}

      {error && !loading && (
        <div className="mt-6 rounded-2xl bg-[#1A1118] border border-[#E8445A]/40 p-5 text-sm" data-testid="report-error">
          {error}
          <button onClick={() => run(true)} className="mt-3 inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-[#E8445A] text-[#0A0A0F] font-medium">
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
        </div>
      )}

      {data && !loading && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
            className="mt-5 rounded-2xl bg-[#13131A] border p-5"
            style={{ borderColor: `${bandColor}55` }}
            data-testid="report-primary-card"
          >
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wider text-[#8A8280]">{primary?.modelUsed}</div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: bandColor }}>{primary?.band?.replace("_", " ")}</div>
            </div>
            <div className="display mt-2 text-6xl font-semibold tracking-tight" style={{ color: bandColor }} data-testid="report-primary-score">{primary?.score}<span className="text-2xl ml-1 text-[#8A8280]">%</span></div>
            <p className="mt-1 text-[12px] text-[#8A8280]">Estimated 10-year cardiovascular risk</p>
            {data.risk?.selectionRationale && <p className="mt-3 text-[11px] text-[#8A8280] leading-relaxed">{data.risk.selectionRationale}</p>}
            {secondary.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[#1F1F2E]" data-testid="report-secondary">
                <div className="text-[10px] uppercase tracking-wider text-[#8A8280] mb-1">Comparison</div>
                <div className="flex flex-wrap gap-1.5">
                  {secondary.map((s) => (
                    <span key={s.modelUsed} className="px-2 py-1 rounded-full text-[11px] bg-[#0F0F16] border border-[#1F1F2E] text-[#F0EDE8]">
                      {s.modelUsed}: <span style={{ color: BAND_COLOR[s.band] || "#F0EDE8" }}>{s.score}%</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          {analysis?.summary && (
            <div className="mt-4 rounded-2xl bg-[#13131A] border border-[#1F1F2E] p-5" data-testid="report-summary">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#F5C87A]"><ShieldCheck className="w-3 h-3" /> Plain-language summary</div>
              <p className="mt-2 text-[14px] leading-relaxed text-[#F0EDE8]">{analysis.summary}</p>
            </div>
          )}

          {(analysis?.tests?.length || 0) > 0 && (
            <Card title="Tests to consider" icon={<ListChecks className="w-3 h-3" />} testid="report-tests">
              <div className="space-y-2.5">
                {analysis.tests.map((t, i) => (
                  <div key={i} className="rounded-xl bg-[#0F0F16] border border-[#1F1F2E] p-3" data-testid={`report-test-${i}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-[14px]">{t.name}</div>
                      {t.priority && <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: priorityBg(t.priority), color: priorityFg(t.priority) }}>{t.priority}</span>}
                    </div>
                    <p className="mt-1.5 text-[12px] text-[#8A8280] leading-relaxed">{t.why}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {(analysis?.lifestyle?.length || 0) > 0 && (
            <Card title="Lifestyle suggestions" icon={<Heart className="w-3 h-3 text-[#E8445A]" />} testid="report-lifestyle">
              <div className="space-y-2.5">
                {analysis.lifestyle.map((l, i) => (
                  <div key={i} className="rounded-xl bg-[#0F0F16] border border-[#1F1F2E] p-3" data-testid={`report-lifestyle-${i}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-[14px]">{l.action}</div>
                      {l.effortLevel && <span className="text-[9px] uppercase tracking-wider text-[#8A8280]">{l.effortLevel} effort</span>}
                    </div>
                    <p className="mt-1.5 text-[12px] text-[#8A8280] leading-relaxed">{l.why}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {(analysis?.affirmations?.length || 0) > 0 && (
            <Card title="Louise-Hay-inspired affirmations" icon={<Sparkles className="w-3 h-3 text-[#F5C87A]" />} testid="report-affirmations" gold>
              <div className="space-y-3">
                {analysis.affirmations.map((a, i) => (
                  <div key={i} className="rounded-xl bg-[#0F0F16] border border-[#F5C87A]/30 p-4" data-testid={`report-affirmation-${i}`}>
                    <p className="serif text-[18px] leading-snug text-[#F0EDE8]">“{a.text}”</p>
                    {a.beliefPattern && (
                      <p className="mt-2 text-[11px] uppercase tracking-wider text-[#F5C87A]">Belief Louise associated with this</p>
                    )}
                    {a.beliefPattern && <p className="text-[12px] text-[#8A8280] leading-relaxed">{a.beliefPattern}</p>}
                    {a.rationale && (<>
                      <p className="mt-2 text-[11px] uppercase tracking-wider text-[#F5C87A]">Why this makes sense</p>
                      <p className="text-[12px] text-[#8A8280] leading-relaxed">{a.rationale}</p>
                    </>)}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[10px] text-[#6E6862]">Inspired by Louise L. Hay’s teachings — paraphrased, not quoted.</p>
            </Card>
          )}

          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-[#13131A] border border-[#F5A972]/30 p-3.5 text-[12px]" data-testid="report-disclaimer">
            <AlertTriangle className="w-4 h-4 text-[#F5A972] shrink-0 mt-0.5" />
            <span className="text-[#F0EDE8]">{analysis?.disclaimer || "Not a diagnosis. Consider speaking with a clinician about anything that concerns you."}</span>
          </div>

          {(primary?.limitations || []).length > 0 && (
            <details className="mt-3 rounded-2xl bg-[#13131A] border border-[#1F1F2E] p-4 text-[12px]" data-testid="report-limitations">
              <summary className="cursor-pointer text-[#8A8280]">Model limitations &amp; transparency</summary>
              <ul className="mt-2 list-disc pl-4 space-y-1 text-[#8A8280]">
                {(primary.limitations || []).map((l, i) => (<li key={i}>{l}</li>))}
              </ul>
            </details>
          )}

          <button onClick={() => run(true)} className="mt-4 w-full inline-flex items-center justify-center gap-1.5 h-11 rounded-xl bg-[#13131A] border border-[#1F1F2E] text-sm hover:bg-[#191923]" data-testid="report-refresh">
            <RefreshCw className="w-4 h-4" /> Generate fresh report
          </button>
        </>
      )}
    </div>
  );
}

function Card({ title, icon, children, testid, gold }) {
  return (
    <div className={`mt-4 rounded-2xl bg-[#13131A] border p-5 ${gold ? "border-[#F5C87A]/30" : "border-[#1F1F2E]"}`} data-testid={testid}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#F5C87A]">{icon}{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
function priorityBg(p) {
  return { urgent: "rgba(232,68,90,0.15)", soon: "rgba(245,169,114,0.15)", routine: "rgba(125,211,160,0.12)" }[p] || "rgba(138,130,128,0.15)";
}
function priorityFg(p) {
  return { urgent: "#E8445A", soon: "#F5A972", routine: "#7DD3A0" }[p] || "#8A8280";
}
