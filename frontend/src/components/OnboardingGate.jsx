import { Navigate } from "react-router-dom";
import { getProfile } from "@/lib/wellness";

export default function OnboardingGate({ children }) {
  const p = getProfile();
  if (!p || !p.onboarded) return <Navigate to="/onboarding" replace />;
  return children;
}
