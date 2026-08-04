import type { ContractDefinition, ContractRole } from "../contracts/contract-types";
import { FactsV3Contract, FactsV3Schema } from "../contracts/facts/v3/contract";
import { NeedsV3Contract } from "../contracts/needs/v3/contract";
import { NeedsV3Schema } from "../contracts/needs/v3/contract";
import { OutcomeV3Contract, OutcomeV3Schema } from "../contracts/outcome/v3/contract";
import type { PipelineStageReportV3 } from "../contracts/pipeline-report/v3/contract";
import { SUMMARY_CRITERIA } from "../contracts/canonical-enums";
import type { SummaryCriterionV3 } from "../contracts/summary-judge-input/v3/contract";
import { buildStructuredPrompt, type ResolvedPrompt } from "../runtime/prompt-builder";
import {
  applyFactsAgentOutputPolicyV3,
  applyNeedsAgentOutputPolicyV3,
  applyOutcomeAgentOutputPolicyV3,
  type AgentOutputPolicyTransformationV3,
} from "../runtime/agent-output-policy";
import {
  executeStructuredCompletion,
  type SafeProviderDiagnostic,
  type StructuredDiagnostic,
  type StructuredProviderTransport,
} from "../runtime/structured-output";
import { buildConversationStoreV3 } from "../store";
import { executeSummaryAgentV3 } from "../summary";
import { executeSummaryJudgeV3 } from "../summary-judges";
import { executeSummaryQualityGateV3 } from "../quality-gate";
import { executeCrmPublicationV3 } from "../crm-publication";
import type {
  CrmClientV3,
  CrmPublicationRepositoryV3,
} from "../crm-publication";
import type {
  PipelineExecutionContext,
  PipelineStageAudit,
  PipelineStageExecution,
  TranscriptionSummaryV3StageExecutor,
  TranscriptionSummaryV3StageId,
} from "./types";

const ROLE_BY_AGENT_STAGE = {
  facts_agent: "facts",
  needs_agent: "needs",
  outcome_agent: "outcome",
} as const satisfies Partial<Record<TranscriptionSummaryV3StageId, ContractRole>>;

const CONTRACT_BY_AGENT_STAGE = {
  facts_agent: FactsV3Contract,
  needs_agent: NeedsV3Contract,
  outcome_agent: OutcomeV3Contract,
} as const;

const SUMMARY_JUDGE_CRITERION = {
  summary_judge_faithfulness: "faithfulness",
  summary_judge_completeness: "completeness",
  summary_judge_usefulness: "usefulness",
  summary_judge_agreements_next_step: "agreements_next_step",
  summary_judge_format: "format",
} as const satisfies Partial<Record<TranscriptionSummaryV3StageId, SummaryCriterionV3>>;

const BUSINESS_INSTRUCTIONS = {
  facts_agent: "Извлеки только явно подтверждённые рабочие факты. Не включай имя, телефон или его части, полный адрес, цену, площадь, этаж, ЖК, код объекта и прочие параметры карточки объявления. Не включай действия Outcome (просмотр, встречу, звонок, отправку) в confirmed_facts. Цитаты: только клиент, максимум две, только мотив, сомнение, ограничение, возражение или важная позиция; не цитируй приветствие, имя, обычную цель, бюджет, финансирование, срок, время или договорённость. verification_status каждого валидного элемента должен быть extracted.",
  needs_agent: "Используй ctx.facts, ctx.facts.quotes и полную транскрипцию. Не ожидай fact_check. Разделяй потребности, требования и CRM-атрибуты. Параметр конкретного объекта не является требованием клиента. property_requirements допустим только при прямой формулировке клиента: нужно, важно, только, не рассматриваю без, хочу не менее или равнозначной. ЖК и ДДУ не означают interested_in=Новостройки без прямого клиентского критерия. Просмотры, встречи, звонки, отправки и другие действия относятся к Outcome и запрещены в business_needs/property_requirements. verification_status каждого валидного элемента должен быть extracted.",
  outcome_agent: "Используй ctx.facts, ctx.needs и полную транскрипцию. Не ожидай fact_check или need_check. Верни только call_result, agreements и primary_next_step строго по JSON Schema. call_result всегда строка: только короткий результат разговора без Facts/Needs и точных деталей primary_next_step. agreements содержит только подтверждённые клиентом договорённости; не создавай status=not_defined. Условная возможность просмотра не является согласованным просмотром. Если агент обещал сначала подтвердить доступность объекта, primary_next_step — звонок/сообщение с ответом; не переноси время и канал этого контакта на просмотр. Просмотр нельзя проводить по телефону. owner задавай ролью, без имени. Не используй call_results, agreement_id, outcome_meta или text.",
} as const;

