import type { PipelineContractManifest } from "../contracts/contract-types";
import {
  SUMMARY_CRITERIA,
} from "../contracts/canonical-enums";
import type { SummaryCriterionV3 } from "../contracts/summary-judge-input/v3/contract";
import {
  SummaryJudgeV3Contract,
  type SummaryJudgeV3,
} from "../contracts/summary-judges/v3/contract";
import type { TranscriptV3 } from "../contracts/transcript/v3/contract";
import type {
  SafeProviderDiagnostic,
  StructuredOutputErrorCode,
  StructuredProviderTransport,
} from "../runtime/structured-output";
import { executeStructuredCompletion } from "../runtime/structured-output";
import {
  buildSummaryJudgeInput,
  type SummaryJudgeInputErrorCode,
} from "./input-builder";
import {
  buildSummaryJudgePrompt,
  SUMMARY_JUDGE_PROMPTS,
  type SummaryJudgeResolvedPromptV3,
} from "./prompt-builders";
import { validateSummaryJudgeVerdict } from "./post-validation";

export type SummaryJudgeExecutionErrorCode =
  | SummaryJudgeInputErrorCode
  | "STRUCTURED_OUTPUT_UNAVAILABLE"
  | "SUMMARY_JUDGE_OUTPUT_INVALID"
  | "SUMMARY_JUDGE_PROVIDER_ERROR"
  | "SUMMARY_JUDGE_TECHNICAL_ERROR"
  | StructuredOutputErrorCode;

export type SummaryJudgeDiagnosticV3 = Readonly<{
  stageId: string;
  criterion: SummaryCriterionV3;
  inputContractId: "summary.judge.input.v3";
  inputContractVersion: "3.0.0";
  outputContractId: "summary.judge.verdict.v3";
  outputContractVersion: "3.1.0";
  manifestHash: string;
  storeId: string | null;
  storeContentHash: string | null;
  summaryHash: string | null;
  promptId: string;
  promptVersion: string;
  promptHash: string | null;
  schemaHash: string;
  structuredOutputRequested: boolean;
  structuredOutputApplied: boolean;
  attemptCount: number;
  repairAttempted: boolean;
  rawScore: 0 | 25 | 50 | 75 | 100 | null;
  score: 0 | 25 | 50 | 75 | 100 | null;
  confidence: number | null;
  verdict: SummaryJudgeV3["verdict"] | null;
  validationStatus: "valid" | "invalid" | "not_run";
  providerDiagnostic: SafeProviderDiagnostic | null;
  errorType: "dependency_error" | "provider_error" | "validation_error" | "judge_technical_error" | null;
  errorCode: SummaryJudgeExecutionErrorCode | null;
  durationMs: number;
}>;

export type ExecuteSummaryJudgeV3Result =
  | Readonly<{
      ok: true;
      value: SummaryJudgeV3;
      prompt: SummaryJudgeResolvedPromptV3;
      diagnostic: SummaryJudgeDiagnosticV3;
    }>
  | Readonly<{
      ok: false;
      disposition: "NOT_RUN" | "TECHNICAL_ERROR";
      error: {
        status: "NOT_RUN" | "TECHNICAL_ERROR";
        errorCode: SummaryJudgeExecutionErrorCode;
        message: string;
      };
      prompt?: SummaryJudgeResolvedPromptV3;
      diagnostic: SummaryJudgeDiagnosticV3;
    }>;

function structuredErrorCode(code: string): SummaryJudgeExecutionErrorCode {
  if (code === "STRUCTURED_OUTPUT_UNAVAILABLE" || code === "STRUCTURED_OUTPUT_NOT_APPLIED") {
    return "STRUCTURED_OUTPUT_UNAVAILABLE";
  }
  if (code === "SCHEMA_VALIDATION_ERROR" || code === "JSON_DECODE_ERROR") {
    return "SUMMARY_JUDGE_OUTPUT_INVALID";
  }
  return code as StructuredOutputErrorCode;
}

