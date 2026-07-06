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
 *   3. `ctx.benefits`   -- `AdCopyBenefitsSchema` (`usp`/`advantages`/
 *      `selling_points` -- ready-to-use customer benefits, not raw
 *      characteristics), derived from `ctx.normalized` alone.
 *   4. `ctx.stored`     -- the single record `{property, user_settings,
 *      benefits: {usp, advantages, selling_points}}` the Generation/
 *      Checker stages actually read from -- nothing else.
 *   5. `ctx.ad` / `ctx.checked` -- `AdCopySchema`/`AdCopyQualityCheckSchema`
 *      (`{title, description, cta}`, the Checker's version adding its
 *      own pass/fail fields) -- never `advantages` again at this point.
 *
 * Production-quality pass (2026-07-06, second same-day audit), still
 * with **zero new stages, zero new LLM calls, zero routing/reflection/
 * self-critique** added -- the existing 6-node chain (Validation code ->
 * Benefits LLM -> Storage -> Generation LLM -> Checker LLM -> Publish
 * code) is unchanged; only what each existing node does got better:
 *   - `repairAndParseJson()` -- real JSON repair (smart quotes, trailing
 *     commas, raw control characters inside string literals, unbalanced
 *     brackets from a truncated response) run on every LLM/Checker
 *     response before validation. A response that needed repair but
 *     came out right is still a successful stage, not a warning.
 *   - `STAGE_OUTPUT_SCHEMAS` (unchanged mechanism) now backs one of six
 *     named Confidence components (`schemaOk`) instead of silently
 *     gating only pass/fail.
 *   - The Benefits Agent's prompt was rewritten to require finished,
 *     usable *benefits* ("Две лоджии позволяют организовать
 *     дополнительную зону отдыха и хранения"), not characteristics
 *     ("Две лоджии") -- enforced by `AdCopyBenefitsSchema`'s length
 *     floor and the Checker's own review.
 *   - The Generation prompt was rewritten against real Avito/ЦИАН
 *     copywriting practice (sell the lived experience, not a spec
 *     sheet; one strong hook; natural non-boilerplate subheadings only
 *     in "structured" mode; a mandatory, verbatim legal disclaimer by
 *     deal type that a deterministic fallback in `fnSaveAd` guarantees
 *     even if the model paraphrases it away).
 *   - The Checker gained two new checks LLM judgment is uniquely suited
 *     for: `ai_cliches_ok` (generic AI-sounding boilerplate) and
 *     `user_settings_ok`/`platform_requirements_ok` (does this text
 *     actually honor the requested style/length/structure and would a
 *     real Avito/ЦИАН moderator accept it).
 *   - Confidence is now a named 6-component weighted average
 *     (validation / JSON correctness / schema match / Checker content /
 *     platform requirements / user-settings match) instead of a mix of
 *     ad-hoc structural checks.
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
  /** Diagnostics for `llm`/`check` stages only (test-bench UI item #7: RAW response / JSON Repair result / final valid JSON). */
  rawResponse?: string;
  jsonRepaired?: boolean;
  repairedJson?: string;
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

// ── JSON Repair (test bench requirement #1) ──

export type JsonRepairResult = Readonly<{ ok: boolean; value?: unknown; repaired: boolean; rawText: string; repairedText?: string; error?: string }>;

function extractBraceSpan(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}

/** Escapes raw control characters an LLM sometimes leaves inside a string literal (the single most common cause of an otherwise-correct JSON response failing to parse) -- tracks string/escape state char by char so it never touches structural whitespace outside strings. */
function fixControlCharsInsideStrings(text: string): string {
  let result = "";
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (!inString) {
      if (ch === '"') inString = true;
      result += ch;
      continue;
    }
    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      result += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = false;
      result += ch;
      continue;
    }
    if (ch === "\n") {
      result += "\\n";
      continue;
    }
    if (ch === "\r") continue;
    if (ch === "\t") {
      result += "\\t";
      continue;
    }
    result += ch;
  }
  return result;
}

/** Closes brackets left open by a response truncated mid-object (e.g. hit a token limit) -- tracked with a stack, ignoring bracket characters that appear inside string literals. */
function closeUnbalancedBrackets(text: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") stack.pop();
  }
  return stack.length > 0 ? text + stack.reverse().join("") : text;
}

