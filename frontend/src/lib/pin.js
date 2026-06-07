// PIN authentication helpers
// PIN is never stored in plain text — only a SHA-256 hash in localStorage.
// Session unlock is tracked in sessionStorage so the lock screen only appears
// on a fresh app open, not on every navigation.

const PIN_KEY     = "somatic.pinHash";
const SESSION_KEY = "somatic.pinUnlocked";

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function setPin(pin) {
  const hash = await sha256(pin);
  localStorage.setItem(PIN_KEY, hash);
}

export async function verifyPin(pin) {
  const stored = localStorage.getItem(PIN_KEY);
  if (!stored) return true;             // no PIN set → always pass
  const hash = await sha256(pin);
  return hash === stored;
}

export function hasPinSet() {
  return !!localStorage.getItem(PIN_KEY);
}

export function isSessionUnlocked() {
  return !!sessionStorage.getItem(SESSION_KEY);
}

export function markSessionUnlocked() {
  sessionStorage.setItem(SESSION_KEY, "1");
}

export function clearPin() {
  localStorage.removeItem(PIN_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}
