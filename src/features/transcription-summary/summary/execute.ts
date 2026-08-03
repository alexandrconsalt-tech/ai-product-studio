import type { PipelineContractManifest } from "../contracts/contract-types";
import { SummaryV3Contract, type SummaryV3 } from "../contracts/summary/v3/contract";
import type {
  SafeProviderDiagnostic,
  StructuredOutputErrorCode,
  StructuredProviderTransport,
} from "../runtime/structured-output";
import { executeStructuredCompletion } from "../runtime/structured-output";
import type { TranscriptV3 } from "../contracts/transcript/v3/contract";
import type { SummaryResolvedPromptV3 } from "./prompt-builder";
import { buildSummaryAgentInput } from "./input-builder";
import { buildSummaryPromptV3 } from "./prompt-builder";
import {
  processSummaryOutput,
  type RepetitionTransformation,
  type SummarySourceErrorCode,
} from "./source-validation";
import { buildSummaryPlanV3, type SummaryPlanV3 } from "./summary-plan";
import type { SummaryFinalDiagnosticsV3 } from "./structural-validation";

export type SummaryExecutionErrorCode =
  | "SUMMARY_STORE_MISSING"
  | "SUMMARY_STORE_INCOMPLETE"
  | "SUMMARY_MANIFEST_MISMATCH"
  | "SUMMARY_STORE_REFERENCE_INVALID"
  | "STRUCTURED_OUTPUT_UNAVAILABLE"
  | "SUMMARY_OUTPUT_SCHEMA_INVALID"
  | SummarySourceErrorCode
  | "SUMMARY_PROVIDER_ERROR"
  | StructuredOutputErrorCode;

export type SummaryAgentV3Diagnostic = Readonly<{
  stageId: "summary_agent_v3";
  inputContractId: "summary.agent.input.v3";
  inputContractVersion: "3.0.0";
  outputContractId: "summary.content.v3";
  outputContractVersion: "3.1.0";
  manifestHash: string;
  storeId: string | null;
  storeContentHash: string | null;
  promptVersion: string;
  promptHash: string | null;
  schemaHash: string;
  structuredOutputRequested: boolean;
  structuredOutputApplied: boolean;
  attemptCount: number;
  repairAttempted: boolean;
  sourceValidationStatus: "valid" | "invalid" | "not_run";
  repetitionGuardStatus: "unchanged" | "transformed" | "not_run";
  repetitionTransformations: readonly RepetitionTransformation[];
  summaryPlan: SummaryPlanV3 | null;
  finalDiagnostics: SummaryFinalDiagnosticsV3 | null;
  validationStatus: "valid" | "invalid" | "not_run";
  providerDiagnostic: SafeProviderDiagnostic | null;
  rawProviderResponse: unknown | null;
  errorType: "dependency_error" | "provider_error" | "validation_error" | "source_error" | null;
  errorCode: SummaryExecutionErrorCode | null;
  durationMs: number;
}>;

export type ExecuteSummaryAgentV3Result =
  | Readonly<{
      ok: true;
      value: SummaryV3;
      prompt: SummaryResolvedPromptV3;
      diagnostic: SummaryAgentV3Diagnostic;
    }>
  | Readonly<{
      ok: false;
      disposition: "NOT_RUN" | "TECHNICAL_ERROR";
      error: {
        status: "NOT_RUN" | "TECHNICAL_ERROR";
        errorCode: SummaryExecutionErrorCode;
        message: string;
      };
      prompt?: SummaryResolvedPromptV3;
      diagnostic: SummaryAgentV3Diagnostic;
    }>;

function mapStructuredError(code: string): SummaryExecutionErrorCode {
  if (code === "STRUCTURED_OUTPUT_UNAVAILABLE" || code === "STRUCTURED_OUTPUT_NOT_APPLIED") {
    return "STRUCTURED_OUTPUT_UNAVAILABLE";
  }
  if (code === "SCHEMA_VALIDATION_ERROR" || code === "JSON_DECODE_ERROR") {
    return "SUMMARY_OUTPUT_SCHEMA_INVALID";
  }
  return code as StructuredOutputErrorCode;
}

