// RULE 5 — Hidden active lien.
// An encumbrance (mortgage/loan against the property) that is still active
// means the title is NOT clear. If a sale deed claims "clear title" while an
// active encumbrance exists, the buyer is inheriting an undisclosed debt.
import type { Rule, RuleFinding } from "../types.js";

export const hiddenLien: Rule = (g): RuleFinding[] => {
  const findings: RuleFinding[] = [];

  const activeLiens = g.encumbrances.filter((e) => e.active);
  if (activeLiens.length === 0) return findings;

  // does any sale deed claim clear title?
  const deedClaimsClear = g.documents.some(
    (d) =>
      d.type === "SALE_DEED" &&
      String(d.extractedFields["titleStatus"] ?? "").toLowerCase().includes("clear"),
  );

  for (const lien of activeLiens) {
    findings.push({
      ruleKey: "HIDDEN_LIEN",
      severity: deedClaimsClear ? "CRITICAL" : "WARNING",
      title: deedClaimsClear
        ? "Active lien despite 'clear title' claim"
        : "Active lien on property",
      description: deedClaimsClear
        ? `An active encumbrance of ₹${lien.amount.toLocaleString("en-IN")} exists, ` +
          `yet a sale deed claims clear title. The buyer would take on an undisclosed charge.`
        : `Property carries an active (uncleared) encumbrance of ₹${lien.amount.toLocaleString("en-IN")}. ` +
          `Title is not free until this is cleared.`,
      linkedRecordIds: [lien.id],
    });
  }
  return findings;
};
