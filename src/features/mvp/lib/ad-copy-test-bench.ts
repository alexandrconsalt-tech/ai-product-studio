/**
 * Editable, ctx-based test bench engine for "Генерация текстов
 * объявлений" -- matches Pipeline Lab v3's own format (the same 5 stage
 * types `svc`/`llm`/`check`/`code`/`store`, the same `{{ctx.KEY}}`
 * template convention, the same editable Название/Тип/Модель/Промт/
 * Код-функция/Ключ результата fields per stage, and the same "run
 * every enabled stage in order, never hard-abort on one stage's
 * failure" behavior).
 *
 * Single data contract (2026-07-06 audit). Every stage reads and writes
 * exactly one shape end to end -- there is deliberately no second,
 * parallel `crm_data`/`crm_fields`/`property_data` structure anywhere:
 *   1. `ctx.validated`  -- the platform's raw `{property, user_settings}`
 *      input, Zod-validated (`AdCopyPipelineInputSchema`).
 *   2. `ctx.normalized` -- the same shape, text-cleaned. Every stage
 *      from here on reads `ctx.normalized`, never the raw input.
 *   3. `ctx.benefits`   -- `AdCopyBenefitsSchema` (advantages/usp/
 *      strengths/selling_points/target_audience), derived from
 *      `ctx.normalized` alone.
 *   4. `ctx.stored`     -- the single record `{property, user_settings,
 *      advantages, strengths, selling_points, usp, target_audience}`
 *      the Generation/Checker stages actually read from.
 *   5. `ctx.ad` / `ctx.checked` -- `AdCopySchema`/`AdCopyQualityCheckSchema`
 *      (`{title, description, cta}`, the Checker's version adding its
 *      own pass/fail fields) -- never `advantages` again at this point.
 *
 * The three built-in `llm`/`check` stages (`benefits`/`generate`/
 * `check`) additionally validate their own JSON response against the
 * matching Zod schema (`STAGE_OUTPUT_SCHEMAS`) before it's written to
 * `ctx` -- a shape mismatch (e.g. a misconfigured prompt returning
 * `advantages` instead of `title`/`description`/`cta`) is reported as a
 * real "bad" status with the exact Zod issues, not silently accepted.
 *
 * What's real, not decorative: the deterministic `codeFn`
 * implementations (validate/normalize/storage/quality/gate/saveAd/
 * saveCrm) are this product's actual business logic (real Zod
 * validation, a real weighted Confidence Score, real HTML stripping),
 * and the Quality Gate drives a genuine confidence-gated retry loop
 * (re-running the stages between the last `store`-type stage and the
 * `gate` stage up to 2 extra times when confidence < 90%).
 */

import { z } from "zod";
import { AdCopyPipelineInputSchema, type AdCopyPipelineInput, type AdCopyProperty, type AdCopyUserSettings } from "@/shared/model/ad-copy-crm-input";
import { AdCopyBenefitsSchema, type AdCopyBenefits } from "@/shared/model/ad-copy-benefits";
import { AdCopySchema } from "@/shared/model/ad-copy-output";
import { AdCopyQualityCheckSchema } from "@/shared/model/ad-copy-quality-check";
import { callModelByName, loadAnthropicApiKey, loadOpenAiApiKey, MODEL_VENDOR, parseJsonResponse } from "@/shared/llm/browser-direct-provider";
import type { StoredFileContext } from "@/shared/lib/input-file-storage";

export type AdCopyStageType = "svc" | "llm" | "check" | "code" | "store";

export const AD_COPY_TYPE_LABELS: Record<AdCopyStageType, string> = {
  svc: "Сервис",
  llm: "LLM-агент",
  check: "Проверщик",
  code: "Код",
  store: "Хранилище",
};

