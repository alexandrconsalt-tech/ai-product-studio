import type { PipelineContractManifest } from "../contracts/contract-types";
import type {
  PipelineReportV3,
  PipelineStageReportV3,
} from "../contracts/pipeline-report/v3/contract";
import type { TranscriptV3 } from "../contracts/transcript/v3/contract";

export const TRANSCRIPTION_SUMMARY_V3_STAGE_IDS = [
  "transcript_validation",
  "facts_agent",
  "needs_agent",
  "outcome_agent",
  "conversation_store",
  "summary_agent",
  "summary_judge_faithfulness",
  "summary_judge_completeness",
  "summary_judge_usefulness",
  "summary_judge_agreements_next_step",
  "summary_judge_format",
  "quality_gate",
  "crm_publication",
] as const;

export type TranscriptionSummaryV3StageId =
  (typeof TRANSCRIPTION_SUMMARY_V3_STAGE_IDS)[number];
export type PipelineStageStatus = PipelineStageReportV3["status"];

export type PipelineStageAudit = Readonly<{
  contractId: string;
  contractVersion: string;
  schemaHash: string;
  promptId?: string | null;
  promptVersion?: string | null;
  promptHash?: string | null;
  basePrompt?: string | null;
  resolvedPrompt?: string | null;
  model?: string | null;
  provider?: string | null;
  structuredOutputRequired?: boolean;
  structuredOutputRequested?: boolean;
  structuredOutputApplied?: boolean;
  providerDiagnostic?: PipelineStageReportV3["provider_diagnostic"];
  attempts?: number;
  repairAttempted?: boolean;
  rawProviderResponse?: unknown | null;
  timeoutStage?: string | null;
  transformations?: PipelineStageReportV3["transformations"];
  validationStatus?: "valid" | "invalid" | "not_run";
  validationIssues?: PipelineStageReportV3["validation_result"]["issues"];
  score?: number | null;
  confidence?: number | null;
  errorType?: PipelineStageReportV3["error_type"];
  errorCode?: string | null;
  blocking?: boolean;
  durationMs?: number;
}>;

export type PipelineStageExecution = Readonly<{
  status: Exclude<PipelineStageStatus, "NOT_RUN">;
  value: unknown | null;
  audit: PipelineStageAudit;
}>;

export type PipelineExecutionContext = Readonly<{
  runId: string;
  transcript: TranscriptV3;
  transcriptHash: string;
  manifest: PipelineContractManifest;
  outputs: Readonly<Partial<Record<TranscriptionSummaryV3StageId, unknown>>>;
  deadlineAtMs: number;
}>;

export interface TranscriptionSummaryV3StageExecutor {
  execute(
    stageId: Exclude<TranscriptionSummaryV3StageId, "transcript_validation">,
    context: PipelineExecutionContext,
  ): Promise<PipelineStageExecution>;
}

export type ExecuteTranscriptionSummaryV3PipelineResult = Readonly<{
  manifest: PipelineContractManifest;
  report: PipelineReportV3;
  outputs: Readonly<Partial<Record<TranscriptionSummaryV3StageId, unknown>>>;
}>;
