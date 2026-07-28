import { z } from "zod";
import {
  CallOutcomeSchema,
  ConversationStoreSchema,
  type ConversationStoreV2,
  type ExtractorOutput,
  ExtractorOutputSchema,
  type Fact,
  type JudgeCriterion,
  type JudgeOutput,
  JudgeOutputSchema,
  NextStepSchema,
  SUMMARY_V2_PIPELINE_VERSION,
  SUMMARY_V2_PRODUCT_ID,
  type SummaryOutput,
  SummaryOutputSchema,
  type SummaryV2Config,
  type SummaryV2Run,
  type TechnicalEnvelope,
  type VerifierOutput,
  VerifierOutputSchema,
} from "./contracts";
import { callStructuredLlm } from "./structured-llm";
import { extractorPrompt, generatorPrompt, judgePrompt, PROMPT_VERSIONS, verifierPrompt } from "./prompts";

const EXTRACTOR_JSON_SCHEMA = z.toJSONSchema(ExtractorOutputSchema) as Record<string, unknown>;
const VERIFIER_JSON_SCHEMA = z.toJSONSchema(VerifierOutputSchema) as Record<string, unknown>;
const SUMMARY_JSON_SCHEMA = z.toJSONSchema(SummaryOutputSchema) as Record<string, unknown>;
const JUDGE_JSON_SCHEMA = z.toJSONSchema(JudgeOutputSchema) as Record<string, unknown>;

const JUDGE_CRITERIA: readonly JudgeCriterion[] = ["faithfulness", "completeness", "usefulness", "agreements_next_step", "format"];

type TranscriptTurn = Readonly<{ turn_id: string; speaker: "client" | "agent" | "operator" | "unknown"; text: string }>;
type TranscriptGuardOutput = Readonly<{
  is_processable: boolean;
  dialogue_type: "FULL" | "SHORT" | "OPERATOR_ONLY" | "NO_CONNECTION" | "INVALID";
  speaker_stats: Readonly<{ client_utterances: number; agent_utterances: number; operator_utterances: number; unknown_utterances: number }>;
  warnings: readonly string[];
  blocking_issues: readonly string[];
  turns: readonly TranscriptTurn[];
}>;

type NormalizationOutput = Readonly<{
  normalized_data: ExtractorOutput;
  normalization_actions: readonly Readonly<Record<string, unknown>>[];
  rejected_values: readonly Readonly<Record<string, unknown>>[];
  warnings: readonly string[];
}>;

export type SummaryV2Dependencies = Readonly<{
  structuredLlm?: typeof callStructuredLlm;
  now?: () => Date;
  randomId?: () => string;
}>;

function defaultId(): string {
  return `summary_v2_${crypto.randomUUID()}`;
}

async function hash(value: unknown): Promise<string> {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function errorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/timeout/i.test(message)) return "timeout";
  if (/schema_validation_failed/i.test(message)) return "schema_validation_failed";
  if (/api_key_missing/i.test(message)) return "api_key_missing";
  if (/mock_provider/i.test(message)) return "provider_not_configured";
  if (/empty_structured_output/i.test(message)) return "empty_response";
  return "provider_or_internal_error";
}

async function envelope<T>(
  input: {
    stageId: string;
    stageVersion: string;
    executionId: string;
    input: unknown;
    status?: TechnicalEnvelope<T>["status"];
    decision?: TechnicalEnvelope<T>["decision"];
    score?: number | null;
    confidence?: number | null;
    output?: T | null;
    issues?: readonly string[];
    technicalError?: { code: string; message: string } | null;
    durationMs?: number;
    model?: string | null;
    promptVersion?: string | null;
    inputContract?: string;
    outputContract?: string;
    createdAt: string;
  },
): Promise<TechnicalEnvelope<T>> {
  return {
    stage_id: input.stageId,
    stage_version: input.stageVersion,
    execution_id: input.executionId,
    status: input.status ?? "SUCCESS",
    decision: input.decision ?? "PASS",
    score: input.score ?? null,
    confidence: input.confidence ?? null,
    input_hash: await hash(input.input),
    output: input.output ?? null,
    issues: input.issues ?? [],
    technical_error: input.technicalError ?? null,
    duration_ms: input.durationMs ?? 0,
    model: input.model ?? null,
    prompt_version: input.promptVersion ?? null,
    input_contract_version: input.inputContract ?? "summary-v2-input-v1",
    output_contract_version: input.outputContract ?? "summary-v2-output-v1",
    created_at: input.createdAt,
  };
}

