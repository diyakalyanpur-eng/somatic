import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { getSnapshot, logPractice, generateInsight } from "@/lib/api";
import { nervousSystemState, emotionalReflection, setLatestVitals } from "@/lib/wellness";
import BeatingHeart3D from "@/components/BeatingHeart3D";
import { Heart, Activity, Droplet, Wind, ChevronRight, Save, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Results() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [snap, setSnap] = useState(null);
  const [insight, setInsight] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const d = await getSnapshot(id);
        setSnap(d.row);
        const f = d.row?.fused || {};
        setLatestVitals({ bpm: f.bpm, hrv_ms: f.hrv_ms });
      } catch { toast.error("Couldn't load that scan"); }
    })();
  }, [id]);

  const f = snap?.fused || {};
  const ns = nervousSystemState(f.hrv_ms);
  const reflection = emotionalReflection(ns, f.bpm, f.hrv_ms);

  const onGetInsight = async () => {
    if (insightLoading) return;
    setInsightLoading(true);
    try {
      const data = await generateInsight({
        snapshotId: id,
        nervousSystemStateKey: ns.key,
        vitals: { bpm: f.bpm, hrv_ms: f.hrv_ms },
        context: { practiceIntent: "reflection" },
      });
      setInsight(data?.text || "");
    } catch (e) {
      toast.error("Couldn't generate insight right now");
    } finally {
      setInsightLoading(false);
    }
  };

  return (
    <div className="relative max-w-md mx-auto px-5 pt-3 pb-6">
      <h1 className="display text-[22px] font-semibold tracking-tight">Your reading</h1>
      <p className="text-sm text-[#8A8280]">A wellness reflection, not a diagnosis.</p>

      <div className="mt-5 flex flex-col items-center">
        <BeatingHeart3D bpm={f.bpm || 60} hrv={f.hrv_ms || 30} size={240} />
        <div className="display mt-2 text-6xl font-semibold tracking-tight" data-testid="results-bpm">{f.bpm ?? "—"}</div>
        <div className="text-[11px] uppercase tracking-wider text-[#8A8280]">bpm</div>
        <p className="mt-1 text-[10px] text-[#8A8280]">Camera-based estimate · slight variation from a clinical reading is normal</p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2" data-testid="results-vital-grid">
        <Stat icon={<Activity className="w-3.5 h-3.5 text-[#E8445A]" />} label="HRV" value={f.hrv_ms != null ? `${f.hrv_ms} ms` : "—"} />
        <Stat icon={<Droplet className="w-3.5 h-3.5 text-[#F5C87A]" />} label="SpO₂" value={f.spo2 != null ? `${f.spo2}%` : "—"} />
        <Stat icon={<Wind className="w-3.5 h-3.5 text-[#8A8280]" />} label="Resp" value={f.brpm != null ? `${f.brpm}/min` : "—"} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="mt-5 rounded-2xl border p-4"
        style={{ background: "#13131A", borderColor: `${ns.color}55` }}
        data-testid="results-ns-state"
      >
        <div className="text-[10px] uppercase tracking-wider text-[#8A8280]">Nervous system state</div>
        <div className="mt-1 display text-xl font-semibold" style={{ color: ns.color }}>
          {ns.emoji} {ns.label}
        </div>
        <p className="mt-2 text-sm text-[#F0EDE8] leading-relaxed">{ns.blurb}</p>
      </motion.div>

      <div className="mt-5 rounded-2xl bg-[#13131A] gold-border p-5" data-testid="results-emotional-insight">
        <div className="text-[10px] uppercase tracking-wider text-[#F5C87A]">What your body may be telling you</div>
        <p className="serif mt-2 text-[17px] leading-snug text-[#F0EDE8]">{reflection}</p>
        {insight ? (
          <div className="mt-4 pt-4 border-t border-[#1F1F2E]" data-testid="results-ai-insight">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#F5C87A]">
              <Sparkles className="w-3 h-3" /> A deeper reflection
            </div>
            <p className="serif mt-2 text-[16px] leading-snug text-[#F0EDE8] whitespace-pre-wrap">{insight}</p>
          </div>
        ) : (
          <button
            onClick={onGetInsight}
            disabled={insightLoading}
            className="mt-4 w-full inline-flex items-center justify-center gap-1.5 h-11 rounded-full bg-[#F5C87A]/15 border border-[#F5C87A]/40 text-[#F5C87A] text-sm font-medium hover:bg-[#F5C87A]/25 disabled:opacity-60 transition-colors"
            data-testid="results-get-insight"
          >
            {insightLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Listening…</> : <><Sparkles className="w-3.5 h-3.5" /> Get a deeper insight</>}
          </button>
        )}
        <p className="mt-3 text-[10px] text-[#8A8280]">This is a wellness reflection, not a medical diagnosis.</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          onClick={() => { logPractice("scan", { snapshotId: id }).catch(()=>{}); navigate("/reflect/" + id); }}
          className="col-span-2 inline-flex items-center justify-center gap-1.5 h-12 rounded-2xl bg-[#E8445A] text-[#0A0A0F] font-semibold hover:bg-[#F26478] scan-cta-shadow"
          data-testid="results-start-practice"
        >
          Start today's practice <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => navigate("/")}
          className="col-span-2 inline-flex items-center justify-center gap-1.5 h-11 rounded-xl bg-[#13131A] border border-[#1F1F2E] hover:bg-[#191923] text-sm"
          data-testid="results-save-close"
        >
          <Save className="w-4 h-4" /> Save & close
        </button>
      </div>
    </div>
  );
}
function Stat({ icon, label, value }) {
  return (
    <div className="rounded-xl bg-[#13131A] border border-[#1F1F2E] p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#8A8280]">{icon}{label}</div>
      <div className="mt-1 display text-sm font-semibold">{value}</div>
    </div>
  );
}