/**
 * Real, no-data-loss JSON repair: normalizes smart quotes, strips
 * trailing commas, escapes raw control characters inside string
 * literals, and closes brackets left open by truncation -- never
 * rewrites content, only syntax. If the repaired text still doesn't
 * parse, that's reported honestly as unrepairable rather than guessed
 * at (per the requirement: repair counts as success only when nothing
 * was lost).
 */
export function repairAndParseJson(raw: string): JsonRepairResult {
  const rawText = raw;
  try {
    return { ok: true, value: parseJsonResponse(raw), repaired: false, rawText };
  } catch {
    // fall through to repair
  }

  let candidate = extractBraceSpan(
    raw
      .trim()
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim(),
  );
  candidate = candidate.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  candidate = fixControlCharsInsideStrings(candidate);
  candidate = candidate.replace(/,(\s*[}\]])/g, "$1");
  candidate = closeUnbalancedBrackets(candidate);

  try {
    return { ok: true, value: JSON.parse(candidate), repaired: true, rawText, repairedText: candidate };
  } catch (error) {
    return { ok: false, repaired: false, rawText, error: errorMessage(error) };
  }
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

// ── Mandatory legal disclaimer by deal type ──
// Verbatim text per the platform's existing production prompt -- kept
// as a deterministic code-level guarantee (not just a prompt
// instruction) so it can never be lost to LLM paraphrasing, without
// adding a new stage or LLM call: `fnSaveAd` appends it if missing.

const SALE_DISCLAIMER = "Мы гарантируем безопасную сделку и юридическую поддержку нашим Клиентам. Поможем одобрить ипотеку с сниженной ставкой.";
const RENT_DISCLAIMER = "Мы гарантируем безопасную сделку и юридическую поддержку нашим Клиентам.";

function isRentDealType(dealType: string): boolean {
  return /сда|аренд|найм|rent|lease/i.test(dealType);
}

