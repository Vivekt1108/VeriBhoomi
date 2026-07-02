// Health score: start at 100, deduct per finding by severity.
// Transparent — we return a breakdown so the UI can show exactly how each
// point was lost. Score floors at 0.
import type { RuleFinding, Severity } from "./types.js";

const WEIGHTS: Record<Severity, number> = {
  CRITICAL: 30,
  WARNING: 12,
  INFO: 4,
};

export interface ScoreBreakdownItem {
  ruleKey: string;
  title: string;
  severity: Severity;
  deduction: number;
}

export interface ScoreResult {
  score: number;
  riskBand: "LOW" | "MEDIUM" | "HIGH";
  breakdown: ScoreBreakdownItem[];
}

export function computeScore(findings: RuleFinding[]): ScoreResult {
  const breakdown: ScoreBreakdownItem[] = findings.map((f) => ({
    ruleKey: f.ruleKey,
    title: f.title,
    severity: f.severity,
    deduction: WEIGHTS[f.severity],
  }));

  const totalDeduction = breakdown.reduce((sum, b) => sum + b.deduction, 0);
  const score = Math.max(0, 100 - totalDeduction);

  // band thresholds: higher score = safer
  const riskBand = score >= 75 ? "LOW" : score >= 45 ? "MEDIUM" : "HIGH";

  return { score, riskBand, breakdown };
}
