// The fraud engine entry point.
// Runs every rule over a property's web, collects findings, computes the score.
// Pure: no DB, no AI, no network. Same input always gives the same output.
import type { PropertyGraph, RuleFinding, Rule } from "./types.js";
import { computeScore, type ScoreResult } from "./score.js";

import { doubleSelling } from "./rules/doubleSelling.js";
import { chainOfTitle } from "./rules/chainOfTitle.js";
import { inheritanceConflict } from "./rules/inheritanceConflict.js";
import { taxPayerMismatch } from "./rules/taxPayerMismatch.js";
import { hiddenLien } from "./rules/hiddenLien.js";
import { areaMismatch } from "./rules/areaMismatch.js";
import { activeLitigation } from "./rules/activeLitigation.js";
import { circularOwnership } from "./rules/circularOwnership.js";

// the full rule set — add new rules here and they run automatically
export const ALL_RULES: Rule[] = [
  doubleSelling,
  chainOfTitle,
  inheritanceConflict,
  taxPayerMismatch,
  hiddenLien,
  areaMismatch,
  activeLitigation,
  circularOwnership,
];

export interface AnalysisResult {
  findings: RuleFinding[];
  score: ScoreResult;
}

export function analyze(graph: PropertyGraph): AnalysisResult {
  const findings = ALL_RULES.flatMap((rule) => rule(graph));
  const score = computeScore(findings);
  return { findings, score };
}

export type { PropertyGraph, RuleFinding };
export { computeScore };
