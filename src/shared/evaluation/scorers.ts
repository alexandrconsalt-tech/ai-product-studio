import type { Run } from "@/entities/Run/model/types";
import { CallAnalysisSummarySchema } from "@/shared/model/call-analysis-summary";
import type { GoldenExample } from "./golden-dataset";

/**
 * Deterministic scorers, matching the evaluation plan actually
 * described in this repository's real business case (CLAUDE.md §18,
 * `pdf-notes.txt` Этап 1): cheap, exact, no model-judge call. A
 * model-judge scorer (LLM-as-judge) is deliberately not included here
 * -- it would need a real LLM call to grade another LLM call, which
 * is a larger, separate piece of work than this evaluation mechanism
 * needed to demonstrate the Golden Dataset concept end to end.
 */

export type ScoreResult = Readonly<{
  scorerName: string;
  passed: boolean;
  details?: string;
}>;

export type Scorer = (run: Run, example: GoldenExample) => ScoreResult;

/** Prerequisite for every other scorer: does the output even match the expected structured shape? */
export const schemaValidScorer: Scorer = (run) => {
  const result = CallAnalysisSummarySchema.safeParse(run.output);
  return { scorerName: "schema_valid", passed: result.success, details: result.success ? undefined : result.error.issues.map((issue) => issue.message).join("; ") };
};

export const minCitationsScorer: Scorer = (run, example) => {
  const result = CallAnalysisSummarySchema.safeParse(run.output);
  if (!result.success) return { scorerName: "min_citations", passed: false, details: "output does not match schema" };
  const passed = result.data.цитаты.length >= example.expected.minCitations;
  return { scorerName: "min_citations", passed, details: `expected >= ${example.expected.minCitations}, got ${result.data.цитаты.length}` };
};

export const hasActionScorer: Scorer = (run) => {
  const result = CallAnalysisSummarySchema.safeParse(run.output);
  if (!result.success) return { scorerName: "has_action", passed: false, details: "output does not match schema" };
  const passed = result.data.действие.trim().length > 10;
  return { scorerName: "has_action", passed, details: passed ? undefined : "действие is present but too short to be a concrete next step" };
};

/**
 * CLAUDE.md §30 BR-2: a contact-center-routed summary must never
 * leak object/client data (phone numbers, exact addresses). This is
 * a real business rule from the actual call-analysis case, not a
 * generic placeholder check.
 */
const PHONE_PATTERN = /(\+?\d[\d\s\-()]{7,}\d)/;

export const noLeakedDataInContactCenterScorer: Scorer = (run) => {
  const result = CallAnalysisSummarySchema.safeParse(run.output);
  if (!result.success) return { scorerName: "no_leaked_data_contact_center", passed: false, details: "output does not match schema" };
  if (result.data.тип_контакта !== "contact_center") {
    return { scorerName: "no_leaked_data_contact_center", passed: true, details: "not applicable (agent contact)" };
  }
  const haystack = [result.data.потребность, ...result.data.цитаты].join(" ");
  const leaked = PHONE_PATTERN.test(haystack);
  return { scorerName: "no_leaked_data_contact_center", passed: !leaked, details: leaked ? "phone-number-like pattern found in a contact_center summary" : undefined };
};

export const contactTypeMatchScorer: Scorer = (run, example) => {
  if (!example.expected.тип_контакта) return { scorerName: "contact_type_match", passed: true, details: "no expectation set" };
  const result = CallAnalysisSummarySchema.safeParse(run.output);
  if (!result.success) return { scorerName: "contact_type_match", passed: false, details: "output does not match schema" };
  const passed = result.data.тип_контакта === example.expected.тип_контакта;
  return { scorerName: "contact_type_match", passed, details: `expected ${example.expected.тип_контакта}, got ${result.data.тип_контакта}` };
};

export const statusMatchScorer: Scorer = (run, example) => {
  if (!example.expected.статус) return { scorerName: "status_match", passed: true, details: "no expectation set" };
  const result = CallAnalysisSummarySchema.safeParse(run.output);
  if (!result.success) return { scorerName: "status_match", passed: false, details: "output does not match schema" };
  const passed = result.data.статус === example.expected.статус;
  return { scorerName: "status_match", passed, details: `expected ${example.expected.статус}, got ${result.data.статус}` };
};

export const defaultScorers: readonly Scorer[] = [
  schemaValidScorer,
  minCitationsScorer,
  hasActionScorer,
  noLeakedDataInContactCenterScorer,
  contactTypeMatchScorer,
  statusMatchScorer,
];
