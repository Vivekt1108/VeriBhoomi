"use client";

// AUTHORITY OVERSIGHT — the regional command view. An interactive map of every
// property, charts that break down status / risk / the verification funnel, and
// a live audit timeline of who did what. Read-heavy, analytical — the opposite
// of the officer's task-by-task console.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Map as MapIcon, ScrollText, ShieldCheck, Activity, Layers, TrendingUp } from "lucide-react";
import { RoleShell, type NavItem } from "@/components/shell/RoleShell";
import { StatTile, DonutChart, BarChart, type Segment, type Bar } from "@/components/viz/charts";
import { BengaluruMap, type MapPin } from "@/components/viz/BengaluruMap";
import { api } from "@/lib/api";

interface Overview {
  scope: string;
  totals: { properties: number; flagged: number; pendingRequests: number; criticalFindings: number; avgScore: number | null };
  findings: { critical: number; warning: number; info: number; verified: number };
  byStatus: Record<string, number>;
  byTaluk: { taluk: string; total: number; flagged: number }[];
  byRequest: Record<string, number>;
  pins: MapPin[];
}
interface AuditRow {
  id: string; action: string; entity: string; entityId: string; timestamp: string;
  actor: { name: string; role: string };
}

const nav: NavItem[] = [
  { href: "/authority", label: "Oversight", icon: <MapIcon className="h-4 w-4" /> },
];

const statusColors: Record<string, string> = {
  CLEAR: "#2F5D44", UNDER_REVIEW: "#B8893B", DISPUTED: "#7A1F1F", FLAGGED: "#B5532A",
};
const actionLabel: Record<string, string> = {
  VIEW: "viewed", ANALYZE: "ran analysis on", VERIFY: "verified a finding on",
  OVERRIDE: "overrode a finding on", PUBLIC_VIEW: "opened trust report for",
  REQUEST_OPEN: "opened a request on", REQUEST_CLAIM: "claimed a case on",
  REQUEST_RESOLVE: "resolved a case on", USER_CREATE: "created a user", USER_UPDATE: "updated a user",
};

export default function AuthorityHome() {
  return (
    <RoleShell role="AUTHORITY" nav={nav}>
      <AuthorityInner />
    </RoleShell>
  );
}

