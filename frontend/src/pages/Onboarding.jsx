import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { setProfile, getProfile } from "@/lib/wellness";
import { setPin } from "@/lib/pin";
import { ChevronRight, Sparkles, ShieldCheck, Check, Lock, Delete } from "lucide-react";

const PIN_LENGTH = 6;

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
  const [phone, setPhone] = useState("");
  const [gdprConsent, setGdprConsent] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  // PIN setup state
  const [pinDigits, setPinDigits] = useState([]);
  const [pinConfirm, setPinConfirm] = useState([]);
  const [pinStage, setPinStage] = useState("set"); // "set" | "confirm"
  const [pinError, setPinError] = useState("");

  const existing = getProfile();
  useEffect(() => { if (existing?.onboarded) navigate("/", { replace: true }); }, [existing, navigate]);

  const next = () => setStep((s) => s + 1);
  const skip = () => finish();

  const finish = async (pin = null) => {
    if (pin) await setPin(pin);
    setProfile({
      onboarded: true,
      phone: phone.trim() || null,
      gdprConsent: gdprConsent,
      gdprConsentDate: gdprConsent ? new Date().toISOString() : null,
      since: new Date().toISOString(),
    });
    navigate("/", { replace: true });
  };

  const validateAndNext = () => {
    if (phone.trim() && phone.replace(/[\s\-\+\(\)]/g, "").length < 7) {
      setPhoneError("Please enter a valid phone number");
      return;
    }
    if (!gdprConsent) {
      setPhoneError("Please accept the data agreement to continue");
      return;
    }
    setPhoneError("");
    next(); // go to PIN setup step
  };

  // PIN numpad handler
  const pinPress = (d) => {
    setPinError("");
    if (pinStage === "set") {
      const next_ = [...pinDigits, d];
      setPinDigits(next_);
      if (next_.length === PIN_LENGTH) {
        // Move to confirm
        setPinStage("confirm");
      }
    } else {
      const next_ = [...pinConfirm, d];
      setPinConfirm(next_);
      if (next_.length === PIN_LENGTH) {
        if (next_.join("") === pinDigits.join("")) {
          finish(next_.join(""));
        } else {
          setPinError("PINs don't match. Try again.");
          setPinDigits([]);
          setPinConfirm([]);
          setPinStage("set");
        }
      }
    }
  };

  const pinDel = () => {
    setPinError("");
    if (pinStage === "set") {
      setPinDigits((d) => d.slice(0, -1));
    } else {
      setPinConfirm((d) => d.slice(0, -1));
    }
  };

  const activePinDigits = pinStage === "set" ? pinDigits : pinConfirm;

  // Slides (steps 0–2), profile+GDPR (step 3), PIN setup (step 4)
  if (step < SLIDES.length) {
    const s = SLIDES[step];
    return (
      <div className="relative flex flex-col" style={{ minHeight: "100dvh" }} data-testid="onboarding">
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
                {s.visual === "heart" && <PulseArt />}
                {s.visual === "wave" && <WaveArt />}
                {s.visual === "sparkle" && <SparkleArt />}
              </div>
              <h1 className="display mt-8 text-3xl sm:text-4xl font-semibold tracking-tight max-w-md" data-testid="onboarding-headline">
                {s.title}
              </h1>
              <p className="mt-4 text-[15px] text-[#8A8280] max-w-sm leading-relaxed">{s.sub}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="relative pb-10 px-6">
          <div className="flex items-center justify-center gap-1.5 mb-5" data-testid="onboarding-dots">
            {[...SLIDES, "profile", "pin"].map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-8 bg-[#E8445A]" : "w-2 bg-[#1F1F2E]"}`} />
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
            <button onClick={skip} className="text-sm text-[#8A8280] hover:text-[#F0EDE8] transition-colors" data-testid="onboarding-skip">Skip</button>
            <button
              onClick={next}
              className="inline-flex items-center gap-1.5 h-12 px-6 rounded-full bg-[#F0EDE8] text-[#0A0A0F] font-medium hover:bg-white transition-colors"
              data-testid="onboarding-next"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 4 — PIN setup
  if (step === SLIDES.length + 1) {
    return (
      <div className="relative flex flex-col" style={{ minHeight: "100dvh" }} data-testid="onboarding-pin">
        <div className="absolute inset-0 bg-top-band pointer-events-none" />
        <div className="relative flex-1 flex flex-col items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-xs flex flex-col items-center"
          >
            <Lock className="w-8 h-8 text-[#E8445A] mb-4" />
            <h1 className="display text-2xl font-semibold tracking-tight text-center">
              {pinStage === "set" ? "Set a PIN" : "Confirm your PIN"}
            </h1>
            <p className="mt-2 text-[14px] text-[#8A8280] text-center">
              {pinStage === "set"
                ? "Protects your health data on this device."
                : "Enter the same PIN again to confirm."}
            </p>

            {/* Dot indicators */}
            <div className="mt-8 flex items-center justify-center gap-4">
              {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                <div
                  key={i}
                  className="w-3.5 h-3.5 rounded-full border-2 transition-all duration-150"
                  style={{
                    background: i < activePinDigits.length ? "#E8445A" : "transparent",
                    borderColor: i < activePinDigits.length ? "#E8445A" : "#2A2A3A",
                  }}
                />
              ))}
            </div>

            {pinError && (
              <p className="mt-3 text-[12px] text-[#E8445A] text-center">{pinError}</p>
            )}

            {/* Numpad */}
            <div className="mt-8 grid grid-cols-3 gap-3 w-full">
              {[1,2,3,4,5,6,7,8,9].map((n) => (
                <button
                  key={n}
                  onPointerDown={() => pinPress(String(n))}
                  className="w-full aspect-square rounded-2xl bg-[#13131A] border border-[#1F1F2E] text-[#F0EDE8] text-xl font-semibold active:bg-[#1F1F2E] active:scale-95 transition-all"
                >
                  {n}
                </button>
              ))}
              <div />
              <button
                onPointerDown={() => pinPress("0")}
                className="w-full aspect-square rounded-2xl bg-[#13131A] border border-[#1F1F2E] text-[#F0EDE8] text-xl font-semibold active:bg-[#1F1F2E] active:scale-95 transition-all"
              >
                0
              </button>
              <button
                onPointerDown={pinDel}
                className="w-full aspect-square rounded-2xl flex items-center justify-center text-[#8A8280] active:bg-[#1F1F2E] transition-colors"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        </div>

        <div className="relative pb-10 px-6 text-center">
          <button
            onClick={() => finish(null)}
            className="text-sm text-[#8A8280] hover:text-[#F0EDE8] transition-colors"
          >
            Skip — don't set a PIN
          </button>
        </div>
      </div>
    );
  }

  // Step 3 — phone number + GDPR
  return (
    <div className="relative flex flex-col" style={{ minHeight: "100dvh" }} data-testid="onboarding-profile">
      <div className="absolute inset-0 bg-top-band pointer-events-none" />
      <div className="relative flex-1 flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          <h1 className="display text-3xl font-semibold tracking-tight text-center">Almost there</h1>
          <p className="mt-2 text-[15px] text-[#8A8280] text-center leading-relaxed">
            Your phone number links your health data across devices and lets you share with family.
          </p>

          {/* Phone input */}
          <div className="mt-8">
            <label className="text-[11px] uppercase tracking-wider text-[#8A8280]">Phone number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setPhoneError(""); }}
              placeholder="+44 7700 900000"
              className="mt-2 w-full text-center bg-[#13131A] border border-[#1F1F2E] rounded-xl h-12 px-4 text-[#F0EDE8] placeholder:text-[#8A8280] focus:border-[#E8445A]/60 outline-none transition-colors"
              data-testid="onboarding-phone-input"
            />
            <p className="mt-1.5 text-[11px] text-[#8A8280] text-center">
              Used only to link your data with family members. Never sold or shared with third parties.
            </p>
          </div>

          {/* GDPR consent */}
          <div className="mt-6 rounded-2xl bg-[#13131A] border border-[#1F1F2E] p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#F5C87A] mb-3">
              <ShieldCheck className="w-3.5 h-3.5" /> Your data & privacy
            </div>
            <ul className="space-y-2 text-[12px] text-[#8A8280] leading-relaxed">
              <li className="flex items-start gap-2"><Check className="w-3 h-3 text-[#F5C87A] mt-0.5 shrink-0" />We collect your phone number, heart rate, HRV, SpO₂ and breathing rate — nothing more.</li>
              <li className="flex items-start gap-2"><Check className="w-3 h-3 text-[#F5C87A] mt-0.5 shrink-0" />Your data is stored on EU servers (GDPR compliant) and never sold to third parties.</li>
              <li className="flex items-start gap-2"><Check className="w-3 h-3 text-[#F5C87A] mt-0.5 shrink-0" />You can delete all your data at any time from the Profile page.</li>
              <li className="flex items-start gap-2"><Check className="w-3 h-3 text-[#F5C87A] mt-0.5 shrink-0" />This is a wellness tool — not a medical device. Results are indicative only.</li>
            </ul>

            {/* Consent checkbox */}
            <button
              type="button"
              onClick={() => { setGdprConsent((v) => !v); setPhoneError(""); }}
              className="mt-4 w-full flex items-center gap-3 text-left"
              data-testid="onboarding-gdpr-consent"
            >
              <div className={`w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center transition-colors ${gdprConsent ? "bg-[#E8445A] border-[#E8445A]" : "border-[#1F1F2E] bg-[#0A0A0F]"}`}>
                {gdprConsent && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="text-[12px] text-[#F0EDE8] leading-snug">
                I agree to the collection and processing of my health data as described above, in accordance with GDPR.
              </span>
            </button>
          </div>

          {phoneError && (
            <p className="mt-3 text-[12px] text-[#E8445A] text-center">{phoneError}</p>
          )}
        </motion.div>
      </div>

      <div className="relative pb-10 px-6">
        <div className="flex items-center justify-center gap-1.5 mb-5">
          {[...SLIDES, "profile", "pin"].map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-8 bg-[#E8445A]" : "w-2 bg-[#1F1F2E]"}`} />
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
          <button onClick={() => finish(null)} className="text-sm text-[#8A8280] hover:text-[#F0EDE8] transition-colors">Skip</button>
          <button
            onClick={validateAndNext}
            disabled={!gdprConsent}
            className="inline-flex items-center gap-1.5 h-12 px-6 rounded-full bg-[#E8445A] text-[#0A0A0F] font-semibold hover:bg-[#F26478] disabled:opacity-40 transition-colors scan-cta-shadow"
            data-testid="onboarding-get-started"
          >
            Next <Sparkles className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function PulseArt() {
  return (
    <div className="relative w-[280px] h-[280px] grid place-items-center">
      {[0, 0.5, 1.0].map((delay, i) => (
        <div key={i} className="absolute rounded-full border border-[#E8445A]"
          style={{ width: 80 + i * 60, height: 80 + i * 60, opacity: 0.6 - i * 0.18, animation: `pulse-ring 2.2s ease-out ${delay}s infinite` }} />
      ))}
      <div className="w-4 h-4 rounded-full bg-[#E8445A]" style={{ boxShadow: "0 0 18px rgba(232,68,90,0.7)" }} />
      <svg viewBox="0 0 280 60" width="220" height="44" className="absolute" style={{ bottom: 52 }}>
        <defs>
          <linearGradient id="ecg-g" x1="0" x2="1">
            <stop offset="0" stopColor="#E8445A" stopOpacity="0" />
            <stop offset="0.3" stopColor="#E8445A" />
            <stop offset="0.7" stopColor="#F5C87A" />
            <stop offset="1" stopColor="#F5C87A" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 30 L55 30 L70 30 L82 6 L94 54 L106 18 L118 30 L225 30 L280 30"
          fill="none" stroke="url(#ecg-g)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
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
