import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import BeatingHeart3D from "@/components/BeatingHeart3D";
import { getAffirmationToday, getStreak, listSnapshots, logPractice } from "@/lib/api";
import { getProfile, getLatestBpm, getLatestHrv, nervousSystemState, timeAwareGreeting } from "@/lib/wellness";
import { Heart, Activity, Flame, ChevronRight, Sparkles, BookOpen } from "lucide-react";
import { toast } from "sonner";

export default function Home() {
  const navigate = useNavigate();
  const profile = getProfile();
  const [aff, setAff] = useState(null);
  const [streak, setStreak] = useState(0);
  const [snapshots, setSnapshots] = useState([]);
  const bpm = getLatestBpm() || 60;
  const hrv = getLatestHrv();
  const ns = nervousSystemState(hrv);

  useEffect(() => {
    (async () => {
      try { const d = await getAffirmationToday(); setAff(d); } catch {}
      try { const d = await getStreak(); setStreak(d.streak || 0); } catch {}
      try { const d = await listSnapshots({ limit: 1 }); setSnapshots(d.rows || []); } catch {}
    })();
  }, []);

  return (
    <div className="relative max-w-md mx-auto px-5 pt-3 pb-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="display text-[26px] font-semibold tracking-tight" data-testid="home-greeting">{timeAwareGreeting(profile?.name)}</h1>
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
          <BeatingHeart3D bpm={bpm} hrv={hrv || 30} size={220} />
        </button>
        <div className="mt-4 text-center">
          <div className="display text-5xl font-semibold tracking-tight leading-none" data-testid="home-bpm">{bpm}</div>
          <div className="mt-1 text-[11px] uppercase tracking-wider text-[#8A8280]">bpm · tap to scan</div>
        </div>
      </div>

      <div className="mt-6 flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5" data-testid="home-cards-strip">
        <SnapshotCard
          icon={<Activity className="w-3.5 h-3.5 text-[#E8445A]" />}
          label="Last HRV"
          value={hrv != null ? `${hrv}` : "—"}
          suffix={hrv != null ? "ms" : ""}
        />
        <SnapshotCard
          icon={<Heart className="w-3.5 h-3.5" style={{ color: ns.color }} />}
          label="Nervous system"
          value={ns.label.split(" \u2014")[0]}
          accentColor={ns.color}
        />
        <SnapshotCard
          icon={<Flame className="w-3.5 h-3.5 text-[#F5C87A]" />}
          label="Streak"
          value={`${streak}`}
          suffix={`day${streak === 1 ? "" : "s"}`}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="mt-6 rounded-2xl bg-[#13131A] gold-border p-5"
        data-testid="home-affirmation-card"
      >
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#F5C87A]">
          <Sparkles className="w-3 h-3" /> Today's affirmation
        </div>
        <p className="serif mt-3 text-[22px] leading-snug text-[#F0EDE8]" data-testid="home-affirmation-text">
          “{aff?.affirmation?.text || "I am open to the healing power within me."}”
        </p>
        <div className="mt-5 flex justify-end">
          <button
            onClick={() => { logPractice("open_reflection").catch(()=>{}); navigate("/reflect"); }}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-[#F5C87A]/15 border border-[#F5C87A]/40 text-[#F5C87A] text-sm hover:bg-[#F5C87A]/25 transition-colors"
            data-testid="home-reflect-button"
          >
            <BookOpen className="w-3.5 h-3.5" /> Reflect
          </button>
        </div>
      </motion.div>

      <button
        onClick={() => navigate("/scan")}
        className="mt-5 w-full inline-flex items-center justify-center gap-1.5 h-12 rounded-2xl bg-[#E8445A] text-[#0A0A0F] font-semibold hover:bg-[#F26478] transition-colors scan-cta-shadow"
        data-testid="home-start-scan"
      >
        Start a scan <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function SnapshotCard({ icon, label, value, suffix, accentColor }) {
  return (
    <div className="min-w-[150px] rounded-2xl bg-[#13131A] border border-[#1F1F2E] p-3.5" data-testid="home-snapshot-card">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#8A8280]">{icon}{label}</div>
      <div className="mt-2 display text-xl font-semibold" style={accentColor ? { color: accentColor } : undefined}>
        {value}{suffix ? <span className="text-[11px] text-[#8A8280] ml-1">{suffix}</span> : null}
      </div>
    </div>
  );
}
