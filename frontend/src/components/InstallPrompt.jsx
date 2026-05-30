/**
 * InstallPrompt — auto-shows on first visit.
 *
 * Android : one-tap native install via beforeinstallprompt.
 * iOS     : full-screen visual overlay → user taps Safari Share → auto-dismisses.
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useInstall, detectStandalone } from "@/lib/useInstall";
import IosInstallOverlay from "@/components/IosInstallOverlay";

export default function InstallPrompt() {
  const { canInstall, isIos, install } = useInstall();
  const [dismissed, setDismissed] = useState(
    () => !!localStorage.getItem("somatic.installDismissed")
  );
  const [visible, setVisible] = useState(false);
  const [showIosOverlay, setShowIosOverlay] = useState(false);

  useEffect(() => {
    if (detectStandalone()) return;
    if (dismissed) return;

    if (isIos) {
      const t = setTimeout(() => setVisible(true), 3500);
      return () => clearTimeout(t);
    }
    if (canInstall) setVisible(true);
  }, [canInstall, isIos, dismissed]);

  function dismiss() {
    localStorage.setItem("somatic.installDismissed", "1");
    setDismissed(true);
    setVisible(false);
  }

  async function handleInstall() {
    if (isIos) {
      setVisible(false);
      setShowIosOverlay(true);
    } else {
      const accepted = await install();
      if (accepted) setVisible(false);
    }
  }

  return (
    <>
      {/* Bottom banner */}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 px-4"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto max-w-md rounded-2xl bg-[#13131A] border border-[#1F1F2E] p-4 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src="/icons/icon-192.png"
                    alt="Somatic"
                    className="w-11 h-11 rounded-2xl flex-shrink-0"
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                  <div>
                    <p className="font-semibold text-[#F0EDE8] text-sm leading-snug">
                      Add Somatic to your home screen
                    </p>
                    <p className="text-[11px] text-[#8A8280] mt-0.5">
                      Works offline · instant access · no App Store
                    </p>
                  </div>
                </div>
                <button
                  onClick={dismiss}
                  className="text-[#8A8280] hover:text-[#F0EDE8] flex-shrink-0 mt-0.5"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={handleInstall}
                className="mt-3 w-full h-10 rounded-xl bg-[#E8445A] text-[#0A0A0F] text-sm font-semibold hover:bg-[#F26478] transition-colors"
              >
                {isIos ? "Show me how" : "Install app"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS full-screen overlay */}
      <AnimatePresence>
        {showIosOverlay && (
          <IosInstallOverlay onClose={() => setShowIosOverlay(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