function AuthorityInner() {
  const router = useRouter();
  const [ov, setOv] = useState<Overview | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    api<Overview>("/api/stats/overview").then(setOv).catch(() => {});
    api<AuditRow[]>("/api/audit").then(setAudit).catch(() => {});
  }, []);

  const statusSegments: Segment[] = ov
    ? Object.entries(ov.byStatus).map(([k, v]) => ({ label: k.replace(/_/g, " "), value: v, color: statusColors[k] ?? "#34435A" }))
    : [];
  const talukBars: Bar[] = ov ? ov.byTaluk.map((t) => ({ label: t.taluk, value: t.total, sub: t.flagged })) : [];

  const funnel = ov ? [
    { k: "SUBMITTED", l: "Submitted", c: "#6B7689" },
    { k: "IN_REVIEW", l: "In review", c: "#B8893B" },
    { k: "CLEARED", l: "Cleared", c: "#2F5D44" },
    { k: "FLAGGED", l: "Flagged", c: "#B5532A" },
    { k: "REJECTED", l: "Rejected", c: "#7A1F1F" },
  ].map((s) => ({ ...s, v: ov.byRequest[s.k] ?? 0 })) : [];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.v));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl text-ink">Regional oversight</h1>
        <p className="mt-1 text-ink-soft">Everything happening across <strong className="text-ink">{ov?.scope ?? "…"}</strong>.</p>
      </div>

      {/* ---------- STAT TILES ---------- */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Properties" value={ov?.totals.properties ?? 0} accent="#1B2A41" icon={<Layers className="h-5 w-5" />} delay={0} />
        <StatTile label="Flagged" value={ov?.totals.flagged ?? 0} accent="#B5532A" icon={<Activity className="h-5 w-5" />} delay={0.05} />
        <StatTile label="Open requests" value={ov?.totals.pendingRequests ?? 0} accent="#B8893B" icon={<ScrollText className="h-5 w-5" />} delay={0.1} />
        <StatTile label="Critical findings" value={ov?.totals.criticalFindings ?? 0} accent="#7A1F1F" icon={<ShieldCheck className="h-5 w-5" />} delay={0.15} />
        <StatTile label="Avg health" value={ov?.totals.avgScore ?? 0} suffix="/100" accent="#2F5D44" icon={<TrendingUp className="h-5 w-5" />} delay={0.2} />
      </section>

      {/* ---------- MAP + STATUS DONUT ---------- */}
      <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm uppercase tracking-[0.18em] text-ink-faint">
            <MapIcon className="h-4 w-4" /> Property map · click a pin
          </div>
          {ov && <BengaluruMap pins={ov.pins} selectedId={selected} onSelect={(id) => { setSelected(id); router.push(`/property/${id}`); }} />}
        </div>
        <div className="space-y-6">
          <div className="rounded-lg border border-ink/10 bg-parchment p-5 shadow-raised">
            <h3 className="mb-4 text-sm uppercase tracking-[0.18em] text-ink-faint">Status breakdown</h3>
            {statusSegments.length > 0 && <DonutChart segments={statusSegments} />}
          </div>
          <div className="rounded-lg border border-ink/10 bg-parchment p-5 shadow-raised">
            <h3 className="mb-4 text-sm uppercase tracking-[0.18em] text-ink-faint">Findings by severity</h3>
            <BarChart
              bars={ov ? [
                { label: "Critical", value: ov.findings.critical },
                { label: "Warning", value: ov.findings.warning },
                { label: "Info", value: ov.findings.info },
                { label: "Human-verified", value: ov.findings.verified },
              ] : []}
              color="#B8893B"
            />
          </div>
        </div>
      </section>

      {/* ---------- TALUK BARS + REQUEST FUNNEL ---------- */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-ink/10 bg-parchment p-5 shadow-raised">
          <h3 className="mb-4 text-sm uppercase tracking-[0.18em] text-ink-faint">Properties by taluk</h3>
          <BarChart bars={talukBars} color="#1B2A41" subColor="#B5532A" />
        </div>
        <div className="rounded-lg border border-ink/10 bg-parchment p-5 shadow-raised">
          <h3 className="mb-4 text-sm uppercase tracking-[0.18em] text-ink-faint">Verification funnel</h3>
          <div className="space-y-2.5">
            {funnel.map((f, i) => (
              <div key={f.k} className="flex items-center gap-3">
                <span className="w-20 text-xs text-ink-soft">{f.l}</span>
                <div className="relative h-7 flex-1 overflow-hidden rounded-sm bg-ink/5">
                  <motion.div
                    className="flex h-full items-center justify-end rounded-sm px-2 text-xs font-bold text-white"
                    style={{ background: f.c }}
                    initial={{ width: 0 }} animate={{ width: `${Math.max((f.v / funnelMax) * 100, f.v ? 12 : 0)}%` }}
                    transition={{ delay: i * 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {f.v > 0 ? f.v : ""}
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- AUDIT TIMELINE ---------- */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-ink" />
          <h2 className="font-serif text-2xl text-ink">Audit timeline</h2>
          <span className="text-sm text-ink-faint">· append-only record of every action</span>
        </div>
        <div className="rounded-lg border border-ink/10 bg-parchment p-5 shadow-raised">
          <ol className="relative ml-3 border-l border-ink/15">
            {audit.slice(0, 40).map((a, i) => (
              <motion.li
                key={a.id}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.02, 0.4) }}
                className="mb-4 ml-5"
              >
                <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full border-2 border-parchment" style={{ background: "#B5532A" }} />
                <div className="text-sm text-ink">
                  <strong>{a.actor.name}</strong>
                  <span className="text-ink-faint"> ({a.actor.role.toLowerCase()}) </span>
                  {actionLabel[a.action] ?? a.action.toLowerCase().replace(/_/g, " ")}
                  <span className="text-ink-soft"> {a.entity}</span>
                </div>
                <div className="text-xs text-ink-faint">{new Date(a.timestamp).toLocaleString("en-IN")}</div>
              </motion.li>
            ))}
            {audit.length === 0 && <li className="ml-5 text-sm text-ink-faint">No activity recorded yet.</li>}
          </ol>
        </div>
      </section>
    </div>
  );
}