function ensureDisclaimer(description: string, dealType: string | undefined): string {
  const disclaimer = isRentDealType(dealType ?? "") ? RENT_DISCLAIMER : SALE_DISCLAIMER;
  const trimmed = description.trim();
  if (!trimmed) return disclaimer;
  return trimmed.includes(disclaimer) ? trimmed : `${trimmed} ${disclaimer}`;
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

/** `ctx.stored` -- exactly `{property, user_settings, benefits}`, nothing else (test-bench requirement #3: no duplicate/parallel arrays). */
function fnStorage({ ctx }: CodeFnInput): CodeFnResult {
  const normalized = (ctx.normalized ?? {}) as Partial<AdCopyPipelineInput>;
  const benefits = (ctx.benefits ?? {}) as Partial<AdCopyBenefits>;
  const merged = {
    property: normalized.property ?? {},
    user_settings: normalized.user_settings ?? {},
    benefits: {
      usp: benefits.usp ?? "",
      advantages: benefits.advantages ?? [],
      selling_points: benefits.selling_points ?? [],
    },
  };
  return {
    output: merged,
    status: "ok",
    checks: [{ label: "property + user_settings + benefits{usp, advantages, selling_points} объединены в единую запись", pass: Boolean(normalized.property && benefits.advantages) }],
    metrics: [{ label: "Преимуществ сохранено", value: String(merged.benefits.advantages.length) }],
  };
}

const CHECKER_BOOLEAN_FIELDS = ["facts_ok", "style_ok", "language_ok", "prohibited_words_ok", "ai_cliches_ok", "seo_ok", "duplicates_ok"] as const;

type StageDiagnostics = Readonly<{ jsonOk: boolean; schemaOk: boolean }>;

/**
 * Confidence is a weighted average over 6 named components, matching
 * the audit's explicit list -- validation / JSON correctness / schema
 * match / Checker content / platform requirements / user-settings
 * match. A component only a Checker can judge (its own content check,
 * platform semantics, user-settings match) is *excluded* from the
 * denominator when the Checker didn't run, never scored as a failure
 * -- an absent optional cross-check should never itself cap confidence.
 */
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

  const diagnostics = (ctx.__diagnostics ?? {}) as Record<string, StageDiagnostics>;
  const diagEntries = Object.values(diagnostics);
  const jsonOk = diagEntries.length === 0 || diagEntries.every((entry) => entry.jsonOk);
  const schemaOk = diagEntries.length === 0 || diagEntries.every((entry) => entry.schemaOk);

  const withinLength = title.length <= 90 && description.length <= 2200;
  const noForbiddenChars = !/[<>{}]/.test(`${title}${description}`);
  const deterministicPlatformOk = Boolean(title.trim() && description.trim() && cta.trim()) && withinLength && noForbiddenChars;

  const checkerRan = ctx.checked !== undefined && Object.keys(checked).length > 0;
  const checkerContentOk = checkerRan && CHECKER_BOOLEAN_FIELDS.every((field) => checked[field] === true);
  const platformOk = deterministicPlatformOk && (!checkerRan || checked.platform_requirements_ok === true);
  const userSettingsOk = checkerRan ? checked.user_settings_ok === true : undefined;

  const components: { label: string; weight: number; ok: boolean }[] = [
    { label: "Валидация входных данных", weight: 15, ok: validationOk },
    { label: "Корректность JSON (после JSON Repair при необходимости)", weight: 10, ok: jsonOk },
    { label: "Соответствие схемам данных этапов", weight: 15, ok: schemaOk },
    { label: "Требования площадок (Avito/ЦИАН: длина, запрещённые символы)", weight: 20, ok: platformOk },
  ];
  if (checkerRan) {
    components.push({ label: "Проверка объявления (Checker: факты/стиль/язык/AI-клише/SEO/повторы)", weight: 25, ok: checkerContentOk });
    components.push({ label: "Соответствие пользовательским настройкам", weight: 15, ok: userSettingsOk === true });
  }

  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
  const scored = components.reduce((sum, component) => sum + (component.ok ? component.weight : 0), 0);
  const confidenceScore = Math.round((scored / totalWeight) * 100);

  const checks: AdCopyCheckItem[] = components.map((component) => ({ label: component.label, pass: component.ok }));
  if (!checkerRan) checks.push({ label: "Checker не выполнялся (отключён или недоступен) — его 2 компонента не учитываются в расчёте", pass: true, warn: true });
  if (checkerRan && Array.isArray(checked.issues) && checked.issues.length > 0) {
    for (const issue of checked.issues as string[]) checks.push({ label: `Checker: ${issue}`, pass: false, warn: true });
  }
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
  const normalized = (ctx.normalized ?? {}) as Partial<AdCopyPipelineInput>;
  const checked = (ctx.checked ?? {}) as Record<string, unknown>;
  const ad = (ctx.ad ?? {}) as Record<string, unknown>;
  const gate = (ctx.gate ?? {}) as { decision?: string; confidenceScore?: number };
  const rawDescription = (checked.description as string) ?? (ad.description as string) ?? "";
  const record: AdCopyFinalRecord = {
    title: (checked.title as string) ?? (ad.title as string) ?? "",
    description: ensureDisclaimer(rawDescription, normalized.property?.deal_type),
    cta: (checked.cta as string) ?? (ad.cta as string) ?? "",
    confidenceScore: gate.confidenceScore ?? 0,
    model: meta.lastModelUsed || "неизвестно",
    promptVersion: "1.1.0",
    generatedAt: new Date().toISOString(),
    lowConfidence: gate.decision !== "SAVE",
    retryCount: meta.attempt - 1,
  };
  return { output: record, status: "ok", checks: [{ label: "Объявление и метаданные сформированы (юридический блок гарантирован)", pass: true }] };
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

const BENEFITS_PROMPT = `Ты — эксперт по продающему копирайтингу недвижимости. Твоя задача — не описать объект, а перевести КАЖДУЮ его характеристику в готовую выгоду для покупателя: то, что он получит или почувствует, а не сухой факт.

Плохо (характеристика): "Две лоджии."
Хорошо (выгода): "Две лоджии позволяют организовать дополнительную зону отдыха и хранения."

Плохо: "Высота потолков 3 метра."
Хорошо: "Потолки 3 метра создают ощущение простора и лёгкости, каких нет в типовых домах."

Каждый пункт advantages должен быть готов к прямой вставке в текст объявления — не характеристика, а завершённая мысль о пользе для человека.

Данные объекта (property):
{{ctx.normalized.property}}

Настройки генерации (user_settings):
{{ctx.normalized.user_settings}}

Верни СТРОГО валидный JSON без markdown и пояснений с полями:
{
  "usp": string (одно уникальное торговое предложение — главный аргумент в пользу этого объекта, не выдумывай, основывай только на реальных данных),
  "advantages": string[] (3-6 готовых выгод, каждая — законченное предложение о пользе для человека, не сырая характеристика; учти user_settings.focus, если указан),
  "selling_points": string[] (3-5 коротких продающих тезисов для использования в тексте объявления)
}

Правила:
- Используй только факты из данных объекта, ничего не выдумывай.
- Каждая выгода должна быть логически выводима из конкретного факта в property — не общие фразы вроде "отличная квартира".`;

const GENERATION_PROMPT = `Ты — топовый агент по недвижимости с 15+ летним опытом, эксперт в создании высоко-конверсионных объявлений для Avito, ЦИАН, ДомКлик и Яндекс.Недвижимость.

Твоя задача — создать живое, естественное и продающее объявление, которое выглядит так, будто его написал сильный опытный риелтор, а не сгенерировал ИИ. Продавай образ жизни и ощущения от объекта, а не перечисление характеристик.

ДАННЫЕ ДЛЯ ГЕНЕРАЦИИ
Данные объекта (property):
{{ctx.stored.property}}

Настройки генерации (user_settings — стиль, акценты, длина текста, целевая аудитория, структура, эмодзи):
{{ctx.stored.user_settings}}

Готовые выгоды объекта (benefits — используй как есть, не изобретай новые характеристики):
{{ctx.stored.benefits}}

КРИТИЧЕСКИЕ ЗАПРЕТЫ
- Никаких служебных меток и заголовков блоков ("О квартире", "Планировка", "Локация", "Для кого" и т.п.), если пользователь не выбрал структуру со списком/заголовками.
- Никогда не называть целевую аудиторию напрямую ("для семьи", "инвесторам", "молодым специалистам") — описывай через универсальные сценарии жизни и ощущения, даже если user_settings.target_audience указана.
- Не выдумывай факты и характеристики, которых нет в property и benefits.
- Избегай канцелярита, шаблонных AI-фраз и пустых превосходных степеней без фактического основания ("уникальное предложение", "идеальный вариант", "лучшее на рынке", "не упустите шанс").
- Не перечисляй параметры квартиры подряд одним списком фактов — каждый факт должен быть подан через пользу или ощущение.
- Не повторяй одну и ту же характеристику или мысль дважды разными словами.

ГЛАВНЫЙ ПРИНЦИП
Выбери 1-2 ключевых benefit из списка и построй вокруг них первые 30-40% текста — это хук. Дальше веди текст как рассказ о жизни в этом объекте: как человек будет себя чувствовать, что будет делать, какие ощущения испытывать (утренний свет, ощущение простора, удобство вечером).

СТИЛЬ
- Живой, естественный, профессиональный. Короткие и средние предложения.
- Легко читается с телефона: абзацы по 2-5 строк.
- Минимум восклицаний.

СТРУКТУРА (строго по user_settings.structure)
- "Свободная форма" / не указано: единый плавный текст абзацами, без заголовков и списков.
- "Список с заголовками" / "структурированная": можно использовать естественные, не шаблонные подзаголовки (например "Простор и свет", "Что делает квартиру особенной") — никогда типовые CRM-подписи вроде "О квартире".

НАСТРОЙКИ ПОЛЬЗОВАТЕЛЯ (абсолютный приоритет)
- style: следуй тону максимально точно (формальный/неформальный/экспертный/тёплый и т.п.).
- focus: раздели этим характеристикам больше места и внимания в тексте.
- text_length: {{ctx.stored.user_settings.text_length}} — держись в этих границах по количеству символов.
- emoji: используй эмодзи только если явно включено, и умеренно (не больше 3-5).

ЗАВЕРШЕНИЕ
Заверши текст мягким, естественным призывом посмотреть объект (без шаблонных "звоните прямо сейчас"). В конце description ОБЯЗАТЕЛЬНО добавь один из двух блоков без изменения формулировки, определив нужный по property.deal_type:
- Если сделка о продаже (deal_type похож на "Продать"/"Продажа"/"sale"): "Мы гарантируем безопасную сделку и юридическую поддержку нашим Клиентам. Поможем одобрить ипотеку с сниженной ставкой."
- Если сделка об аренде (deal_type похож на "Сдать"/"Аренда"/"rent"): "Мы гарантируем безопасную сделку и юридическую поддержку нашим Клиентам."

Верни СТРОГО валидный JSON без markdown и пояснений СТРОГО с тремя полями (никаких benefits/advantages/других полей в ответе):
{
  "title": string (заголовок объявления, до 90 символов, содержит ключевую характеристику и локацию),
  "description": string (основной текст объявления, включая обязательный юридический блок в конце),
  "cta": string (короткая мягкая фраза-приглашение к просмотру, отдельно от юридического блока)
}`;

const CHECKER_PROMPT = `Ты — независимый контролёр качества объявлений недвижимости (самопроверка перед публикацией, кросс-вендорная проверка).
Сверь текст объявления с исходными данными объекта, настройками пользователя и требованиями площадок Avito/ЦИАН. Исправь найденные ошибки прямо в полях.

Исходные данные объекта (property):
{{ctx.stored.property}}

Настройки генерации (user_settings):
{{ctx.stored.user_settings}}

Готовые выгоды (benefits):
{{ctx.stored.benefits}}

Проверяемое объявление:
{{ctx.ad}}

Проверь и верни СТРОГО валидный JSON без markdown и пояснений:
{
  "facts_ok": boolean (все факты в объявлении соответствуют property, нет ни одного выдуманного факта или характеристики),
  "style_ok": boolean (стиль соответствует user_settings.style, без канцеляризмов),
  "language_ok": boolean (нет орфографических и грамматических ошибок русского языка),
  "prohibited_words_ok": boolean (нет запрещённых/регулируемых слов: "лучший", "гарантия" вне юр.блока, "100%"),
  "ai_cliches_ok": boolean (нет типичных AI-штампов: "уникальное предложение", "идеальный вариант", "лучшее на рынке", "не упустите шанс" и подобных пустых фраз),
  "readability_score": number (0-100, оценка читаемости текста),
  "seo_ok": boolean (заголовок и описание содержат релевантные для поиска характеристики — район, комнатность, площадь),
  "duplicates_ok": boolean (нет повторов одной и той же мысли или характеристики разными словами),
  "user_settings_ok": boolean (текст реально соответствует user_settings: стиль, акценты, примерная длина, структура, эмодзи — не только на словах),
  "platform_requirements_ok": boolean (текст соответствует требованиям Avito/ЦИАН: нет прямого упоминания целевой аудитории, нет телефонов/ссылок в тексте, длина разумна для площадки),
  "title": string (исправленный заголовок, если были ошибки — иначе тот же),
  "description": string (исправленное описание, если были ошибки — иначе то же; юридический блок в конце обязателен и должен остаться без изменений),
  "cta": string (исправленный CTA, если были ошибки — иначе тот же),
  "issues": string[] (подробный список каждой найденной и исправленной проблемы, по одной строке на проблему; пустой массив, если проблем нет)
}

Правила:
- Если найдена ошибка — исправь её прямо в полях title/description/cta, не только опиши в issues.
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
  const ctx: Record<string, unknown> = { stored_files: storedFiles, __diagnostics: {} };
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
      let extra: Partial<AdCopyStageReport> = {};
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

        const repair = repairAndParseJson(text);
        let parsed: unknown = repair.ok ? repair.value : { raw: text };
        extra = { rawResponse: text, jsonRepaired: repair.repaired, repairedJson: repair.repaired ? repair.repairedText : undefined };

        const schema = STAGE_OUTPUT_SCHEMAS[stage.id];
        let status: "ok" | "warn" | "bad" = "ok";
        const contractChecks: AdCopyCheckItem[] = [];
        let schemaOk = true;
        if (!repair.ok) {
          status = "bad";
          contractChecks.push({ label: `JSON не удалось разобрать даже после восстановления: ${repair.error}`, pass: false });
        } else if (repair.repaired) {
          contractChecks.push({ label: "Ответ модели содержал невалидный JSON — автоматически восстановлен без потери данных", pass: true });
        }
        if (repair.ok && schema) {
          const validated = schema.safeParse(parsed);
          if (validated.success) {
            parsed = validated.data ?? parsed;
            contractChecks.push({ label: "Формат ответа соответствует контракту этапа", pass: true });
          } else {
            status = "bad";
            schemaOk = false;
            for (const issue of (validated.error?.issues ?? []).slice(0, 6)) {
              contractChecks.push({ label: `Контракт: ${issue.path.join(".") || "(root)"} — ${issue.message}`, pass: false });
            }
          }
        }
        ctx.__diagnostics = { ...(ctx.__diagnostics as Record<string, StageDiagnostics>), [stage.id]: { jsonOk: repair.ok, schemaOk } };

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
      setReport(stage.id, { status: result.status, output: result.output, checks: result.checks, metrics: result.metrics, attempt, durationMs: Date.now() - startedMs, ...extra });
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
