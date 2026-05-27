import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { listPatients, createPatient, deletePatient, setActivePatient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  UserPlus, Users, ScanLine, Trash2, ChevronRight, ShieldCheck, Lock,
} from "lucide-react";

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); } catch { return iso; }
}
function maskPhone(p) {
  if (!p) return "—";
  const t = String(p).replace(/\s+/g, "");
  if (t.length < 4) return t;
  return `••• ${t.slice(-4)}`;
}

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const navigate = useNavigate();

  const refresh = async () => {
    try {
      const d = await listPatients();
      setPatients(d.rows || []);
    } catch { toast.error("Failed to load patients"); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const startScanWith = (p) => {
    setActivePatient({ id: p.id, code: p.code });
    toast.success(`Scanning as ${p.code}`);
    setTimeout(() => {
      window.location.href = `/aisteth.html?patientId=${encodeURIComponent(p.id)}&patientCode=${encodeURIComponent(p.code || "")}`;
    }, 180);
  };
  const onDelete = async (p) => {
    if (!confirm(`Delete patient ${p.code}? Their scans will be kept.`)) return;
    try {
      await deletePatient(p.id);
      toast.success("Patient deleted");
      setPatients(ps => ps.filter(x => x.id !== p.id));
    } catch { toast.error("Delete failed"); }
  };

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 h-[180px] bg-top-band pointer-events-none" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 mb-2 px-2.5 py-1 rounded-full border border-[#13343A] bg-[#0B1E22] text-[10px] uppercase tracking-wider text-[#9FB8B0]">
              <ShieldCheck className="w-3 h-3 text-[#22D3A4]" /> Pseudonymised · GDPR / HIPAA aware
            </div>
            <h1 className="display text-3xl sm:text-4xl font-semibold tracking-tight">Patients</h1>
            <p className="mt-1.5 text-sm text-[#9FB8B0]">Each patient is referenced by an opaque code — no names or emails are stored.</p>
          </div>
          <Button
            onClick={() => setOpenNew(true)}
            className="h-10 px-4 rounded-xl bg-[#22D3A4] text-[#04121A] hover:bg-[#3FE8B9] font-semibold scan-cta-shadow"
            data-testid="patients-add-button"
          >
            <UserPlus className="w-4 h-4 mr-1.5" /> Add patient
          </Button>
        </div>

        {loading ? (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({length:6}).map((_,i)=>(<Skeleton key={i} className="h-36 rounded-2xl bg-[#0B1E22]" />))}
          </div>
        ) : patients.length === 0 ? (
          <div className="mt-8 rounded-2xl bg-[#0B1E22] border border-[#13343A] p-8 text-center max-w-xl mx-auto" data-testid="patients-empty-state">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-[#04121A] border border-[#13343A] grid place-items-center">
              <Users className="w-5 h-5 text-[#22D3A4]" />
            </div>
            <h3 className="display mt-4 text-lg font-semibold">No patients yet</h3>
            <p className="mt-2 text-sm text-[#9FB8B0]">Create your first pseudonymised patient to start tracking cardiac trends.</p>
            <Button onClick={() => setOpenNew(true)} className="mt-5 h-10 px-4 rounded-xl bg-[#22D3A4] text-[#04121A] hover:bg-[#3FE8B9] font-semibold" data-testid="patients-empty-add-button">
              <UserPlus className="w-4 h-4 mr-1.5" /> Add your first patient
            </Button>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {patients.map((p, idx) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(idx*0.03,0.25), ease: [0.2,0.8,0.2,1] }}
                className="group rounded-2xl bg-[#0B1E22] border border-[#13343A] p-4 sm:p-5 hover:border-[#22D3A4]/40 transition-[border-color]"
                data-testid="patient-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/patients/${p.id}`)}
                    className="flex items-center gap-3 flex-1 text-left"
                    data-testid="patient-card-open"
                  >
                    <span
                      className="w-11 h-11 rounded-2xl grid place-items-center text-xs font-mono font-semibold tracking-wider"
                      style={{ background: `${p.color}22`, color: p.color, border: `1px solid ${p.color}55` }}
                    >
                      <Lock className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-mono font-semibold tracking-wider" data-testid="patient-card-code">{p.code || p.name || "PT-?"}</div>
                      <div className="text-[11px] text-[#9FB8B0] truncate">
                        {maskPhone(p.phone)} · {p.sex || "—"} · {p.ethnicity || "—"}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(p)}
                    className="text-[#6F8B83] hover:text-[#FF6E76] transition-[color] p-1"
                    aria-label="Delete"
                    data-testid="patient-card-delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Stat label="Scans" value={p.scanCount ?? 0} />
                  <Stat label="Latest HR" value={p.latestBpm != null ? `${p.latestBpm}` : "—"} suffix={p.latestBpm != null ? "bpm" : ""} />
                  <Stat label="Last seen" value={p.latestAt ? new Date(p.latestAt).toLocaleDateString() : "—"} />
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => startScanWith(p)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-[#22D3A4] text-[#04121A] hover:bg-[#3FE8B9] text-sm font-semibold"
                    data-testid="patient-start-scan"
                  >
                    <ScanLine className="w-4 h-4" /> Scan
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/patients/${p.id}`)}
                    className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg bg-[#0F2027] border border-[#13343A] hover:bg-[#13343A] text-sm"
                    data-testid="patient-open-detail"
                  >
                    Open <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <NewPatientDialog open={openNew} onOpenChange={setOpenNew} onCreated={(p) => { setPatients(ps => [{ ...p, scanCount:0 }, ...ps]); }} />
    </div>
  );
}

function Stat({ label, value, suffix }) {
  return (
    <div className="rounded-xl bg-[#04121A] border border-[#13343A] p-2.5">
      <div className="text-[10px] text-[#6F8B83] uppercase tracking-wider">{label}</div>
      <div className="mt-1 display text-sm font-semibold">
        {value}{suffix ? <span className="text-[10px] text-[#9FB8B0] ml-1">{suffix}</span> : null}
      </div>
    </div>
  );
}

const ETHNICITY_OPTIONS = [
  "White / not stated", "Indian", "Pakistani", "Bangladeshi", "Other Asian",
  "Black Caribbean", "Black African", "Chinese", "Mixed / other", "Prefer not to say",
];

function NewPatientDialog({ open, onOpenChange, onCreated }) {
  const [form, setForm] = useState({ phone: "", sex: "", ethnicity: "", dob: "", notes: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.phone.trim()) return toast.error("Phone is required");
    if (!form.sex) return toast.error("Sex is required");
    if (!form.ethnicity) return toast.error("Ethnicity is required");
    setBusy(true);
    try {
      const d = await createPatient(form);
      toast.success(`Patient ${d.row.code} created`);
      onCreated(d.row);
      onOpenChange(false);
      setForm({ phone: "", sex: "", ethnicity: "", dob: "", notes: "" });
    } catch (err) {
      const msg = err?.response?.data?.detail || "Create failed";
      toast.error(msg);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0B1E22] border-[#13343A] p-0" data-testid="patient-new-dialog">
        <DialogHeader className="p-5 border-b border-[#13343A]">
          <DialogTitle className="display">New patient</DialogTitle>
          <p className="text-xs text-[#9FB8B0]">An opaque code (e.g. PT-9C4F2A) is generated automatically. AiSteth never stores names or emails.</p>
        </DialogHeader>
        <form onSubmit={submit} className="p-5 space-y-3">
          <Field label="Phone *">
            <input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} className="input" placeholder="+1 555 0123" data-testid="patient-new-phone" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sex *">
              <select value={form.sex} onChange={(e) => setForm(f => ({ ...f, sex: e.target.value }))} className="input" data-testid="patient-new-sex">
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other / prefer not to say</option>
              </select>
            </Field>
            <Field label="Ethnicity *">
              <select value={form.ethnicity} onChange={(e) => setForm(f => ({ ...f, ethnicity: e.target.value }))} className="input" data-testid="patient-new-ethnicity">
                <option value="">—</option>
                {ETHNICITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Year of birth (optional)">
            <input value={form.dob} onChange={(e) => setForm(f => ({ ...f, dob: e.target.value }))} className="input" placeholder="e.g. 1985" />
          </Field>
          <Field label="Notes (optional)">
            <textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="input" placeholder="Clinical notes — avoid names or identifying info" />
          </Field>
          <div className="text-[11px] text-[#6F8B83] leading-relaxed">
            By creating a patient you confirm any clinical context entered respects GDPR/HIPAA minimisation principles.
          </div>
          <div className="pt-1 flex justify-end gap-2">
            <button type="button" onClick={() => onOpenChange(false)} className="h-10 px-4 rounded-xl bg-[#0F2027] border border-[#13343A] text-sm">Cancel</button>
            <button type="submit" disabled={busy} className="h-10 px-4 rounded-xl bg-[#22D3A4] text-[#04121A] hover:bg-[#3FE8B9] disabled:opacity-50 text-sm font-semibold" data-testid="patient-new-submit">
              {busy ? "Creating…" : "Create patient"}
            </button>
          </div>
        </form>
        <style>{`.input { background:#04121A; color:#E6FBF3; border:1px solid #13343A; border-radius:10px; padding:8px 10px; width:100%; font-family:inherit; font-size:13px; }`}</style>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs text-[#9FB8B0] uppercase tracking-wider">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