async function technicalErrorEnvelope<T>(
  stageId: string,
  stageVersion: string,
  executionId: string,
  input: unknown,
  error: unknown,
  createdAt: string,
  promptVersion: string | null = null,
  model: string | null = null,
): Promise<TechnicalEnvelope<T>> {
  const message = error instanceof Error ? error.message : String(error);
  return envelope<T>({
    stageId,
    stageVersion,
    executionId,
    input,
    status: "TECHNICAL_ERROR",
    decision: "TECHNICAL_ERROR",
    score: null,
    confidence: null,
    output: null,
    issues: [],
    technicalError: { code: errorCode(error), message },
    createdAt,
    promptVersion,
    model,
  });
}

async function skippedEnvelope(stageId: string, executionId: string, input: unknown, createdAt: string, reason: string): Promise<TechnicalEnvelope<never>> {
  return envelope({
    stageId,
    stageVersion: "summary-v2-stage-v1",
    executionId,
    input,
    status: "SKIPPED",
    decision: "NOT_APPLICABLE",
    issues: [reason],
    createdAt,
  });
}

function speakerFromLabel(label: string): TranscriptTurn["speaker"] {
  if (/^(клиент|покупатель|собеседник)/i.test(label)) return "client";
  if (/^(агент|менеджер|риелтор)/i.test(label)) return "agent";
  if (/^оператор/i.test(label)) return "operator";
  return "unknown";
}

export function parseTranscriptTurns(transcript: string): TranscriptTurn[] {
  const lines = transcript.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.map((line, index) => {
    const match = line.match(/^([^:]{1,30}):\s*(.+)$/);
    return {
      turn_id: `turn-${index + 1}`,
      speaker: match ? speakerFromLabel(match[1].trim()) : "unknown",
      text: (match?.[2] ?? line).trim(),
    };
  });
}

export function transcriptGuard(transcript: string): TranscriptGuardOutput {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const trimmed = transcript.trim();
  if (!trimmed) blocking.push("transcript_empty");
  if (/^(ошибка (?:распознавания|stt)|transcription failed|нет транскрипции|fallback)$/i.test(trimmed)) blocking.push("stt_error_or_fallback");
  const damaged = (trimmed.match(/[�]{1,}|(?:\?\?\?)+/g) ?? []).join("").length;
  if (trimmed && damaged / trimmed.length > 0.2) blocking.push("critically_damaged_text");
  const turns = parseTranscriptTurns(trimmed);
  const stats = {
    client_utterances: turns.filter((turn) => turn.speaker === "client").length,
    agent_utterances: turns.filter((turn) => turn.speaker === "agent").length,
    operator_utterances: turns.filter((turn) => turn.speaker === "operator").length,
    unknown_utterances: turns.filter((turn) => turn.speaker === "unknown").length,
  };
  const meaningfulLength = turns.reduce((sum, turn) => sum + (turn.text.match(/[\p{L}\p{N}]/gu) ?? []).length, 0);
  if (meaningfulLength < 8 && trimmed) blocking.push("insufficient_semantic_content");
  const noConnection = /(?:не дозвонил|нет соединения|абонент недоступен|не отвечает)/i.test(trimmed);
  const operatorOnly = stats.operator_utterances > 0 && stats.client_utterances === 0 && stats.agent_utterances === 0;
  const short = turns.length <= 4 || meaningfulLength < 120;
  if (stats.client_utterances === 0 && !noConnection && !operatorOnly) warnings.push("client_role_not_explicit");
  const dialogueType = blocking.length ? "INVALID" : noConnection ? "NO_CONNECTION" : operatorOnly ? "OPERATOR_ONLY" : short ? "SHORT" : "FULL";
  return { is_processable: blocking.length === 0, dialogue_type: dialogueType, speaker_stats: stats, warnings, blocking_issues: blocking, turns };
}

