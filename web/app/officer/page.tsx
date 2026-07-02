"use client";

// OFFICER CONSOLE — a caseload. Stat tiles scoped to the officer's district,
// then the verification-request queue: claim a case (SUBMITTED → IN_REVIEW),
// open the forensic report, and resolve it (CLEARED / FLAGGED / REJECTED) with
// a note back to the citizen. This is real bureaucratic work, not a brochure.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase, Inbox, AlertOctagon, Gauge, FileSearch, ArrowRight,
  CheckCircle2, Flag, XCircle, Hand, Clock,
} from "lucide-react";
import { RoleShell, type NavItem } from "@/components/shell/RoleShell";
import { StatTile } from "@/components/viz/charts";
import { api } from "@/lib/api";

interface Overview {
  scope: string;
  totals: { properties: number; flagged: number; pendingRequests: number; criticalFindings: number; avgScore: number | null };
}
interface Case {
  id: string; purpose: string; status: string; note?: string | null; createdAt: string;
  property: { id: string; surveyNo: string; village: string; taluk: string; district: string; status: string; latestScore: number | null; criticalCount: number };
  requester: { name: string };
  officer?: { name: string } | null;
}

const nav: NavItem[] = [
  { href: "/officer", label: "Caseload", icon: <Briefcase className="h-4 w-4" /> },
];

const statusOrder = ["SUBMITTED", "IN_REVIEW", "CLEARED", "FLAGGED", "REJECTED"];
const statusStyle: Record<string, string> = {
  SUBMITTED: "#6B7689", IN_REVIEW: "#B8893B", CLEARED: "#2F5D44", FLAGGED: "#B5532A", REJECTED: "#7A1F1F",
};

export default function OfficerHome() {
  return (
    <RoleShell role="OFFICER" nav={nav}>
      <OfficerInner />
    </RoleShell>
  );
}

