import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { setProfile, getProfile } from "@/lib/wellness";
import BeatingHeart3D from "@/components/BeatingHeart3D";
import { ChevronRight, Sparkles } from "lucide-react";

const SLIDES = [
  {
    title: "Your body is always speaking.",
    sub: "Learn to listen.",
    visual: "heart",
  },
  {
    title: "Measure. Reflect. Heal.",
    sub: "We combine real-time physiological signals with emotional insight to help you understand yourself better.",
    visual: "wave",
  },
  {
    title: "Inspired by Louise L. Hay",
    sub: "Thoughts shape feelings. Feelings shape health. This app helps you see the patterns.",
    visual: "sparkle",
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const existing = getProfile();
  useEffect(() => { if (existing?.onboarded) navigate("/", { replace: true }); }, [existing, navigate]);

  const next = () => setStep((s) => s + 1);
  const skip = () => finish();
  const finish = () => {
    setProfile({ onboarded: true, name: name.trim() || null, since: new Date().toISOString() });
    navigate("/", { replace: true });
  };

  if (step < SLIDES.length) {
    const s = SLIDES[step];
    return (
      <div className="relative flex flex-col" style={{ minHeight: '100dvh' }} data-testid="onboarding">
        <div className="absolute inset-0 bg-top-band pointer-events-none" />
        <div className="relative flex-1 flex flex-col items-center justify-center px-6 text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
              className="flex flex-col items-center"
            >
              <div className="relative" style={{ width: 280, height: 280 }}>
                {s.visual === "heart" && <BeatingHeart3D bpm={58} hrv={28} size={280} />}
                {s.visual === "wave" && <WaveArt />}
                {s.visual === "sparkle" && <SparkleArt />}
              </div>
              <h1 className="display mt-8 text-3xl sm:text-4xl font-semibold tracking-tight max-w-md" data-testid="onboarding-headline">
                {s.title}
              </h1>
              <p className="mt-4 text-[15px] text-[#8A8280] max-w-sm leading-relaxed">{s.sub}</p>
            </motion.div>
          </AnimatePresence>
          {step === SLIDES.length - 1 && (
            <div className="mt-8 w-full max-w-sm">
              <label className="text-[11px] uppercase tracking-wider text-[#8A8280]">What shall we call you?</label>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Your first name"
                className="mt-2 w-full text-center bg-[#13131A] border border-[#1F1F2E] rounded-xl h-12 px-4 text-[#F0EDE8] placeholder:text-[#8A8280]"
                data-testid="onboarding-name-input"
              />
              <p className="mt-2 text-[10px] text-[#8A8280]">Stays on this device. Never sent to a server.</p>
            </div>
          )}
        </div>
        <div className="relative pb-10 px-6">
          <div className="flex items-center justify-center gap-1.5 mb-5" data-testid="onboarding-dots">
            {SLIDES.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-8 bg-[#E8445A]" : "w-2 bg-[#1F1F2E]"}`} />
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
            <button onClick={skip} className="text-sm text-[#8A8280] hover:text-[#F0EDE8] transition-colors" data-testid="onboarding-skip">Skip</button>
            {step < SLIDES.length - 1 ? (
              <button
                onClick={next}
                className="inline-flex items-center gap-1.5 h-12 px-6 rounded-full bg-[#F0EDE8] text-[#0A0A0F] font-medium hover:bg-white transition-colors"
                data-testid="onboarding-next"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={finish}
                className="inline-flex items-center gap-1.5 h-12 px-6 rounded-full bg-[#E8445A] text-[#0A0A0F] font-semibold hover:bg-[#F26478] transition-colors scan-cta-shadow"
                data-testid="onboarding-get-started"
              >
                Get Started <Sparkles className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
  return null;
}

function WaveArt() {
  return (
    <svg viewBox="0 0 300 200" width="280" height="200" className="mx-auto soft-breath">
      <defs>
        <linearGradient id="wg" x1="0" x2="1">
          <stop offset="0" stopColor="#E8445A" stopOpacity="0" />
          <stop offset="0.5" stopColor="#E8445A" />
          <stop offset="1" stopColor="#F5C87A" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M 0 100 Q 40 100 60 100 L 90 100 L 100 60 L 110 140 L 120 80 L 130 100 L 180 100 Q 220 100 240 100 L 300 100" fill="none" stroke="url(#wg)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="100" cy="100" r="3" fill="#E8445A" />
      <circle cx="110" cy="100" r="3" fill="#E8445A" />
    </svg>
  );
}
function SparkleArt() {
  return (
    <div className="relative w-[280px] h-[280px] grid place-items-center">
      <div className="absolute inset-0 rose-glow soft-breath" />
      <Sparkles className="w-20 h-20 text-[#F5C87A]" />
    </div>
  );
}