/** Same per-type accent colors as public/pipeline-lab-v3.html's own TYPE_META (svc/llm/check/code/store), kept in sync by hex value so both surfaces read as one visual system. */
export const AD_COPY_TYPE_COLORS: Record<AdCopyStageType, Readonly<{ color: string; bg: string; border: string }>> = {
  svc: { color: "#38bdf8", bg: "rgba(56,189,248,.12)", border: "rgba(56,189,248,.4)" },
  llm: { color: "#34d399", bg: "rgba(52,211,153,.12)", border: "rgba(52,211,153,.4)" },
  check: { color: "#a78bfa", bg: "rgba(167,139,250,.12)", border: "rgba(167,139,250,.4)" },
  code: { color: "#f59e0b", bg: "rgba(245,158,11,.12)", border: "rgba(245,158,11,.4)" },
  store: { color: "#fb7185", bg: "rgba(251,113,133,.12)", border: "rgba(251,113,133,.4)" },
};

export const AD_COPY_CODE_FN_LIST = ["validate", "normalize", "storage", "quality", "gate", "saveAd", "saveCrm"] as const;
export type AdCopyCodeFn = (typeof AD_COPY_CODE_FN_LIST)[number];

export type AdCopyStageConfig = Readonly<{
  id: string;
  enabled: boolean;
  name: string;
  type: AdCopyStageType;
  codeFn?: string;
  vendor?: string;
  model?: string;
  prompt?: string;
  outKey: string;
}>;

export type AdCopyCheckItem = Readonly<{ label: string; pass: boolean; warn?: boolean }>;
export type AdCopyMetricItem = Readonly<{ label: string; value: string }>;
export type AdCopyStageStatus = "idle" | "running" | "ok" | "warn" | "bad";

export type AdCopyStageReport = Readonly<{
  stageId: string;
  status: AdCopyStageStatus;
  attempt?: number;
  output?: unknown;
  checks?: readonly AdCopyCheckItem[];
  metrics?: readonly AdCopyMetricItem[];
  error?: string;
  durationMs?: number;
}>;

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

export type AdCopyPipelineResult = Readonly<{
  reports: Readonly<Record<string, AdCopyStageReport>>;
  ctx: Readonly<Record<string, unknown>>;
  totalTokensEstimate: number;
  totalCostUsd: number;
  totalDurationMs: number;
  finalRecord?: AdCopyFinalRecord;
}>;

const CONFIDENCE_THRESHOLD = 90;
const MAX_ATTEMPTS = 3;

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
  return (tokens / 1000) * (COST_PER_1K_TOKENS[model] ?? 0.001);
}
function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}
function cleanValue(value: unknown): unknown {
  if (typeof value === "string") return stripHtml(value);
  if (Array.isArray(value)) return value.map(cleanValue);
  return value;
}

/** Same `{{expr}}` replacement Pipeline Lab v3's own `tmpl()` does, generalized to a `{crm, ctx}` root instead of a single special-cased `transcript`. */
export function tmpl(str: string, root: Readonly<{ crm: unknown; ctx: unknown }>): string {
  return str.replace(/\{\{([^}]+)\}\}/g, (_, expr: string) => {
    const path = expr.trim().split(".");
    let value: unknown = root;
    for (const segment of path) {
      value = value == null ? undefined : (value as Record<string, unknown>)[segment];
    }
    if (value === undefined) return "";
    return typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
  });
}

/**
 * `benefits`/`generate`/`check` are this pipeline's three built-in
 * `llm`/`check` stages -- their JSON response is validated against the
 * exact contract each one is supposed to produce, keyed by stage `id`.
 * A custom stage a user adds has no entry here and is never subject to
 * this check (freeform by design, same as Pipeline Lab v3 itself).
 */
const STAGE_OUTPUT_SCHEMAS: Partial<Record<string, z.ZodTypeAny>> = {
  benefits: AdCopyBenefitsSchema,
  generate: AdCopySchema,
  check: AdCopyQualityCheckSchema,
};

