/**
 * Dedicated test bench for the "Генерация текстов объявлений" demo
 * product -- built because the generic Playground "Запустить Pipeline"
 * (domain Pipeline + Production Pipeline Runtime, `executePipeline`)
 * only ever calls the Mock LLM Provider, which returns
 * `{mock, model, echo, confidence}` regardless of what a prompt asked
 * for -- never a real ad. This module runs the exact same 9-stage
 * design for real: real Zod validation, real deterministic
 * normalization/quality checks, and real BYOK model calls (via
 * `browser-direct-provider.ts`, the same Anthropic/OpenAI keys
 * configured in Настройки that Pipeline Lab v3 already uses), with a
 * genuine confidence-gated retry loop -- something the domain
 * Pipeline's DAG-based executor cannot do at all (no cycles allowed,
 * `topology.ts`'s `topologicalOrder` throws `CyclicPipelineError`).
 *
 * Reused, not duplicated: the real seeded prompts (`seed-prompts.ts`),
 * the real Zod schemas (`src/shared/model/ad-copy-*.ts`), and the real
 * BYOK call path (`browser-direct-provider.ts`) -- only the
 * orchestration (stage sequencing, retry loop, live progress
 * reporting) is new, because no existing engine in this repository can
 * do a real confidence-gated retry loop over real model calls.
 */

import { AdCopyBenefitsSchema, type AdCopyBenefits } from "@/shared/model/ad-copy-benefits";
import { AdCopyCrmInputSchema, type AdCopyCrmInput } from "@/shared/model/ad-copy-crm-input";
import { AdCopySchema, type AdCopy } from "@/shared/model/ad-copy-output";
import { AdCopyQualityCheckSchema, type AdCopyQualityCheck } from "@/shared/model/ad-copy-quality-check";
import { callConfiguredLlm, parseJsonResponse } from "@/shared/llm/browser-direct-provider";
import { seededPromptRegistry } from "@/shared/prompts/seed-prompts";

export type AdCopyStageId = "validate" | "normalize" | "benefits" | "storage" | "generate" | "check" | "quality" | "gate" | "saveAd" | "saveCrm";
export type AdCopyStageStatus = "idle" | "running" | "succeeded" | "failed" | "skipped";
export type AdCopyStageGroup = "code" | "llm" | "storage" | "service";

export type AdCopyChecklistItem = Readonly<{ label: string; pass: boolean }>;
export type AdCopyStageMetric = Readonly<{ label: string; value: string }>;

export type AdCopyStageResult = Readonly<{
  id: AdCopyStageId;
  status: AdCopyStageStatus;
  startedAt?: string;
  durationMs?: number;
  attempt?: number;
  input?: unknown;
  output?: unknown;
  error?: string;
  checklist?: readonly AdCopyChecklistItem[];
  metrics?: readonly AdCopyStageMetric[];
}>;

export type AdCopyStageDefinition = Readonly<{ id: AdCopyStageId; number: number; name: string; group: AdCopyStageGroup; description: string }>;

export const AD_COPY_STAGE_DEFINITIONS: readonly AdCopyStageDefinition[] = [
  { id: "validate", number: 1, name: "Валидация входных данных", group: "code", description: "Проверка полноты и корректности данных CRM (обязательные поля, типы, диапазоны)." },
  { id: "normalize", number: 2, name: "Подготовка структуры объекта", group: "code", description: "Нормализация и очистка данных CRM: удаление HTML, объединение полей." },
  { id: "benefits", number: 3, name: "Агент извлечения преимуществ", group: "llm", description: "Анализ объекта как опытный риелтор: преимущества, УТП, целевая аудитория." },
  { id: "storage", number: 4, name: "Единое хранилище", group: "storage", description: "Единое JSON-хранилище данных для всех последующих этапов." },
  { id: "generate", number: 5, name: "Генерация объявления", group: "llm", description: "Генерация продающего текста объявления: заголовок, описание, CTA." },
  { id: "check", number: 6, name: "Проверка объявления", group: "llm", description: "Самопроверка и улучшение качества текста." },
  { id: "quality", number: 7, name: "Контур качества", group: "code", description: "Проверка структуры, обязательных данных, требований площадок и расчёт Confidence Score." },
  { id: "gate", number: 8, name: "Quality Gate", group: "code", description: "Confidence >= 90% -> сохранить, иначе повторная генерация (максимум 2 попытки)." },
  { id: "saveAd", number: 9, name: "Сохранение объявления", group: "service", description: "Сохранение финального объявления и метаданных (модель, версия промпта, дата)." },
  { id: "saveCrm", number: 10, name: "Сохранение в CRM и публикация", group: "service", description: "Запись в CRM и отправка на публикацию." },
];

