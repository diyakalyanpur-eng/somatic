import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Stethoscope, ShieldCheck, Sparkles, ChevronRight, AlertTriangle, FileText } from "lucide-react";
import { isHealthOptedIn, setHealthOptedIn, getHealthProfile } from "@/lib/wellness";
import { listHealthReports } from "@/lib/api";

export default function Insights() {
  const navigate = useNavigate();
  const [opted, setOpted] = useState(isHealthOptedIn());
  const profile = getHealthProfile();
  const [reports, setReports] = useState([]);

  useEffect(() => {
    if (!opted) return;
    (async () => {
      try { const d = await listHealthReports({ limit: 10 }); setReports(d.rows || []); } catch {}
    })();
  }, [opted]);

  if (!opted) {
    return (
      <div className="relative max-w-md mx-auto px-5 pt-3 pb-24">
        <div className="flex items-center gap-2">
          <span className="w-10 h-10 rounded-2xl bg-[#1A1118] border border-[#E8445A]/40 grid place-items-center">
            <Stethoscope className="w-5 h-5 text-[#E8445A]" />
          </span>
          <div>
            <h1 className="display text-[22px] font-semibold tracking-tight" data-testid="insights-title">Health Insights</h1>
            <p className="text-[12px] text-[#8A8280] mt-0.5">Optional. A different tone from your Somatic practice.</p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
          className="mt-5 rounded-2xl bg-[#13131A] border border-[#1F1F2E] p-5 space-y-4"
          data-testid="insights-optin-card"
        >
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 shrink-0 rounded-xl bg-[#0F0F16] border border-[#1F1F2E] grid place-items-center mt-0.5">
              <ShieldCheck className="w-4 h-4 text-[#7DD3A0]" />
            </span>
            <div>
              <h3 className="font-medium text-[15px]">A factual, opt-in companion</h3>
              <p className="mt-1 text-[13px] text-[#8A8280] leading-relaxed">
                Estimate your 10-year cardiovascular risk using <span className="text-[#F0EDE8]">QRISK3, SCORE2, or WHO/ISH</span> depending on your region & ethnicity. Get plain-language tests + lifestyle suggestions.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 shrink-0 rounded-xl bg-[#0F0F16] border border-[#1F1F2E] grid place-items-center mt-0.5">
              <Sparkles className="w-4 h-4 text-[#F5C87A]" />
            </span>
            <div>
              <h3 className="font-medium text-[15px]">Louise-Hay-inspired affirmations</h3>
              <p className="mt-1 text-[13px] text-[#8A8280] leading-relaxed">
                Each report includes affirmations tied to the underlying belief patterns Louise associated with the condition — with rationale.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 shrink-0 rounded-xl bg-[#0F0F16] border border-[#1F1F2E] grid place-items-center mt-0.5">
              <AlertTriangle className="w-4 h-4 text-[#F5A972]" />
            </span>
            <div>
              <h3 className="font-medium text-[15px]">Educational — not a diagnosis</h3>
              <p className="mt-1 text-[13px] text-[#8A8280] leading-relaxed">
                Risk models here are simplified educational implementations. They are not equivalent to the official calculators, and they are not medical devices.
              </p>
            </div>
          </div>
          <button
            onClick={() => { setHealthOptedIn(true); setOpted(true); }}
            className="w-full mt-2 inline-flex items-center justify-center gap-1.5 h-12 rounded-2xl bg-[#E8445A] text-[#0A0A0F] font-semibold hover:bg-[#F26478] transition-colors scan-cta-shadow"
            data-testid="insights-optin-button"
          >
            Turn on Health Insights
          </button>
          <p className="text-[10px] text-center text-[#6E6862]">You can turn this off anytime from Profile.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative max-w-md mx-auto px-5 pt-3 pb-24">
      <h1 className="display text-[22px] font-semibold tracking-tight" data-testid="insights-title">Health Insights</h1>
      <p className="mt-0.5 text-sm text-[#8A8280]">Educational risk + plain-language guidance.</p>

      <div className="mt-5 rounded-2xl bg-[#13131A] border border-[#1F1F2E] p-5" data-testid="insights-profile-card">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#8A8280]">Your health profile</div>
            <div className="mt-1 text-[15px] font-medium">{profile ? "Saved locally on this device" : "Not set yet"}</div>
          </div>
          <button
            onClick={() => navigate("/insights/profile")}
            className="h-10 px-4 rounded-full bg-[#E8445A]/15 border border-[#E8445A]/40 text-[#E8445A] text-sm font-medium hover:bg-[#E8445A]/25 transition-colors"
            data-testid="insights-edit-profile"
          >
            {profile ? "Update" : "Set up"}
          </button>
        </div>
        {profile && (
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[#8A8280]" data-testid="insights-profile-chips">
            {profile.region && <Chip>{profile.region}</Chip>}
            {profile.ethnicity && <Chip>{profile.ethnicity}</Chip>}
            {profile.age && <Chip>{profile.age}y</Chip>}
            {profile.sex && <Chip>{profile.sex}</Chip>}
            {profile.sbp && <Chip>BP {profile.sbp}</Chip>}
            {profile.smoking && <Chip>smk: {profile.smoking}</Chip>}
          </div>
        )}
      </div>

      <button
        onClick={() => navigate("/insights/report")}
        disabled={!profile}
        className="mt-4 w-full inline-flex items-center justify-center gap-1.5 h-12 rounded-2xl bg-[#E8445A] text-[#0A0A0F] font-semibold hover:bg-[#F26478] disabled:opacity-50 disabled:hover:bg-[#E8445A] transition-colors scan-cta-shadow"
        data-testid="insights-generate-button"
      >
        Generate health report <ChevronRight className="w-4 h-4" />
      </button>
      {!profile && <p className="mt-2 text-[10px] text-center text-[#8A8280]">Set up your profile first.</p>}

      {reports.length > 0 && (
        <div className="mt-6" data-testid="insights-recent">
          <div className="text-[10px] uppercase tracking-wider text-[#8A8280] mb-2">Recent reports</div>
          <div className="space-y-2">
            {reports.map((r) => (
              <div key={r.id} className="rounded-xl bg-[#13131A] border border-[#1F1F2E] p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-[#8A8280]" />
                  <div>
                    <div className="text-[13px] font-medium">{r.primaryModel} — {r.primaryScore}% <span className="text-[10px] uppercase tracking-wider text-[#8A8280] ml-1">{r.primaryBand}</span></div>
                    <div className="text-[11px] text-[#8A8280] truncate max-w-[220px]">{r.summary || r.region}</div>
                  </div>
                </div>
                <div className="text-[10px] text-[#6E6862]">{new Date(r.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ children }) {
  return <span className="px-2 py-0.5 rounded-full bg-[#0F0F16] border border-[#1F1F2E]">{children}</span>;
}
