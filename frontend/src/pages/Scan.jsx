import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Camera, Fingerprint, Lock, X, BellRing, Stethoscope } from "lucide-react";
import BeatingHeart3D from "@/components/BeatingHeart3D";
import { notifyMe } from "@/lib/api";
import { toast } from "sonner";

const TABS = [
  { id: "rppg", label: "Face", icon: Camera, sub: "Front camera · contactless", locked: false },
  { id: "ppg", label: "Finger", icon: Fingerprint, sub: "Rear camera + flash", locked: false },
  { id: "auscult", label: "Auscultation", icon: Stethoscope, sub: "Heart & lung sounds", locked: true },
];

export default function Scan() {
  const navigate = useNavigate();
  const [active, setActive] = useState("rppg");
  const [showLock, setShowLock] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const tab = TABS.find((t) => t.id === active);

  const launch = () => {
    if (tab.locked) { setShowLock(true); return; }
    const url = `/aisteth.html${active === "ppg" ? "?mode=finger" : ""}`;
    window.location.href = url;
  };

  const submitNotify = async (e) => {
    e.preventDefault();
    if (!email || !email.includes("@")) { toast.error("Enter a valid email"); return; }
    setBusy(true);
    try { await notifyMe("auscultation", email); toast.success("We'll let you know when it's ready"); setShowLock(false); setEmail(""); }
    catch { toast.error("Something went wrong"); }
    finally { setBusy(false); }
  };

  return (
    <div className="relative max-w-md mx-auto px-5 pt-3 pb-6">
      <h1 className="display text-[24px] font-semibold tracking-tight">Scan</h1>
      <p className="mt-0.5 text-sm text-[#8A8280]">Choose how to listen to your body today.</p>

      <div className="mt-5 grid grid-cols-3 gap-2" data-testid="scan-tabs">
        {TABS.map((t) => {
          const isActive = active === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => { setActive(t.id); if (t.locked) setShowLock(true); }}
              className={`relative rounded-2xl border p-3 flex flex-col items-center gap-1.5 text-center transition-all ${isActive && !t.locked ? "bg-[#1A1118] border-[#E8445A]/40" : t.locked ? "bg-[#0F0F16] border-[#1F1F2E] opacity-70" : "bg-[#13131A] border-[#1F1F2E] hover:bg-[#191923]"}`}
              data-testid={`scan-tab-${t.id}`}
            >
              {t.locked && <Lock className="absolute top-1.5 right-1.5 w-3 h-3 text-[#8A8280]" />}
              <Icon className={`w-5 h-5 ${isActive && !t.locked ? "text-[#E8445A]" : "text-[#8A8280]"}`} />
              <div className="text-[12px] font-medium">{t.label}</div>
              {t.locked && <div className="text-[9px] uppercase tracking-wider text-[#8A8280]">Coming soon</div>}
            </button>
          );
        })}
      </div>

      {!tab.locked && (
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-5 rounded-3xl bg-[#13131A] border border-[#1F1F2E] p-5"
        >
          <div className="flex items-center justify-center my-2">
            <BeatingHeart3D bpm={60} hrv={28} size={260} />
          </div>
          <div className="text-center">
            <h3 className="display text-xl font-semibold tracking-tight">{active === "rppg" ? "Face Scan" : "Finger Scan"}</h3>
            <p className="mt-1 text-sm text-[#8A8280]">{active === "rppg" ? "Hold still. Keep your face gently in the frame." : "Place your fingertip lightly over the rear camera + flash."}</p>
            <p className="mt-1 text-[11px] text-[#8A8280]">About 30 seconds. The 3D heart will sync with your detected pulse.</p>
          </div>
          <button
            onClick={launch}
            className="mt-5 w-full inline-flex items-center justify-center gap-1.5 h-12 rounded-2xl bg-[#E8445A] text-[#0A0A0F] font-semibold hover:bg-[#F26478] transition-colors scan-cta-shadow"
            data-testid="scan-start-button"
          >
            Begin scan
          </button>
          <p className="mt-2 text-[10px] text-center text-[#8A8280]">Wellness signal · not a medical diagnosis</p>
        </motion.div>
      )}

      {showLock && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={() => setShowLock(false)} data-testid="auscult-locked-sheet">
          <motion.div
            initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-[#13131A] border-t sm:border border-[#1F1F2E] sm:rounded-3xl rounded-t-3xl p-6"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-2xl bg-[#1A1118] border border-[#E8445A]/40 grid place-items-center">
                  <Stethoscope className="w-5 h-5 text-[#E8445A]" />
                </span>
                <div>
                  <h3 className="display text-lg font-semibold">Auscultation Mode</h3>
                  <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] uppercase tracking-wider text-[#F5C87A]"><Lock className="w-2.5 h-2.5" /> In development</span>
                </div>
              </div>
              <button onClick={() => setShowLock(false)} className="text-[#8A8280] hover:text-[#F0EDE8]"><X className="w-5 h-5" /></button>
            </div>
            <p className="mt-4 text-sm text-[#F0EDE8] leading-relaxed">
              Listen to your heart and lung sounds using your device microphone. Our AI classifies patterns in real time.
            </p>
            <form onSubmit={submitNotify} className="mt-5 space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-[#8A8280]">Get notified when it lands</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-[#0A0A0F] border border-[#1F1F2E] rounded-xl h-11 px-3 text-[#F0EDE8] placeholder:text-[#8A8280]"
                data-testid="auscult-notify-email"
              />
              <button type="submit" disabled={busy} className="w-full inline-flex items-center justify-center gap-1.5 h-11 rounded-xl bg-[#E8445A] text-[#0A0A0F] font-semibold hover:bg-[#F26478] disabled:opacity-50" data-testid="auscult-notify-submit">
                <BellRing className="w-4 h-4" /> {busy ? "Saving…" : "Notify me"}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
