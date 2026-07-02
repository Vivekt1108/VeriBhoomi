"use client";

import { motion } from "framer-motion";
import { AlertOctagon, AlertTriangle, Info, CheckCircle2 } from "lucide-react";

export interface Finding {
  id: string;
  ruleKey: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  title: string;
  description: string;
  linkedRecordIds: string[] | unknown;
  humanVerified: boolean;
  expertNotes?: string | null;
  verifiedBy?: { name: string } | null;
}

const sevConfig = {
  CRITICAL: { icon: AlertOctagon, color: "#B5532A", label: "Critical" },
  WARNING: { icon: AlertTriangle, color: "#B8893B", label: "Warning" },
  INFO: { icon: Info, color: "#34435A", label: "Info" },
} as const;

export function FindingCard({
  finding,
  index,
  onHover,
  canVerify,
  onVerify,
}: {
  finding: Finding;
  index: number;
  onHover?: (ids: string[] | null) => void;
  canVerify?: boolean;
  onVerify?: (f: Finding) => void;
}) {
  const cfg = sevConfig[finding.severity];
  const Icon = cfg.icon;
  const ids = Array.isArray(finding.linkedRecordIds) ? (finding.linkedRecordIds as string[]) : [];

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      onMouseEnter={() => onHover?.(ids)}
      onMouseLeave={() => onHover?.(null)}
      className="rounded-sm border-l-4 bg-parchment p-4 shadow-ledger"
      style={{ borderLeftColor: cfg.color }}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: cfg.color }} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span
              className="rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
              style={{ backgroundColor: cfg.color }}
            >
              {cfg.label}
            </span>
            <h4 className="font-serif text-base text-ink">{finding.title}</h4>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{finding.description}</p>

          {finding.humanVerified && (
            <div className="mt-2 flex items-center gap-2 rounded-sm bg-gold/15 px-2.5 py-1.5 text-xs text-ink">
              <CheckCircle2 className="h-4 w-4 text-gold" />
              Verified by {finding.verifiedBy?.name ?? "officer"}
              {finding.expertNotes ? ` — “${finding.expertNotes}”` : ""}
            </div>
          )}

          {canVerify && !finding.humanVerified && (
            <button
              onClick={() => onVerify?.(finding)}
              className="mt-2 rounded-sm border border-ink/20 px-3 py-1 text-xs text-ink transition hover:bg-ink hover:text-parchment"
            >
              Review this finding
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