const PROMPT_VERSION_BY_STAGE = {
  facts_agent: "facts_agent-v3.2.0",
  needs_agent: "needs_agent-v3.4.0",
  outcome_agent: "outcome_agent-v3.4.0",
} as const;

function remainingTimeout(context: PipelineExecutionContext, stageLimitMs: number): number {
  return Math.max(1, Math.min(stageLimitMs, context.deadlineAtMs - Date.now() - 2_000));
}

function emptyNeedsResult(context: PipelineExecutionContext): unknown | null {
  const text = context.transcript.turns.map((turn) => turn.text).join(" ");
  if (/(?:бюджет|наличн|ипотек|участ|студи|комнат|метр|м²|купить|покуп|ищу|нужн\S*|важн\S*|рассматрива)/iu.test(text)) return null;
  if (!/(?:неудобно|перезвон|повторн\S* звон|связаться|после \d{1,2}:\d{2}|готов\S* приехать|встречаемся|подтверждаю)/iu.test(text)) return null;
  const first = context.transcript.turns[0];
  if (!first) return null;
  const base = {
    source_turn_ids: [first.id],
    evidence: first.text,
    confidence: 1,
    verification_status: "extracted" as const,
  };
  const candidate = {
    business_needs: [],
    property_requirements: [],
    structured_crm_attributes: {
      interested_in: [],
      funding_source: { id: "funding-source-not-defined", value: "не определено", ...base },
      purchase_term: { id: "purchase-term-not-defined", value: "не определено", ...base },
    },
    communication_preferences: [],
    client_questions: [],
  };
  const parsed = NeedsV3Schema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function sourceReferences(context: PipelineExecutionContext) {
  return context.transcript.turns.map((turn) => ({
    turn_id: turn.id,
    speaker: turn.speaker,
    text: turn.text,
  }));
}

function providerAudit(
  providerDiagnostic: SafeProviderDiagnostic | null,
): PipelineStageReportV3["provider_diagnostic"] {
  return providerDiagnostic ? {
    request_dispatched: providerDiagnostic.requestDispatched,
    provider: providerDiagnostic.providerName,
    base_url: providerDiagnostic.baseUrl,
    endpoint: providerDiagnostic.endpoint,
    model: providerDiagnostic.model,
    schema_id: providerDiagnostic.schemaId,
    schema_hash: providerDiagnostic.schemaHash,
    response_format_type: providerDiagnostic.responseFormatType,
    http_status: providerDiagnostic.httpStatus,
    provider_error_type: providerDiagnostic.providerErrorType,
    provider_error_code: providerDiagnostic.providerErrorCode,
    provider_error_param: providerDiagnostic.providerErrorParam,
    provider_error_message: providerDiagnostic.providerErrorMessage,
    provider_request_id: providerDiagnostic.providerRequestId,
    error_category: providerDiagnostic.errorCategory,
    api_key_present: providerDiagnostic.apiKeyPresent,
    environment_scope: providerDiagnostic.environmentScope,
    request_serialization_status: providerDiagnostic.requestSerializationStatus,
    timeout_network_classification: providerDiagnostic.timeoutNetworkClassification,
    structured_output_not_applied_reason: providerDiagnostic.structuredOutputNotAppliedReason,
    attempt_started_at: providerDiagnostic.attemptStartedAt,
    request_dispatched_at: providerDiagnostic.requestDispatchedAt,
    response_received_at: providerDiagnostic.responseReceivedAt,
    attempt_finished_at: providerDiagnostic.attemptFinishedAt,
    duration_ms: providerDiagnostic.durationMs,
    usage: providerDiagnostic.usage ? {
      input_tokens: providerDiagnostic.usage.inputTokens,
      output_tokens: providerDiagnostic.usage.outputTokens,
      total_tokens: providerDiagnostic.usage.totalTokens,
    } : null,
  } : null;
}

function structuredAudit(
  contract: ContractDefinition,
  prompt: ResolvedPrompt,
  diagnostic: StructuredDiagnostic,
  stageId: string,
): PipelineStageAudit {
  const timestamp = new Date(0).toISOString();
  const transformations: PipelineStageReportV3["transformations"] =
    diagnostic.normalizationTransformations.map((item) => ({
      operation_id: item.transformationId,
      operation_type: "normalized" as const,
      field_path: item.fieldPath,
      old_value: JSON.parse(JSON.stringify(item.originalValue)) as never,
      new_value: JSON.parse(JSON.stringify(item.normalizedValue)) as never,
      rule_id: item.ruleId,
      reason: item.result,
      source_refs: item.itemId ? [item.itemId] : [],
      timestamp,
    }));
  return {
    contractId: contract.id,
    contractVersion: contract.version,
    schemaHash: contract.schemaHash,
    promptId: prompt.promptVersion,
    promptVersion: prompt.promptVersion,
    promptHash: prompt.promptHash,
    basePrompt: prompt.basePrompt,
    resolvedPrompt: prompt.resolvedPrompt,
    model: diagnostic.model,
    provider: diagnostic.provider,
    structuredOutputRequired: true,
    structuredOutputRequested: diagnostic.structuredOutputRequested,
    structuredOutputApplied: diagnostic.structuredOutputApplied,
    providerDiagnostic: providerAudit(diagnostic.providerDiagnostic),
    attempts: diagnostic.attemptCount,
    repairAttempted: diagnostic.repairAttempted,
    timeoutStage: diagnostic.providerDiagnostic?.errorCategory === "timeout" ? stageId : null,
    durationMs: diagnostic.durationMs,
    transformations,
    validationStatus: diagnostic.validationStatus,
    validationIssues: diagnostic.validationIssues.map((issue) => ({
      path: issue.path,
      code: issue.issueCode,
      message: issue.message,
    })),
    errorType: diagnostic.errorCode ? (
      diagnostic.errorType?.includes("normalization")
        ? "normalization"
        : diagnostic.errorType?.includes("validation")
          ? "schema"
          : "provider"
    ) : null,
    errorCode: diagnostic.errorCode,
    blocking: diagnostic.errorCode !== null,
  };
}

function policyAuditTransformations(
  transformations: readonly AgentOutputPolicyTransformationV3[],
): PipelineStageReportV3["transformations"] {
  return transformations.map((item, index) => ({
    operation_id: `${item.ruleId}:${index + 1}`,
    operation_type: "normalized" as const,
    field_path: item.fieldPath,
    old_value: JSON.parse(JSON.stringify(item.originalValue)) as never,
    new_value: JSON.parse(JSON.stringify(item.normalizedValue)) as never,
    rule_id: item.ruleId,
    reason: item.reason,
    source_refs: [],
    timestamp: new Date(0).toISOString(),
  }));
}

function applyAgentPolicy(
  stageId: keyof typeof CONTRACT_BY_AGENT_STAGE,
  value: unknown,
): Readonly<{ value: unknown; transformations: readonly AgentOutputPolicyTransformationV3[] }> {
  if (stageId === "facts_agent") return applyFactsAgentOutputPolicyV3(FactsV3Schema.parse(value));
  if (stageId === "needs_agent") return applyNeedsAgentOutputPolicyV3(NeedsV3Schema.parse(value));
  return applyOutcomeAgentOutputPolicyV3(OutcomeV3Schema.parse(value));
}

function codeAudit(
  context: PipelineExecutionContext,
  role: ContractRole,
  overrides: Partial<PipelineStageAudit> = {},
): PipelineStageAudit {
  const reference = context.manifest.contracts[role];
  return {
    contractId: reference.id,
    contractVersion: reference.version,
    schemaHash: reference.schemaHash,
    validationStatus: "valid",
    blocking: false,
    ...overrides,
  };
}

export class RuntimeTranscriptionSummaryV3StageExecutor
implements TranscriptionSummaryV3StageExecutor {
  readonly #provider: string;
  readonly #models: Readonly<Record<string, string>>;
  readonly #transport: StructuredProviderTransport;
  readonly #crmRepository: CrmPublicationRepositoryV3;
  readonly #crmClient: CrmClientV3;
  readonly #now: () => Date;

  constructor(input: {
    provider: string;
    models: Readonly<Record<string, string>>;
    transport: StructuredProviderTransport;
    crmRepository: CrmPublicationRepositoryV3;
    crmClient: CrmClientV3;
    now?: () => Date;
  }) {
    if (input.provider !== "openai-direct") {
      throw new Error("V3_RUNTIME_CONFIGURATION_MISMATCH");
    }
    this.#provider = input.provider;
    this.#models = input.models;
    this.#transport = input.transport;
    this.#crmRepository = input.crmRepository;
    this.#crmClient = input.crmClient;
    this.#now = input.now ?? (() => new Date());
  }

  #model(stageId: string): string {
    return this.#models[stageId] ?? this.#models.default ?? "gpt-5-mini-2025-08-07";
  }

  async #structuredAgent(
    stageId: keyof typeof CONTRACT_BY_AGENT_STAGE,
    context: PipelineExecutionContext,
  ): Promise<PipelineStageExecution> {
    const contract = CONTRACT_BY_AGENT_STAGE[stageId];
    const sources = sourceReferences(context);
    const outputs = context.outputs;
    const inputData = stageId === "facts_agent"
      ? { transcript: context.transcript, source_references: sources }
      : stageId === "needs_agent"
        ? {
            facts: outputs.facts_agent,
            transcript: context.transcript,
            source_references: sources,
          }
        : {
            facts: outputs.facts_agent,
            needs: outputs.needs_agent,
            transcript: context.transcript,
            source_references: sources,
          };
    const prompt = buildStructuredPrompt({
      systemRole: `Structured ${ROLE_BY_AGENT_STAGE[stageId]} stage for transcription summary v3.`,
      businessInstruction: BUSINESS_INSTRUCTIONS[stageId],
      promptVersion: PROMPT_VERSION_BY_STAGE[stageId],
      contract,
      inputData,
    });
    const completion = await executeStructuredCompletion({
      stageId,
      manifestHash: context.manifest.manifestHash,
      contract,
      prompt: prompt.resolvedPrompt,
      promptHash: prompt.promptHash,
      provider: this.#provider,
      model: this.#model(stageId),
      transport: this.#transport,
      timeoutMs: remainingTimeout(context, 60_000),
    });
    const policy = completion.ok ? applyAgentPolicy(stageId, completion.value) : null;
    const structured = structuredAudit(contract, prompt, completion.diagnostic, stageId);
    const audit = {
      ...structured,
      transformations: [
        ...(structured.transformations ?? []),
        ...policyAuditTransformations(policy?.transformations ?? []),
      ],
      rawProviderResponse: completion.ok ? null : completion.rawResponse ?? null,
    };
    if (!completion.ok && stageId === "needs_agent") {
      const emptyNeeds = emptyNeedsResult(context);
      if (emptyNeeds) return {
        status: "SUCCESS_WITH_WARNING",
        value: emptyNeeds,
        audit: {
          ...audit,
          validationStatus: "valid",
          validationIssues: [{
            path: "needs_agent",
            code: "EMPTY_NEEDS_NORMALIZED",
            message: "No business needs were discussed; deterministic empty Needs v3 result applied.",
          }],
          errorType: null,
          errorCode: null,
          blocking: false,
        },
      };
    }
    return completion.ok
      ? { status: policy?.transformations.length ? "SUCCESS_WITH_WARNING" : "SUCCESS", value: policy?.value ?? completion.value, audit }
      : {
          status: "TECHNICAL_ERROR",
          value: null,
          audit: {
            ...audit,
            errorCode: completion.error.errorCode,
            blocking: false,
          },
        };
  }

  async execute(
    stageId: Exclude<TranscriptionSummaryV3StageId, "transcript_validation">,
    context: PipelineExecutionContext,
  ): Promise<PipelineStageExecution> {
    if (stageId in CONTRACT_BY_AGENT_STAGE) {
      return this.#structuredAgent(stageId as keyof typeof CONTRACT_BY_AGENT_STAGE, context);
    }
    const outputs = context.outputs;
    const sources = sourceReferences(context);
    if (stageId === "conversation_store") {
      const result = buildConversationStoreV3({
        manifest: context.manifest,
        transcript: context.transcript,
        facts: outputs.facts_agent,
        needs: outputs.needs_agent,
        outcome: outputs.outcome_agent,
      });
      return result.ok
        ? { status: "SUCCESS", value: result.store, audit: codeAudit(context, "conversationStore", { durationMs: result.diagnostic.durationMs }) }
        : { status: "TECHNICAL_ERROR", value: null, audit: codeAudit(context, "conversationStore", { validationStatus: "invalid", errorType: "invariant", errorCode: result.error.errorCode, blocking: true, durationMs: result.diagnostic.durationMs }) };
    }
    if (stageId === "summary_agent") {
      const result = await executeSummaryAgentV3({
        manifest: context.manifest,
        conversationStore: outputs.conversation_store,
        transcript: context.transcript,
        provider: this.#provider,
        model: this.#model(stageId),
        transport: this.#transport,
        timeoutMs: remainingTimeout(context, 60_000),
      });
      const audit = codeAudit(context, "summary", {
        promptId: "summary-agent-v3",
        promptVersion: result.prompt?.promptVersion ?? result.diagnostic.promptVersion,
        promptHash: result.prompt?.promptHash ?? result.diagnostic.promptHash,
        basePrompt: result.prompt?.basePrompt ?? null,
        resolvedPrompt: result.prompt?.resolvedPrompt ?? null,
        model: this.#model(stageId),
        provider: this.#provider,
        structuredOutputRequired: true,
        structuredOutputRequested: result.diagnostic.structuredOutputRequested,
        structuredOutputApplied: result.diagnostic.structuredOutputApplied,
        providerDiagnostic: providerAudit(result.diagnostic.providerDiagnostic),
        attempts: result.diagnostic.attemptCount,
        repairAttempted: result.diagnostic.repairAttempted,
        rawProviderResponse: result.ok ? null : result.diagnostic.rawProviderResponse,
        timeoutStage: result.diagnostic.providerDiagnostic?.errorCategory === "timeout" ? stageId : null,
        transformations: result.diagnostic.repetitionTransformations.map((item) => ({
          operation_id: item.ruleId,
          operation_type: "normalized" as const,
          field_path: item.fieldPath,
          old_value: null,
          new_value: item.meaningId,
          rule_id: item.ruleId,
          reason: item.reason,
          source_refs: item.meaningId ? [item.meaningId] : [],
          timestamp: new Date(0).toISOString(),
        })),
        validationStatus: result.diagnostic.validationStatus,
        validationIssues: [
          ...(result.diagnostic.summaryPlan ? [{
            path: "summary.plan",
            code: "SUMMARY_PLAN",
            message: JSON.stringify(result.diagnostic.summaryPlan),
          }] : []),
          ...(result.diagnostic.finalDiagnostics ? [{
            path: "summary.final",
            code: "POST_FINAL_DIAGNOSTICS",
            message: JSON.stringify(result.diagnostic.finalDiagnostics),
          }] : []),
          ...result.diagnostic.quoteDiagnostics.map((diagnostic) => ({
            path: "summary.quotes",
            code: "SUMMARY_QUOTE_SOURCE_DIAGNOSTIC",
            message: JSON.stringify(diagnostic),
          })),
        ],
        errorType: result.ok ? null : result.diagnostic.errorType === "provider_error" ? "provider" : "schema",
        errorCode: result.diagnostic.errorCode,
        blocking: !result.ok,
        durationMs: result.diagnostic.durationMs,
      });
      return result.ok
        ? { status: "SUCCESS", value: result.value, audit }
        : { status: "TECHNICAL_ERROR", value: null, audit: { ...audit, errorCode: result.error.errorCode, blocking: true } };
    }
    if (stageId in SUMMARY_JUDGE_CRITERION) {
      const criterion = SUMMARY_JUDGE_CRITERION[stageId as keyof typeof SUMMARY_JUDGE_CRITERION];
      const result = await executeSummaryJudgeV3({
        manifest: context.manifest,
        conversationStore: outputs.conversation_store,
        summary: outputs.summary_agent,
        transcript: context.transcript,
        criterion,
        provider: this.#provider,
        model: this.#model(stageId),
        transport: this.#transport,
        timeoutMs: remainingTimeout(context, 45_000),
      });
      const audit = codeAudit(context, "summaryJudges", {
        promptId: result.prompt?.promptId ?? result.diagnostic.promptId,
        promptVersion: result.prompt?.promptVersion ?? result.diagnostic.promptVersion,
        promptHash: result.prompt?.promptHash ?? result.diagnostic.promptHash,
        basePrompt: result.prompt?.basePrompt ?? null,
        resolvedPrompt: result.prompt?.resolvedPrompt ?? null,
        model: this.#model(stageId),
        provider: this.#provider,
        structuredOutputRequired: true,
        structuredOutputRequested: result.diagnostic.structuredOutputRequested,
        structuredOutputApplied: result.diagnostic.structuredOutputApplied,
        providerDiagnostic: providerAudit(result.diagnostic.providerDiagnostic),
        attempts: result.diagnostic.attemptCount,
        repairAttempted: result.diagnostic.repairAttempted,
        rawProviderResponse: result.ok ? null : result.diagnostic.rawProviderResponse,
        timeoutStage: result.diagnostic.providerDiagnostic?.errorCategory === "timeout" ? stageId : null,
        validationStatus: result.diagnostic.validationStatus,
        validationIssues: [{
          path: `summary_judge.${criterion}`,
          code: "JUDGE_SCORE_AUDIT",
          message: JSON.stringify({
            criterion,
            raw_score: result.diagnostic.rawScore,
            effective_score: result.diagnostic.score,
          }),
        }, ...result.diagnostic.validationIssues],
        score: result.diagnostic.score,
        confidence: result.diagnostic.confidence,
        errorType: result.ok ? null : "provider",
        errorCode: result.diagnostic.errorCode,
        blocking: false,
        durationMs: result.diagnostic.durationMs,
      });
      return result.ok
        ? {
            status: result.value.verdict === "pass"
              ? "SUCCESS"
              : result.value.verdict === "technical_error"
                ? "TECHNICAL_ERROR"
                : "SUCCESS_WITH_WARNING",
            value: result.value,
            audit,
          }
        : {
            status: "TECHNICAL_ERROR",
            value: {
              criterion,
              verdict: "technical_error",
              score: null,
              confidence: null,
              issues: [],
              evidence: [],
              payload: null,
            },
            audit: { ...audit, errorCode: result.error.errorCode, blocking: false },
          };
    }
    if (stageId === "quality_gate") {
      const verdicts = SUMMARY_CRITERIA.map((criterion) =>
        outputs[`summary_judge_${criterion}` as TranscriptionSummaryV3StageId]
      );
      const result = executeSummaryQualityGateV3({
        manifest: context.manifest,
        conversationStore: outputs.conversation_store,
        summary: outputs.summary_agent,
        verdicts,
      });
      return {
            status: result.value.partialEvaluation
              || result.value.qualityStatus === "NEEDS_ATTENTION"
              || result.value.qualityStatus === "LOW_QUALITY"
              ? "SUCCESS_WITH_WARNING"
              : "SUCCESS",
            value: result.value,
            audit: codeAudit(context, "qualityGate", {
              score: result.value.qualityScore,
              validationIssues: [
                ...result.diagnostic.decisionReasons.map((reason) => ({
                  path: "quality_gate.decision_reasons",
                  code: reason.split(":", 1)[0] || "QUALITY_GATE_REASON",
                  message: reason,
                })),
                ...(result.diagnostic.postFinalDiagnostics ? [{
                  path: "quality_gate.post_final_diagnostics",
                  code: "POST_FINAL_DIAGNOSTICS",
                  message: JSON.stringify(result.diagnostic.postFinalDiagnostics),
                }] : []),
              ],
              errorType: result.diagnostic.errorCode ? "invariant" : null,
              errorCode: result.diagnostic.errorCode,
              blocking: false,
              durationMs: result.diagnostic.durationMs,
            }),
          };
    }
    const result = await executeCrmPublicationV3({
      manifest: context.manifest,
      executionId: `${context.runId}-crm-publication-v3`,
      conversationStore: outputs.conversation_store,
      summary: outputs.summary_agent,
      qualityGate: outputs.quality_gate,
      target: {
        crmSystem: "pipeline-lab-preview-crm",
        entityType: "call",
        entityId: context.runId,
      },
      dryRun: true,
      repository: this.#crmRepository,
      client: this.#crmClient,
      now: this.#now,
    });
    if (!result.ok) {
      return {
        status: "TECHNICAL_ERROR",
        value: null,
        audit: codeAudit(context, "crmPublicationResult", {
          errorType: "crm",
          errorCode: result.error.errorCode,
          blocking: true,
          durationMs: result.diagnostic.durationMs,
        }),
      };
    }
    return {
      status: result.value.status === "TECHNICAL_ERROR" ? "TECHNICAL_ERROR" : "SUCCESS",
      value: result.value,
      audit: codeAudit(context, "crmPublicationResult", {
        errorType: result.diagnostic.errorCode ? "crm" : null,
        errorCode: result.diagnostic.errorCode,
        blocking: false,
        durationMs: result.diagnostic.durationMs,
      }),
    };
  }
}