export function normalizeMoneyAmount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function dedupeFacts(items: readonly Fact[]): Fact[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.category}:${item.value.trim().toLocaleLowerCase("ru")}:${item.evidence.map((evidence) => evidence.turn_id).join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeExtractorOutput(value: ExtractorOutput): NormalizationOutput {
  const actions: Record<string, unknown>[] = [];
  const rejected: Record<string, unknown>[] = [];
  const normalizeFacts = (path: string, facts: readonly Fact[]) => {
    const withEvidence = facts.filter((fact) => {
      if (fact.evidence.length > 0) return true;
      rejected.push({ field: path, value: fact, reason: "evidence_missing" });
      return false;
    });
    const result = dedupeFacts(withEvidence);
    if (result.length !== withEvidence.length) actions.push({ field: path, reason: "duplicates_removed", evidence_preserved: true });
    return result;
  };
  const budgetMin = normalizeMoneyAmount(value.financial_data.budget.amount_min);
  const budgetMax = normalizeMoneyAmount(value.financial_data.budget.amount_max);
  const downPayment = normalizeMoneyAmount(value.financial_data.down_payment.amount);
  if (value.financial_data.budget.amount_min !== budgetMin) rejected.push({ field: "financial_data.budget.amount_min", reason: "invalid_money_type" });
  if (value.financial_data.budget.amount_max !== budgetMax) rejected.push({ field: "financial_data.budget.amount_max", reason: "invalid_money_type" });
  if (value.financial_data.down_payment.amount !== downPayment) rejected.push({ field: "financial_data.down_payment.amount", reason: "invalid_money_type" });

  const nextStep = value.next_step.status !== "NOT_DEFINED" && value.next_step.evidence.length === 0
    ? (rejected.push({ field: "next_step", reason: "evidence_missing" }), NextStepSchema.parse({ status: "NOT_DEFINED", action: null, responsible: "NOT_DEFINED", deadline: null, channel: null, evidence: [] }))
    : value.next_step;

  const normalized: ExtractorOutput = {
    ...value,
    facts: normalizeFacts("facts", value.facts),
    requirements: normalizeFacts("requirements", value.requirements),
    objections: normalizeFacts("objections", value.objections),
    open_questions: normalizeFacts("open_questions", value.open_questions),
    agreements: normalizeFacts("agreements", value.agreements),
    next_step: nextStep,
    structured_attributes: {
      interested_in: [...new Set(value.structured_attributes.interested_in)],
      funding_source: value.structured_attributes.funding_source,
      purchase_timeline: value.structured_attributes.purchase_timeline,
    },
    financial_data: {
      ...value.financial_data,
      budget: { ...value.financial_data.budget, amount_min: budgetMin, amount_max: budgetMax },
      down_payment: { ...value.financial_data.down_payment, amount: downPayment },
    },
  };
  return { normalized_data: normalized, normalization_actions: actions, rejected_values: rejected, warnings: [] };
}

function verifierMap(verifier: VerifierOutput): Map<string, VerifierOutput["items"][number]> {
  return new Map(verifier.items.map((item) => [item.id, item]));
}

export function buildConversationStore(callId: string, normalized: ExtractorOutput, verifier: VerifierOutput, createdAt: string): ConversationStoreV2 {
  const verdicts = verifierMap(verifier);
  const verifiedOnly = (items: readonly Fact[]) => items.filter((item) => verdicts.get(item.id)?.verdict === "VERIFIED");
  const uncertain = verifier.items.filter((item) => item.verdict === "UNCERTAIN").map((item) => ({ id: item.id, reason: item.reason }));
  const rejected = verifier.items.filter((item) => item.verdict === "REJECTED").map((item) => ({ id: item.id, reason: item.reason }));
  const verifiedFacts = [
    ...verifiedOnly(normalized.facts),
    ...verifiedOnly(normalized.requirements),
    ...verifiedOnly(normalized.objections),
    ...verifiedOnly(normalized.open_questions),
    ...verifiedOnly(normalized.agreements),
  ];
  const evidenceIndex = Object.fromEntries(verifiedFacts.map((item) => [item.id, item.evidence]));
  const nextStep = verifier.next_step.verdict === "VERIFIED" && (normalized.next_step.status === "NOT_DEFINED" || normalized.next_step.evidence.length > 0)
    ? normalized.next_step
    : NextStepSchema.parse({ status: "NOT_DEFINED", action: null, responsible: "NOT_DEFINED", deadline: null, channel: null, evidence: [] });
  const outcome = verifier.outcome.verdict === "VERIFIED" && (normalized.call_outcome.type === "NO_CONNECTION" || normalized.call_outcome.evidence.length > 0)
    ? normalized.call_outcome
    : null;
  const fundingSource = verifier.structured_attributes.funding_source === "VERIFIED" ? normalized.structured_attributes.funding_source : "не определено";
  const purchaseTimeline = verifier.structured_attributes.purchase_timeline === "VERIFIED" ? normalized.structured_attributes.purchase_timeline : "не определено";
  const interestedIn = verifier.structured_attributes.interested_in === "VERIFIED" ? normalized.structured_attributes.interested_in : [];
  return ConversationStoreSchema.parse({
    schema_version: "summary-store-v2",
    call_id: callId,
    verified: {
      client_intent: normalized.client_intent.evidence.length ? normalized.client_intent : null,
      facts: verifiedOnly(normalized.facts),
      requirements: verifiedOnly(normalized.requirements),
      objections: verifiedOnly(normalized.objections),
      open_questions: verifiedOnly(normalized.open_questions),
      agreements: verifiedOnly(normalized.agreements),
      next_step: nextStep,
      call_outcome: outcome,
      structured_attributes: { interested_in: interestedIn, funding_source: fundingSource, purchase_timeline: purchaseTimeline },
      financial_data: {
        ...normalized.financial_data,
        funding_source: fundingSource === "не определено"
          ? { value: "не определено", evidence: [] }
          : normalized.financial_data.funding_source,
      },
    },
    uncertain,
    rejected,
    critical_information: normalized.critical_information,
    evidence_index: evidenceIndex,
    created_at: createdAt,
  });
}

export function renderSummary(summary: SummaryOutput): string {
  const sections = [`Итог разговора\n${summary.overview.trim()}`];
  if (summary.key_facts.length) sections.push(`Ключевые факты\n${summary.key_facts.map((item) => `• ${item.trim()}`).join("\n")}`);
  if (summary.quotes.length) sections.push(`Важная цитата\n${summary.quotes.map((item) => `• «${item.replace(/^«|»$/g, "").trim()}»`).join("\n")}`);
  if (summary.agreement_next_step?.trim()) sections.push(`Договорённости / следующий шаг\n${summary.agreement_next_step.trim()}`);
  return sections.join("\n\n");
}

export function qualityGate(judges: readonly TechnicalEnvelope<JudgeOutput>[], verifierIssues: readonly string[]) {
  const criterionScores = Object.fromEntries(JUDGE_CRITERIA.map((criterion) => [criterion, null])) as Record<string, number | null>;
  if (judges.some((judge) => judge.status !== "SUCCESS" || !judge.output)) {
    return { score: null, decision: "TECHNICAL_ERROR" as const, criterion_scores: criterionScores, critical_errors: [] as string[], warnings: ["Не все Judge завершились технически успешно."] };
  }
  for (const judge of judges) criterionScores[judge.output!.criterion] = judge.output!.score;
  const score = JUDGE_CRITERIA.reduce((sum, criterion) => sum + (criterionScores[criterion] ?? 0) * 0.2, 0);
  const allIssues = judges.flatMap((judge) => judge.output!.issues);
  const critical = allIssues.filter((issue) => issue.severity === "CRITICAL").map((issue) => issue.explanation);
  const major = allIssues.filter((issue) => issue.severity === "MAJOR");
  const minor = allIssues.filter((issue) => issue.severity === "MINOR").map((issue) => issue.explanation);
  const scores = Object.values(criterionScores) as number[];
  const allJudgesPassed = judges.every((judge) => judge.output?.decision === "PASS");
  let decision: "AUTO_SAVE" | "SAVE_WITH_WARNING" | "REVIEW_REQUIRED" = "REVIEW_REQUIRED";
  if (allJudgesPassed && score >= 95 && scores.every((value) => value >= 90) && critical.length === 0 && major.length === 0 && verifierIssues.length === 0) decision = "AUTO_SAVE";
  else if (allJudgesPassed && score >= 90 && score < 95 && scores.every((value) => value >= 80) && critical.length === 0 && major.length === 0 && verifierIssues.length === 0) decision = "SAVE_WITH_WARNING";
  return { score, decision, criterion_scores: criterionScores, critical_errors: critical, warnings: [...minor, ...verifierIssues] };
}

async function runLlmStage<T>(
  args: {
    stageId: string;
    stageVersion: string;
    executionId: string;
    input: unknown;
    prompt: string;
    promptVersion: string;
    schemaName: string;
    schema: Record<string, unknown>;
    validator: z.ZodType<T>;
    model: string;
    createdAt: string;
    llm: typeof callStructuredLlm;
  },
): Promise<TechnicalEnvelope<T>> {
  const started = performance.now();
  try {
    const result = await args.llm(args.prompt, args.schemaName, args.schema, args.validator, args.model);
    return envelope({
      stageId: args.stageId,
      stageVersion: args.stageVersion,
      executionId: args.executionId,
      input: args.input,
      output: result.data,
      durationMs: Math.max(result.durationMs, Math.round(performance.now() - started)),
      model: result.model,
      promptVersion: args.promptVersion,
      createdAt: args.createdAt,
    });
  } catch (error) {
    return technicalErrorEnvelope(args.stageId, args.stageVersion, args.executionId, args.input, error, args.createdAt, args.promptVersion, args.model);
  }
}

export async function executeSummaryPipelineV2(transcript: string, config: SummaryV2Config, dependencies: SummaryV2Dependencies = {}): Promise<SummaryV2Run> {
  const llm = dependencies.structuredLlm ?? callStructuredLlm;
  const now = dependencies.now ?? (() => new Date());
  const randomId = dependencies.randomId ?? defaultId;
  const runId = randomId();
  const startedAt = now().toISOString();
  const stages: TechnicalEnvelope<unknown>[] = [];

  const guardStarted = performance.now();
  const guardOutput = transcriptGuard(transcript);
  const guard = await envelope({
    stageId: "transcript_guard",
    stageVersion: "transcript-guard-v2",
    executionId: randomId(),
    input: { transcript },
    decision: guardOutput.is_processable ? "PASS" : "FAIL",
    output: guardOutput,
    issues: [...guardOutput.warnings, ...guardOutput.blocking_issues],
    durationMs: Math.round(performance.now() - guardStarted),
    createdAt: now().toISOString(),
  });
  stages.push(guard);

  if (!guardOutput.is_processable) {
    const remaining = ["call_intelligence_extractor", "deterministic_normalizer", "evidence_verifier", "conversation_store_v2", "summary_generator", ...JUDGE_CRITERIA.map((item) => `${item}_judge`), "quality_gate_v2", "crm_publish_v2"];
    for (const stageId of remaining) stages.push(await skippedEnvelope(stageId, randomId(), { upstream: "transcript_guard" }, now().toISOString(), "Transcript Guard вернул FAIL."));
    return {
      run_id: runId,
      product_id: SUMMARY_V2_PRODUCT_ID,
      pipeline_version: SUMMARY_V2_PIPELINE_VERSION,
      transcript_hash: await hash(transcript),
      config_hash: await hash(config),
      started_at: startedAt,
      finished_at: now().toISOString(),
      stages,
      summary: null,
      attributes: null,
      quality: { score: null, decision: "REVIEW_REQUIRED", criterion_scores: {}, critical_errors: guardOutput.blocking_issues, warnings: guardOutput.warnings },
      crm_publish: { status: "BLOCKED", payload: null, reason: "transcript_not_processable" },
    };
  }

  const transcriptWithTurns = guardOutput.turns.map((turn) => `${turn.turn_id} | ${turn.speaker}: ${turn.text}`).join("\n");
  const extractor = await runLlmStage({
    stageId: "call_intelligence_extractor",
    stageVersion: "call-intelligence-v2",
    executionId: randomId(),
    input: { transcript_hash: await hash(transcript) },
    prompt: extractorPrompt(transcriptWithTurns),
    promptVersion: PROMPT_VERSIONS.extractor,
    schemaName: "call_intelligence_v2",
    schema: EXTRACTOR_JSON_SCHEMA,
    validator: ExtractorOutputSchema,
    model: config.extractorModel,
    createdAt: now().toISOString(),
    llm,
  });
  stages.push(extractor);
  if (!extractor.output) return finishTechnicalFailure(runId, transcript, config, startedAt, stages, ["deterministic_normalizer", "evidence_verifier", "conversation_store_v2", "summary_generator", ...JUDGE_CRITERIA.map((item) => `${item}_judge`), "quality_gate_v2", "crm_publish_v2"], randomId, now);

  const normalizationStarted = performance.now();
  const normalized = normalizeExtractorOutput(extractor.output);
  const normalizer = await envelope({
    stageId: "deterministic_normalizer",
    stageVersion: "deterministic-normalizer-v2",
    executionId: randomId(),
    input: extractor.output,
    output: normalized,
    issues: normalized.warnings,
    durationMs: Math.round(performance.now() - normalizationStarted),
    createdAt: now().toISOString(),
  });
  stages.push(normalizer);

  let verifier = await runLlmStage({
    stageId: "evidence_verifier",
    stageVersion: "evidence-verifier-v2",
    executionId: randomId(),
    input: normalized.normalized_data,
    prompt: verifierPrompt(transcriptWithTurns, normalized.normalized_data),
    promptVersion: PROMPT_VERSIONS.verifier,
    schemaName: "evidence_verifier_v2",
    schema: VERIFIER_JSON_SCHEMA,
    validator: VerifierOutputSchema,
    model: config.verifierModel,
    createdAt: now().toISOString(),
    llm,
  });
  if (verifier.output) {
    const expectedIds = [
      ...normalized.normalized_data.facts,
      ...normalized.normalized_data.requirements,
      ...normalized.normalized_data.objections,
      ...normalized.normalized_data.open_questions,
      ...normalized.normalized_data.agreements,
    ].map((item) => item.id);
    const returnedIds = new Set(verifier.output.items.map((item) => item.id));
    const missingIds = expectedIds.filter((id) => !returnedIds.has(id));
    if (missingIds.length > 0) {
      verifier = await technicalErrorEnvelope(
        "evidence_verifier",
        "evidence-verifier-v2",
        verifier.execution_id,
        normalized.normalized_data,
        new Error(`schema_validation_failed: missing_verdicts:${missingIds.join(",")}`),
        now().toISOString(),
        PROMPT_VERSIONS.verifier,
        config.verifierModel,
      );
    }
  }
  stages.push(verifier);
  if (!verifier.output) return finishTechnicalFailure(runId, transcript, config, startedAt, stages, ["conversation_store_v2", "summary_generator", ...JUDGE_CRITERIA.map((item) => `${item}_judge`), "quality_gate_v2", "crm_publish_v2"], randomId, now);

  const storeStarted = performance.now();
  let store: ConversationStoreV2;
  try {
    store = buildConversationStore(runId, normalized.normalized_data, verifier.output, now().toISOString());
  } catch (error) {
    stages.push(await technicalErrorEnvelope("conversation_store_v2", "conversation-store-v2", randomId(), { normalized, verifier: verifier.output }, error, now().toISOString()));
    return finishTechnicalFailure(runId, transcript, config, startedAt, stages, ["summary_generator", ...JUDGE_CRITERIA.map((item) => `${item}_judge`), "quality_gate_v2", "crm_publish_v2"], randomId, now);
  }
  stages.push(await envelope({
    stageId: "conversation_store_v2",
    stageVersion: "conversation-store-v2",
    executionId: randomId(),
    input: { normalized: normalized.normalized_data, verifier: verifier.output },
    output: store,
    issues: verifier.output.issues,
    durationMs: Math.round(performance.now() - storeStarted),
    outputContract: "conversation-store-v2",
    createdAt: now().toISOString(),
  }));

  const generator = await runLlmStage({
    stageId: "summary_generator",
    stageVersion: "summary-generator-v2",
    executionId: randomId(),
    input: store,
    prompt: generatorPrompt(transcriptWithTurns, store),
    promptVersion: PROMPT_VERSIONS.generator,
    schemaName: "summary_generator_v2",
    schema: SUMMARY_JSON_SCHEMA,
    validator: SummaryOutputSchema,
    model: config.generatorModel,
    createdAt: now().toISOString(),
    llm,
  });
  stages.push(generator);
  if (!generator.output) return finishTechnicalFailure(runId, transcript, config, startedAt, stages, [...JUDGE_CRITERIA.map((item) => `${item}_judge`), "quality_gate_v2", "crm_publish_v2"], randomId, now);

  const judgeStages = await Promise.all(JUDGE_CRITERIA.map(async (criterion) => {
    const result = await runLlmStage({
      stageId: `${criterion}_judge`,
      stageVersion: "summary-quality-v2",
      executionId: randomId(),
      input: { store, summary: generator.output },
      prompt: judgePrompt(criterion, transcriptWithTurns, store, generator.output),
      promptVersion: PROMPT_VERSIONS[criterion],
      schemaName: `${criterion}_judge_v2`,
      schema: JUDGE_JSON_SCHEMA,
      validator: JudgeOutputSchema,
      model: config.judgeModel,
      createdAt: now().toISOString(),
      llm,
    });
    if (result.output && result.output.criterion !== criterion) {
      return technicalErrorEnvelope<JudgeOutput>(`${criterion}_judge`, "summary-quality-v2", result.execution_id, { store, summary: generator.output }, new Error("schema_validation_failed: criterion_mismatch"), now().toISOString(), PROMPT_VERSIONS[criterion], config.judgeModel);
    }
    if (!result.output) return result;
    return { ...result, decision: result.output.decision, score: result.output.score, confidence: result.output.confidence, issues: result.output.issues.map((issue) => issue.explanation) };
  }));
  stages.push(...judgeStages);

  const gateStarted = performance.now();
  const gate = qualityGate(judgeStages, verifier.output.issues);
  stages.push(await envelope({
    stageId: "quality_gate_v2",
    stageVersion: "summary-quality-v2",
    executionId: randomId(),
    input: judgeStages.map((judge) => judge.output),
    status: gate.decision === "TECHNICAL_ERROR" ? "TECHNICAL_ERROR" : "SUCCESS",
    decision: gate.decision === "TECHNICAL_ERROR" ? "TECHNICAL_ERROR" : gate.decision === "REVIEW_REQUIRED" ? "REVIEW_REQUIRED" : "PASS",
    score: gate.score,
    output: gate,
    issues: [...gate.critical_errors, ...gate.warnings],
    technicalError: gate.decision === "TECHNICAL_ERROR" ? { code: "judge_technical_error", message: "Хотя бы один Judge завершился технической ошибкой." } : null,
    durationMs: Math.round(performance.now() - gateStarted),
    createdAt: now().toISOString(),
  }));

  const summaryText = renderSummary(generator.output);
  const attributes = store.verified.structured_attributes;
  const publishAllowed = gate.decision === "AUTO_SAVE" || gate.decision === "SAVE_WITH_WARNING";
  const publishPayload = publishAllowed ? { summary: summaryText, attributes, quality: { score: gate.score, decision: gate.decision, criterion_scores: gate.criterion_scores } } : null;
  const crmPublish = {
    status: gate.decision === "AUTO_SAVE" ? "PUBLISHED" as const : gate.decision === "SAVE_WITH_WARNING" ? "PUBLISHED_WITH_WARNING" as const : "BLOCKED" as const,
    payload: publishPayload,
    reason: publishAllowed ? null : gate.decision === "TECHNICAL_ERROR" ? "technical_error" : "review_required",
  };
  stages.push(await envelope({
    stageId: "crm_publish_v2",
    stageVersion: "crm-publish-v2",
    executionId: randomId(),
    input: { gate, summary: summaryText, attributes },
    decision: publishAllowed ? "PASS" : gate.decision === "TECHNICAL_ERROR" ? "TECHNICAL_ERROR" : "REVIEW_REQUIRED",
    status: gate.decision === "TECHNICAL_ERROR" ? "SKIPPED" : "SUCCESS",
    output: crmPublish,
    issues: crmPublish.reason ? [crmPublish.reason] : [],
    createdAt: now().toISOString(),
  }));

  return {
    run_id: runId,
    product_id: SUMMARY_V2_PRODUCT_ID,
    pipeline_version: SUMMARY_V2_PIPELINE_VERSION,
    transcript_hash: await hash(transcript),
    config_hash: await hash(config),
    started_at: startedAt,
    finished_at: now().toISOString(),
    stages,
    summary: summaryText,
    attributes,
    quality: gate,
    crm_publish: crmPublish,
  };
}

async function finishTechnicalFailure(
  runId: string,
  transcript: string,
  config: SummaryV2Config,
  startedAt: string,
  stages: TechnicalEnvelope<unknown>[],
  remaining: readonly string[],
  randomId: () => string,
  now: () => Date,
): Promise<SummaryV2Run> {
  for (const stageId of remaining) stages.push(await skippedEnvelope(stageId, randomId(), { upstream_failure: true }, now().toISOString(), "Обязательный предыдущий этап завершился TECHNICAL_ERROR."));
  return {
    run_id: runId,
    product_id: SUMMARY_V2_PRODUCT_ID,
    pipeline_version: SUMMARY_V2_PIPELINE_VERSION,
    transcript_hash: await hash(transcript),
    config_hash: await hash(config),
    started_at: startedAt,
    finished_at: now().toISOString(),
    stages,
    summary: null,
    attributes: null,
    quality: { score: null, decision: "TECHNICAL_ERROR", criterion_scores: {}, critical_errors: [], warnings: ["Обязательный этап завершился технической ошибкой."] },
    crm_publish: { status: "BLOCKED", payload: null, reason: "technical_error" },
  };
}
