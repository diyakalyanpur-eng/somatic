import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Toaster } from "sonner";
import "@/App.css";
import AppShell from "@/components/AppShell";
import OnboardingGate from "@/components/OnboardingGate";
import InstallPrompt from "@/components/InstallPrompt";
import PinGate from "@/components/PinGate";
import { initInstallCapture } from "@/lib/useInstall";

// Critical path — loaded eagerly so the home screen appears instantly
import Home from "@/pages/Home";
import Onboarding from "@/pages/Onboarding";

// Heavy routes — lazy loaded so their chunks don't block initial parse.
// recharts (History), framer-motion (Results), and HealthReport are the biggest.
const Scan        = lazy(() => import("@/pages/Scan"));
const Results     = lazy(() => import("@/pages/Results"));
const Reflect     = lazy(() => import("@/pages/Reflect"));
const History     = lazy(() => import("@/pages/History"));
const Profile     = lazy(() => import("@/pages/Profile"));
const Insights    = lazy(() => import("@/pages/Insights"));
const HealthProfile = lazy(() => import("@/pages/HealthProfile"));
const HealthReport  = lazy(() => import("@/pages/HealthReport"));

// Capture the beforeinstallprompt event as early as possible
initInstallCapture();

// Minimal fallback — dark background so the transition is invisible
const PageFallback = () => (
  <div className="min-h-screen bg-[#0A0A0F]" />
);

function App() {
  return (
    <BrowserRouter>
      <PinGate>
      <AppShell>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/" element={<OnboardingGate><Home /></OnboardingGate>} />
            <Route path="/scan" element={<OnboardingGate><Scan /></OnboardingGate>} />
            <Route path="/results/:id" element={<OnboardingGate><Results /></OnboardingGate>} />
            <Route path="/reflect" element={<OnboardingGate><Reflect /></OnboardingGate>} />
            <Route path="/reflect/:id" element={<OnboardingGate><Reflect /></OnboardingGate>} />
            <Route path="/history" element={<OnboardingGate><History /></OnboardingGate>} />
            <Route path="/profile" element={<OnboardingGate><Profile /></OnboardingGate>} />
            <Route path="/insights" element={<OnboardingGate><Insights /></OnboardingGate>} />
            <Route path="/insights/profile" element={<OnboardingGate><HealthProfile /></OnboardingGate>} />
            <Route path="/insights/report" element={<OnboardingGate><HealthReport /></OnboardingGate>} />
            <Route path="*" element={<OnboardingGate><Home /></OnboardingGate>} />
          </Routes>
        </Suspense>
      </AppShell>
      <Toaster theme="dark" position="top-center" toastOptions={{ style: { background: "#13131A", border: "1px solid #1F1F2E", color: "#F0EDE8" } }} />
      <InstallPrompt />
      </PinGate>
    </BrowserRouter>
  );
}
export default App;