/**
 * If a stage's configured model's vendor key isn't set but the *other*
 * vendor's is, fall back to that vendor's default model instead of
 * failing the whole stage -- e.g. the Checker defaults to Claude
 * Sonnet 4.6, but a user who only configured an OpenAI key should still
 * get a real (if same-vendor) self-check rather than a hard error.
 * Falls through unchanged when neither key is configured (that's a
 * genuine "no model available at all" case, not something to paper
 * over) or when the requested vendor's key is already present.
 */
function resolveAvailableModel(preferredModel: string): Readonly<{ model: string; fallbackNote?: string }> {
  const vendor = MODEL_VENDOR[preferredModel] ?? "anthropic";
  const anthropicReady = Boolean(loadAnthropicApiKey());
  const openAiReady = Boolean(loadOpenAiApiKey());
  if (vendor === "anthropic" && !anthropicReady && openAiReady) {
    return { model: "gpt-5-mini", fallbackNote: "(авто-переключение на GPT — ключ Anthropic не задан)" };
  }
  if (vendor === "openai" && !openAiReady && anthropicReady) {
    return { model: "claude-sonnet-4-6", fallbackNote: "(авто-переключение на Claude — ключ OpenAI не задан)" };
  }
  return { model: preferredModel };
}

// ── Real, deterministic code-function implementations ──
type CodeFnInput = Readonly<{ crm: Record<string, unknown>; ctx: Record<string, unknown>; rawInput: string }>;
type CodeFnMeta = Readonly<{ attempt: number; maxAttempts: number; lastModelUsed: string }>;
type CodeFnResult = Readonly<{ output: unknown; checks?: readonly AdCopyCheckItem[]; metrics?: readonly AdCopyMetricItem[]; status: "ok" | "warn" | "bad" }>;

function fnValidate({ rawInput }: CodeFnInput): CodeFnResult {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawInput);
  } catch (error) {
    return { output: undefined, status: "bad", checks: [{ label: `Валидный JSON: ${errorMessage(error)}`, pass: false }] };
  }
  const result = AdCopyPipelineInputSchema.safeParse(parsedJson);
  if (!result.success) {
    const checks = result.error.issues.map((issue) => ({ label: `${issue.path.join(".") || "(root)"}: ${issue.message}`, pass: false }));
    return { output: parsedJson, status: "bad", checks, metrics: [{ label: "Ошибок валидации", value: String(checks.length) }] };
  }
  return {
    output: result.data,
    status: "ok",
    checks: [
      { label: "property.deal_type и property.property_type заполнены", pass: true },
      { label: "Типы полей корректны", pass: true },
      { label: "Необязательные поля (например, price) не блокируют валидацию", pass: true },
    ],
    metrics: [{ label: "Полей в property", value: String(Object.keys(result.data.property).length) }],
  };
}

function fnNormalize({ crm }: CodeFnInput): CodeFnResult {
  const data = crm as unknown as AdCopyPipelineInput;
  if (!data?.property || Object.keys(data.property).length === 0) {
    return { output: undefined, status: "bad", checks: [{ label: "Есть валидные данные property для нормализации", pass: false }] };
  }
  const property = Object.fromEntries(Object.entries(data.property).map(([key, value]) => [key, cleanValue(value)])) as AdCopyProperty;
  const userSettings = Object.fromEntries(Object.entries(data.user_settings ?? {}).map(([key, value]) => [key, cleanValue(value)])) as AdCopyUserSettings;
  const normalized: AdCopyPipelineInput = { property, user_settings: userSettings };
  return {
    output: normalized,
    status: "ok",
    checks: [
      { label: "HTML удалён из текстовых полей", pass: true },
      { label: "Единый объект {property, user_settings} сформирован (ctx.normalized)", pass: true },
    ],
  };
}

