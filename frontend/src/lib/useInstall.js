/**
 * useInstall — shared PWA install utilities.
 *
 * Keeps the deferredPrompt alive at module level so any component can
 * trigger the Android install prompt without needing React context.
 *
 * Usage:
 *   import { useInstall } from "@/lib/useInstall";
 *   const { canInstall, isInstalled, isIos, install, clearDismissed } = useInstall();
 */
import { useEffect, useState } from "react";

// Module-level — survives across renders and component remounts
let _deferredPrompt = null;
const _listeners = new Set();

function notifyListeners() {
  _listeners.forEach((fn) => fn(_deferredPrompt));
}

// Call once at app boot to start capturing the event
export function initInstallCapture() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    _deferredPrompt = e;
    notifyListeners();
  });
  window.addEventListener("appinstalled", () => {
    _deferredPrompt = null;
    notifyListeners();
  });
}

/** True if running on iOS Safari or Chrome-on-iOS (no beforeinstallprompt support) */
export function detectIos() {
  const ua = navigator.userAgent;
  // Standard iPhones/iPods
  if (/iphone|ipod/i.test(ua)) return true;
  // iPad classic user-agent
  if (/ipad/i.test(ua)) return true;
  // iPadOS 13+ reports as "MacIntel" but has touch
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
  return false;
}

/** True if already running as installed PWA */
export function detectStandalone() {
  return (
    window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

/** Trigger the Android install prompt. Returns true if user accepted. */
export async function triggerAndroidInstall() {
  if (!_deferredPrompt) return false;
  _deferredPrompt.prompt();
  const { outcome } = await _deferredPrompt.userChoice;
  _deferredPrompt = null;
  notifyListeners();
  return outcome === "accepted";
}

export function clearInstallDismissed() {
  localStorage.removeItem("somatic.installDismissed");
}

/** React hook — subscribe to install prompt availability */
export function useInstall() {
  const [prompt, setPrompt] = useState(_deferredPrompt);

  useEffect(() => {
    const update = (p) => setPrompt(p);
    _listeners.add(update);
    return () => _listeners.delete(update);
  }, []);

  return {
    isInstalled: detectStandalone(),
    isIos: detectIos(),
    canInstall: !!prompt && !detectStandalone(),
    install: triggerAndroidInstall,
    clearDismissed: clearInstallDismissed,
  };
}
