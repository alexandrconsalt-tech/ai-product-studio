import { createHash, randomUUID } from "node:crypto";
import {
  AI_SUMMARY_V3_PIPELINE_VERSION,
} from "../contracts/constants";
import type { ContractRole, PipelineContractManifest } from "../contracts/contract-types";
import { createContractManifest } from "../contracts/manifest";
import {
  PIPELINE_STAGE_STATUSES,
  PipelineReportV3Schema,
  type PipelineReportV3,
  type PipelineStageReportV3,
} from "../contracts/pipeline-report/v3/contract";
import { TranscriptV3Schema } from "../contracts/transcript/v3/contract";
import { stableStringify } from "../contracts/schema-utils";
import { applyTranscriptSpeakerInheritanceV3 } from "../runtime/transcript-speaker-policy";
import { calculateTranscriptContentHash } from "../store";
import type {
  ExecuteTranscriptionSummaryV3PipelineResult,
  PipelineExecutionContext,
  PipelineStageAudit,
  PipelineStageExecution,
  PipelineStageStatus,
  TranscriptionSummaryV3StageExecutor,
  TranscriptionSummaryV3StageId,
} from "./types";
import { TRANSCRIPTION_SUMMARY_V3_STAGE_IDS } from "./types";

const STAGE_ROLE: Readonly<Record<TranscriptionSummaryV3StageId, ContractRole>> = {
  transcript_validation: "transcript",
  facts_agent: "facts",
  needs_agent: "needs",
  outcome_agent: "outcome",
  conversation_store: "conversationStore",
  summary_agent: "summary",
  summary_judge_faithfulness: "summaryJudges",
  summary_judge_completeness: "summaryJudges",
  summary_judge_usefulness: "summaryJudges",
  summary_judge_agreements_next_step: "summaryJudges",
  summary_judge_format: "summaryJudges",
  quality_gate: "qualityGate",
  crm_publication: "crmPublicationResult",
};

const SUMMARY_JUDGES = new Set<TranscriptionSummaryV3StageId>([
  "summary_judge_faithfulness",
  "summary_judge_completeness",
  "summary_judge_usefulness",
  "summary_judge_agreements_next_step",
  "summary_judge_format",
]);

const PIPELINE_TIMEOUT_MS = 235_000;

function stageReport(input: {
  stageId: TranscriptionSummaryV3StageId;
  status: PipelineStageStatus;
  audit: PipelineStageAudit;
  manifest: PipelineContractManifest;
  value: unknown | null;
}): PipelineStageReportV3 {
  const reference = input.manifest.contracts[STAGE_ROLE[input.stageId]];
  const isJudge = input.stageId.includes("judge");
  return {
    stage_id: input.stageId,
    stage_version: "3.0.0",
    status: input.status,
    contract_id: input.audit.contractId || reference.id,
    contract_version: input.audit.contractVersion || reference.version,
    manifest_hash: input.manifest.manifestHash,
    prompt_id: input.audit.promptId ?? null,
    prompt_version: input.audit.promptVersion ?? null,
    prompt_hash: input.audit.promptHash ?? null,
    base_prompt: input.audit.basePrompt ?? null,
    resolved_prompt: input.audit.resolvedPrompt ?? null,
    schema_hash: input.audit.schemaHash || reference.schemaHash,
    model: input.audit.model ?? null,
    provider: input.audit.provider ?? null,
    structured_output: {
      required: input.audit.structuredOutputRequired ?? false,
      requested: input.audit.structuredOutputRequested ?? false,
      applied: input.audit.structuredOutputApplied ?? false,
    },
    provider_diagnostic: input.audit.providerDiagnostic ?? null,
    attempts: input.audit.attempts ?? 0,
    repair_attempted: input.audit.repairAttempted ?? false,
    raw_provider_response: input.audit.rawProviderResponse === undefined
      ? null
      : JSON.parse(JSON.stringify(input.audit.rawProviderResponse)) as never,
    timeout_stage: input.audit.timeoutStage ?? null,
    validation_result: {
      status: input.audit.validationStatus ?? (
        input.status === "NOT_RUN" ? "not_run" : input.status === "TECHNICAL_ERROR" ? "invalid" : "valid"
      ),
      issues: [...(input.audit.validationIssues ?? [])],
    },
    transformations: [...(input.audit.transformations ?? [])],
    agent_output: !isJudge && input.status !== "NOT_RUN"
      ? JSON.parse(JSON.stringify(input.value)) as PipelineStageReportV3["agent_output"]
      : null,
    judge_verdict: isJudge && input.status !== "NOT_RUN"
      ? JSON.parse(JSON.stringify(input.value)) as PipelineStageReportV3["judge_verdict"]
      : null,
    code_invariant_result: input.audit.structuredOutputRequired ? null : { status: input.status },
    final_verdict: input.status === "NOT_RUN" ? null : { status: input.status },
    score: input.audit.score ?? null,
    confidence: input.audit.confidence ?? null,
    error_type: input.audit.errorType ?? null,
    error_code: input.audit.errorCode ?? null,
    blocking: input.audit.blocking ?? input.status === "TECHNICAL_ERROR",
    duration_ms: input.audit.durationMs ?? 0,
  };
}

