import { Link, useLocation } from "react-router-dom";
import { Home, Activity, Stethoscope, BarChart3, User } from "lucide-react";

const TABS = [
  { to: "/", icon: Home, label: "Home", test: "nav-home" },
  { to: "/scan", icon: Activity, label: "Scan", test: "nav-scan" },
  { to: "/insights", icon: Stethoscope, label: "Insights", test: "nav-insights" },
  { to: "/history", icon: BarChart3, label: "History", test: "nav-history" },
  { to: "/profile", icon: User, label: "Profile", test: "nav-profile" },
];

export default function BottomNav() {
  const loc = useLocation();
  if (loc.pathname === "/onboarding") return null;
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-md border-t border-[#1F1F2E]"
      data-testid="bottom-nav"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="max-w-md mx-auto flex items-center justify-around h-16 px-4">
        {TABS.map((t) => {
          const active = t.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(t.to);
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`flex flex-col items-center justify-center gap-0.5 w-14 transition-colors ${active ? "text-[#E8445A]" : "text-[#8A8280] hover:text-[#F0EDE8]"}`}
              data-testid={t.test}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.2 : 1.7} />
              <span className="text-[10px] font-medium tracking-wide">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
