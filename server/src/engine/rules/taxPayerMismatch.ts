// RULE 4 — Tax-payer mismatch.
// Whoever paid tax in a given year should be the recorded owner for that year.
// If taxes were paid by someone who never appears in the ownership chain at
// that time, ownership records and ground reality disagree.
import type { Rule, RuleFinding } from "../types.js";
import { partyName } from "../types.js";

// who owned the property during a given calendar year?
function ownerIdsInYear(
  g: { ownerships: { ownerId: string; fromDate: Date; toDate: Date | null }[] },
  year: number,
): Set<string> {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));
  const ids = new Set<string>();
  for (const o of g.ownerships) {
    const oEnd = o.toDate ?? new Date(8640000000000000);
    if (o.fromDate <= end && oEnd >= start) ids.add(o.ownerId);
  }
  return ids;
}

export const taxPayerMismatch: Rule = (g): RuleFinding[] => {
  const findings: RuleFinding[] = [];

  for (const tax of g.taxRecords) {
    const owners = ownerIdsInYear(g, tax.year);
    if (owners.size === 0) continue; // no ownership data that year, can't judge
    if (!owners.has(tax.payerId)) {
      findings.push({
        ruleKey: "TAX_PAYER_MISMATCH",
        severity: "WARNING",
        title: "Tax paid by a non-owner",
        description:
          `In ${tax.year}, property tax was paid by ${partyName(g, tax.payerId)}, ` +
          `who is not recorded as an owner that year. This can indicate an ` +
          `unrecorded transfer or a third party maintaining a claim.`,
        linkedRecordIds: [tax.id],
      });
    }
  }
  return findings;
};
