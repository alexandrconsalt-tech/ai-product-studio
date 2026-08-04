import { SUMMARY_CRITERIA } from "../contracts/canonical-enums";
import type { PipelineContractManifest } from "../contracts/contract-types";
import { ConversationStoreV3Schema } from "../contracts/conversation-store/v3/contract";
import {
  SUMMARY_QUALITY_GATE_POLICY_VERSION,
  SUMMARY_QUALITY_GATE_WEIGHTS,
} from "../contracts/quality-gate-input/v3/contract";
import {
  SummaryQualityGateResultV3Schema,
  type SummaryQualityGateResultV3,
} from "../contracts/quality-gate/v3/contract";
import {
  SummaryJudgeV3Schema,
  type SummaryJudgeV3,
} from "../contracts/summary-judges/v3/contract";
import { SummaryV3Schema } from "../contracts/summary/v3/contract";
import { calculateSummaryContentHash } from "../summary-judges/input-builder";
import { buildSummaryPlanV3 } from "../summary/summary-plan";
import { applySummaryPlanAndValidate, type SummaryFinalDiagnosticsV3 } from "../summary/structural-validation";

type Criterion = (typeof SUMMARY_CRITERIA)[number];

export type SummaryQualityGateDiagnosticV3 = Readonly<{
  stageId: "summary_quality_gate_v3";
  inputContractId: "summary.quality-gate.input.v3";
  inputContractVersion: "3.0.0";
  outputContractId: "summary.quality-gate.v3";
  outputContractVersion: "3.2.0";
  manifestHash: string;
  storeId: string;
  storeContentHash: string;
  summaryHash: string;
  policyVersion: typeof SUMMARY_QUALITY_GATE_POLICY_VERSION;
  weights: typeof SUMMARY_QUALITY_GATE_WEIGHTS;
  criterionScores: Readonly<Record<Criterion, number | null>>;
  effectiveCriterionScores: Readonly<Record<Criterion, number | null>>;
  decisionReasons: readonly string[];
  postFinalDiagnostics: SummaryFinalDiagnosticsV3 | null;
  qualityScore: number | null;
  decision: "QUALITY_RECORDED";
  blockersCount: 0;
  warningsCount: number;
  validationStatus: "valid";
  errorType: null;
  errorCode: null;
  durationMs: number;
}>;

export type ExecuteSummaryQualityGateV3Result = Readonly<{
  ok: true;
  value: SummaryQualityGateResultV3;
  diagnostic: SummaryQualityGateDiagnosticV3;
}>;

function parsedVerdicts(verdicts: readonly unknown[]): ReadonlyMap<Criterion, SummaryJudgeV3> {
  const result = new Map<Criterion, SummaryJudgeV3>();
  for (const criterion of SUMMARY_CRITERIA) {
    const matches = verdicts.filter((verdict) =>
      typeof verdict === "object"
      && verdict !== null
      && (verdict as { criterion?: unknown }).criterion === criterion);
    if (matches.length !== 1) continue;
    const parsed = SummaryJudgeV3Schema.safeParse(matches[0]);
    if (parsed.success) result.set(criterion, parsed.data);
  }
  return result;
}

function status(score: number | null): SummaryQualityGateResultV3["qualityStatus"] {
  if (score === null) return "NOT_EVALUATED";
  if (score >= 95) return "EXCELLENT";
  if (score >= 90) return "GOOD";
  if (score >= 75) return "NEEDS_ATTENTION";
  return "LOW_QUALITY";
}

function semanticDecisionReasons(
  store: unknown,
  diagnostics: SummaryFinalDiagnosticsV3 | null,
): readonly string[] {
  const item = store && typeof store === "object" ? store as Record<string, unknown> : {};
  const step = item.primary_next_step && typeof item.primary_next_step === "object"
    ? item.primary_next_step as Record<string, unknown> : {};
  const action = String(step.action ?? "").toLocaleLowerCase("ru-RU");
  const channel = String(step.channel ?? "").toLocaleLowerCase("ru-RU");
  const requirements = Array.isArray(item.requirements) ? item.requirements : [];
  const result: string[] = [];
  if (diagnostics?.technicalResidue.length) result.push("SUMMARY_TECHNICAL_RESIDUE");
  if (diagnostics?.duplicatedMeaningIds.length
    || diagnostics?.technicalResidue.some((code) => code.startsWith("DUPLICATE_KEY_FACT"))) result.push("DUPLICATE_KEY_FACT");
  if (/(?:осмотр|просмотр|показ)/u.test(action) && /(?:phone|телефон|звон)/u.test(channel)) {
    result.push("OUTCOME_ACTION_MISMATCH", "NEXT_STEP_CHANNEL_CONFLICT");
  }
  if (/(?:просмотр\s+согласован)/u.test(String(item.call_result ?? "").toLocaleLowerCase("ru-RU"))
    && step.status !== "confirmed") result.push("UNCONFIRMED_VIEWING");
  if (requirements.some((value) => /(?:адрес|этаж|площадь|жк|комплекс|цена\s*:|property_detail)/iu.test(JSON.stringify(value)))) {
    result.push("CRM_DATA_IN_REQUIREMENTS");
  }
  return [...new Set(result)];
}