function OfficerInner() {
  const router = useRouter();
  const [ov, setOv] = useState<Overview | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [resolving, setResolving] = useState<Case | null>(null);
  const [filter, setFilter] = useState<string>("ALL");

  const load = useCallback(() => {
    api<Overview>("/api/stats/overview").then(setOv).catch(() => {});
    api<Case[]>("/api/requests/queue").then(setCases).catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function claim(c: Case) {
    await api(`/api/requests/${c.id}/claim`, { method: "PATCH" });
    load();
  }

  const filtered = filter === "ALL" ? cases : cases.filter((c) => c.status === filter);
  // sort: open work first
  const sorted = [...filtered].sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status));

  const counts = statusOrder.reduce((acc, s) => {
    acc[s] = cases.filter((c) => c.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-8">
      {/* heading */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-ink">Your caseload</h1>
          <p className="mt-1 text-ink-soft">Verification requests in <strong className="text-ink">{ov?.scope ?? "…"}</strong> — claim, investigate, resolve.</p>
        </div>
      </div>

      {/* ---------- STAT TILES ---------- */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Open cases" value={ov?.totals.pendingRequests ?? 0} accent="#B5532A" icon={<Inbox className="h-5 w-5" />} hint="Awaiting your action" delay={0} />
        <StatTile label="Properties in scope" value={ov?.totals.properties ?? 0} accent="#1B2A41" icon={<FileSearch className="h-5 w-5" />} delay={0.05} />
        <StatTile label="Flagged / disputed" value={ov?.totals.flagged ?? 0} accent="#7A1F1F" icon={<Flag className="h-5 w-5" />} delay={0.1} />
        <StatTile label="Critical findings" value={ov?.totals.criticalFindings ?? 0} accent="#B5532A" icon={<AlertOctagon className="h-5 w-5" />} delay={0.15} />
      </section>

      {/* ---------- FILTER PILLS ---------- */}
      <div className="flex flex-wrap gap-2">
        {["ALL", ...statusOrder].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className="rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition"
            style={{
              borderColor: filter === s ? (s === "ALL" ? "#1B2A41" : statusStyle[s]) : "rgba(27,42,65,0.15)",
              background: filter === s ? (s === "ALL" ? "rgba(27,42,65,0.06)" : `${statusStyle[s]}14`) : "transparent",
              color: filter === s ? (s === "ALL" ? "#1B2A41" : statusStyle[s]) : "#6B7689",
            }}
          >
            {s === "ALL" ? `All (${cases.length})` : `${s.replace(/_/g, " ")} (${counts[s] ?? 0})`}
          </button>
        ))}
      </div>

      {/* ---------- CASE LIST ---------- */}
      <section className="space-y-3">
        {sorted.map((c, i) => {
          const open = c.status === "SUBMITTED";
          const inReview = c.status === "IN_REVIEW";
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="rounded-lg border border-ink/10 bg-parchment p-5 shadow-raised"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-lg text-ink">{c.property.surveyNo}</span>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white" style={{ background: statusStyle[c.status] }}>
                      {c.status.replace(/_/g, " ")}
                    </span>
                    {c.property.criticalCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-sm bg-terracotta/10 px-1.5 py-0.5 text-[10px] font-bold text-terracotta">
                        <AlertOctagon className="h-3 w-3" /> {c.property.criticalCount} critical
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-ink-soft">
                    {c.property.village}, {c.property.taluk} · requested by <strong className="text-ink">{c.requester.name}</strong> for {c.purpose.toLowerCase()}
                  </div>
                  {c.note && <p className="mt-2 rounded-sm bg-ink/5 p-2.5 text-sm text-ink-soft">“{c.note}”</p>}
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-xs uppercase tracking-wider text-ink-faint"><Gauge className="h-3.5 w-3.5" /> Score</div>
                    <div className="font-serif text-2xl font-semibold text-ink">{c.property.latestScore ?? "—"}</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3">
                <button
                  onClick={() => router.push(`/property/${c.property.id}`)}
                  className="inline-flex items-center gap-1.5 rounded-sm border border-ink/20 px-3 py-1.5 text-sm text-ink transition hover:bg-ink hover:text-parchment"
                >
                  <FileSearch className="h-4 w-4" /> Open forensic report <ArrowRight className="h-3.5 w-3.5" />
                </button>
                {open && (
                  <button onClick={() => claim(c)} className="inline-flex items-center gap-1.5 rounded-sm bg-gold px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
                    <Hand className="h-4 w-4" /> Claim case
                  </button>
                )}
                {inReview && (
                  <button onClick={() => setResolving(c)} className="inline-flex items-center gap-1.5 rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-parchment hover:bg-ink-soft">
                    <CheckCircle2 className="h-4 w-4" /> Resolve
                  </button>
                )}
                {open && (
                  <span className="inline-flex items-center gap-1 text-xs text-ink-faint"><Clock className="h-3.5 w-3.5" /> Unassigned</span>
                )}
              </div>
            </motion.div>
          );
        })}
        {sorted.length === 0 && (
          <p className="rounded-lg border border-dashed border-ink/20 p-8 text-center text-sm text-ink-faint">No cases in this view.</p>
        )}
      </section>

      {/* ---------- RESOLVE MODAL ---------- */}
      <AnimatePresence>
        {resolving && (
          <ResolveModal
            c={resolving}
            onClose={() => setResolving(null)}
            onDone={() => { setResolving(null); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ResolveModal({ c, onClose, onDone }: { c: Case; onClose: () => void; onDone: () => void }) {
  const [status, setStatus] = useState("CLEARED");
  const [officerNote, setOfficerNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api(`/api/requests/${c.id}/resolve`, { method: "PATCH", body: JSON.stringify({ status, officerNote }) });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  const options = [
    { v: "CLEARED", l: "Cleared — safe", icon: CheckCircle2, color: "#2F5D44" },
    { v: "FLAGGED", l: "Flagged — risky", icon: Flag, color: "#B5532A" },
    { v: "REJECTED", l: "Rejected", icon: XCircle, color: "#7A1F1F" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6" onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl border border-ink/10 bg-parchment p-6 shadow-raised"
      >
        <h3 className="font-serif text-xl text-ink">Resolve case · {c.property.surveyNo}</h3>
        <p className="mt-1 text-sm text-ink-soft">Your decision and note are sent back to {c.requester.name}.</p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {options.map((o) => (
            <button
              key={o.v}
              onClick={() => setStatus(o.v)}
              className="flex flex-col items-center gap-1 rounded-sm border px-2 py-3 text-xs transition"
              style={{
                borderColor: status === o.v ? o.color : "rgba(27,42,65,0.2)",
                background: status === o.v ? `${o.color}12` : "transparent",
                color: status === o.v ? o.color : "#34435A",
              }}
            >
              <o.icon className="h-5 w-5" /> {o.l}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-sm text-ink-soft">Note to citizen</label>
        <textarea
          value={officerNote} onChange={(e) => setOfficerNote(e.target.value)} rows={3}
          placeholder="e.g. Active lien of ₹25L and an open court case. Do not proceed."
          className="mt-1 w-full rounded-sm border border-ink/20 bg-white/60 px-3 py-2 text-sm outline-none focus:border-terracotta"
        />

        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-sm border border-ink/20 px-4 py-2 text-sm text-ink hover:bg-ink/5">Cancel</button>
          <button onClick={save} disabled={saving} className="rounded-sm bg-ink px-4 py-2 text-sm font-medium text-parchment hover:bg-ink-soft disabled:opacity-60">
            {saving ? "Saving…" : "Send decision"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
