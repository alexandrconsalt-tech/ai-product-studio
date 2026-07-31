import type {
  DeprecatedSummaryJudgeV3_0 as SummaryJudgeV3,
} from "../contracts/summary-judges/v3/contract";

export type CompatibilityLog = Readonly<{
  adapterId: string;
  sourceContractId: string;
  target: "summary_quality_gate_v1";
  mappedPaths: readonly string[];
  lossy: boolean;
}>;

export type CompatibilityResult<T> =
  | Readonly<{ ok: true; value: T; log: CompatibilityLog }>
  | Readonly<{
      ok: false;
      error: {
        status: "TECHNICAL_ERROR";
        errorCode: "LOSSY_COMPATIBILITY_MAPPING";
        message: string;
      };
      log: CompatibilityLog;
    }>;

function messages(input: SummaryJudgeV3, severity: "warning" | "critical"): string[] {
  return input.issues.filter((issue) => issue.severity === severity).map((issue) => issue.message);
}

/** @temporary Remove when Quality Gate consumes summary.judge.verdict.v3 directly. */
export function adaptSummaryJudgeToQualityGateV1(
  input: SummaryJudgeV3,
): CompatibilityResult<Record<string, unknown>> {
  if (input.verdict === "technical_error") {
    return {
      ok: true,
      value: { status: "error", score: null, confidence: null, errors: [], warnings: [] },
      log: {
        adapterId: "temporary.summary-judge-v3-to-quality-gate-v1",
        sourceContractId: "summary.judge.verdict.v3",
        target: "summary_quality_gate_v1",
        mappedPaths: ["status", "score", "confidence"],
        lossy: false,
      },
    };
  }

  const critical = messages(input, "critical");
  const warnings = messages(input, "warning");
  const base = {
    status: input.verdict === "pass" ? "pass" : input.verdict,
    score: input.score,
    confidence: input.confidence,
  };
  const criterionFields: Record<SummaryJudgeV3["criterion"], Record<string, unknown>> = {
    faithfulness: {
      critical_errors: critical,
      warnings,
      has_hallucinations: input.payload.criterion === "faithfulness" && input.payload.unsupported_claims.length > 0,
      has_money_or_number_errors: false,
      has_pii: false,
    },
    completeness: { missing_items: critical, warnings },
    usefulness: {
      problems: [...critical, ...warnings],
      missing_for_next_agent: input.payload.criterion === "usefulness" ? input.payload.agent_blocking_omissions : [],
      can_continue_without_recording: critical.length === 0,
    },
    agreements_next_step: { errors: critical, warnings, next_step_verified: critical.length === 0 },
    format: { errors: critical, warnings, checks: {} },
  };
  return {
    ok: true,
    value: { ...base, ...criterionFields[input.criterion], compatibility_v3_source: input },
    log: {
      adapterId: "temporary.summary-judge-v3-to-quality-gate-v1",
      sourceContractId: "summary.judge.verdict.v3",
      target: "summary_quality_gate_v1",
      mappedPaths: ["status", "score", "confidence", input.criterion],
      lossy: false,
    },
  };
}
