/**
 * InstallPrompt — shows a native-feeling install banner on both platforms.
 *
 * Android: intercepts the browser's beforeinstallprompt event and shows
 *   our own styled banner instead of the generic browser one.
 *
 * iOS: detects Safari on iOS (which never fires beforeinstallprompt) and
 *   shows step-by-step instructions pointing at the Share button.
 *
 * Dismissed state is persisted in localStorage so it only shows once.
 */
import { useEffect, useState } from "react";
import { X, Share, Plus } from "lucide-react";

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isInStandaloneMode() {
  return (
    window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null); // Android
  const [showIos, setShowIos]               = useState(false);
  const [visible, setVisible]               = useState(false);

  useEffect(() => {
    // Already installed — don't show anything
    if (isInStandaloneMode()) return;
    // User already dismissed — respect that
    if (localStorage.getItem("somatic.installDismissed")) return;

    if (isIos()) {
      // Show iOS instructions after a 3-second delay (let the page settle)
      const t = setTimeout(() => { setShowIos(true); setVisible(true); }, 3000);
      return () => clearTimeout(t);
    }

    // Android / Chrome: catch the browser's install event
    const handler = (e) => {
      e.preventDefault(); // stop the browser's default mini-infobar
      setDeferredPrompt(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    localStorage.setItem("somatic.installDismissed", "1");
    setVisible(false);
  }

  async function installAndroid() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setVisible(false);
    setDeferredPrompt(null);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-safe-bottom"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto max-w-md rounded-2xl bg-[#13131A] border border-[#1F1F2E] p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/icons/icon-192.png" alt="Somatic" className="w-12 h-12 rounded-2xl flex-shrink-0" />
            <div>
              <p className="font-semibold text-[#F0EDE8] text-sm">Add Somatic to your home screen</p>
              <p className="text-[11px] text-[#8A8280] mt-0.5">
                {showIos
                  ? "Tap the share icon below, then "Add to Home Screen""
                  : "Install for instant access — no App Store needed"}
              </p>
            </div>
          </div>
          <button onClick={dismiss} className="text-[#8A8280] hover:text-[#F0EDE8] flex-shrink-0 mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {showIos ? (
          // iOS: visual guide pointing at the share button
          <div className="mt-3 flex items-center gap-2 text-[12px] text-[#8A8280]">
            <span className="inline-flex items-center gap-1 rounded-lg bg-[#1F1F2E] px-2 py-1 text-[#F0EDE8]">
              <Share className="w-3 h-3" /> Share
            </span>
            <span>→ scroll down →</span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-[#1F1F2E] px-2 py-1 text-[#F0EDE8]">
              <Plus className="w-3 h-3" /> Add to Home Screen
            </span>
          </div>
        ) : (
          <button
            onClick={installAndroid}
            className="mt-3 w-full h-10 rounded-xl bg-[#E8445A] text-[#0A0A0F] text-sm font-semibold hover:bg-[#F26478] transition-colors"
          >
            Install app
          </button>
        )}
      </div>
    </div>
  );
}