function notRunReport(
  stageId: TranscriptionSummaryV3StageId,
  manifest: PipelineContractManifest,
  blockedBy: TranscriptionSummaryV3StageId,
): PipelineStageReportV3 {
  const reference = manifest.contracts[STAGE_ROLE[stageId]];
  return stageReport({
    stageId,
    status: "NOT_RUN",
    manifest,
    value: null,
    audit: {
      contractId: reference.id,
      contractVersion: reference.version,
      schemaHash: reference.schemaHash,
      validationStatus: "not_run",
      errorType: "dependency",
      errorCode: `UPSTREAM_${blockedBy.toUpperCase()}_BLOCKED`,
      blocking: true,
    },
  });
}

function finalStatus(
  outputs: Readonly<Partial<Record<TranscriptionSummaryV3StageId, unknown>>>,
  reports: readonly PipelineStageReportV3[],
): PipelineReportV3["status"] {
  const gate = outputs.quality_gate as { decision?: unknown } | undefined;
  if (reports.some((report) => report.status === "TECHNICAL_ERROR" && report.blocking)) {
    return "TECHNICAL_ERROR";
  }
  if (reports.some((report) =>
    report.status === "TECHNICAL_ERROR"
    && !report.blocking)) return "SUCCESS_WITH_WARNING";
  return "SUCCESS";
}

function transcriptReport(
  manifest: PipelineContractManifest,
  ok: boolean,
  errorCode: string | null,
): PipelineStageReportV3 {
  const reference = manifest.contracts.transcript;
  return stageReport({
    stageId: "transcript_validation",
    status: ok ? "SUCCESS" : "TECHNICAL_ERROR",
    manifest,
    value: null,
    audit: {
      contractId: reference.id,
      contractVersion: reference.version,
      schemaHash: reference.schemaHash,
      validationStatus: ok ? "valid" : "invalid",
      errorType: ok ? null : "schema",
      errorCode,
      blocking: !ok,
    },
  });
}