export function executeSummaryQualityGateV3(input: {
  manifest: PipelineContractManifest;
  conversationStore: unknown;
  summary: unknown;
  verdicts: readonly unknown[];
  policy?: unknown;
}): ExecuteSummaryQualityGateV3Result {
  const startedAt = Date.now();
  const store = ConversationStoreV3Schema.safeParse(input.conversationStore);
  const summary = SummaryV3Schema.safeParse(input.summary);
  const verdicts = parsedVerdicts(input.verdicts);
  const criterionResults = SUMMARY_CRITERIA.map((criterion) => {
    const verdict = verdicts.get(criterion);
    return {
      criterion,
      score: verdict?.score ?? null,
      verdict: verdict?.verdict ?? "technical_error" as const,
      weight: 0.2 as const,
      evaluated: verdict?.score !== null && verdict !== undefined,
    };
  });
  const evaluated = criterionResults.filter((item) => item.evaluated && item.score !== null);
  const qualityScore = evaluated.length
    ? Math.round(
      (evaluated.reduce((sum, item) => sum + (item.score ?? 0), 0) / evaluated.length) * 10,
    ) / 10
    : null;
  const issues = SUMMARY_CRITERIA.flatMap((criterion) =>
    (verdicts.get(criterion)?.issues ?? []).map((issue) => ({
      code: issue.code,
      criterion,
      message: issue.message,
    })));
  const criticalIssues = SUMMARY_CRITERIA.flatMap((criterion) =>
    (verdicts.get(criterion)?.issues ?? [])
      .filter((issue) => issue.severity === "critical")
      .map((issue) => ({
        code: issue.code,
        criterion,
        message: issue.message,
      })));
  const finalValidation = store.success && summary.success
    ? applySummaryPlanAndValidate(summary.data, buildSummaryPlanV3(store.data))
    : null;
  const postFinalDiagnostics = finalValidation?.diagnostics ?? null;
  const decisionReasons = [
    ...criterionResults
      .filter((item) => item.score !== null && item.score < 80)
      .map((item) => `JUDGE_SCORE_BELOW_80:${item.criterion}:${item.score}`),
    ...criticalIssues.map((item) => `CRITICAL_ISSUE:${item.criterion ?? "unknown"}:${item.code}`),
    ...semanticDecisionReasons(store.success ? store.data : input.conversationStore, postFinalDiagnostics),
  ];
  const computedStatus = status(qualityScore);
  const storeData = store.success ? store.data : null;
  const value = SummaryQualityGateResultV3Schema.parse({
    decision: "QUALITY_RECORDED",
    blocking: false,
    qualityScore,
    qualityStatus: criticalIssues.length > 0 && ["EXCELLENT", "GOOD"].includes(computedStatus)
      ? "NEEDS_ATTENTION"
      : computedStatus,
    evaluationStatus: evaluated.length === 0
      ? "technical_error"
      : evaluated.length < 5 ? "partial" : "complete",
    evaluatedChecks: evaluated.length,
    failedChecks: evaluated.filter((item) => item.verdict === "fail").length,
    technicalErrors: 5 - evaluated.length,
    partialEvaluation: evaluated.length < 5,
    criterionResults,
    issues,
    criticalIssues,
    metadata: {
      runId: storeData?.meta.run_id ?? "unknown-run",
      sourceStoreId: storeData?.meta.store_id ?? "unknown-store",
      sourceStoreHash: storeData?.content_hash ?? "0".repeat(64),
      sourceSummaryHash: summary.success
        ? calculateSummaryContentHash(summary.data)
        : calculateSummaryContentHash(input.summary),
      manifestHash: input.manifest.manifestHash,
      contractVersion: "3.2.0",
      policyVersion: SUMMARY_QUALITY_GATE_POLICY_VERSION,
    },
  });
  return {
    ok: true,
    value,
    diagnostic: {
      stageId: "summary_quality_gate_v3",
      inputContractId: "summary.quality-gate.input.v3",
      inputContractVersion: "3.0.0",
      outputContractId: "summary.quality-gate.v3",
      outputContractVersion: "3.2.0",
      manifestHash: input.manifest.manifestHash,
      storeId: value.metadata.sourceStoreId,
      storeContentHash: value.metadata.sourceStoreHash,
      summaryHash: value.metadata.sourceSummaryHash,
      policyVersion: SUMMARY_QUALITY_GATE_POLICY_VERSION,
      weights: SUMMARY_QUALITY_GATE_WEIGHTS,
      criterionScores: Object.fromEntries(
        criterionResults.map((item) => [item.criterion, item.score]),
      ) as Record<Criterion, number | null>,
      effectiveCriterionScores: Object.fromEntries(
        criterionResults.map((item) => [item.criterion, item.score]),
      ) as Record<Criterion, number | null>,
      decisionReasons,
      postFinalDiagnostics,
      qualityScore,
      decision: "QUALITY_RECORDED",
      blockersCount: 0,
      warningsCount: issues.length,
      validationStatus: "valid",
      errorType: null,
      errorCode: null,
      durationMs: Date.now() - startedAt,
    },
  };
}
