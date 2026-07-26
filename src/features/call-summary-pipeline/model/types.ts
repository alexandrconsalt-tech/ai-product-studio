import type { CallSummaryErrorType, CriterionKey, QualityDecision, QualityIssue } from "../lib/call-summary-pipeline";

/** One saved human evaluation of a single pipeline run -- same shape `computeQualityDecision` expects, so the AI path and the human path run through the identical deterministic formula (spec §9: "AI и человек должны использовать одинаковые критерии/шкалу/веса/правила расчёта"). */
export type HumanEvaluation = Readonly<{
  scores: Record<CriterionKey, { raw_score: 0 | 1 | 2 | 3 | 4; comment?: string }>;
  issues: readonly QualityIssue[];
  savedAt: string;
}>;

export type AiVsHumanComparison = Readonly<{
  overallDiff: number;
  perCriterionDiff: Record<CriterionKey, number>;
  decisionMatches: boolean;
}>;

export type { CallSummaryErrorType, CriterionKey, QualityDecision, QualityIssue };
