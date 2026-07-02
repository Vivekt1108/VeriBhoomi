// RULE 3 — Inheritance conflict.
// When a property passes by inheritance, the person who then SELLS/holds it
// should be the recorded heir (the inheritance's "toParty"). If an owner takes
// over right after an inheritance but isn't the heir, someone other than the
// rightful heir is dealing with the property.
import type { Rule, RuleFinding } from "../types.js";
import { partyName } from "../types.js";

const NEAR_DAYS = 730; // within ~2 years of the inheritance
const DAY = 1000 * 60 * 60 * 24;

export const inheritanceConflict: Rule = (g): RuleFinding[] => {
  const findings: RuleFinding[] = [];

  for (const inh of g.inheritances) {
    // find an ownership that begins shortly AFTER this inheritance
    const successor = g.ownerships.find((o) => {
      const diff = (o.fromDate.getTime() - inh.date.getTime()) / DAY;
      return diff >= 0 && diff <= NEAR_DAYS;
    });
    if (!successor) continue;

    if (successor.ownerId !== inh.toId) {
      findings.push({
        ruleKey: "INHERITANCE_CONFLICT",
        severity: "CRITICAL",
        title: "Owner is not the recorded heir",
        description:
          `Inheritance records pass this property to ${partyName(g, inh.toId)}, ` +
          `but ${partyName(g, successor.ownerId)} took ownership soon after. ` +
          `The property may have been dealt with by someone other than the rightful heir.`,
        linkedRecordIds: [inh.id, successor.id],
      });
    }
  }
  return findings;
};