function fnStorage({ ctx }: CodeFnInput): CodeFnResult {
  const normalized = (ctx.normalized ?? {}) as Partial<AdCopyPipelineInput>;
  const benefits = (ctx.benefits ?? {}) as Partial<AdCopyBenefits>;
  const merged = {
    property: normalized.property ?? {},
    user_settings: normalized.user_settings ?? {},
    advantages: benefits.advantages ?? [],
    strengths: benefits.strengths ?? [],
    selling_points: benefits.selling_points ?? [],
    usp: benefits.usp ?? "",
    target_audience: benefits.target_audience ?? [],
  };
  return {
    output: merged,
    status: "ok",
    checks: [{ label: "property + user_settings + преимущества объединены в единую запись", pass: Boolean(normalized.property && benefits.advantages) }],
    metrics: [{ label: "Преимуществ сохранено", value: String(merged.advantages.length) }],
  };
}

function fnQuality({ ctx }: CodeFnInput): CodeFnResult {
  const normalized = (ctx.normalized ?? {}) as Partial<AdCopyPipelineInput>;
  const property = (normalized.property ?? {}) as Partial<AdCopyProperty>;
  const checked = (ctx.checked ?? {}) as Record<string, unknown>;
  const ad = (ctx.ad ?? {}) as Record<string, unknown>;

  // Prefer the Checker's (possibly corrected) text; fall back to the raw
  // generator output when the Checker didn't run -- matches fnSaveAd's
  // own fallback, so a missing/disabled Checker never makes an
  // otherwise-good ad look empty here.
  const title = typeof checked.title === "string" && checked.title.trim() ? checked.title : typeof ad.title === "string" ? ad.title : "";
  const description = typeof checked.description === "string" && checked.description.trim() ? checked.description : typeof ad.description === "string" ? ad.description : "";
  const cta = typeof checked.cta === "string" && checked.cta.trim() ? checked.cta : typeof ad.cta === "string" ? ad.cta : "";

  const validationOk = AdCopyPipelineInputSchema.safeParse(ctx.validated).success;
  const benefitsOk = AdCopyBenefitsSchema.safeParse(ctx.benefits).success;
  const generationOk = AdCopySchema.safeParse({ title, description, cta }).success;

  const structureOk = Boolean(title.trim() && description.trim() && cta.trim());
  const requiredDataOk = [property.deal_type, property.property_type, property.rooms, property.total_area].every((value) => value !== undefined && value !== null && value !== "");
  const withinLength = title.length <= 90 && description.length <= 2200;
  const noForbiddenChars = !/[<>{}]/.test(`${title}${description}`);
  const platformOk = withinLength && noForbiddenChars;

  const checkerRan = ctx.checked !== undefined && Object.keys(checked).length > 0;
  const checkerBooleanFields = ["facts_ok", "style_ok", "language_ok", "prohibited_words_ok", "seo_ok", "duplicates_ok"] as const;
  const checkerOk = checkerRan && checkerBooleanFields.every((field) => checked[field] === true);

  // Weighted average over whichever components actually ran -- a
  // disabled/unavailable Checker is *excluded* from the denominator,
  // not scored as a failure, so confidence reflects "how much of what
  // ran succeeded" rather than being capped by an optional cross-check
  // nobody asked to skip.
  const components: { label: string; weight: number; ok: boolean }[] = [
    { label: "Валидация входных данных", weight: 10, ok: validationOk },
    { label: "Извлечение преимуществ", weight: 10, ok: benefitsOk },
    { label: "Генерация объявления (title/description/cta)", weight: 15, ok: generationOk },
    { label: "Структура текста (заголовок/описание/CTA заполнены)", weight: 15, ok: structureOk },
    { label: "Обязательные данные объекта (тип сделки/объекта, комнаты, площадь)", weight: 15, ok: requiredDataOk },
    { label: "Требования площадок (длина, запрещённые символы)", weight: 10, ok: platformOk },
  ];
  if (checkerRan) components.push({ label: "Проверка объявления (Checker: факты/стиль/язык/SEO/повторы)", weight: 25, ok: checkerOk });

  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
  const scored = components.reduce((sum, component) => sum + (component.ok ? component.weight : 0), 0);
  const confidenceScore = Math.round((scored / totalWeight) * 100);

  const checks: AdCopyCheckItem[] = components.map((component) => ({ label: component.label, pass: component.ok }));
  if (!checkerRan) checks.push({ label: "Checker не выполнялся (отключён или недоступен) — не учитывается в расчёте", pass: true, warn: true });
  checks.push({ label: `Confidence Score ${confidenceScore}%`, pass: confidenceScore >= CONFIDENCE_THRESHOLD });

  return { output: { confidenceScore }, status: confidenceScore >= CONFIDENCE_THRESHOLD ? "ok" : "warn", checks, metrics: [{ label: "Confidence Score", value: `${confidenceScore}%` }] };
}

