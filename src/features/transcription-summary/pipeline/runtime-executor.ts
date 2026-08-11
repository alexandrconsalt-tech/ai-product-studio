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
import {
  buildCompactFactsInputV3,
  estimateFactsPromptTokensV3,
  type FactsInputCompactionV3,
} from "./facts-input";

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
  facts_agent: "Извлеки только подтверждённые рабочие смыслы и выведи их в порядке critical, important, secondary; noise не выводи. Critical: цель обращения, возражение/отказ, юридическое ограничение, источник средств, бюджет клиента, срок клиента, результат существенного вопроса, препятствие, условие продолжения, подтверждённая позиция клиента. Important: ответы агента на ключевые вопросы, документы, собственники, обременения, задаток, влияющий на решение ремонт, прямой отказ. Не включай карточечные параметры без рабочего значения, имя, телефон, адрес, соединение, число звонков, мнение о других клиентах и Outcome-действия. Не путай цену объявления с бюджетом. Цитаты: только клиент, максимум две, только рабочий мотив, возражение или ограничение. verification_status=extracted.",
  needs_agent: "Не ожидай fact_check. Разделяй строго: business_needs — цель покупки, мотивация, финансовое ограничение, решаемая проблема или существенное условие решения; property_requirements — только прямо сформулированные критерии поиска; structured_crm_attributes — только funding_source, purchase_term, interested_in. Параметры текущего объявления, интерес к конкретному объекту, цель звонка, просмотр и результат разговора не являются Needs. Не дублируй один meaning в business_needs и CRM-атрибуте: если дополнительной рабочей проблемы нет, оставь CRM-атрибут. Цена объявления не является бюджетом клиента. ЖК/ДДУ не означают интерес к новостройкам. verification_status=extracted.",
  outcome_agent: "Верни только call_result, agreements и primary_next_step по JSON Schema; call_result всегда строка. agreements — только подтверждённые будущие действия; факты, финансирование, цель покупки, атрибуты и согласие с характеристикой объекта запрещены. call_result — терминальный результат разговора без деталей next step: при отказе из-за цены и ремонта явно зафиксируй отказ; при ожидании подтверждения просмотра явно зафиксируй ожидание. primary_next_step содержит только каноническое действие, роль owner, deadline и channel и должен соответствовать подтверждённому agreement. Условный просмотр не является согласованным. Не используй legacy-поля.",
} as const;

