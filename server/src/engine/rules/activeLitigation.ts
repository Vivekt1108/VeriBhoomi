// RULE 7 — Active litigation.
// If the property is party to an OPEN court dispute, any transaction is risky
// until the case is resolved — the outcome could change ownership.
import type { Rule, RuleFinding } from "../types.js";

export const activeLitigation: Rule = (g): RuleFinding[] => {
  const findings: RuleFinding[] = [];

  for (const d of g.disputes) {
    if (d.status === "OPEN" || d.status === "STAYED") {
      findings.push({
        ruleKey: "ACTIVE_LITIGATION",
        severity: "CRITICAL",
        title: "Property under active litigation",
        description:
          `An ${d.status.toLowerCase()} court case (${d.caseNo}, ${d.court}) involves this property. ` +
          `Ownership could change with the verdict; transacting now is high-risk.`,
        linkedRecordIds: [d.id],
      });
    }
  }
  return findings;
};