function fnGate({ ctx }: CodeFnInput, meta: CodeFnMeta): CodeFnResult {
  const confidenceScore = typeof (ctx.quality as { confidenceScore?: number } | undefined)?.confidenceScore === "number" ? (ctx.quality as { confidenceScore: number }).confidenceScore : 0;
  const pass = confidenceScore >= CONFIDENCE_THRESHOLD;
  const willRetry = !pass && meta.attempt < meta.maxAttempts;
  const decision = pass ? "SAVE" : willRetry ? "RETRY" : "SAVE_LOW_CONFIDENCE";
  return {
    output: { decision, confidenceScore },
    status: pass ? "ok" : "warn",
    checks: [{ label: `Confidence ${confidenceScore}% ${pass ? ">= 90%" : "< 90%"}`, pass }],
    metrics: [{ label: "Решение", value: decision === "SAVE" ? "Сохранить" : decision === "RETRY" ? `Повторная генерация (попытка ${meta.attempt + 1})` : "Сохранить с пометкой low-confidence" }],
  };
}

function fnSaveAd({ ctx }: CodeFnInput, meta: CodeFnMeta): CodeFnResult {
  const checked = (ctx.checked ?? {}) as Record<string, unknown>;
  const ad = (ctx.ad ?? {}) as Record<string, unknown>;
  const gate = (ctx.gate ?? {}) as { decision?: string; confidenceScore?: number };
  const record: AdCopyFinalRecord = {
    title: (checked.title as string) ?? (ad.title as string) ?? "",
    description: (checked.description as string) ?? (ad.description as string) ?? "",
    cta: (checked.cta as string) ?? (ad.cta as string) ?? "",
    confidenceScore: gate.confidenceScore ?? 0,
    model: meta.lastModelUsed || "неизвестно",
    promptVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    lowConfidence: gate.decision !== "SAVE",
    retryCount: meta.attempt - 1,
  };
  return { output: record, status: "ok", checks: [{ label: "Объявление и метаданные сформированы", pass: true }] };
}

function fnSaveCrm({ ctx }: CodeFnInput): CodeFnResult {
  const normalized = (ctx.normalized ?? {}) as Partial<AdCopyPipelineInput>;
  const address = normalized.property?.address ?? "не указан";
  return {
    output: { savedToCrm: true, note: "Симуляция записи в CRM — реальной интеграции с внешней CRM в этом MVP нет.", address },
    status: "ok",
    checks: [{ label: "Запись в CRM выполнена (симуляция)", pass: true }],
  };
}

const CODE_FUNCS: Record<string, (input: CodeFnInput, meta: CodeFnMeta) => CodeFnResult> = {
  validate: fnValidate,
  normalize: fnNormalize,
  storage: fnStorage,
  quality: fnQuality,
  gate: fnGate,
  saveAd: fnSaveAd,
  saveCrm: fnSaveCrm,
};

