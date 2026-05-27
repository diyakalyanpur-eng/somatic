import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";
import { listSnapshots, listJournal, getStreak } from "@/lib/api";
import { nervousSystemState } from "@/lib/wellness";
import { Sparkles, Lock, Stethoscope, Flame, BookOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function History() {
  const [snaps, setSnaps] = useState([]);
  const [journal, setJournal] = useState([]);
  const [streakData, setStreakData] = useState({ streak: 0, totalDays: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, j, st] = await Promise.all([listSnapshots({ limit: 60 }), listJournal(), getStreak()]);
        setSnaps((s.rows || []).reverse());
        setJournal(j.rows || []);
        setStreakData(st);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const hrvSeries = useMemo(() => snaps.map((s) => ({
    date: s.created_at ? new Date(s.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "",
    hrv: s.fused?.hrv_ms ?? null,
    bpm: s.fused?.bpm ?? null,
  })).filter((x) => x.hrv != null), [snaps]);

  const stressSeries = useMemo(() => snaps.map((s) => {
    const ns = nervousSystemState(s.fused?.hrv_ms);
    const score = ns.key === "calm" ? 1 : ns.key === "mild" ? 2 : ns.key === "moderate" ? 3 : ns.key === "high" ? 4 : 0;
    return { date: new Date(s.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }), score, color: ns.color };
  }).filter((x) => x.score > 0), [snaps]);

  const insight = useMemo(() => {
    if (hrvSeries.length < 2) return "As your scans accumulate, we'll surface gentle weekly insights here.";
    const last = hrvSeries[hrvSeries.length - 1].hrv;
    const prev = hrvSeries[hrvSeries.length - 2].hrv;
    const delta = last - prev;
    if (Math.abs(delta) < 2) return "Your HRV is steady. Consistency is its own quiet kind of progress.";
    if (delta > 0) return `Your HRV improved ${Math.round((delta/prev)*100)}% recently. Notice what you've been doing differently — your body remembers.`;
    return "Your HRV dipped slightly. Today might be a day to choose softness over striving.";
  }, [hrvSeries]);

  return (
    <div className="relative max-w-md mx-auto px-5 pt-3 pb-6">
      <h1 className="display text-[24px] font-semibold tracking-tight">Your progress</h1>
      <p className="text-sm text-[#8A8280]">A gentle view of the past 30 days.</p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Tile icon={<Flame className="w-3.5 h-3.5 text-[#F5C87A]" />} label="Streak" value={`${streakData.streak}d`} />
        <Tile icon={<Sparkles className="w-3.5 h-3.5 text-[#E8445A]" />} label="Scans" value={`${snaps.length}`} />
        <Tile icon={<BookOpen className="w-3.5 h-3.5 text-[#F5C87A]" />} label="Journals" value={`${journal.length}`} />
      </div>

      <div className="mt-5 rounded-2xl bg-[#13131A] border border-[#1F1F2E] p-4" data-testid="history-hrv-chart">
        <div className="text-[10px] uppercase tracking-wider text-[#8A8280] mb-2">HRV trend</div>
        {loading ? <Skeleton className="h-40 bg-[#0A0A0F]" /> : hrvSeries.length === 0 ? (
          <div className="h-40 grid place-items-center text-sm text-[#8A8280]">No HRV data yet — run your first scan.</div>
        ) : (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hrvSeries} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#1F1F2E" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" stroke="#8A8280" tick={{ fontSize: 10 }} />
                <YAxis stroke="#8A8280" tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                <Tooltip contentStyle={{ background: "#13131A", border: "1px solid #1F1F2E", borderRadius: 12, fontSize: 12 }} labelStyle={{ color: "#8A8280" }} />
                <Line type="monotone" dataKey="hrv" stroke="#E8445A" strokeWidth={2.5} dot={{ r: 3, fill: "#E8445A" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl bg-[#13131A] border border-[#1F1F2E] p-4" data-testid="history-stress-chart">
        <div className="text-[10px] uppercase tracking-wider text-[#8A8280] mb-2">Nervous system load</div>
        {loading ? <Skeleton className="h-32 bg-[#0A0A0F]" /> : stressSeries.length === 0 ? (
          <div className="h-32 grid place-items-center text-sm text-[#8A8280]">No data yet.</div>
        ) : (
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stressSeries} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#1F1F2E" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" stroke="#8A8280" tick={{ fontSize: 10 }} />
                <YAxis stroke="#8A8280" tick={{ fontSize: 10 }} domain={[0, 4]} ticks={[1,2,3,4]} />
                <Tooltip contentStyle={{ background: "#13131A", border: "1px solid #1F1F2E", borderRadius: 12, fontSize: 12 }} labelStyle={{ color: "#8A8280" }} />
                <Bar dataKey="score" radius={[6, 6, 0, 0]} fill="#F5C87A" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl bg-[#13131A] gold-border p-5" data-testid="history-weekly-insight">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#F5C87A]"><Sparkles className="w-3 h-3" /> Weekly reflection</div>
        <p className="serif mt-3 text-[17px] leading-snug text-[#F0EDE8]">{insight}</p>
      </div>

      {/* Locked auscultation history placeholder */}
      <div className="mt-4 rounded-2xl bg-[#0F0F16] border border-[#1F1F2E] p-4 opacity-80" data-testid="history-auscult-locked">
        <div className="flex items-center gap-2 text-[#8A8280]">
          <Lock className="w-3.5 h-3.5" />
          <Stethoscope className="w-4 h-4 text-[#E8445A]" />
          <span className="text-sm font-medium text-[#F0EDE8]">Auscultation history</span>
          <span className="ml-auto text-[10px] uppercase tracking-wider text-[#F5C87A]">Coming soon</span>
        </div>
        <p className="mt-2 text-xs text-[#8A8280]">Once heart & lung sound analysis goes live, your patterns will appear here.</p>
      </div>

      <div className="mt-5">
        <div className="text-[10px] uppercase tracking-wider text-[#8A8280] mb-2">Past sessions</div>
        {snaps.length === 0 ? (
          <div className="rounded-2xl bg-[#13131A] border border-[#1F1F2E] p-5 text-sm text-[#8A8280]">Your sessions will appear here.</div>
        ) : (
          <div className="space-y-2">
            {[...snaps].reverse().slice(0, 10).map((s) => {
              const ns = nervousSystemState(s.fused?.hrv_ms);
              return (
                <div key={s.id} className="rounded-2xl bg-[#13131A] border border-[#1F1F2E] p-3 flex items-center justify-between" data-testid="history-session-row">
                  <div>
                    <div className="text-[12px] text-[#8A8280]">{new Date(s.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                    <div className="mt-0.5 text-sm font-medium">{s.fused?.bpm ?? "—"} bpm · {s.fused?.hrv_ms ?? "—"} ms HRV</div>
                  </div>
                  <span className="text-[11px] px-2 py-1 rounded-full border" style={{ borderColor: ns.color + "55", color: ns.color }}>{ns.label.split(" \u2014")[0]}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({ icon, label, value }) {
  return (
    <div className="rounded-2xl bg-[#13131A] border border-[#1F1F2E] p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#8A8280]">{icon}{label}</div>
      <div className="mt-1.5 display text-lg font-semibold">{value}</div>
    </div>
  );
}
