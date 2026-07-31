import { NextResponse } from "next/server";
import { z } from "zod";
import type { ContractRole } from "@/features/transcription-summary/contracts/contract-types";
import {
  AI_SUMMARY_V3_PIPELINE_VERSION,
} from "@/features/transcription-summary/contracts/constants";
import { FactJudgeV3Schema } from "@/features/transcription-summary/contracts/fact-judge/v3/contract";
import { FactsV3Schema } from "@/features/transcription-summary/contracts/facts/v3/contract";
import { createContractManifest, validateContractManifest } from "@/features/transcription-summary/contracts/manifest";
import { NeedJudgeV3Schema } from "@/features/transcription-summary/contracts/need-judge/v3/contract";
import { NeedsV3Schema } from "@/features/transcription-summary/contracts/needs/v3/contract";
import { OutcomeJudgeV3Schema } from "@/features/transcription-summary/contracts/outcome-judge/v3/contract";
import { OutcomeV3Schema } from "@/features/transcription-summary/contracts/outcome/v3/contract";
import { getContract } from "@/features/transcription-summary/contracts/registry";
import { SourceReferenceSchema } from "@/features/transcription-summary/contracts/shared-schemas";
import { SUMMARY_CRITERIA } from "@/features/transcription-summary/contracts/canonical-enums";
import { buildStructuredPrompt } from "@/features/transcription-summary/runtime/prompt-builder";
import {
  reconcileFactsV3,
  reconcileNeedsV3,
  reconcileOutcomeV3,
} from "@/features/transcription-summary/runtime/reconciliation";
import {
  aiTunnelFailClosedTransport,
  executeStructuredCompletion,
  type StructuredProviderTransport,
} from "@/features/transcription-summary/runtime/structured-output";
import {
  createOpenAiDirectTransport,
} from "@/features/transcription-summary/runtime/openai-direct-transport";
import {
  buildConversationStoreV3,
  calculateTranscriptContentHash,
} from "@/features/transcription-summary/store";
import { executeSummaryAgentV3 } from "@/features/transcription-summary/summary";
import { executeSummaryJudgeV3 } from "@/features/transcription-summary/summary-judges";
import { executeSummaryQualityGateV3 } from "@/features/transcription-summary/quality-gate";
import {
  executeCrmPublicationV3,
  InMemoryCrmPublicationRepositoryV3,
  type CrmClientV3,
} from "@/features/transcription-summary/crm-publication";
import {
  executeTranscriptionSummaryV3Pipeline,
  RuntimeTranscriptionSummaryV3StageExecutor,
  validateV3RuntimeConfiguration,
} from "@/features/transcription-summary/pipeline";
import { resolveTranscriptionSummaryV3RuntimeConfig } from "../config/runtime-config";

const crmPublicationRepository = new InMemoryCrmPublicationRepositoryV3();
const dryRunOnlyCrmClient: CrmClientV3 = {
  async publishSummary() {
    throw new Error("CRM_CLIENT_MUST_NOT_BE_CALLED_IN_DRY_RUN");
  },
};

const ALLOWED_STAGE_ROLES = [
  "facts",
  "factJudge",
  "needs",
  "needJudge",
  "outcome",
  "outcomeJudge",
] as const satisfies readonly ContractRole[];

const RequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("manifest") }).strict(),
  z.object({
    action: z.literal("complete"),
    manifestHash: z.string().length(64),
    role: z.enum(ALLOWED_STAGE_ROLES),
    stageId: z.string().min(1),
    systemRole: z.string().min(1),
    businessInstruction: z.string().min(1),
    promptVersion: z.string().min(1),
    inputData: z.unknown(),
    provider: z.enum(["ai-tunnel", "openai-direct", "anthropic-direct", "mock"]),
    model: z.string().min(1),
  }).strict(),
  z.object({
    action: z.literal("reconcile"),
    kind: z.enum(["facts", "needs", "outcome"]),
    agentOutput: z.unknown(),
    judgeOutput: z.unknown(),
    sourceReferences: z.array(SourceReferenceSchema),
    reconciledAt: z.string().datetime(),
  }).strict(),
  z.object({
    action: z.literal("build_store"),
    manifestHash: z.string().length(64),
    runId: z.string().min(1),
    transcript: z.object({
      transcript_id: z.string().min(1),
      turns: z.array(z.object({
        id: z.string().min(1),
        sequence: z.number().int().nonnegative(),
        speaker: z.enum(["client", "agent", "operator", "other"]),
        text: z.string().min(1),
        started_at_ms: z.number().int().nonnegative().nullable(),
        ended_at_ms: z.number().int().nonnegative().nullable(),
      }).strict()).min(1),
      metadata: z.record(z.string(), z.json()),
      validation_warnings: z.array(z.string().min(1)),
    }).strict(),
    facts: z.unknown().optional(),
    needs: z.unknown().optional(),
    outcome: z.unknown().optional(),
  }).strict(),
  z.object({
    action: z.literal("summarize"),
    manifestHash: z.string().length(64),
    promptVersion: z.string().min(1),
    conversationStore: z.unknown(),
    transcript: z.object({
      transcript_id: z.string().min(1),
      turns: z.array(z.object({
        id: z.string().min(1),
        sequence: z.number().int().nonnegative(),
        speaker: z.enum(["client", "agent", "operator", "other"]),
        text: z.string().min(1),
        started_at_ms: z.number().int().nonnegative().nullable(),
        ended_at_ms: z.number().int().nonnegative().nullable(),
      }).strict()).min(1),
      metadata: z.record(z.string(), z.json()),
      validation_warnings: z.array(z.string().min(1)),
    }).strict(),
    provider: z.enum(["ai-tunnel", "openai-direct", "anthropic-direct", "mock"]),
    model: z.string().min(1),
  }).strict(),
  z.object({
    action: z.literal("judge_summary"),
    manifestHash: z.string().length(64),
    criterion: z.enum(SUMMARY_CRITERIA),
    conversationStore: z.unknown(),
    summary: z.unknown(),
    transcript: z.object({
      transcript_id: z.string().min(1),
      turns: z.array(z.object({
        id: z.string().min(1),
        sequence: z.number().int().nonnegative(),
        speaker: z.enum(["client", "agent", "operator", "other"]),
        text: z.string().min(1),
        started_at_ms: z.number().int().nonnegative().nullable(),
        ended_at_ms: z.number().int().nonnegative().nullable(),
      }).strict()).min(1),
      metadata: z.record(z.string(), z.json()),
      validation_warnings: z.array(z.string().min(1)),
    }).strict(),
    provider: z.enum(["ai-tunnel", "openai-direct", "anthropic-direct", "mock"]),
    model: z.string().min(1),
  }).strict(),
  z.object({
    action: z.literal("quality_gate_summary"),
    manifestHash: z.string().length(64),
    conversationStore: z.unknown(),
    summary: z.unknown(),
    verdicts: z.array(z.unknown()),
  }).strict(),
  z.object({
    action: z.literal("publish_crm_summary"),
    manifestHash: z.string().length(64),
    executionId: z.string().min(1),
    conversationStore: z.unknown(),
    summary: z.unknown(),
    qualityGate: z.unknown().nullable(),
    target: z.object({
      crmSystem: z.string().min(1),
      entityType: z.enum(["lead", "request", "contact", "call"]),
      entityId: z.string().min(1),
    }).strict(),
  }).strict(),
  z.object({
    action: z.literal("execute_pipeline"),
    runId: z.string().min(1),
    transcript: z.unknown(),
    provider: z.literal("openai-direct"),
    models: z.record(z.string(), z.string().min(1)),
    runtimeConfiguration: z.object({
      pipelineVersion: z.literal("3.0.0"),
      stageVersion: z.literal("3.0.0"),
      provider: z.literal("openai-direct"),
      contractFamily: z.literal("v3"),
      structuredOutputRequired: z.literal(true),
      parserFallbackEnabled: z.literal(false),
    }).strict(),
  }).strict(),
]);

function transportFor(provider: string): StructuredProviderTransport {
  if (provider === "ai-tunnel") return aiTunnelFailClosedTransport;
  if (provider === "openai-direct") return createOpenAiDirectTransport();
  return async () => ({
    ok: false,
    errorCode: "STRUCTURED_OUTPUT_UNAVAILABLE",
    message: `${provider} does not have an attested Structured Output adapter in Phase 2`,
    attestation: { requested: true, forwarded: false, accepted: false, structuredResponseReturned: false },
  });
}