// ── Default, fully editable 10-stage configuration ──
const BENEFITS_PROMPT = `Ты — эксперт по анализу объектов недвижимости и продающему копирайтингу.
Проанализируй структурированные данные объекта недвижимости и настройки пользователя, определи преимущества, уникальное торговое предложение, целевую аудиторию и продающие тезисы.

Данные объекта (property):
{{ctx.normalized.property}}

Настройки генерации (user_settings):
{{ctx.normalized.user_settings}}

Верни СТРОГО валидный JSON без markdown и пояснений с полями:
{
  "advantages": string[] (3-6 конкретных преимуществ объекта на основе реальных данных выше, ничего не выдумывай),
  "usp": string (одно уникальное торговое предложение — главный аргумент в пользу покупки),
  "strengths": string[] (сильные стороны локации, дома, планировки),
  "selling_points": string[] (3-5 продающих тезисов для текста объявления),
  "target_audience": string[] (для кого этот объект подходит лучше всего — учти user_settings.target_audience, если указано)
}`;

const GENERATION_PROMPT = `Ты — профессиональный копирайтер объявлений недвижимости.
Составь продающее объявление на основе данных объекта, преимуществ и пользовательских настроек генерации.

Данные объекта (property):
{{ctx.stored.property}}

Настройки генерации (user_settings — стиль, фокус, длина текста, структура, аудитория, эмодзи):
{{ctx.stored.user_settings}}

Преимущества и позиционирование:
Advantages: {{ctx.stored.advantages}}
USP: {{ctx.stored.usp}}
Strengths: {{ctx.stored.strengths}}
Selling points: {{ctx.stored.selling_points}}
Target audience: {{ctx.stored.target_audience}}

Верни СТРОГО валидный JSON без markdown и пояснений СТРОГО с тремя полями (никаких advantages/usp/других полей в ответе):
{
  "title": string (заголовок объявления, до 90 символов, содержит ключевые характеристики),
  "description": string (текст объявления; следуй user_settings.structure и придерживайся user_settings.text_length, если указаны),
  "cta": string (короткий призыв к действию)
}

Правила:
- Используй только факты из данных объекта и преимущества выше, ничего не выдумывай.
- Учитывай style/focus/target_audience/structure/emoji из user_settings.
- Не используй канцеляризмы, штампы и избыточные превосходные степени без основания в фактах.`;

const CHECKER_PROMPT = `Ты — независимый контролёр качества объявлений недвижимости (самопроверка перед публикацией, кросс-вендорная проверка).
Сверь текст объявления с исходными данными объекта и правилами качества, исправь ошибки.

Исходные данные объекта (property):
{{ctx.stored.property}}

Настройки генерации (user_settings):
{{ctx.stored.user_settings}}

Преимущества: {{ctx.stored.advantages}}

Проверяемое объявление:
{{ctx.ad}}

Проверь и верни СТРОГО валидный JSON без markdown и пояснений:
{
  "facts_ok": boolean (все факты в объявлении соответствуют исходным данным),
  "style_ok": boolean (стиль соответствует user_settings.style и целевой аудитории, без канцеляризмов),
  "language_ok": boolean (нет орфографических и грамматических ошибок русского языка),
  "prohibited_words_ok": boolean (нет запрещённых слов: "лучший", "гарантия", "100%"),
  "readability_score": number (0-100, оценка читаемости текста),
  "seo_ok": boolean (заголовок и описание содержат релевантные для поиска характеристики),
  "duplicates_ok": boolean (нет повторов одних и тех же характеристик),
  "title": string (исправленный заголовок, если были ошибки — иначе тот же),
  "description": string (исправленное описание, если были ошибки — иначе то же),
  "cta": string (исправленный CTA, если были ошибки — иначе тот же),
  "issues": string[] (список найденных и исправленных проблем)
}

Правила:
- Если найдена ошибка — исправь её прямо в полях title/description/cta.
- confidence не пересчитывай здесь — это делает следующий этап (Контур качества).`;

