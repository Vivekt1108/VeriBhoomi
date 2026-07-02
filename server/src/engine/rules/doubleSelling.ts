// RULE 1 — Double-selling.
// If the same property has two ownership periods that OVERLAP in time but
// belong to DIFFERENT owners, the property was effectively sold to two people
// for the same period. Classic land fraud.
import type { Rule, RuleFinding } from "../types.js";
import { partyName } from "../types.js";

// Two date ranges overlap if each starts before the other ends.
// A null toDate means "still current", treated as the far future.
function overlaps(
  aFrom: Date,
  aTo: Date | null,
  bFrom: Date,
  bTo: Date | null,
): boolean {
  const aEnd = aTo ?? new Date(8640000000000000); // max date
  const bEnd = bTo ?? new Date(8640000000000000);
  return aFrom < bEnd && bFrom < aEnd;
}

export const doubleSelling: Rule = (g): RuleFinding[] => {
  const findings: RuleFinding[] = [];
  const owns = g.ownerships;

  for (let i = 0; i < owns.length; i++) {
    for (let j = i + 1; j < owns.length; j++) {
      const a = owns[i];
      const b = owns[j];
      if (a.ownerId === b.ownerId) continue; // same person, fine
      if (overlaps(a.fromDate, a.toDate, b.fromDate, b.toDate)) {
        findings.push({
          ruleKey: "DOUBLE_SELLING",
          severity: "CRITICAL",
          title: "Overlapping ownership (possible double-sale)",
          description:
            `Property shows overlapping ownership periods for two different owners: ` +
            `${partyName(g, a.ownerId)} and ${partyName(g, b.ownerId)}. ` +
            `The same property appears to have been transferred to two parties for an overlapping period.`,
          linkedRecordIds: [a.id, b.id],
        });
      }
    }
  }
  return findings;
};
