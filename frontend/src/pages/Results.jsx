import { useEffect, useState, Suspense, lazy } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { getSnapshot, logPractice } from "@/lib/api";
import { setLatestVitals } from "@/lib/wellness";
import { Activity, Droplet, Wind, ChevronRight, Save } from "lucide-react";
import { toast } from "sonner";

// Three.js is ~600KB — lazy load so it doesn't block the initial bundle
const BeatingHeart3D = lazy(() => import("@/components/BeatingHeart3D"));

export default function Results() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [snap, setSnap] = useState(null);
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

  return (
    <div className="relative max-w-md mx-auto px-5 pt-3 pb-6">
      <h1 className="display text-[22px] font-semibold tracking-tight">Your reading</h1>
      <p className="text-sm text-[#8A8280]">A wellness reflection, not a diagnosis.</p>

      <div className="mt-5 flex flex-col items-center">
        <Suspense fallback={<div style={{ width: 240, height: 240 }} />}>
          <BeatingHeart3D bpm={f.bpm || 60} hrv={f.hrv_ms || 30} size={240} />
        </Suspense>
        <div className="display mt-2 text-6xl font-semibold tracking-tight" data-testid="results-bpm">{f.bpm ?? "—"}</div>
        <div className="text-[11px] uppercase tracking-wider text-[#8A8280]">bpm</div>
        <p className="mt-1 text-[10px] text-[#8A8280]">Camera-based estimate · slight variation from a clinical reading is normal</p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2" data-testid="results-vital-grid">
        <Stat icon={<Activity className="w-3.5 h-3.5 text-[#E8445A]" />} label="HRV" value={f.hrv_ms != null ? `${f.hrv_ms} ms` : "—"} />
        <Stat icon={<Droplet className="w-3.5 h-3.5 text-[#F5C87A]" />} label="SpO₂" value={f.spo2 != null ? `${f.spo2}%` : "—"} />
        <Stat icon={<Wind className="w-3.5 h-3.5 text-[#8A8280]" />} label="Resp" value={f.brpm != null ? `${f.brpm}/min` : "—"} />
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