export function defaultAdCopyStages(): AdCopyStageConfig[] {
  return [
    { id: "validate", enabled: true, name: "Валидация входных данных", type: "code", codeFn: "validate", vendor: "Code", outKey: "validated" },
    { id: "normalize", enabled: true, name: "Подготовка структуры объекта", type: "code", codeFn: "normalize", vendor: "Code", outKey: "normalized" },
    { id: "benefits", enabled: true, name: "Агент извлечения преимуществ", type: "llm", model: "gpt-5-mini", prompt: BENEFITS_PROMPT, outKey: "benefits" },
    { id: "storage", enabled: true, name: "Единое хранилище", type: "store", codeFn: "storage", vendor: "JSON Store", outKey: "stored" },
    { id: "generate", enabled: true, name: "Генерация объявления", type: "llm", model: "gpt-5-mini", prompt: GENERATION_PROMPT, outKey: "ad" },
    { id: "check", enabled: true, name: "Проверка объявления", type: "check", model: "claude-sonnet-4-6", prompt: CHECKER_PROMPT, outKey: "checked" },
    { id: "quality", enabled: true, name: "Контур качества", type: "code", codeFn: "quality", vendor: "Code", outKey: "quality" },
    { id: "gate", enabled: true, name: "Quality Gate", type: "code", codeFn: "gate", vendor: "Code", outKey: "gate" },
    { id: "saveAd", enabled: true, name: "Сохранение объявления", type: "svc", codeFn: "saveAd", vendor: "Ad Store", outKey: "saved_ad" },
    { id: "saveCrm", enabled: true, name: "Сохранение в CRM", type: "svc", codeFn: "saveCrm", vendor: "CRM", outKey: "saved_crm" },
  ];
}

let newStageCounter = 0;
export function createBlankStage(): AdCopyStageConfig {
  newStageCounter += 1;
  return { id: `custom_${Date.now()}_${newStageCounter}`, enabled: true, name: "Новый шаг", type: "code", codeFn: undefined, vendor: "Code", outKey: `step_${newStageCounter}` };
}

/** Every `ctx.KEY` a prompt can currently reference, for the "Переменные в промтах" reference panel. */
export function availableContextKeys(stages: readonly AdCopyStageConfig[]): readonly string[] {
  return stages.filter((stage) => stage.enabled).map((stage) => stage.outKey);
}

