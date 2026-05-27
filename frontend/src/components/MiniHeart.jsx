// Tiny pulsing heart in the top bar, paces at the user's last known BPM.
import { useMemo } from "react";

export default function MiniHeart({ bpm = 60, size = 22 }) {
  const dur = useMemo(() => {
    const safe = Math.max(35, Math.min(180, bpm || 60));
    return (60 / safe).toFixed(2) + "s";
  }, [bpm]);
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} aria-label={`Heartbeat ${bpm} bpm`}>
      <span
        className="absolute inset-0 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(232,68,90,0.4), rgba(232,68,90,0) 70%)", animation: `mh-glow ${dur} ease-in-out infinite` }}
      />
      <svg viewBox="0 0 24 24" width={size} height={size} style={{ animation: `mh-beat ${dur} ease-in-out infinite`, color: "#E8445A" }}>
        <path fill="currentColor" d="M12 21s-7-4.35-7-10a4.5 4.5 0 0 1 8-2.83A4.5 4.5 0 0 1 21 11c0 5.65-7 10-7 10z" />
      </svg>
      <style>{`@keyframes mh-beat { 0%,55%,100% { transform:scale(1); } 15% { transform:scale(1.18); } 30% { transform:scale(0.96); } } @keyframes mh-glow { 0%,55%,100% { opacity:.35; } 15% { opacity:.9; } }`}</style>
    </span>
  );
}
