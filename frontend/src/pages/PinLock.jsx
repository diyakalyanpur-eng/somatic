import { useState, useCallback } from "react";
import { verifyPin, markSessionUnlocked, clearPin } from "@/lib/pin";
import { Delete } from "lucide-react";

const PIN_LENGTH = 6;

export default function PinLock({ onUnlock }) {
  const [digits, setDigits]     = useState([]);
  const [error, setError]       = useState("");
  const [shaking, setShaking]   = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [checking, setChecking] = useState(false);

  const shake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 600);
  };

  const press = useCallback(async (d) => {
    if (checking) return;
    setError("");
    const next = [...digits, d];
    setDigits(next);

    if (next.length < PIN_LENGTH) return;

    // Full PIN entered — verify
    setChecking(true);
    const ok = await verifyPin(next.join(""));
    if (ok) {
      markSessionUnlocked();
      onUnlock();
    } else {
      const a = attempts + 1;
      setAttempts(a);
      shake();
      setError(a >= 5 ? "Too many attempts." : "Incorrect PIN.");
      setTimeout(() => setDigits([]), 600);
    }
    setChecking(false);
  }, [digits, attempts, checking, onUnlock]);

  const del = useCallback(() => {
    setError("");
    setDigits((d) => d.slice(0, -1));
  }, []);

  const resetEverything = () => {
    clearPin();
    // Clear all app data and force fresh onboarding
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace("/onboarding");
  };

  return (
    <div className="fixed inset-0 bg-[#0A0A0F] flex flex-col items-center justify-between py-16 px-6 z-50">
      {/* Wordmark */}
      <div className="flex items-baseline gap-0.5">
        <span className="text-2xl font-bold text-[#E8445A]">Ai</span>
        <span className="text-2xl font-bold text-[#F0EDE8]">Steth</span>
      </div>

      {/* Middle section */}
      <div className="flex flex-col items-center gap-8 w-full max-w-xs">
        <div>
          <p className="text-center text-[15px] text-[#8A8280]">Enter your PIN</p>

          {/* Dot indicators */}
          <div
            className="mt-6 flex items-center justify-center gap-4"
            style={{ animation: shaking ? "pin-shake 0.6s ease" : "none" }}
          >
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <div
                key={i}
                className="w-3.5 h-3.5 rounded-full border-2 transition-all duration-150"
                style={{
                  background: i < digits.length ? "#E8445A" : "transparent",
                  borderColor: i < digits.length ? "#E8445A" : "#2A2A3A",
                }}
              />
            ))}
          </div>

          {error && (
            <p className="mt-4 text-center text-[12px] text-[#E8445A]">{error}</p>
          )}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-4 w-full">
          {[1,2,3,4,5,6,7,8,9].map((n) => (
            <NumKey key={n} label={String(n)} onPress={() => press(String(n))} />
          ))}
          {/* Bottom row */}
          <div /> {/* empty */}
          <NumKey label="0" onPress={() => press("0")} />
          <button
            onPointerDown={del}
            className="w-full aspect-square rounded-2xl flex items-center justify-center text-[#8A8280] active:bg-[#1F1F2E] transition-colors"
            aria-label="Delete"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Forgot PIN */}
      {attempts >= 3 && (
        <button
          onClick={resetEverything}
          className="text-[12px] text-[#8A8280] underline underline-offset-2"
        >
          Forgot PIN? Reset app data
        </button>
      )}
      {attempts < 3 && <div className="h-5" />}

      <style>{`
        @keyframes pin-shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
          75% { transform: translateX(-3px); }
          90% { transform: translateX(3px); }
        }
      `}</style>
    </div>
  );
}

function NumKey({ label, onPress }) {
  return (
    <button
      onPointerDown={onPress}
      className="w-full aspect-square rounded-2xl bg-[#13131A] border border-[#1F1F2E] text-[#F0EDE8] text-xl font-semibold active:bg-[#1F1F2E] active:scale-95 transition-all"
    >
      {label}
    </button>
  );
}