export async function executeSummaryJudgeV3(input: {
  manifest: PipelineContractManifest;
  conversationStore: unknown;
  summary: unknown;
  transcript: TranscriptV3 | unknown;
  criterion: SummaryCriterionV3;
  provider: string;
  model: string;
  transport: StructuredProviderTransport;
}): Promise<ExecuteSummaryJudgeV3Result> {
  const startedAt = Date.now();
  const promptIdentity = SUMMARY_JUDGE_PROMPTS[input.criterion];
  const baseDiagnostic = {
    stageId: `summary_judge_${input.criterion}`,
    criterion: input.criterion,
    inputContractId: "summary.judge.input.v3" as const,
    inputContractVersion: "3.0.0" as const,
    outputContractId: "summary.judge.verdict.v3" as const,
    outputContractVersion: "3.1.0" as const,
    manifestHash: input.manifest.manifestHash,
    storeId: null,
    storeContentHash: null,
    summaryHash: null,
    promptId: promptIdentity.id,
    promptVersion: promptIdentity.version,
    promptHash: null,
    schemaHash: SummaryJudgeV3Contract.schemaHash,
    structuredOutputRequested: false,
    structuredOutputApplied: false,
    attemptCount: 0,
    repairAttempted: false,
    rawScore: null,
    score: null,
    confidence: null,
    verdict: null,
    validationStatus: "not_run" as const,
    providerDiagnostic: null,
  };
  const built = buildSummaryJudgeInput({
    manifest: input.manifest,
    conversationStore: input.conversationStore,
    summary: input.summary,
    transcript: input.transcript,
    criterion: input.criterion,
    judgePromptVersion: promptIdentity.version,
  });
  if (!built.ok) {
    return {
      ok: false,
      disposition: built.disposition,
      error: built.error,
      diagnostic: {
        ...baseDiagnostic,
        errorType: "dependency_error",
        errorCode: built.error.errorCode,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  const prompt = buildSummaryJudgePrompt(built.value);
  let completion: Awaited<ReturnType<typeof executeStructuredCompletion>>;
  try {
    completion = await executeStructuredCompletion({
      stageId: baseDiagnostic.stageId,
      manifestHash: input.manifest.manifestHash,
      contract: SummaryJudgeV3Contract,
      prompt: prompt.resolvedPrompt,
      promptHash: prompt.promptHash,
      provider: input.provider,
      model: input.model,
      transport: input.transport,
    });
  } catch (error) {
    return {
      ok: false,
      disposition: "TECHNICAL_ERROR",
      error: {
        status: "TECHNICAL_ERROR",
        errorCode: "SUMMARY_JUDGE_PROVIDER_ERROR",
        message: error instanceof Error ? error.message : String(error),
      },
      prompt,
      diagnostic: {
        ...baseDiagnostic,
        storeId: built.value.meta.storeId,
        storeContentHash: built.value.meta.storeContentHash,
        summaryHash: built.value.meta.summaryHash,
        promptHash: prompt.promptHash,
        structuredOutputRequested: false,
        errorType: "provider_error",
        errorCode: "SUMMARY_JUDGE_PROVIDER_ERROR",
        durationMs: Date.now() - startedAt,
      },
    };
  }
  if (!completion.ok) {
    const errorCode = structuredErrorCode(completion.error.errorCode);
    return {
      ok: false,
      disposition: "TECHNICAL_ERROR",
      error: {
        status: "TECHNICAL_ERROR",
        errorCode,
        message: completion.error.message,
      },
      prompt,
      diagnostic: {
        ...baseDiagnostic,
        storeId: built.value.meta.storeId,
        storeContentHash: built.value.meta.storeContentHash,
        summaryHash: built.value.meta.summaryHash,
        promptHash: prompt.promptHash,
        structuredOutputRequested: completion.diagnostic.structuredOutputRequested,
        structuredOutputApplied: completion.diagnostic.structuredOutputApplied,
        attemptCount: completion.diagnostic.attemptCount,
        repairAttempted: completion.diagnostic.repairAttempted,
        validationStatus: completion.diagnostic.validationStatus,
        providerDiagnostic: completion.diagnostic.providerDiagnostic,
        errorType: errorCode === "SUMMARY_JUDGE_OUTPUT_INVALID"
          ? "validation_error"
          : "provider_error",
        errorCode,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  const validated = validateSummaryJudgeVerdict(
    built.value,
    input.criterion,
    completion.value,
  );
  if (!validated.ok) {
    return {
      ok: false,
      disposition: "TECHNICAL_ERROR",
      error: validated.error,
      prompt,
      diagnostic: {
        ...baseDiagnostic,
        storeId: built.value.meta.storeId,
        storeContentHash: built.value.meta.storeContentHash,
        summaryHash: built.value.meta.summaryHash,
        promptHash: prompt.promptHash,
        structuredOutputRequested: completion.diagnostic.structuredOutputRequested,
        structuredOutputApplied: completion.diagnostic.structuredOutputApplied,
        attemptCount: completion.diagnostic.attemptCount,
        repairAttempted: completion.diagnostic.repairAttempted,
        validationStatus: "invalid",
        providerDiagnostic: completion.diagnostic.providerDiagnostic,
        errorType: "validation_error",
        errorCode: validated.error.errorCode,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  const judgeTechnical = validated.value.verdict === "technical_error";
  return {
    ok: true,
    value: validated.value,
    prompt,
    diagnostic: {
      ...baseDiagnostic,
      storeId: built.value.meta.storeId,
      storeContentHash: built.value.meta.storeContentHash,
      summaryHash: built.value.meta.summaryHash,
      promptHash: prompt.promptHash,
      structuredOutputRequested: completion.diagnostic.structuredOutputRequested,
      structuredOutputApplied: completion.diagnostic.structuredOutputApplied,
      attemptCount: completion.diagnostic.attemptCount,
      repairAttempted: completion.diagnostic.repairAttempted,
      rawScore: typeof completion.value === "object" && completion.value !== null && "score" in completion.value
        ? completion.value.score as SummaryJudgeDiagnosticV3["rawScore"]
        : null,
      score: validated.value.score,
      confidence: validated.value.confidence,
      verdict: validated.value.verdict,
      validationStatus: "valid",
      providerDiagnostic: completion.diagnostic.providerDiagnostic,
      errorType: judgeTechnical ? "judge_technical_error" : null,
      errorCode: judgeTechnical ? "SUMMARY_JUDGE_TECHNICAL_ERROR" : null,
      durationMs: Date.now() - startedAt,
    },
  };
}

export async function executeFiveSummaryJudgesV3(input: {
  manifest: PipelineContractManifest;
  conversationStore: unknown;
  summary: unknown;
  transcript: TranscriptV3 | unknown;
  provider: string;
  model: string;
  transports: Readonly<Record<SummaryCriterionV3, StructuredProviderTransport>>;
}): Promise<Readonly<Record<SummaryCriterionV3, ExecuteSummaryJudgeV3Result>>> {
  const results = {} as Record<SummaryCriterionV3, ExecuteSummaryJudgeV3Result>;
  for (const criterion of SUMMARY_CRITERIA) {
    results[criterion] = await executeSummaryJudgeV3({
      manifest: input.manifest,
      conversationStore: input.conversationStore,
      summary: input.summary,
      transcript: input.transcript,
      criterion,
      provider: input.provider,
      model: input.model,
      transport: input.transports[criterion],
    });
  }
  return Object.freeze(results);
}
