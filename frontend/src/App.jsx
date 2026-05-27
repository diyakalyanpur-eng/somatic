import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import "@/App.css";
import AppShell from "@/components/AppShell";
import Onboarding from "@/pages/Onboarding";
import Home from "@/pages/Home";
import Scan from "@/pages/Scan";
import Results from "@/pages/Results";
import Reflect from "@/pages/Reflect";
import History from "@/pages/History";
import Profile from "@/pages/Profile";
import Insights from "@/pages/Insights";
import HealthProfile from "@/pages/HealthProfile";
import HealthReport from "@/pages/HealthReport";
import OnboardingGate from "@/components/OnboardingGate";
import InstallPrompt from "@/components/InstallPrompt";

function App() {
  return (
    <BrowserRouter>
      <AppShell>
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
      </AppShell>
      <Toaster theme="dark" position="top-center" toastOptions={{ style: { background: "#13131A", border: "1px solid #1F1F2E", color: "#F0EDE8" } }} />
      <InstallPrompt />
    </BrowserRouter>
  );
}
export default App;