export type AdCopyFinalRecord = Readonly<{
  title: string;
  description: string;
  cta: string;
  confidenceScore: number;
  model: string;
  promptVersion: string;
  generatedAt: string;
  lowConfidence: boolean;
  retryCount: number;
}>;

export type AdCopyRunResult = Readonly<{
  stages: readonly AdCopyStageResult[];
  success: boolean;
  finalRecord?: AdCopyFinalRecord;
  totalTokensEstimate: number;
  totalCostUsd: number;
  totalDurationMs: number;
}>;

const CONFIDENCE_THRESHOLD = 90;
const MAX_RETRIES = 2;

// Same rates public/pipeline-lab-v3.html's own COST_PER_1K_TOKENS uses for
// these exact model names -- an estimate for display, not real vendor billing.
const COST_PER_1K_TOKENS: Record<string, number> = { "gpt-5-mini": 0.0006, "claude-sonnet-4-6": 0.006 };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}

function estimateCost(model: string, tokens: number): number {
  const rate = COST_PER_1K_TOKENS[model] ?? 0.001;
  return (tokens / 1000) * rate;
}

function toTemplateVariables(record: Record<string, unknown>): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) continue;
    variables[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return variables;
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Stage 1: real Zod validation (no LLM, no fabricated errors) ──
function runValidateStage(rawInput: string): Readonly<{ data?: AdCopyCrmInput; errors?: readonly string[] }> {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawInput);
  } catch (error) {
    return { errors: [`Некорректный JSON: ${errorMessage(error)}`] };
  }
  const result = AdCopyCrmInputSchema.safeParse(parsedJson);
  if (!result.success) {
    return { errors: result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`) };
  }
  return { data: result.data };
}

// ── Stage 2: real deterministic normalization ──
function runNormalizeStage(data: AdCopyCrmInput): AdCopyCrmInput {
  return {
    ...data,
    object_type: data.object_type.trim(),
    city: data.city.trim(),
    district: data.district?.trim(),
    street: data.street?.trim(),
    description: data.description ? stripHtml(data.description) : data.description,
  };
}

type LlmCallOutcome<T> = Readonly<{ data?: T; raw: string; vendor: string; model: string; tokens: number; costUsd: number }>;

async function callLlmStage<T>(prompt: string, schema: { safeParse: (value: unknown) => { success: boolean; data?: T } }): Promise<LlmCallOutcome<T>> {
  const { text, vendor, model } = await callConfiguredLlm(prompt);
  const tokens = estimateTokens(prompt) + estimateTokens(text);
  const costUsd = estimateCost(model, tokens);
  let data: T | undefined;
  try {
    const parsed = parseJsonResponse<unknown>(text);
    const result = schema.safeParse(parsed);
    data = result.success ? result.data : undefined;
  } catch {
    data = undefined;
  }
  return { data, raw: text, vendor, model, tokens, costUsd };
}

// ── Stage 3: real LLM call (Benefit Extraction Agent) ──
async function runBenefitsStage(normalized: AdCopyCrmInput): Promise<LlmCallOutcome<AdCopyBenefits>> {
  const prompt = seededPromptRegistry.render("prompt_ad_benefits", toTemplateVariables(normalized));
  return callLlmStage(prompt, AdCopyBenefitsSchema);
}

// ── Stage 5: real LLM call (Ad Generation Agent) ──
async function runGenerateStage(normalized: AdCopyCrmInput, benefits: AdCopyBenefits): Promise<LlmCallOutcome<AdCopy>> {
  const variables = { ...toTemplateVariables(normalized), value: JSON.stringify(benefits) };
  const prompt = seededPromptRegistry.render("prompt_ad_generation", variables);
  return callLlmStage(prompt, AdCopySchema);
}

// ── Stage 6: real LLM call (Self-Check Agent) ──
async function runCheckStage(normalized: AdCopyCrmInput, benefits: AdCopyBenefits, ad: AdCopy): Promise<LlmCallOutcome<AdCopyQualityCheck>> {
  const variables = {
    city: normalized.city,
    district: normalized.district ?? "не указан",
    rooms: String(normalized.rooms),
    area: String(normalized.area),
    price: String(normalized.price),
    value: JSON.stringify({ ...ad, advantages: benefits.advantages }),
  };
  const prompt = seededPromptRegistry.render("prompt_ad_checker", variables);
  return callLlmStage(prompt, AdCopyQualityCheckSchema);
}

// ── Stage 7: real deterministic quality circuit (4 checks, each shown separately) ──
function runQualityCircuit(normalized: AdCopyCrmInput, checked: AdCopyQualityCheck): Readonly<{ checklist: readonly AdCopyChecklistItem[]; confidenceScore: number }> {
  const structureOk = Boolean(checked.title?.trim() && checked.description?.trim() && checked.cta?.trim());
  const requiredDataOk = [normalized.price, normalized.area, normalized.rooms, normalized.object_type].every((value) => value !== undefined && value !== null && value !== "");
  const withinLength = checked.title.length <= 70 && checked.description.length <= 600;
  const noForbiddenChars = !/[<>{}]/.test(`${checked.title}${checked.description}`);
  const platformOk = withinLength && noForbiddenChars;

  const booleanChecks = [checked.facts_ok, checked.style_ok, checked.language_ok, checked.prohibited_words_ok, checked.seo_ok, checked.duplicates_ok];
  const checksScore = (booleanChecks.filter(Boolean).length / booleanChecks.length) * 100;
  const structureScore = structureOk ? 100 : 40;
  const requiredDataScore = requiredDataOk ? 100 : 50;
  const platformScore = platformOk ? 100 : 60;
  const rawScore = 0.35 * checksScore + 0.15 * checked.readability_score + 0.2 * structureScore + 0.15 * requiredDataScore + 0.15 * platformScore;
  const confidenceScore = Math.round(Math.max(0, Math.min(100, rawScore)));

  const checklist: AdCopyChecklistItem[] = [
    { label: "Проверка структуры (заголовок/описание/CTA)", pass: structureOk },
    { label: "Проверка обязательных данных (цена/площадь/комнатность/тип)", pass: requiredDataOk },
    { label: "Проверка требований площадок (длина, запрещённые символы)", pass: platformOk },
    { label: `Оценка уверенности: Confidence Score ${confidenceScore}%`, pass: confidenceScore >= CONFIDENCE_THRESHOLD },
  ];
  return { checklist, confidenceScore };
}

export async function runAdCopyTestBench(rawInput: string, onUpdate: (stages: readonly AdCopyStageResult[]) => void): Promise<AdCopyRunResult> {
  const startAll = Date.now();
  let stages: AdCopyStageResult[] = AD_COPY_STAGE_DEFINITIONS.map((def) => ({ id: def.id, status: "idle" as AdCopyStageStatus }));
  let totalTokens = 0;
  let totalCostUsd = 0;

  const emit = () => onUpdate(stages);
  const setStage = (id: AdCopyStageId, patch: Partial<AdCopyStageResult>) => {
    stages = stages.map((stage) => (stage.id === id ? { ...stage, ...patch } : stage));
    emit();
  };
  const startStage = (id: AdCopyStageId, input?: unknown, attempt?: number): number => {
    setStage(id, { status: "running", startedAt: new Date().toISOString(), input, attempt });
    return Date.now();
  };
  const failRun = (remaining: readonly AdCopyStageId[]): AdCopyRunResult => {
    for (const id of remaining) setStage(id, { status: "skipped" });
    return { stages, success: false, totalTokensEstimate: Math.round(totalTokens), totalCostUsd, totalDurationMs: Date.now() - startAll };
  };
  const remainingAfter = (id: AdCopyStageId): AdCopyStageId[] => {
    const index = AD_COPY_STAGE_DEFINITIONS.findIndex((def) => def.id === id);
    return AD_COPY_STAGE_DEFINITIONS.slice(index + 1).map((def) => def.id);
  };

  emit();

  // 1. Validate
  let startedMs = startStage("validate", rawInput);
  const validation = runValidateStage(rawInput);
  if (!validation.data) {
    setStage("validate", { status: "failed", error: validation.errors?.join("; "), durationMs: Date.now() - startedMs });
    return failRun(remainingAfter("validate"));
  }
  setStage("validate", { status: "succeeded", output: validation.data, durationMs: Date.now() - startedMs });

  // 2. Normalize
  startedMs = startStage("normalize", validation.data);
  const normalized = runNormalizeStage(validation.data);
  setStage("normalize", { status: "succeeded", output: normalized, durationMs: Date.now() - startedMs });

  // 3. Benefits (LLM)
  startedMs = startStage("benefits", normalized);
  let benefitsOutcome: LlmCallOutcome<AdCopyBenefits>;
  try {
    benefitsOutcome = await runBenefitsStage(normalized);
  } catch (error) {
    setStage("benefits", { status: "failed", error: errorMessage(error), durationMs: Date.now() - startedMs });
    return failRun(remainingAfter("benefits"));
  }
  totalTokens += benefitsOutcome.tokens;
  totalCostUsd += benefitsOutcome.costUsd;
  setStage("benefits", {
    status: benefitsOutcome.data ? "succeeded" : "failed",
    output: benefitsOutcome.data ?? benefitsOutcome.raw,
    error: benefitsOutcome.data ? undefined : "Модель вернула ответ, не соответствующий ожидаемой JSON Schema преимуществ.",
    metrics: [
      { label: "Модель", value: `${benefitsOutcome.vendor}/${benefitsOutcome.model}` },
      { label: "Токены (оценка)", value: String(Math.round(benefitsOutcome.tokens)) },
      { label: "Стоимость (оценка)", value: `$${benefitsOutcome.costUsd.toFixed(4)}` },
    ],
    durationMs: Date.now() - startedMs,
  });
  if (!benefitsOutcome.data) return failRun(remainingAfter("benefits"));
  const benefits = benefitsOutcome.data;

  // 4. Storage (real merge, not a passthrough)
  startedMs = startStage("storage", { normalized, benefits });
  const storedContext = { ...normalized, ...benefits };
  setStage("storage", { status: "succeeded", output: storedContext, durationMs: Date.now() - startedMs });

  // 5-8. Generate -> Check -> Quality -> Gate, real confidence-gated retry loop
  let attempt = 0;
  let finalAd: AdCopy | undefined;
  let finalCheck: AdCopyQualityCheck | undefined;
  let confidenceScore = 0;
  let usedVendor = "";
  let usedModel = "";
  let gatePassed = false;

  while (attempt <= MAX_RETRIES) {
    attempt += 1;

    startedMs = startStage("generate", storedContext, attempt);
    let generateOutcome: LlmCallOutcome<AdCopy>;
    try {
      generateOutcome = await runGenerateStage(normalized, benefits);
    } catch (error) {
      setStage("generate", { status: "failed", error: errorMessage(error), attempt, durationMs: Date.now() - startedMs });
      return failRun(remainingAfter("generate"));
    }
    totalTokens += generateOutcome.tokens;
    totalCostUsd += generateOutcome.costUsd;
    setStage("generate", {
      status: generateOutcome.data ? "succeeded" : "failed",
      output: generateOutcome.data ?? generateOutcome.raw,
      error: generateOutcome.data ? undefined : "Модель вернула ответ, не соответствующий ожидаемой JSON Schema объявления.",
      metrics: [
        { label: "Модель", value: `${generateOutcome.vendor}/${generateOutcome.model}` },
        { label: "Токены (оценка)", value: String(Math.round(generateOutcome.tokens)) },
        { label: "Стоимость (оценка)", value: `$${generateOutcome.costUsd.toFixed(4)}` },
      ],
      attempt,
      durationMs: Date.now() - startedMs,
    });
    if (!generateOutcome.data) return failRun(remainingAfter("generate"));
    usedVendor = generateOutcome.vendor;
    usedModel = generateOutcome.model;

    startedMs = startStage("check", generateOutcome.data, attempt);
    let checkOutcome: LlmCallOutcome<AdCopyQualityCheck>;
    try {
      checkOutcome = await runCheckStage(normalized, benefits, generateOutcome.data);
    } catch (error) {
      setStage("check", { status: "failed", error: errorMessage(error), attempt, durationMs: Date.now() - startedMs });
      return failRun(remainingAfter("check"));
    }
    totalTokens += checkOutcome.tokens;
    totalCostUsd += checkOutcome.costUsd;
    if (!checkOutcome.data) {
      setStage("check", { status: "failed", output: checkOutcome.raw, error: "Модель вернула ответ, не соответствующий ожидаемой JSON Schema проверки.", attempt, durationMs: Date.now() - startedMs });
      return failRun(remainingAfter("check"));
    }
    setStage("check", {
      status: "succeeded",
      output: checkOutcome.data,
      metrics: [
        { label: "Модель", value: `${checkOutcome.vendor}/${checkOutcome.model}` },
        { label: "Токены (оценка)", value: String(Math.round(checkOutcome.tokens)) },
        { label: "Стоимость (оценка)", value: `$${checkOutcome.costUsd.toFixed(4)}` },
      ],
      attempt,
      durationMs: Date.now() - startedMs,
    });

    startedMs = startStage("quality", checkOutcome.data, attempt);
    const circuit = runQualityCircuit(normalized, checkOutcome.data);
    confidenceScore = circuit.confidenceScore;
    setStage("quality", { status: "succeeded", output: { confidenceScore }, checklist: circuit.checklist, attempt, durationMs: Date.now() - startedMs });

    startedMs = startStage("gate", { confidenceScore }, attempt);
    gatePassed = confidenceScore >= CONFIDENCE_THRESHOLD;
    const willRetry = !gatePassed && attempt <= MAX_RETRIES;
    setStage("gate", {
      status: "succeeded",
      output: { decision: gatePassed ? "SAVE" : willRetry ? "RETRY" : "SAVE_LOW_CONFIDENCE", confidenceScore, attempt },
      metrics: [{ label: "Решение", value: gatePassed ? "Сохранить" : willRetry ? `Повторная генерация (попытка ${attempt + 1})` : "Сохранить с пометкой low-confidence" }],
      attempt,
      durationMs: Date.now() - startedMs,
    });

    finalAd = generateOutcome.data;
    finalCheck = checkOutcome.data;

    if (gatePassed || attempt > MAX_RETRIES) break;
  }

  // 9. Save Ad
  startedMs = startStage("saveAd", { ad: finalAd, confidenceScore });
  const finalRecord: AdCopyFinalRecord = {
    title: finalCheck?.title ?? finalAd?.title ?? "",
    description: finalCheck?.description ?? finalAd?.description ?? "",
    cta: finalCheck?.cta ?? finalAd?.cta ?? "",
    confidenceScore,
    model: usedVendor && usedModel ? `${usedVendor}/${usedModel}` : "неизвестно",
    promptVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    lowConfidence: !gatePassed,
    retryCount: attempt - 1,
  };
  setStage("saveAd", { status: "succeeded", output: finalRecord, durationMs: Date.now() - startedMs });

  // 10. Save to CRM + publish (no real CRM integration exists, per §10 SB-1 / real-stage.ts's own "no-real-tool-integration" precedent)
  startedMs = startStage("saveCrm", finalRecord);
  const crmResult = {
    savedToCrm: true,
    note: "Симуляция записи в CRM — реальной интеграции с внешней CRM в этом MVP нет.",
    publishedPlatform: normalized.generation_settings?.platform ?? "не указана",
  };
  setStage("saveCrm", { status: "succeeded", output: crmResult, durationMs: Date.now() - startedMs });

  return { stages, success: true, finalRecord, totalTokensEstimate: Math.round(totalTokens), totalCostUsd, totalDurationMs: Date.now() - startAll };
}
