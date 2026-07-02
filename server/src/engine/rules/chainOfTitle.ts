// RULE 2 — Broken chain of title.
// Ownership should be continuous: when one owner's period ends, the next
// should begin around then. A gap (or a later owner whose start has no
// matching predecessor end) means a transfer was never recorded — the chain
// is broken and title is unsafe.
import type { Rule, RuleFinding } from "../types.js";
import { partyName } from "../types.js";

const GAP_DAYS = 365; // tolerate up to ~1 year between recorded transfers
const DAY = 1000 * 60 * 60 * 24;

export const chainOfTitle: Rule = (g): RuleFinding[] => {
  const findings: RuleFinding[] = [];

  // sort ownerships oldest-first by start date
  const owns = [...g.ownerships].sort(
    (a, b) => a.fromDate.getTime() - b.fromDate.getTime(),
  );
  if (owns.length < 2) return findings; // nothing to chain

  for (let i = 1; i < owns.length; i++) {
    const prev = owns[i - 1];
    const curr = owns[i];
    if (!prev.toDate) continue; // previous still current; overlap handled by rule 1

    const gap = (curr.fromDate.getTime() - prev.toDate.getTime()) / DAY;
    if (gap > GAP_DAYS) {
      findings.push({
        ruleKey: "BROKEN_CHAIN",
        severity: "WARNING",
        title: "Gap in chain of title",
        description:
          `There is an unexplained ${Math.round(gap)}-day gap between ` +
          `${partyName(g, prev.ownerId)} (ended ${prev.toDate.toISOString().slice(0, 10)}) ` +
          `and ${partyName(g, curr.ownerId)} (started ${curr.fromDate.toISOString().slice(0, 10)}). ` +
          `A transfer in this period may never have been recorded.`,
        linkedRecordIds: [prev.id, curr.id],
      });
    }
  }
  return findings;
};