export async function runAdCopyPipeline(
  stages: readonly AdCopyStageConfig[],
  rawInput: string,
  onUpdate: (reports: Readonly<Record<string, AdCopyStageReport>>) => void,
  storedFiles: readonly StoredFileContext[] = [],
): Promise<AdCopyPipelineResult> {
  const startAll = Date.now();
  let reports: Record<string, AdCopyStageReport> = Object.fromEntries(stages.map((stage) => [stage.id, { stageId: stage.id, status: "idle" as const }]));
  const ctx: Record<string, unknown> = { stored_files: storedFiles };
  let totalTokens = 0;
  let totalCostUsd = 0;
  let lastModelUsed = "";

  const emit = () => onUpdate({ ...reports });
  const setReport = (id: string, patch: Partial<AdCopyStageReport>) => {
    reports = { ...reports, [id]: { ...reports[id], ...patch, stageId: id } };
    emit();
  };
  emit();

  const enabled = stages.filter((stage) => stage.enabled);

  const runOne = async (stage: AdCopyStageConfig, attempt: number | undefined): Promise<void> => {
    const startedMs = Date.now();
    setReport(stage.id, { status: "running", attempt });
    try {
      const crm = (ctx.normalized ?? ctx.validated ?? {}) as Record<string, unknown>;
      let result: CodeFnResult;
      if (stage.type === "llm" || stage.type === "check") {
        const prompt = tmpl(stage.prompt ?? "", { crm, ctx });
        const requestedModel = stage.model || (stage.type === "check" ? "claude-sonnet-4-6" : "gpt-5-mini");
        const { model, fallbackNote } = resolveAvailableModel(requestedModel);
        const text = await callModelByName(prompt, model);
        const tokens = estimateTokens(prompt) + estimateTokens(text);
        const cost = estimateCost(model, tokens);
        totalTokens += tokens;
        totalCostUsd += cost;
        lastModelUsed = model;
        let parsed: unknown;
        try {
          parsed = parseJsonResponse(text);
        } catch {
          parsed = { raw: text };
        }
        const schema = STAGE_OUTPUT_SCHEMAS[stage.id];
        let status: "ok" | "warn" | "bad" = "ok";
        const contractChecks: AdCopyCheckItem[] = [];
        if (schema) {
          const validated = schema.safeParse(parsed);
          if (validated.success) {
            parsed = validated.data ?? parsed;
            contractChecks.push({ label: "Формат ответа соответствует контракту этапа", pass: true });
          } else {
            status = "bad";
            for (const issue of (validated.error?.issues ?? []).slice(0, 6)) {
              contractChecks.push({ label: `Контракт: ${issue.path.join(".") || "(root)"} — ${issue.message}`, pass: false });
            }
          }
        }
        result = {
          output: parsed,
          status,
          checks: contractChecks.length > 0 ? contractChecks : undefined,
          metrics: [
            { label: "Модель", value: `${MODEL_VENDOR[model] ?? "?"}/${model}${fallbackNote ? ` ${fallbackNote}` : ""}` },
            { label: "Токены (оценка)", value: String(Math.round(tokens)) },
            { label: "Стоимость (оценка)", value: `$${cost.toFixed(4)}` },
          ],
        };
      } else {
        const fn = stage.codeFn ? CODE_FUNCS[stage.codeFn] : undefined;
        result = fn
          ? fn({ crm, ctx, rawInput }, { attempt: attempt ?? 1, maxAttempts: MAX_ATTEMPTS, lastModelUsed })
          : { output: ctx, status: "warn", checks: [{ label: "Не задана известная код-функция — шаг пропущен", pass: false, warn: true }] };
      }
      ctx[stage.outKey] = result.output;
      setReport(stage.id, { status: result.status, output: result.output, checks: result.checks, metrics: result.metrics, attempt, durationMs: Date.now() - startedMs });
    } catch (error) {
      setReport(stage.id, { status: "bad", error: errorMessage(error), attempt, durationMs: Date.now() - startedMs });
    }
  };

  let lastStoreIndex = -1;
  enabled.forEach((stage, index) => {
    if (stage.type === "store") lastStoreIndex = index;
  });
  const gateIndex = enabled.findIndex((stage) => stage.codeFn === "gate");

  for (let i = 0; i <= lastStoreIndex; i += 1) await runOne(enabled[i], undefined);

  let finalAttempt: number | undefined;
  if (gateIndex === -1) {
    for (let i = lastStoreIndex + 1; i < enabled.length; i += 1) await runOne(enabled[i], undefined);
  } else {
    let attempt = 1;
    for (;;) {
      for (let i = lastStoreIndex + 1; i <= gateIndex; i += 1) await runOne(enabled[i], attempt);
      const gateOutput = ctx[enabled[gateIndex].outKey] as { decision?: string } | undefined;
      if (gateOutput?.decision !== "RETRY" || attempt >= MAX_ATTEMPTS) break;
      attempt += 1;
    }
    finalAttempt = attempt;
    // Save/service stages after the gate must still know the final
    // attempt count (so e.g. `saveAd`'s `retryCount = attempt - 1` is
    // correct) even though they only ever run once themselves, per
    // stage -- not once per retry.
    for (let i = gateIndex + 1; i < enabled.length; i += 1) await runOne(enabled[i], finalAttempt);
  }

  const saveAdStage = enabled.find((stage) => stage.codeFn === "saveAd");
  const finalRecord = saveAdStage ? (ctx[saveAdStage.outKey] as AdCopyFinalRecord | undefined) : undefined;

  return { reports, ctx, totalTokensEstimate: Math.round(totalTokens), totalCostUsd, totalDurationMs: Date.now() - startAll, finalRecord };
}
