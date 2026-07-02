// RULE 8 — Circular / benami pattern.
// If ownership keeps bouncing back to a party who already owned it earlier
// (A -> B -> A ...), the transfers may be artificial — a benami arrangement
// to launder title or obscure the real owner. We flag any owner that appears
// in more than one NON-CONTIGUOUS ownership period.
import type { Rule, RuleFinding } from "../types.js";
import { partyName } from "../types.js";

export const circularOwnership: Rule = (g): RuleFinding[] => {
  const findings: RuleFinding[] = [];

  // order owners by time, build the sequence of owner ids
  const seq = [...g.ownerships]
    .sort((a, b) => a.fromDate.getTime() - b.fromDate.getTime())
    .map((o) => ({ ownerId: o.ownerId, id: o.id }));

  // for each owner, collect the positions they appear at
  const positions = new Map<string, { idx: number; recId: string }[]>();
  seq.forEach((s, idx) => {
    const arr = positions.get(s.ownerId) ?? [];
    arr.push({ idx, recId: s.id });
    positions.set(s.ownerId, arr);
  });

  for (const [ownerId, appearances] of positions) {
    // appears 2+ times, and not in directly consecutive slots => came back later
    if (appearances.length < 2) continue;
    const nonContiguous = appearances.some(
      (a, k) => k > 0 && a.idx - appearances[k - 1].idx > 1,
    );
    if (nonContiguous) {
      findings.push({
        ruleKey: "CIRCULAR_OWNERSHIP",
        severity: "WARNING",
        title: "Circular ownership pattern",
        description:
          `${partyName(g, ownerId)} appears as owner across multiple separate periods, ` +
          `with other owners in between. Such circular transfers can indicate a ` +
          `benami (proxy) arrangement to obscure the true owner.`,
        linkedRecordIds: appearances.map((a) => a.recId),
      });
    }
  }
  return findings;
};