export async function POST(request: Request) {
  const runtimeConfig = resolveTranscriptionSummaryV3RuntimeConfig(
    "product_transcription_summary_module",
  );
  if (!runtimeConfig.transcriptionSummaryV3Enabled || !runtimeConfig.transcriptionSummaryV3CrmDryRun) {
    return NextResponse.json({ error: "V3_RUNTIME_DISABLED" }, { status: 403 });
  }
  const rawRequest = await request.json().catch(() => null);
  if (
    rawRequest
    && typeof rawRequest === "object"
    && "action" in rawRequest
    && rawRequest.action === "execute_pipeline"
    && (
      ("contractVersion" in rawRequest && rawRequest.contractVersion === "transcription_summary_v1")
      || ("stage_version" in rawRequest && rawRequest.stage_version === "v1")
      || ("provider" in rawRequest && rawRequest.provider === "ai-tunnel")
      || ("parserFallbackEnabled" in rawRequest && rawRequest.parserFallbackEnabled === true)
    )
  ) {
    return NextResponse.json({
      error: "V3_RUNTIME_CONFIGURATION_MISMATCH",
      status: "TECHNICAL_ERROR",
    }, { status: 409 });
  }
  const parsed = RequestSchema.safeParse(rawRequest);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST", issues: parsed.error.issues }, { status: 400 });
  }
  const manifest = createContractManifest(AI_SUMMARY_V3_PIPELINE_VERSION);
  validateContractManifest(manifest);
  if (parsed.data.action === "manifest") {
    return NextResponse.json({ manifest });
  }
  if (parsed.data.action === "execute_pipeline") {
    const mismatch = validateV3RuntimeConfiguration({
      configuration: parsed.data.runtimeConfiguration,
      manifest,
    });
    if (mismatch) {
      return NextResponse.json({
        error: mismatch.errorCode,
        detail: mismatch.message,
      }, { status: 409 });
    }
    const transport = createOpenAiDirectTransport();
    const executor = new RuntimeTranscriptionSummaryV3StageExecutor({
      provider: parsed.data.provider,
      models: parsed.data.models,
      transport,
      crmRepository: crmPublicationRepository,
      crmClient: dryRunOnlyCrmClient,
    });
    const result = await executeTranscriptionSummaryV3Pipeline({
      transcript: parsed.data.transcript,
      runId: parsed.data.runId,
      executor,
    });
    return NextResponse.json({ result });
  }
  if (parsed.data.action === "build_store") {
    if (parsed.data.manifestHash !== manifest.manifestHash) {
      return NextResponse.json({ error: "MANIFEST_HASH_MISMATCH" }, { status: 409 });
    }
    const transcript = {
      ...parsed.data.transcript,
      metadata: {
        ...parsed.data.transcript.metadata,
        run_id: parsed.data.runId,
        sha256: calculateTranscriptContentHash(parsed.data.transcript),
      },
    };
    const result = buildConversationStoreV3({
      manifest,
      transcript,
      facts: parsed.data.facts,
      needs: parsed.data.needs,
      outcome: parsed.data.outcome,
    });
    return NextResponse.json({ result }, { status: result.ok ? 200 : 422 });
  }
  if (parsed.data.action === "summarize") {
    if (parsed.data.manifestHash !== manifest.manifestHash) {
      return NextResponse.json({ error: "SUMMARY_MANIFEST_MISMATCH" }, { status: 409 });
    }
    const result = await executeSummaryAgentV3({
      manifest,
      conversationStore: parsed.data.conversationStore,
      transcript: parsed.data.transcript,
      promptVersion: parsed.data.promptVersion,
      provider: parsed.data.provider,
      model: parsed.data.model,
      transport: transportFor(parsed.data.provider),
    });
    return NextResponse.json(
      { result },
      { status: 200 },
    );
  }
  if (parsed.data.action === "judge_summary") {
    if (parsed.data.manifestHash !== manifest.manifestHash) {
      return NextResponse.json({ error: "SUMMARY_JUDGE_MANIFEST_MISMATCH" }, { status: 409 });
    }
    const result = await executeSummaryJudgeV3({
      manifest,
      conversationStore: parsed.data.conversationStore,
      summary: parsed.data.summary,
      transcript: parsed.data.transcript,
      criterion: parsed.data.criterion,
      provider: parsed.data.provider,
      model: parsed.data.model,
      transport: transportFor(parsed.data.provider),
    });
    return NextResponse.json(
      { result },
      { status: result.ok || result.disposition === "NOT_RUN" ? 200 : 422 },
    );
  }
  if (parsed.data.action === "quality_gate_summary") {
    if (parsed.data.manifestHash !== manifest.manifestHash) {
      return NextResponse.json({ error: "QUALITY_GATE_HASH_MISMATCH" }, { status: 409 });
    }
    const result = executeSummaryQualityGateV3({
      manifest,
      conversationStore: parsed.data.conversationStore,
      summary: parsed.data.summary,
      verdicts: parsed.data.verdicts,
    });
    return NextResponse.json(
      { result },
      { status: 200 },
    );
  }
  if (parsed.data.action === "publish_crm_summary") {
    if (parsed.data.manifestHash !== manifest.manifestHash) {
      return NextResponse.json({ error: "CRM_HASH_MISMATCH" }, { status: 409 });
    }
    const result = await executeCrmPublicationV3({
      manifest,
      executionId: parsed.data.executionId,
      conversationStore: parsed.data.conversationStore,
      summary: parsed.data.summary,
      qualityGate: parsed.data.qualityGate,
      target: parsed.data.target,
      dryRun: true,
      repository: crmPublicationRepository,
      client: dryRunOnlyCrmClient,
    });
    return NextResponse.json(
      { result },
      { status: result.ok || result.disposition === "NOT_RUN" ? 200 : 422 },
    );
  }
  if (parsed.data.action === "reconcile") {
    if (parsed.data.kind === "facts") {
      const agent = FactsV3Schema.safeParse(parsed.data.agentOutput);
      const judge = FactJudgeV3Schema.safeParse(parsed.data.judgeOutput);
      if (!agent.success || !judge.success) return NextResponse.json({ error: "INVALID_RECONCILIATION_INPUT" }, { status: 400 });
      const reconciliation = reconcileFactsV3(agent.data, judge.data, parsed.data.sourceReferences, parsed.data.reconciledAt);
      return NextResponse.json({ reconciliation });
    }
    if (parsed.data.kind === "needs") {
      const agent = NeedsV3Schema.safeParse(parsed.data.agentOutput);
      const judge = NeedJudgeV3Schema.safeParse(parsed.data.judgeOutput);
      if (!agent.success || !judge.success) return NextResponse.json({ error: "INVALID_RECONCILIATION_INPUT" }, { status: 400 });
      const reconciliation = reconcileNeedsV3(agent.data, judge.data, parsed.data.sourceReferences, parsed.data.reconciledAt);
      return NextResponse.json({ reconciliation });
    }
    const agent = OutcomeV3Schema.safeParse(parsed.data.agentOutput);
    const judge = OutcomeJudgeV3Schema.safeParse(parsed.data.judgeOutput);
    if (!agent.success || !judge.success) return NextResponse.json({ error: "INVALID_RECONCILIATION_INPUT" }, { status: 400 });
    const reconciliation = reconcileOutcomeV3(agent.data, judge.data, parsed.data.sourceReferences, parsed.data.reconciledAt);
    return NextResponse.json({ reconciliation });
  }
  if (parsed.data.manifestHash !== manifest.manifestHash) {
    return NextResponse.json({ error: "MANIFEST_HASH_MISMATCH" }, { status: 409 });
  }
  const role = parsed.data.role;
  if (!ALLOWED_STAGE_ROLES.includes(role)) {
    return NextResponse.json({ error: "CONTRACT_ROLE_NOT_ALLOWED" }, { status: 400 });
  }
  const reference = manifest.contracts[role];
  const contract = getContract(reference.id, reference.version);
  const prompt = buildStructuredPrompt({
    systemRole: parsed.data.systemRole,
    businessInstruction: parsed.data.businessInstruction,
    promptVersion: parsed.data.promptVersion,
    contract,
    inputData: parsed.data.inputData,
  });
  const result = await executeStructuredCompletion({
    stageId: parsed.data.stageId,
    manifestHash: manifest.manifestHash,
    contract,
    prompt: prompt.resolvedPrompt,
    promptHash: prompt.promptHash,
    provider: parsed.data.provider,
    model: parsed.data.model,
    transport: transportFor(parsed.data.provider),
  });
  return NextResponse.json({ result, prompt });
}

export const runtime = "nodejs";
