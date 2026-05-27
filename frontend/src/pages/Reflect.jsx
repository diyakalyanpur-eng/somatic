import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { getAffirmationToday, createJournal, logPractice, getSnapshot } from "@/lib/api";
import { Sparkles, BookOpen, Wind, Heart, Check } from "lucide-react";
import { toast } from "sonner";
import { nervousSystemState } from "@/lib/wellness";

export default function Reflect() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [aff, setAff] = useState(null);
  const [absorbed, setAbsorbed] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdRef = useRef(null);
  const [journalText, setJournalText] = useState("");
  const [journalSaved, setJournalSaved] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [needsBreath, setNeedsBreath] = useState(false);

  useEffect(() => {
    (async () => {
      try { const d = await getAffirmationToday(); setAff(d); } catch {}
      if (id) {
        try {
          const d = await getSnapshot(id);
          const f = d.row?.fused || {};
          const ns = nervousSystemState(f.hrv_ms);
          setNeedsBreath(ns.key === "moderate" || ns.key === "high");
        } catch {}
      }
    })();
  }, [id]);

  // Hold-to-absorb (5 second press)
  const startHold = () => {
    if (absorbed) return;
    const start = Date.now();
    holdRef.current = setInterval(() => {
      const elapsed = (Date.now() - start) / 5000;
      if (elapsed >= 1) {
        clearInterval(holdRef.current);
        setHoldProgress(1);
        setAbsorbed(true);
        if (navigator.vibrate) navigator.vibrate(40);
        logPractice("affirmation").catch(() => {});
      } else {
        setHoldProgress(elapsed);
      }
    }, 30);
  };
  const cancelHold = () => {
    if (absorbed) return;
    clearInterval(holdRef.current);
    setHoldProgress(0);
  };

  const saveJournal = async () => {
    if (!journalText.trim()) { toast.error("Write a few words first"); return; }
    try {
      await createJournal({ text: journalText.trim(), prompt: aff?.journal, snapshotId: id || null });
      await logPractice("journal", { snapshotId: id || null });
      setJournalSaved(true);
      toast.success("Thank you for writing");
    } catch { toast.error("Couldn't save right now"); }
  };

  const finish = async () => {
    try { await logPractice("reflection", { snapshotId: id || null }); } catch {}
    setCompleted(true);
    setTimeout(() => navigate("/"), 2200);
  };

  return (
    <div className="relative max-w-md mx-auto px-5 pt-3 pb-6">
      <h1 className="display text-[22px] font-semibold tracking-tight">Today's practice</h1>
      <p className="text-sm text-[#8A8280]">Move through at your own pace.</p>

      {/* Affirmation */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="mt-5 rounded-3xl bg-[#13131A] gold-border p-6 relative overflow-hidden"
        data-testid="reflect-affirmation"
      >
        <div className="absolute inset-0 pointer-events-none soft-breath" style={{ background: "radial-gradient(circle at 50% 50%, rgba(245,200,122,0.08), transparent 60%)" }} />
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#F5C87A]"><Sparkles className="w-3 h-3" /> Affirmation</div>
        <p className="serif relative mt-3 text-[22px] leading-snug text-[#F0EDE8]" data-testid="reflect-affirmation-text">“{aff?.affirmation?.text || "I release all tension. I am at peace."}”</p>
        <button
          onMouseDown={startHold} onMouseUp={cancelHold} onMouseLeave={cancelHold}
          onTouchStart={startHold} onTouchEnd={cancelHold} onTouchCancel={cancelHold}
          className={`mt-5 relative w-full h-12 rounded-full border overflow-hidden font-medium transition-colors ${absorbed ? "bg-[#F5C87A]/15 border-[#F5C87A]/50 text-[#F5C87A]" : "bg-transparent border-[#F5C87A]/40 text-[#F5C87A] hover:bg-[#F5C87A]/10"}`}
          data-testid="reflect-hold-absorb"
        >
          <span className="absolute inset-y-0 left-0 bg-[#F5C87A]/15 transition-all" style={{ width: `${holdProgress * 100}%` }} />
          <span className="relative inline-flex items-center justify-center gap-1.5">
            {absorbed ? (<><Check className="w-4 h-4" /> Absorbed</>) : "Hold to absorb"}
          </span>
        </button>
      </motion.div>

      {/* Mirror */}
      <div className="mt-5 rounded-2xl bg-[#13131A] border border-[#1F1F2E] p-5" data-testid="reflect-mirror">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#8A8280]"><Heart className="w-3 h-3 text-[#E8445A]" /> Mirror work</div>
        <p className="mt-2 text-sm text-[#8A8280]">Look at yourself and say aloud:</p>
        <p className="serif mt-2 text-[19px] leading-snug text-[#F0EDE8]">“{aff?.mirror || "I love and accept myself exactly as I am right now."}”</p>
      </div>

      {/* Journal */}
      <div className="mt-5 rounded-2xl bg-[#13131A] border border-[#1F1F2E] p-5" data-testid="reflect-journal">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#8A8280]"><BookOpen className="w-3 h-3 text-[#F5C87A]" /> Journal · 2 minutes</div>
        <p className="mt-2 text-sm text-[#F0EDE8]">{aff?.journal || "What emotion have you been carrying today that you haven't named yet?"}</p>
        <textarea
          value={journalText} onChange={(e) => { setJournalText(e.target.value); setJournalSaved(false); }}
          rows={4} placeholder="Write freely…"
          className="mt-3 w-full bg-[#0A0A0F] border border-[#1F1F2E] rounded-xl p-3 text-[14px] text-[#F0EDE8] placeholder:text-[#8A8280] resize-none"
          data-testid="reflect-journal-input"
        />
        <div className="mt-2 flex justify-end">
          <button onClick={saveJournal} disabled={journalSaved} className="h-9 px-4 rounded-full bg-[#F5C87A]/15 border border-[#F5C87A]/40 text-[#F5C87A] text-sm hover:bg-[#F5C87A]/25 disabled:opacity-50" data-testid="reflect-journal-save">{journalSaved ? "Saved" : "Save entry"}</button>
        </div>
      </div>

      {/* Breathwork (only when stress is elevated) */}
      {(needsBreath || true) && (
        <div className="mt-5 rounded-2xl bg-[#13131A] border border-[#1F1F2E] p-5" data-testid="reflect-breath">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#8A8280]"><Wind className="w-3 h-3 text-[#E8445A]" /> Box breathing · 4 rounds</div>
          <BreathBox />
        </div>
      )}

      <button
        onClick={finish}
        className="mt-6 w-full inline-flex items-center justify-center gap-1.5 h-12 rounded-2xl bg-[#E8445A] text-[#0A0A0F] font-semibold hover:bg-[#F26478] scan-cta-shadow"
        data-testid="reflect-finish"
      >
        Complete practice
      </button>

      <AnimatePresence>
        {completed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-[#0A0A0F]/95 grid place-items-center" data-testid="reflect-completion">
            <div className="text-center px-6">
              <div className="mx-auto w-20 h-20 rounded-full bg-[#E8445A]/15 border border-[#E8445A]/40 grid place-items-center soft-breath">
                <Heart className="w-9 h-9 text-[#E8445A]" />
              </div>
              <h2 className="display mt-5 text-2xl font-semibold">Practice complete.</h2>
              <p className="mt-2 text-[#8A8280]">Come back tomorrow.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BreathBox() {
  const [phase, setPhase] = useState("inhale");
  const phases = [
    { key: "inhale", label: "Breathe in", scale: 1.5, ms: 4000 },
    { key: "hold-in", label: "Hold", scale: 1.5, ms: 4000 },
    { key: "exhale", label: "Breathe out", scale: 0.85, ms: 4000 },
    { key: "hold-out", label: "Hold", scale: 0.85, ms: 4000 },
  ];
  useEffect(() => {
    let idx = 0;
    setPhase(phases[0].key);
    const tick = () => {
      idx = (idx + 1) % phases.length;
      setPhase(phases[idx].key);
    };
    const timer = setInterval(tick, 4000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const cur = phases.find((p) => p.key === phase) || phases[0];
  return (
    <div className="mt-3 flex flex-col items-center">
      <motion.div
        animate={{ scale: cur.scale }}
        transition={{ duration: 4, ease: "easeInOut" }}
        className="w-32 h-32 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(232,68,90,0.35), rgba(232,68,90,0.05) 60%, transparent 80%)" }}
      />
      <div className="mt-3 display text-base font-medium text-[#F0EDE8]">{cur.label}</div>
    </div>
  );
}