const PROMPT_VERSION_BY_STAGE = {
  facts_agent: "facts_agent-v3.4.0",
  needs_agent: "needs_agent-v3.5.0",
  outcome_agent: "outcome_agent-v3.5.0",
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

function explicitLegalNeedsResult(context: PipelineExecutionContext): unknown | null {
  const source = context.transcript.turns.find((turn) =>
    turn.speaker === "client"
    && /(?:важн\S*|нужн\S*|требу\S*)[^.!?]{0,180}(?:юрид|обремен|оригинал\S*\s+документ)/iu.test(turn.text));
  if (!source) return null;
  const normalized = source.text.toLocaleLowerCase("ru-RU");
  const requirements = [
    /юридическ\S*\s+чист/iu.test(normalized) ? "юридическая чистота" : null,
    /без\s+обремен/iu.test(normalized) ? "без обременений" : null,
    /оригинал\S*\s+документ/iu.test(normalized) ? "оригиналы документов" : null,
  ].filter((value): value is string => Boolean(value));
  if (!requirements.length) return null;
  const base = {
    source_turn_ids: [source.id],
    evidence: source.text,
    confidence: 1,
    verification_status: "extracted" as const,
  };
  const candidate = {
    business_needs: [],
    property_requirements: requirements.map((value, index) => ({
      id: `explicit-legal-requirement-${index + 1}`,
      need_type: "legal_requirement",
      value,
      ...base,
    })),
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

function factsSourceUnavailable(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const store = value as Record<string, unknown>;
  const quality = store.source_quality && typeof store.source_quality === "object"
    ? store.source_quality as Record<string, unknown>
    : {};
  return quality.facts === "technical_error"
    || (Array.isArray(store.source_errors) && store.source_errors.includes("facts"));
}

function factsCompactionTransformation(
  input: FactsInputCompactionV3,
): PipelineStageReportV3["transformations"] {
  if (!input.removedTurnIds.length) return [];
  return [{
    operation_id: "facts-transcript-compaction-v1",
    operation_type: "normalized",
    field_path: "facts_agent.input.turns",
    old_value: { removed_turn_ids: input.removedTurnIds } as never,
    new_value: { retained_turns: input.turns.length } as never,
    rule_id: "facts.deterministic-transcript-compaction.v1",
    reason: "Removed only non-client greetings, acknowledgements and technical noise; protected agent answers and original turn IDs were retained.",
    source_refs: [...input.removedTurnIds],
    timestamp: new Date(0).toISOString(),
  }];
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
  context: PipelineExecutionContext,
): Readonly<{ value: unknown; transformations: readonly AgentOutputPolicyTransformationV3[] }> {
  if (stageId === "facts_agent") return applyFactsAgentOutputPolicyV3(FactsV3Schema.parse(value), context.transcript);
  if (stageId === "needs_agent") return applyNeedsAgentOutputPolicyV3(NeedsV3Schema.parse(value));
  return applyOutcomeAgentOutputPolicyV3(OutcomeV3Schema.parse(value), context.transcript);
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

  async #factsAgent(context: PipelineExecutionContext): Promise<PipelineStageExecution> {
    const stageId = "facts_agent" as const;
    const contract = FactsV3Contract;
    const inputCompactions: FactsInputCompactionV3[] = [
      buildCompactFactsInputV3(context.transcript, "initial"),
    ];
    const prompts: ResolvedPrompt[] = [buildStructuredPrompt({
      systemRole: "Structured facts stage for transcription summary v3.",
      businessInstruction: BUSINESS_INSTRUCTIONS.facts_agent,
      promptVersion: PROMPT_VERSION_BY_STAGE.facts_agent,
      contract,
      inputData: { turns: inputCompactions[0].turns },
    })];
    const attemptTimeouts: number[] = [];
    const providerLatencies: number[] = [];
    const completions: Awaited<ReturnType<typeof executeStructuredCompletion<typeof FactsV3Contract>>>[] = [];
    const executeAttempt = async (prompt: ResolvedPrompt) => {
      const timeoutMs = remainingTimeout(context, 55_000);
      attemptTimeouts.push(timeoutMs);
      const completion = await executeStructuredCompletion({
        stageId,
        manifestHash: context.manifest.manifestHash,
        contract,
        prompt: prompt.resolvedPrompt,
        promptHash: prompt.promptHash,
        provider: this.#provider,
        model: this.#model(stageId),
        transport: this.#transport,
        timeoutMs,
        validationRepairEnabled: false,
      });
      providerLatencies.push(completion.diagnostic.providerDiagnostic?.durationMs ?? completion.diagnostic.durationMs);
      completions.push(completion);
      return completion;
    };

    let completion = await executeAttempt(prompts[0]);
    const retryReason = !completion.ok && completion.error.errorCode === "OPENAI_TIMEOUT"
      ? "timeout" as const
      : !completion.ok && completion.error.errorCode === "OPENAI_NETWORK_ERROR"
        ? "network" as const
        : null;
    if (retryReason && context.deadlineAtMs - Date.now() > 3_000) {
      inputCompactions.push(buildCompactFactsInputV3(context.transcript, "retry"));
      prompts.push(buildStructuredPrompt({
        systemRole: "Structured facts stage for transcription summary v3.",
        businessInstruction: BUSINESS_INSTRUCTIONS.facts_agent,
        promptVersion: PROMPT_VERSION_BY_STAGE.facts_agent,
        contract,
        inputData: { turns: inputCompactions[1].turns },
      }));
      completion = await executeAttempt(prompts[1]);
    }

    const finalPrompt = prompts.at(-1) ?? prompts[0];
    const finalCompaction = inputCompactions.at(-1) ?? inputCompactions[0];
    const totalAttempts = completions.reduce((sum, item) => sum + item.diagnostic.attemptCount, 0);
    const totalDuration = completions.reduce((sum, item) => sum + item.diagnostic.durationMs, 0);
    const policy = completion.ok ? applyFactsAgentOutputPolicyV3(FactsV3Schema.parse(completion.value), context.transcript) : null;
    const structured = structuredAudit(contract, finalPrompt, completion.diagnostic, stageId);
    const providerInputTokens = completions
      .map((item) => item.diagnostic.providerDiagnostic?.usage?.inputTokens)
      .filter((value): value is number => typeof value === "number");
    const providerOutputTokens = completions
      .map((item) => item.diagnostic.providerDiagnostic?.usage?.outputTokens)
      .filter((value): value is number => typeof value === "number");
    const instructionTokens = Math.max(
      0,
      estimateFactsPromptTokensV3(finalPrompt.resolvedPrompt) - finalCompaction.transcriptTokens,
    );
    const audit: PipelineStageAudit = {
      ...structured,
      attempts: totalAttempts,
      repairAttempted: false,
      durationMs: totalDuration,
      transformations: [
        ...factsCompactionTransformation(finalCompaction),
        ...policyAuditTransformations(policy?.transformations ?? []),
      ],
      rawProviderResponse: completion.ok ? null : completion.rawResponse ?? null,
      inputDiagnostic: {
        input_tokens_estimate: estimateFactsPromptTokensV3(finalPrompt.resolvedPrompt),
        transcript_tokens: finalCompaction.transcriptTokens,
        instruction_tokens: instructionTokens,
        duplicated_context_tokens_removed: finalCompaction.duplicatedContextTokensRemoved,
        input_turns_count: finalCompaction.turns.length,
        payload_bytes: new TextEncoder().encode(finalPrompt.resolvedPrompt).length,
        attempt_timeouts_ms: attemptTimeouts,
        provider_latencies_ms: providerLatencies,
        input_tokens: providerInputTokens.length
          ? providerInputTokens.reduce((sum, value) => sum + value, 0)
          : null,
        output_tokens: providerOutputTokens.length
          ? providerOutputTokens.reduce((sum, value) => sum + value, 0)
          : null,
        retry_reason: retryReason,
        final_source_quality: completion.ok ? "valid" : "technical_error",
      },
    };
    return completion.ok
      ? {
          status: policy?.transformations.length ? "SUCCESS_WITH_WARNING" : "SUCCESS",
          value: policy?.value ?? completion.value,
          audit,
        }
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
    const policy = completion.ok ? applyAgentPolicy(stageId, completion.value, context) : null;
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
      const deterministicNeeds = explicitLegalNeedsResult(context) ?? emptyNeedsResult(context);
      if (deterministicNeeds) return {
        status: "SUCCESS_WITH_WARNING",
        value: deterministicNeeds,
        audit: {
          ...audit,
          validationStatus: "valid",
          validationIssues: [{
            path: "needs_agent",
            code: explicitLegalNeedsResult(context) ? "EXPLICIT_NEEDS_RECOVERED" : "EMPTY_NEEDS_NORMALIZED",
            message: explicitLegalNeedsResult(context)
              ? "Provider output was invalid; explicit client legal requirements were recovered deterministically from source turns."
              : "No business needs were discussed; deterministic empty Needs v3 result applied.",
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
    if (stageId === "facts_agent") return this.#factsAgent(context);
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
      if (factsSourceUnavailable(outputs.conversation_store)) {
        return {
          status: "SUCCESS_WITH_WARNING",
          value: {
            conversation_result: "Диагностический preview: источник Facts недоступен; содержательный Summary не сформирован.",
            key_facts: [],
            quotes: [],
            next_step: "Требуется повторный запуск Fact Agent перед публикацией результата.",
          },
          audit: codeAudit(context, "summary", {
            validationIssues: [{
              path: "summary_agent",
              code: "DIAGNOSTIC_PREVIEW_FACTS_UNAVAILABLE",
              message: "Only a diagnostic preview is allowed because the critical Facts source is unavailable.",
            }],
            blocking: false,
          }),
        };
      }
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
      if (factsSourceUnavailable(outputs.conversation_store)) {
        return {
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
          audit: codeAudit(context, "summaryJudges", {
            validationStatus: "not_run",
            validationIssues: [{
              path: `summary_judge.${criterion}`,
              code: "FACTS_SOURCE_UNAVAILABLE",
              message: "Semantic Judge score is not allowed without the critical Facts source.",
            }],
            errorType: "dependency",
            errorCode: "FACTS_SOURCE_UNAVAILABLE",
            blocking: false,
          }),
        };
      }
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
            status: result.value.decision === "TECHNICAL_ERROR"
              ? "TECHNICAL_ERROR"
              : result.value.partialEvaluation
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
              errorType: result.diagnostic.errorCode === "FACTS_SOURCE_UNAVAILABLE"
                ? "dependency"
                : result.diagnostic.errorCode ? "invariant" : null,
              errorCode: result.diagnostic.errorCode,
              blocking: result.value.blocking,
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
