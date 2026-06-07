import { useState } from "react";
import { hasPinSet, isSessionUnlocked } from "@/lib/pin";
import PinLock from "@/pages/PinLock";

/**
 * Wraps the entire app. If a PIN is set and this session hasn't unlocked yet,
 * shows the lock screen. Once unlocked (correct PIN entered), renders children.
 */
export default function PinGate({ children }) {
  const [locked, setLocked] = useState(() => hasPinSet() && !isSessionUnlocked());

  if (locked) {
    return <PinLock onUnlock={() => setLocked(false)} />;
  }

  return children;
}
