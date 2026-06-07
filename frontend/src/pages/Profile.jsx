import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getProfile, setProfile, clearProfile } from "@/lib/wellness";
import { notifyMe, http } from "@/lib/api";
import { toast } from "sonner";
import {
  Bell, Stethoscope, Lock, LogOut, Heart, ShieldCheck, ChevronRight,
  BellRing, Smartphone, Share2, Users, QrCode, Check, Trash2, Phone,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useInstall } from "@/lib/useInstall";
import IosInstallOverlay from "@/components/IosInstallOverlay";

export default function Profile() {
  const navigate = useNavigate();
  const p = getProfile() || {};
  const [phone, setPhone] = useState(p.phone || "");
  const [familyPhone, setFamilyPhone] = useState(p.familyPhone || "");
  const [scanPref, setScanPref] = useState(p.scanPref || "rppg");
  const [reminders, setReminders] = useState(p.reminders !== false);
  const [affDaily, setAffDaily] = useState(p.affDaily !== false);
  const [email, setEmail] = useState("");
  const [showIosSheet, setShowIosSheet] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [deletingData, setDeletingData] = useState(false);
  const { canInstall, isIos, isInstalled, install, clearDismissed } = useInstall();

  const appUrl = typeof window !== "undefined" ? window.location.origin : "https://aisteth.app";

  // Generate QR code for the app URL
  useEffect(() => {
    import("qrcode").then((QRCode) => {
      QRCode.toDataURL(appUrl, {
        width: 200,
        margin: 2,
        color: { dark: "#F0EDE8", light: "#13131A" },
      }).then(setQrDataUrl).catch(() => {});
    }).catch(() => {});
  }, [appUrl]);

  const save = () => {
    setProfile({ ...p, phone: phone.trim() || null, familyPhone: familyPhone.trim() || null, scanPref, reminders, affDaily });
    toast.success("Saved");
  };

  const shareApp = async () => {
    const shareData = {
      title: "AiSteth — See Your Heart",
      text: phone.trim()
        ? `I'm tracking my heart health with AiSteth. Join me — use phone number ${phone.trim()} to link our data.\n\n${appUrl}`
        : `Check out AiSteth — camera-based heart health tracking, no hardware needed.\n\n${appUrl}`,
      url: appUrl,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); }
      catch (e) { if (e.name !== "AbortError") toast.error("Couldn't share"); }
    } else {
      await navigator.clipboard.writeText(`${shareData.text}`);
      toast.success("Link copied to clipboard");
    }
  };

  const deleteAllData = async () => {
    if (!confirm("This will permanently delete all your health data from our servers. Your local profile will also be cleared. This cannot be undone.")) return;
    setDeletingData(true);
    try {
      await http.delete("/user/data", { data: { phone: phone.trim() || null } });
      clearProfile();
      toast.success("All data deleted");
      navigate("/onboarding", { replace: true });
    } catch {
      // Even if server call fails, clear locally and inform
      clearProfile();
      toast("Local profile cleared. If you'd like server data removed, contact privacy@aisteth.com", { duration: 6000 });
      navigate("/onboarding", { replace: true });
    } finally { setDeletingData(false); }
  };

  const logout = () => {
    if (!confirm("Clear your local profile? Your past scans on the server are kept.")) return;
    clearProfile();
    navigate("/onboarding", { replace: true });
  };

  const submitNotify = async (e) => {
    e.preventDefault();
    if (!email.includes("@")) return toast.error("Enter a valid email");
    try { await notifyMe("auscultation", email); toast.success("We'll let you know"); setEmail(""); }
    catch { toast.error("Couldn't save"); }
  };

  return (
    <div className="relative max-w-md mx-auto px-5 pt-3 pb-6">
      <h1 className="display text-[24px] font-semibold tracking-tight">Profile</h1>
      <p className="text-sm text-[#8A8280]">Stored on this device and EU servers.</p>

      {/* ── Phone + preferences ──────────────────────────────── */}
      <div className="mt-5 rounded-2xl bg-[#13131A] border border-[#1F1F2E] p-5">
        <label className="text-[10px] uppercase tracking-wider text-[#8A8280]">Phone number</label>
        <div className="mt-2 relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8280]" />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+44 7700 900000"
            className="w-full bg-[#0A0A0F] border border-[#1F1F2E] rounded-xl h-11 pl-9 pr-3 text-[#F0EDE8] placeholder:text-[#8A8280]"
            data-testid="profile-phone-input"
          />
        </div>
        <p className="mt-1.5 text-[10px] text-[#8A8280]">Used to link your data with family members. Never sold.</p>

        <div className="mt-4">
          <label className="text-[10px] uppercase tracking-wider text-[#8A8280]">Family member's phone</label>
          <div className="mt-2 relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8280]" />
            <input
              type="tel"
              value={familyPhone}
              onChange={(e) => setFamilyPhone(e.target.value)}
              placeholder="+44 7700 900000"
              className="w-full bg-[#0A0A0F] border border-[#1F1F2E] rounded-xl h-11 pl-9 pr-3 text-[#F0EDE8] placeholder:text-[#8A8280]"
              data-testid="profile-family-phone-input"
            />
          </div>
          <p className="mt-1.5 text-[10px] text-[#8A8280]">Add a parent or carer's number to view their heart data in your History.</p>
        </div>

        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-wider text-[#8A8280]">Preferred scan</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {[["rppg","Face"],["ppg","Finger"]].map(([v,l]) => (
              <button key={v} onClick={() => setScanPref(v)}
                className={`h-10 rounded-xl text-sm font-medium border ${scanPref === v ? "bg-[#1A1118] border-[#E8445A]/40 text-[#F0EDE8]" : "bg-[#0A0A0F] border-[#1F1F2E] text-[#8A8280]"}`}
                data-testid={`profile-scan-${v}`}>{l}</button>
            ))}
          </div>
        </div>

        <ToggleRow icon={<Bell className="w-4 h-4 text-[#F5C87A]" />} label="Daily scan reminder" value={reminders} onChange={setReminders} testId="profile-toggle-reminders" />
        <ToggleRow icon={<Heart className="w-4 h-4 text-[#E8445A]" />} label="Affirmation of the day" value={affDaily} onChange={setAffDaily} testId="profile-toggle-affirmation" />

        <button onClick={save} className="mt-5 w-full h-11 rounded-xl bg-[#E8445A] text-[#0A0A0F] font-semibold hover:bg-[#F26478]" data-testid="profile-save">Save preferences</button>
      </div>

      {/* ── Share with parent ────────────────────────────────── */}
      <div className="mt-5 rounded-2xl bg-[#13131A] border border-[#1F1F2E] p-5" data-testid="profile-share-section">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#F5C87A] mb-3">
          <Users className="w-3.5 h-3.5" /> Share with a parent or carer
        </div>
        <p className="text-[13px] text-[#8A8280] leading-relaxed mb-4">
          Send a parent or carer a link to the app. When they sign up using the same phone number
          ({phone.trim() || "your number"}), they'll be able to view your health history.
        </p>

        {/* QR code */}
        <div className="flex flex-col items-center gap-3 py-3">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="App QR code" className="w-40 h-40 rounded-xl" />
          ) : (
            <div className="w-40 h-40 rounded-xl bg-[#0A0A0F] border border-[#1F1F2E] grid place-items-center">
              <QrCode className="w-8 h-8 text-[#8A8280]" />
            </div>
          )}
          <p className="text-[11px] text-[#8A8280]">Scan to open the app</p>
        </div>

        <button
          onClick={shareApp}
          className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-[#F5C87A]/15 border border-[#F5C87A]/40 text-[#F5C87A] text-sm font-medium hover:bg-[#F5C87A]/25 transition-colors"
          data-testid="profile-share-btn"
        >
          <Share2 className="w-4 h-4" />
          {phone.trim() ? "Share link & phone number" : "Share app link"}
        </button>
        {!phone.trim() && (
          <p className="mt-2 text-[11px] text-[#8A8280] text-center">Add your phone number above to include it in the share message.</p>
        )}
      </div>

      {/* ── GDPR / privacy ──────────────────────────────────── */}
      <div className="mt-5 rounded-2xl bg-[#13131A] border border-[#1F1F2E] p-5" data-testid="profile-gdpr-section">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#F5C87A] mb-3">
          <ShieldCheck className="w-3.5 h-3.5" /> Your data & GDPR rights
        </div>
        <ul className="space-y-2 text-[12px] text-[#8A8280] leading-relaxed">
          {[
            "We collect phone number, heart rate, HRV, SpO₂ and breathing rate — nothing more.",
            "Data is stored on EU servers in compliance with GDPR. Never sold to third parties.",
            "You have the right to access, correct, or delete your data at any time.",
            "This app is a wellness tool — not a medical device. All readings are indicative only.",
          ].map((t, i) => (
            <li key={i} className="flex items-start gap-2">
              <Check className="w-3 h-3 text-[#F5C87A] mt-0.5 shrink-0" />{t}
            </li>
          ))}
        </ul>
        {p.gdprConsentDate && (
          <p className="mt-3 text-[10px] text-[#8A8280]">
            Consent given on {new Date(p.gdprConsentDate).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}.
          </p>
        )}
        <button
          onClick={deleteAllData}
          disabled={deletingData}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl border border-[#E8445A]/30 text-[#E8445A] text-[13px] hover:bg-[#E8445A]/10 disabled:opacity-50 transition-colors"
          data-testid="profile-delete-data"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {deletingData ? "Deleting…" : "Delete all my data (GDPR right to erasure)"}
        </button>
      </div>

      {/* ── Add to Home Screen ───────────────────────────────── */}
      {!isInstalled && (
        <div className="mt-5 rounded-2xl bg-[#13131A] border border-[#1F1F2E] p-4" data-testid="profile-install-row">
          <button
            className="w-full flex items-center gap-3 text-left"
            onClick={async () => {
              if (isIos) { setShowIosSheet(true); }
              else if (canInstall) {
                clearDismissed();
                const accepted = await install();
                if (accepted) toast.success("Added to your home screen 🎉");
              } else {
                toast("Open in Chrome or Safari → browser menu → Add to Home Screen", { duration: 5000 });
              }
            }}
          >
            <span className="w-10 h-10 rounded-xl bg-[#1A1118] border border-[#E8445A]/30 grid place-items-center flex-shrink-0">
              <Smartphone className="w-4.5 h-4.5 text-[#E8445A]" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[#F0EDE8]">Add to Home Screen</div>
              <div className="text-[11px] text-[#8A8280] mt-0.5">
                {isIos ? "Works offline · instant access" : canInstall ? "Install as an app — no App Store needed" : "Open in Chrome or Safari to install"}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8A8280] flex-shrink-0" />
          </button>
        </div>
      )}

      <AnimatePresence>
        {showIosSheet && <IosInstallOverlay onClose={() => setShowIosSheet(false)} />}
      </AnimatePresence>

      {/* ── Coming soon ─────────────────────────────────────── */}
      <div className="mt-5 rounded-2xl bg-[#0F0F16] border border-[#1F1F2E] p-5" data-testid="profile-locked-section">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#F5C87A]"><Lock className="w-3 h-3" /> Coming soon</div>
        <div className="mt-2 flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-[#E8445A]" />
          <div>
            <div className="text-[15px] font-medium">Heart & Lung Sounds</div>
            <div className="text-xs text-[#8A8280]">AI-classified auscultation via your device microphone.</div>
          </div>
        </div>
        <form onSubmit={submitNotify} className="mt-3 flex gap-2">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
            className="flex-1 bg-[#0A0A0F] border border-[#1F1F2E] rounded-xl h-10 px-3 text-sm text-[#F0EDE8] placeholder:text-[#8A8280]" data-testid="profile-notify-email" />
          <button type="submit" className="h-10 px-3 rounded-xl bg-[#F5C87A]/15 border border-[#F5C87A]/40 text-[#F5C87A] text-sm inline-flex items-center gap-1.5" data-testid="profile-notify-submit">
            <BellRing className="w-3.5 h-3.5" /> Notify me
          </button>
        </form>
      </div>

      {/* ── About ───────────────────────────────────────────── */}
      <div className="mt-5 rounded-2xl bg-[#13131A] border border-[#1F1F2E] p-5" data-testid="profile-about">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#8A8280]"><Heart className="w-3 h-3 text-[#E8445A]" /> About AiSteth</div>
        <p className="mt-2 text-sm text-[#F0EDE8] leading-relaxed">
          AiSteth is inspired by the philosophy of <span className="italic">You Can Heal Your Life</span> by Louise L. Hay — the idea that thoughts shape feelings, and feelings ripple through the body.
        </p>
        <p className="mt-2 text-sm text-[#8A8280] leading-relaxed">
          We pair real-time physiological signals with gentle reflection prompts so you can listen to your body without judgment.
        </p>
      </div>

      {/* ── Sign out ─────────────────────────────────────────── */}
      <button onClick={logout} className="mt-5 w-full inline-flex items-center justify-center gap-1.5 h-11 rounded-xl bg-transparent border border-[#1F1F2E] text-[#8A8280] hover:bg-[#13131A]" data-testid="profile-logout">
        <LogOut className="w-4 h-4" /> Clear local profile
      </button>
    </div>
  );
}

function ToggleRow({ icon, label, value, onChange, testId }) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">{icon}<span className="text-sm">{label}</span></div>
      <button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)}
        className={`relative w-10 h-6 rounded-full transition-colors ${value ? "bg-[#E8445A]" : "bg-[#1F1F2E]"}`} data-testid={testId}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${value ? "translate-x-4" : ""}`} />
      </button>
    </div>
  );
}
