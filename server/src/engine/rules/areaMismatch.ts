// RULE 6 — Area / survey-number mismatch across documents.
// Each document's OCR-extracted "area" should match the official property area.
// A discrepancy beyond tolerance means documents describe different plots —
// a sign of forgery, mixed-up records, or boundary manipulation.
import type { Rule, RuleFinding } from "../types.js";

const TOLERANCE = 0.02; // 2% — accounts for rounding, not real differences

export const areaMismatch: Rule = (g): RuleFinding[] => {
  const findings: RuleFinding[] = [];

  for (const doc of g.documents) {
    const raw = doc.extractedFields["area"];
    if (raw === undefined || raw === null) continue;
    const docArea = Number(raw);
    if (!Number.isFinite(docArea) || docArea <= 0) continue;

    const diff = Math.abs(docArea - g.area) / g.area;
    if (diff > TOLERANCE) {
      findings.push({
        ruleKey: "AREA_MISMATCH",
        severity: "WARNING",
        title: "Plot area mismatch between documents",
        description:
          `${doc.type.replace(/_/g, " ").toLowerCase()} states an area of ${docArea} sq ft, ` +
          `but the official property record is ${g.area} sq ft ` +
          `(${(diff * 100).toFixed(1)}% difference). Documents may describe different plots.`,
        linkedRecordIds: [doc.id],
      });
    }
  }
  return findings;
};