export async function executeSummaryAgentV3(input: {
  manifest: PipelineContractManifest;
  conversationStore: unknown;
  transcript: TranscriptV3 | unknown;
  promptVersion?: string;
  provider: string;
  model: string;
  transport: StructuredProviderTransport;
  timeoutMs?: number;
}): Promise<ExecuteSummaryAgentV3Result> {
  const startedAt = Date.now();
  const baseDiagnostic = {
    stageId: "summary_agent_v3" as const,
    inputContractId: "summary.agent.input.v3" as const,
    inputContractVersion: "3.0.0" as const,
    outputContractId: "summary.content.v3" as const,
    outputContractVersion: "3.1.0" as const,
    manifestHash: input.manifest.manifestHash,
    storeId: null,
    storeContentHash: null,
    promptVersion: input.promptVersion ?? "summary-agent-v3.0.0",
    promptHash: null,
    schemaHash: SummaryV3Contract.schemaHash,
    structuredOutputRequested: false,
    structuredOutputApplied: false,
    attemptCount: 0,
    repairAttempted: false,
    sourceValidationStatus: "not_run" as const,
    repetitionGuardStatus: "not_run" as const,
    repetitionTransformations: [] as readonly RepetitionTransformation[],
    summaryPlan: null,
    finalDiagnostics: null,
    validationStatus: "not_run" as const,
    providerDiagnostic: null,
    rawProviderResponse: null,
  };
  const builtInput = buildSummaryAgentInput(input);
  if (!builtInput.ok) {
    const errorCode = builtInput.error.errorCode;
    return {
      ok: false,
      disposition: builtInput.disposition,
      error: {
        status: builtInput.disposition,
        errorCode,
        message: builtInput.error.message,
      },
      diagnostic: {
        ...baseDiagnostic,
        errorType: "dependency_error",
        errorCode,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  const summaryPlan = buildSummaryPlanV3(builtInput.value.conversationStore);
  const prompt = buildSummaryPromptV3(builtInput.value, summaryPlan);
  const completion = await executeStructuredCompletion({
    stageId: "summary_agent_v3",
    manifestHash: input.manifest.manifestHash,
    contract: SummaryV3Contract,
    prompt: prompt.resolvedPrompt,
    promptHash: prompt.promptHash,
    provider: input.provider,
    model: input.model,
    transport: input.transport,
    timeoutMs: input.timeoutMs ?? 60_000,
  });
  if (!completion.ok) {
    const errorCode = mapStructuredError(completion.error.errorCode);
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
        storeId: builtInput.value.meta.storeId,
        storeContentHash: builtInput.value.conversationStore.content_hash,
        promptHash: prompt.promptHash,
        summaryPlan,
        structuredOutputRequested: completion.diagnostic.structuredOutputRequested,
        structuredOutputApplied: completion.diagnostic.structuredOutputApplied,
        attemptCount: completion.diagnostic.attemptCount,
        repairAttempted: completion.diagnostic.repairAttempted,
        validationStatus: completion.diagnostic.validationStatus,
        providerDiagnostic: completion.diagnostic.providerDiagnostic,
        rawProviderResponse: completion.rawResponse ?? null,
        errorType: errorCode === "SUMMARY_OUTPUT_SCHEMA_INVALID"
          ? "validation_error"
          : "provider_error",
        errorCode,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  const processed = processSummaryOutput(builtInput.value, completion.value, summaryPlan);
  if (!processed.ok) {
    return {
      ok: false,
      disposition: "TECHNICAL_ERROR",
      error: processed.error,
      prompt,
      diagnostic: {
        ...baseDiagnostic,
        storeId: builtInput.value.meta.storeId,
        storeContentHash: builtInput.value.conversationStore.content_hash,
        promptHash: prompt.promptHash,
        summaryPlan,
        finalDiagnostics: processed.finalDiagnostics,
        structuredOutputRequested: completion.diagnostic.structuredOutputRequested,
        structuredOutputApplied: completion.diagnostic.structuredOutputApplied,
        attemptCount: completion.diagnostic.attemptCount,
        repairAttempted: completion.diagnostic.repairAttempted,
        sourceValidationStatus: "invalid",
        validationStatus: "invalid",
        providerDiagnostic: completion.diagnostic.providerDiagnostic,
        rawProviderResponse: completion.rawResponse ?? null,
        errorType: "source_error",
        errorCode: processed.error.errorCode,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  return {
    ok: true,
    value: processed.value,
    prompt,
    diagnostic: {
      ...baseDiagnostic,
      storeId: builtInput.value.meta.storeId,
      storeContentHash: builtInput.value.conversationStore.content_hash,
      promptHash: prompt.promptHash,
      structuredOutputRequested: completion.diagnostic.structuredOutputRequested,
      structuredOutputApplied: completion.diagnostic.structuredOutputApplied,
      attemptCount: completion.diagnostic.attemptCount,
      repairAttempted: completion.diagnostic.repairAttempted,
      sourceValidationStatus: "valid",
      repetitionGuardStatus: processed.repetitionGuardStatus,
      repetitionTransformations: processed.transformations,
      summaryPlan,
      finalDiagnostics: processed.finalDiagnostics,
      validationStatus: "valid",
      providerDiagnostic: completion.diagnostic.providerDiagnostic,
      errorType: null,
      errorCode: null,
      durationMs: Date.now() - startedAt,
    },
  };
}
