/**
 * IosInstallOverlay
 *
 * Full-screen guided overlay for iOS "Add to Home Screen".
 * Since Apple doesn't expose a JS install API, this is the most seamless
 * experience possible: a focused overlay that points the user to the one
 * tap they need to make, then auto-dismisses when they return.
 *
 * Flow:
 *   1. Overlay appears — shows app icon + animated arrow pointing down
 *   2. User taps Safari's Share button (below the viewport)
 *   3. Page fires visibilitychange → hidden  (share sheet opened)
 *   4. User taps "Add to Home Screen" in the share sheet
 *   5. Page fires visibilitychange → visible  (share sheet closed)
 *   6. Overlay auto-dismisses, optional success toast
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export default function IosInstallOverlay({ onClose }) {
  const [phase, setPhase] = useState("guide"); // "guide" | "watching"
  const phaseRef = useRef("guide");

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    function onVisibility() {
      if (document.hidden) {
        // User opened the share sheet — start watching
        setPhase("watching");
        phaseRef.current = "watching";
      } else if (phaseRef.current === "watching") {
        // They came back — close the overlay
        // (whether they added it or cancelled, we get out of the way)
        onClose();
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[100] flex flex-col items-center"
      style={{ background: "rgba(10,10,15,0.96)", backdropFilter: "blur(8px)" }}
    >
      {/* Dismiss */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 grid place-items-center text-white/60 hover:text-white hover:bg-white/20 transition-colors"
        style={{ marginTop: "env(safe-area-inset-top)" }}
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Main content — vertically centred, pulled up a bit so arrows have room */}
      <div className="flex flex-col items-center justify-center flex-1 px-8 pb-48 text-center">

        {/* App icon */}
        <motion.img
          src="/icons/icon-192.png"
          alt="Somatic"
          className="w-24 h-24 rounded-[22px] shadow-2xl mb-7"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 280, damping: 22 }}
          onError={(e) => {
            // Fallback heart icon if image missing
            e.target.style.display = "none";
          }}
        />

        <motion.h2
          className="text-2xl font-bold tracking-tight text-[#F0EDE8] mb-2"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
        >
          Add to Home Screen
        </motion.h2>

        <motion.p
          className="text-[15px] text-[#8A8280] leading-relaxed max-w-[260px]"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
        >
          Tap the{" "}
          <span className="inline-flex items-center gap-1 align-middle mx-0.5 px-2 py-0.5 rounded-lg bg-[#1F1F2E] text-[#F0EDE8] text-[13px] font-medium">
            {/* Safari share icon */}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            Share
          </span>{" "}
          button in Safari's toolbar below
        </motion.p>

        <motion.p
          className="mt-3 text-[13px] text-[#6E6862]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          then tap <span className="text-[#F0EDE8] font-medium">"Add to Home Screen"</span>
        </motion.p>
      </div>

      {/* Cascading arrows pointing down toward the Safari toolbar */}
      <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 18px)" }}
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ y: [0, 10, 0], opacity: [0.25, 1, 0.25] }}
            transition={{
              duration: 1.1,
              delay: i * 0.18,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <svg
              width="28"
              height="18"
              viewBox="0 0 28 18"
              fill="none"
              style={{ display: "block" }}
            >
              <polyline
                points="4,4 14,14 24,4"
                stroke="#E8445A"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>
        ))}

        {/* Glowing pill pointing at the toolbar */}
        <motion.div
          className="mt-1 px-5 py-2 rounded-full text-[12px] font-medium text-[#E8445A]"
          style={{
            background: "rgba(232,68,90,0.10)",
            border: "1px solid rgba(232,68,90,0.30)",
          }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          Safari toolbar
        </motion.div>
      </div>
    </motion.div>
  );
}
