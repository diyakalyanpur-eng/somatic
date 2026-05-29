import { useLocation } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import MiniHeart from "@/components/MiniHeart";
import { Link } from "react-router-dom";
import { getLatestBpm } from "@/lib/wellness";
import { useEffect, useState } from "react";

export default function AppShell({ children }) {
  const loc = useLocation();
  const [bpm, setBpm] = useState(60);
  useEffect(() => { setBpm(getLatestBpm() || 60); }, [loc.pathname]);
  const showHeader = loc.pathname !== "/onboarding";
  return (
    <div className="App noise-bg" style={{ minHeight: '100dvh' }}>
      {showHeader && (
        <header className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-md border-b border-[#1F1F2E]" data-testid="app-header">
          <div className="max-w-md mx-auto px-5 h-14 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5" data-testid="app-header-brand-link">
              <MiniHeart bpm={bpm} size={22} />
              <span className="display font-semibold tracking-tight text-[15px]">Somatic</span>
            </Link>
            <Link to="/profile" className="text-[11px] text-[#8A8280] hover:text-[#F0EDE8] transition-colors" data-testid="app-header-profile-link">
              {bpm} bpm
            </Link>
          </div>
        </header>
      )}
      <main className="app-page">{children}</main>
      <BottomNav />
    </div>
  );
}
