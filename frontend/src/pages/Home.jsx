import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { getStreak, listSnapshots, http } from "@/lib/api";
import { getProfile, getLatestBpm, getLatestHrv, timeAwareGreeting } from "@/lib/wellness";
import { Activity, Flame, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

// Stale-while-revalidate cache — home screen renders instantly from last-known
// values while fresh data loads in the background.
const HOME_CACHE_KEY = "somatic.homeCache";
function readHomeCache() {
  try { return JSON.parse(localStorage.getItem(HOME_CACHE_KEY) || "{}"); } catch { return {}; }
}
function writeHomeCache(patch) {
  try { localStorage.setItem(HOME_CACHE_KEY, JSON.stringify({ ...readHomeCache(), ...patch })); } catch {}
}

export default function Home() {
  const navigate = useNavigate();
  const profile = getProfile();

  // Seed from cache — no loading state on repeat opens
  const _c = readHomeCache();
  const [streak, setStreak] = useState(_c.streak ?? 0);
  const [snapshots, setSnapshots] = useState(_c.snapshots ?? []);
  const [pendingScan, setPendingScan] = useState(null);
  const [savingPending, setSavingPending] = useState(false);
  const bpm = getLatestBpm() || 60;
  const hrv = getLatestHrv();

  useEffect(() => {
    // Refresh in background — UI already shows cached values
    (async () => {
      try {
        const d = await getStreak();
        const val = d.streak || 0;
        setStreak(val);
        writeHomeCache({ streak: val });
      } catch {}
      try {
        const d = await listSnapshots({ limit: 1 });
        const rows = d.rows || [];
        setSnapshots(rows);
        writeHomeCache({ snapshots: rows });
      } catch {}
    })();
    try {
      const raw = localStorage.getItem("somatic.pendingScan");
      if (raw) setPendingScan(JSON.parse(raw));
    } catch {}
  }, []);

  const savePendingScan = async () => {
    if (!pendingScan || savingPending) return;
    setSavingPending(true);
    try {
      const { data } = await http.post("/snapshot", pendingScan);
      if (!data?.ok || !data?.id) throw new Error("Save response missing id");
      localStorage.removeItem("somatic.pendingScan");
      setPendingScan(null);
      navigate(`/results/${data.id}`);
    } catch {
      toast.error("Still couldn't save — check your connection and try again.");
    } finally {
      setSavingPending(false);
    }
  };

  return (
    <div className="relative max-w-md mx-auto px-5 pt-3 pb-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="display text-[26px] font-semibold tracking-tight" data-testid="home-greeting">
            {timeAwareGreeting(profile?.phone || profile?.name)}
          </h1>
          <p className="mt-0.5 text-sm text-[#8A8280]">How is your heart today?</p>
        </div>
      </div>

      <div className="mt-2 flex flex-col items-center" data-testid="home-heart-wrap">
        <button
          type="button"
          onClick={() => navigate("/scan")}
          className="relative outline-none focus-visible:ring-2 focus-visible:ring-[#E8445A] rounded-full"
          aria-label="Tap to begin scan"
          data-testid="home-heart-tap"
        >
          <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
            <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle, rgba(232,68,90,0.10) 0%, transparent 70%)" }} />
            <div className="absolute rounded-full border border-[#E8445A]/20" style={{ width: 140, height: 140, animation: "pulse-ring 2.4s ease-out infinite" }} />
            <div className="absolute rounded-full border border-[#E8445A]/10" style={{ width: 180, height: 180, animation: "pulse-ring 2.4s ease-out 0.6s infinite" }} />
            <div className="flex flex-col items-center justify-center gap-1">
              <div className="display text-6xl font-semibold tracking-tight leading-none text-[#F0EDE8]" data-testid="home-bpm">{bpm}</div>
              <div className="text-[11px] uppercase tracking-wider text-[#8A8280]">bpm · tap to scan</div>
            </div>
          </div>
        </button>
      </div>

      {pendingScan && (
        <motion.div
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex items-center gap-3 rounded-2xl border border-[#F5C87A]/40 bg-[#F5C87A]/10 px-4 py-3"
          data-testid="home-pending-scan-banner"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-[#F5C87A]" />
          <p className="flex-1 text-sm text-[#F0EDE8]">You have an unsaved scan.</p>
          <button
            onClick={savePendingScan}
            disabled={savingPending}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#F5C87A] hover:text-[#f7d89a] disabled:opacity-60 transition-colors"
          >
            {savingPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {savingPending ? "Saving…" : "Save now"}
            {!savingPending && <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </motion.div>
      )}

      <div className="mt-6 flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5" data-testid="home-cards-strip">
        <SnapshotCard
          icon={<Activity className="w-3.5 h-3.5 text-[#E8445A]" />}
          label="Last HRV"
          value={hrv != null ? `${hrv}` : "—"}
          suffix={hrv != null ? "ms" : ""}
        />
        <SnapshotCard
          icon={<Flame className="w-3.5 h-3.5 text-[#F5C87A]" />}
          label="Streak"
          value={`${streak}`}
          suffix={`day${streak === 1 ? "" : "s"}`}
        />
      </div>

      <button
        onClick={() => navigate("/scan")}
        className="mt-6 w-full inline-flex items-center justify-center gap-1.5 h-12 rounded-2xl bg-[#E8445A] text-[#0A0A0F] font-semibold hover:bg-[#F26478] transition-colors scan-cta-shadow"
        data-testid="home-start-scan"
      >
        Start a scan <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function SnapshotCard({ icon, label, value, suffix }) {
  return (
    <div className="min-w-[150px] rounded-2xl bg-[#13131A] border border-[#1F1F2E] p-3.5" data-testid="home-snapshot-card">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#8A8280]">{icon}{label}</div>
      <div className="mt-2 display text-xl font-semibold">
        {value}{suffix ? <span className="text-[11px] text-[#8A8280] ml-1">{suffix}</span> : null}
      </div>
    </div>
  );
}