export async function executeTranscriptionSummaryV3Pipeline(input: {
  transcript: unknown;
  executor: TranscriptionSummaryV3StageExecutor;
  runId?: string;
  now?: () => Date;
}): Promise<ExecuteTranscriptionSummaryV3PipelineResult> {
  const now = input.now ?? (() => new Date());
  const startedAt = now();
  const deadlineAtMs = startedAt.getTime() + PIPELINE_TIMEOUT_MS;
  const runId = input.runId ?? `run-${randomUUID()}`;
  const manifest = createContractManifest(AI_SUMMARY_V3_PIPELINE_VERSION);
  const incomingTranscript = input.transcript && typeof input.transcript === "object"
    ? input.transcript as Record<string, unknown>
    : {};
  const rawTranscript = applyTranscriptSpeakerInheritanceV3(incomingTranscript);
  const transcriptForHash = {
    transcript_id: rawTranscript.transcript_id,
    turns: rawTranscript.turns,
  };
  const transcriptHash = typeof transcriptForHash.transcript_id === "string"
    && Array.isArray(transcriptForHash.turns)
    ? calculateTranscriptContentHash(
        transcriptForHash as Parameters<typeof calculateTranscriptContentHash>[0],
      )
    : createHash("sha256").update(stableStringify(transcriptForHash)).digest("hex");
  const parsedTranscript = TranscriptV3Schema.safeParse({
    ...rawTranscript,
    metadata: {
      ...(rawTranscript.metadata && typeof rawTranscript.metadata === "object"
        ? rawTranscript.metadata as Record<string, unknown>
        : {}),
      run_id: runId,
      sha256: transcriptHash,
    },
  });
  const reports: PipelineStageReportV3[] = [
    transcriptReport(manifest, parsedTranscript.success, parsedTranscript.success ? null : "TRANSCRIPT_SCHEMA_INVALID"),
  ];
  const outputs: Partial<Record<TranscriptionSummaryV3StageId, unknown>> = {};
  if (!parsedTranscript.success) {
    for (const stageId of TRANSCRIPTION_SUMMARY_V3_STAGE_IDS.slice(1)) {
      reports.push(notRunReport(stageId, manifest, "transcript_validation"));
    }
    const finishedAt = now();
    const report = PipelineReportV3Schema.parse({
      report_id: `report-${runId}`,
      run_id: runId,
      product_id: manifest.productId,
      pipeline_id: manifest.pipelineId,
      pipeline_version: manifest.pipelineVersion,
      manifest_hash: manifest.manifestHash,
      transcript_hash: transcriptHash,
      flags: { v3Enabled: true, crmDryRun: true },
      status: "TECHNICAL_ERROR",
      stages: reports,
      quality_score: null,
      quality_decision: null,
      crm_status: "NOT_RUN",
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
    });
    return { manifest, report, outputs };
  }

  outputs.transcript_validation = parsedTranscript.data;
  let blockedBy: TranscriptionSummaryV3StageId | null = null;
  const executableStages = TRANSCRIPTION_SUMMARY_V3_STAGE_IDS.slice(1) as readonly Exclude<
    TranscriptionSummaryV3StageId,
    "transcript_validation"
  >[];
  const executeStage = async (
    stageId: Exclude<TranscriptionSummaryV3StageId, "transcript_validation">,
  ): Promise<PipelineStageExecution> => {
    const context: PipelineExecutionContext = {
      runId,
      transcript: parsedTranscript.data,
      transcriptHash,
      manifest,
      outputs,
      deadlineAtMs,
    };
    try {
      return await input.executor.execute(stageId, context);
    } catch (error) {
      const reference = manifest.contracts[STAGE_ROLE[stageId]];
      return {
        status: "TECHNICAL_ERROR",
        value: null,
        audit: {
          contractId: reference.id,
          contractVersion: reference.version,
          schemaHash: reference.schemaHash,
          errorType: "provider",
          errorCode: error instanceof Error && error.name === "AbortError"
            ? "STAGE_TIMEOUT"
            : "UNHANDLED_STAGE_ERROR",
          blocking: !SUMMARY_JUDGES.has(stageId),
        },
      };
    }
  };

  for (let index = 0; index < executableStages.length; index += 1) {
    const stageId = executableStages[index];
    if (blockedBy) {
      reports.push(notRunReport(stageId, manifest, blockedBy));
      continue;
    }
    if (SUMMARY_JUDGES.has(stageId)) {
      const judgeStages = executableStages.slice(index, index + SUMMARY_JUDGES.size);
      const settled = await Promise.allSettled(judgeStages.map(executeStage));
      settled.forEach((item, judgeIndex) => {
        const judgeStageId = judgeStages[judgeIndex];
        const reference = manifest.contracts[STAGE_ROLE[judgeStageId]];
        const execution: PipelineStageExecution = item.status === "fulfilled" ? item.value : {
          status: "TECHNICAL_ERROR",
          value: null,
          audit: {
            contractId: reference.id,
            contractVersion: reference.version,
            schemaHash: reference.schemaHash,
            validationStatus: "invalid",
            errorType: "provider",
            errorCode: "UNHANDLED_JUDGE_ERROR",
            blocking: false,
          },
        };
        outputs[judgeStageId] = execution.value;
        reports.push(stageReport({
          stageId: judgeStageId,
          status: execution.status,
          audit: execution.audit,
          manifest,
          value: execution.value,
        }));
      });
      index += judgeStages.length - 1;
      continue;
    }
    const execution = await executeStage(stageId);
    outputs[stageId] = execution.value;
    reports.push(stageReport({
      stageId,
      status: execution.status,
      audit: execution.audit,
      manifest,
      value: execution.value,
    }));
    if (execution.status === "TECHNICAL_ERROR") {
      if (
        stageId === "facts_agent"
        || stageId === "needs_agent"
        || stageId === "outcome_agent"
        || SUMMARY_JUDGES.has(stageId)
        || stageId === "quality_gate"
      ) {
        continue;
      }
      blockedBy = stageId;
    }
  }

  const gate = outputs.quality_gate as { qualityScore?: number | null; decision?: PipelineReportV3["quality_decision"] } | undefined;
  const crm = outputs.crm_publication as { status?: PipelineReportV3["crm_status"] } | undefined;
  const finishedAt = now();
  const report = PipelineReportV3Schema.parse({
    report_id: `report-${runId}`,
    run_id: runId,
    product_id: manifest.productId,
    pipeline_id: manifest.pipelineId,
    pipeline_version: manifest.pipelineVersion,
    manifest_hash: manifest.manifestHash,
    transcript_hash: transcriptHash,
    flags: { v3Enabled: true, crmDryRun: true },
    status: finalStatus(outputs, reports),
    stages: reports,
    quality_score: gate?.qualityScore ?? null,
    quality_decision: gate?.decision ?? null,
    crm_status: crm?.status ?? "NOT_RUN",
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
  });
  return { manifest, report, outputs };
}
