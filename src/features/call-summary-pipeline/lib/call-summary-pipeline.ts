/**
 * Engine for the "Анализ звонков v2" product -- a second, fully isolated
 * call-summary pipeline living alongside (never touching) the original
 * `public/pipeline-lab-v3.html` product. Follows the same architectural
 * pattern as `src/features/mvp/lib/ad-copy-test-bench.ts` (the repo's
 * existing precedent for a second product-specific pipeline engine):
 * data-driven stage config, real LLM calls via
 * `@/shared/llm/browser-direct-provider`, Zod-validated stage contracts,
 * own JSON-repair pass (duplicated here rather than importing from
 * ad-copy-test-bench.ts, which is itself out of scope for this task).
 *
 * Five stages per `docs/NEW_SUMMARY_PIPELINE_SPEC.md` (the authoritative
 * spec for this product -- read it before changing any prompt/schema
 * here): Facts & Quotes -> Needs -> Outcome & Next Step -> Summary
 * Generator -> Summary Quality Gate. Stages 1-3 extract independently
 * from the transcript; Summary Generator consumes all three JSONs plus
 * the transcript; Quality Gate scores the summary using the exact same
 * five-criterion/0-4 rubric a human reviewer uses (`computeQualityDecision`
 * is the single deterministic function both paths call).
 */

import { z } from "zod";
import { callModelByName, parseJsonResponse } from "@/shared/llm/browser-direct-provider";

// ── Lenient parsing helpers ──
// Real model output is occasionally "almost right" (a score as "4" instead
// of 4, a boolean as "true", an enum value translated/mis-cased, a
// discriminator field omitted) -- with plain Zod that invalidates the
// *entire* stage and produces a TECHNICAL_ERROR over what is otherwise a
// perfectly usable response. Every field built with these helpers instead
// falls back to a safe default and lets the rest of the object through.
// Fields that actually drive scoring math (Quality Gate raw_score) are
// still range-clamped, never silently zeroed.

function looseConfidence(fallback: number) {
  return z.preprocess((value) => {
    const n = typeof value === "string" ? Number(value) : value;
    return typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
  }, z.number());
}

function looseNullableNumber() {
  return z.preprocess((value) => {
    if (value === null || value === undefined) return value;
    const n = typeof value === "string" ? Number(value) : value;
    return typeof n === "number" && Number.isFinite(n) ? n : null;
  }, z.number().nullable().optional());
}

function looseBool(fallback: boolean) {
  return z.preprocess((value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.trim().toLowerCase() === "true";
    return fallback;
  }, z.boolean());
}

/** Like the others, but preserves the strict literal-union TS type (via z.enum) for downstream consumers like CALL_SUMMARY_ERROR_LABELS[...] -- only the runtime *validation* is lenient. */
function looseEnum<T extends readonly [string, ...string[]]>(values: T, fallback: T[number]) {
  return z.preprocess((value) => ((values as readonly string[]).includes(value as string) ? value : fallback), z.enum(values));
}

function looseScore04(fallback: number) {
  return z.preprocess((value) => {
    const n = typeof value === "string" ? Number(value) : value;
    return typeof n === "number" && Number.isFinite(n) ? Math.min(4, Math.max(0, Math.round(n))) : fallback;
  }, z.number().int().min(0).max(4));
}

// ── Error taxonomy (spec §17) -- shared by the AI judge and the human evaluation form ──

export const CALL_SUMMARY_ERROR_TYPES = [
  "FACT_INVENTED",
  "FACT_DISTORTED",
  "ROLE_CONFUSION",
  "CRITICAL_FACT_MISSING",
  "WRONG_CLIENT_NEED",
  "WRONG_OUTCOME",
  "WRONG_NEXT_STEP",
  "QUOTE_INACCURATE",
  "CRM_DATA_DUPLICATION",
  "VERBOSE",
  "UNCLEAR_LANGUAGE",
  "FORMAT_VIOLATION",
] as const;
export type CallSummaryErrorType = (typeof CALL_SUMMARY_ERROR_TYPES)[number];

export const CALL_SUMMARY_ERROR_LABELS: Record<CallSummaryErrorType, string> = {
  FACT_INVENTED: "Придуман факт",
  FACT_DISTORTED: "Факт искажён",
  ROLE_CONFUSION: "Перепутаны роли клиента и агента",
  CRITICAL_FACT_MISSING: "Пропущен критически важный факт",
  WRONG_CLIENT_NEED: "Неверно определена потребность клиента",
  WRONG_OUTCOME: "Неверно определён результат разговора",
  WRONG_NEXT_STEP: "Неверно определён следующий шаг",
  QUOTE_INACCURATE: "Цитата искажает смысл сказанного",
  CRM_DATA_DUPLICATION: "Дублирование данных, уже видимых в карточке CRM",
  VERBOSE: "Многословно / есть повторы",
  UNCLEAR_LANGUAGE: "Неясная формулировка",
  FORMAT_VIOLATION: "Нарушен формат",
};

// ── Stage 1: Facts & Quotes (spec §2) ──

const EvidenceSchema = z.object({ turn_id: z.number().optional(), quote: z.string().catch("") });

const FactSchema = z.object({
  id: z.string().catch(""),
  category: z.string().catch(""),
  value: z.unknown().optional(),
  normalized_text: z.string().catch(""),
  speaker: z.string().optional(),
  evidence: z.array(EvidenceSchema).catch([]),
  confidence: looseConfidence(0.8),
  status: z.string().catch("confirmed"),
});

const QuoteSchema = z.object({
  id: z.string().catch(""),
  category: z.string().catch(""),
  speaker: z.string().optional(),
  text: z.string().catch(""),
  turn_id: z.number().optional(),
  importance: z.string().catch("medium"),
});

export const FactsQuotesSchema = z.object({
  facts: z.array(FactSchema).catch([]),
  quotes: z.array(QuoteSchema).catch([]),
  conflicts: z.array(z.object({ description: z.string().catch(""), values: z.array(z.unknown()).optional() })).catch([]),
  missing_critical_facts: z.array(z.string()).catch([]),
});
export type FactsQuotes = z.infer<typeof FactsQuotesSchema>;

const FACTS_PROMPT = `Ты — аналитик, который извлекает из транскрибации звонка только подтверждённые факты и важные цитаты. Это не пересказ разговора и не summary.

ЧТО ИЗВЛЕКАТЬ
Факты о клиенте и запросе: цель обращения, объект/тип объекта, назначение покупки, бюджет, способ финансирования, срок покупки, локации, параметры объекта, готовность к просмотру, возражения, ограничения, важные обстоятельства, предпочитаемый канал связи.
Цитаты: только те, что подтверждают ключевую потребность, бюджет/финансирование, срок, мотивацию, возражение, готовность к действию или договорённость. Не извлекай цитаты с адресом объекта, приветствиями или техническими деталями без продуктовой ценности.

ПРАВИЛА
- Не добавляй факты по логике или домыслу — только то, что реально прозвучало.
- Слова агента не считаются потребностью клиента без подтверждения клиента.
- Строго различай: подтверждённый факт / предположение / предложение агента / незакрытый вопрос — в facts попадают только подтверждённые факты.
- Каждому важному факту — evidence (turn_id + дословная цитата).
- Если информация не определена — не угадывай, просто не включай её (или отметь в missing_critical_facts).
- Если есть конфликтующие значения одного и того же факта — сохрани оба варианта в conflicts, не выбирай один произвольно.

ТРАНСКРИБАЦИЯ
{{transcript}}

Верни СТРОГО валидный JSON без markdown и пояснений по схеме:
{
  "facts": [{"id": "fact_001", "category": string, "value": любое значение (число/строка/объект — по природе факта), "normalized_text": string, "speaker": "client"|"agent", "evidence": [{"turn_id": number, "quote": string}], "confidence": number 0-1, "status": "confirmed"|"assumed"|"conflict"|"not_found"}],
  "quotes": [{"id": "quote_001", "category": string, "speaker": "client"|"agent", "text": string, "turn_id": number, "importance": "high"|"medium"|"low"}],
  "conflicts": [{"description": string, "values": [любые конфликтующие значения]}],
  "missing_critical_facts": [string]
}`;

// ── Stage 2: Needs (spec §3) ──

export const NeedsSchema = z.object({
  primary_need: z
    .object({
      intent: z.string().optional(),
      object_type: z.string().optional(),
      purpose: z.string().optional(),
      summary: z.string().catch(""),
    })
    .catch({ summary: "" }),
  requirements: z
    .object({
      locations: z.array(z.string()).catch([]),
      budget: z.object({ min: looseNullableNumber(), max: looseNullableNumber(), currency: z.string().optional() }).optional().catch(undefined),
      object_parameters: z
        .array(z.object({ parameter: z.string().catch(""), operator: z.string().optional(), value: z.unknown(), unit: z.string().optional(), priority: z.string().optional() }))
        .catch([]),
      preferences: z.array(z.string()).catch([]),
      limitations: z.array(z.string()).catch([]),
    })
    .catch({ locations: [], object_parameters: [], preferences: [], limitations: [] }),
  decision_context: z
    .object({
      motivation: z.string().nullable().optional(),
      purchase_timeline: z.string().optional(),
      funding_source: z.string().optional(),
      readiness: z.string().optional(),
      decision_stage: z.string().optional(),
    })
    .catch({}),
  canonical_attributes: z
    .object({
      needs: z.array(z.string()).catch([]),
      funding_source: z.string().optional(),
      purchase_timeline: z.string().optional(),
    })
    .catch({ needs: [] }),
  evidence_links: z.array(z.string()).catch([]),
  confidence: looseConfidence(0.7),
});
export type Needs = z.infer<typeof NeedsSchema>;

const NEEDS_PROMPT = `Ты собираешь полноценную модель клиентского запроса из транскрибации звонка и уже извлечённых фактов. Отвечаешь на вопрос: что клиент реально хочет, что для него важно и что мешает двигаться дальше?

КРИТИЧЕСКИ ВАЖНО РАЗЛИЧАТЬ (частая ошибка):
- Потребность клиента ("Нужен участок от шести соток") — идёт в requirements.
- Предложение агента ("Могу предложить участок на пять соток") — НЕ потребность, игнорировать.
- Характеристика обсуждаемого объекта ("Этот участок — 6 соток") — НЕ потребность клиента, это факт про конкретный объект.
- Условие клиента ("Если взнос меньше, готов рассматривать") — идёт в limitations/preferences с точной формулировкой условия.
- Незакрытый вопрос ("Надо уточнить, входит ли НДС") — НЕ потребность, не включать в requirements.

Канонические атрибуты (canonical_attributes) заполняй строго по факту разговора, не изобретай значения.

ТРАНСКРИБАЦИЯ
{{transcript}}

ИЗВЛЕЧЁННЫЕ ФАКТЫ (facts.json)
{{facts}}

Верни СТРОГО валидный JSON без markdown и пояснений по схеме:
{
  "primary_need": {"intent": string, "object_type": string, "purpose": string, "summary": string},
  "requirements": {"locations": [string], "budget": {"min": number|null, "max": number|null, "currency": string}, "object_parameters": [{"parameter": string, "operator": string, "value": любое, "unit": string, "priority": "must_have"|"nice_to_have"}], "preferences": [string], "limitations": [string]},
  "decision_context": {"motivation": string|null, "purchase_timeline": string, "funding_source": string, "readiness": string, "decision_stage": string},
  "canonical_attributes": {"needs": [string], "funding_source": string, "purchase_timeline": string},
  "evidence_links": [string (id факта или цитаты из facts.json)],
  "confidence": number 0-1
}`;

// ── Stage 3: Outcome & Next Step (spec §4) ──

export const OUTCOME_TYPES = [
  "viewing_agreed",
  "meeting_agreed",
  "follow_up_required",
  "information_sent",
  "selection_preparation",
  "client_will_decide",
  "client_not_ready",
  "object_not_suitable",
  "request_closed",
  "no_agreement",
] as const;

export const OutcomeSchema = z.object({
  conversation_outcome: z
    .object({
      // A plain, catch-all string rather than a strict OUTCOME_TYPES enum
      // -- the prompt still asks the model for exactly one of those 10
      // values (kept as guidance, not a hard gate), but a near-miss
      // (wrong case, a synonym) should degrade to an unexpected label
      // here, not blow up the entire stage.
      type: z.string().catch("no_agreement"),
      summary: z.string().catch(""),
      client_status: z.string().optional(),
      resolved_questions: z.array(z.string()).catch([]),
      unresolved_questions: z.array(z.string()).catch([]),
    })
    .catch({ type: "no_agreement", summary: "", resolved_questions: [], unresolved_questions: [] }),
  agreements: z
    .array(
      z.object({
        id: z.string().catch(""),
        owner: z.string().catch("agent"),
        action: z.string().catch(""),
        deadline: z.object({ value: z.string().optional(), normalized: z.string().nullable().optional() }).optional().catch(undefined),
        channel: z.string().optional(),
        status: z.string().catch("agreed"),
        evidence: EvidenceSchema.optional().catch(undefined),
      }),
    )
    .catch([]),
  next_step: z
    .object({
      primary: z
        .object({ owner: z.string().optional(), action: z.string().optional(), deadline: z.string().optional(), channel: z.string().optional() })
        .nullable()
        .catch(null),
      client_commitment: z.string().nullable().optional(),
      is_specific: looseBool(false),
      is_agreed: looseBool(false),
    })
    .catch({ primary: null, is_specific: false, is_agreed: false }),
  conversation_closed: looseBool(false),
  confidence: looseConfidence(0.7),
});
export type Outcome = z.infer<typeof OutcomeSchema>;

const OUTCOME_PROMPT = `Ты определяешь итог звонка: чем разговор фактически закончился, что было согласовано, кто должен выполнить действие и что происходит дальше с заявкой.

КРИТИЧЕСКИ ВАЖНО НЕ ОБЪЕДИНЯТЬ В ОДНО ПОЛЕ:
- Результат разговора (conversation_outcome) — что изменилось по итогам звонка.
- Договорённость (agreements) — что стороны согласовали.
- Следующий шаг (next_step) — что конкретно должно произойти дальше, кто и когда.

Тип результата (conversation_outcome.type) — выбери ровно один из справочника: ${OUTCOME_TYPES.join(", ")}.
Если в разговоре не было согласованного следующего шага — next_step.primary должен быть null, is_agreed:false. За честное "шаг не согласован" оценка не снижается.

ТРАНСКРИБАЦИЯ
{{transcript}}

ИЗВЛЕЧЁННЫЕ ФАКТЫ (facts.json)
{{facts}}

Верни СТРОГО валидный JSON без markdown и пояснений по схеме:
{
  "conversation_outcome": {"type": "${OUTCOME_TYPES[0]}"|..., "summary": string, "client_status": string, "resolved_questions": [string], "unresolved_questions": [string]},
  "agreements": [{"id": "agreement_001", "owner": "agent"|"client"|"both", "action": string, "deadline": {"value": string, "normalized": string|null}, "channel": string, "status": "agreed"|"proposed"|"rejected", "evidence": {"turn_id": number, "quote": string}}],
  "next_step": {"primary": {"owner": string, "action": string, "deadline": string, "channel": string}|null, "client_commitment": string|null, "is_specific": boolean, "is_agreed": boolean},
  "conversation_closed": boolean,
  "confidence": number 0-1
}`;

// ── Stage 4: Summary Generator (spec §5-§8) ──

function clampedStringArray(limit: number) {
  return z
    .array(z.unknown())
    .optional()
    .transform((arr) => (arr ?? []).slice(0, limit).map((item) => (typeof item === "string" ? item : JSON.stringify(item))));
}

const SummaryOkSchema = z.object({
  summary_status: z.literal("ok"),
  conversation_result: z.string().catch(""),
  key_facts: clampedStringArray(4),
  important_quotes: clampedStringArray(2),
  agreements_next_step: z.string().catch(""),
});
const SummaryIncompleteSchema = z.object({
  summary_status: z.literal("input_data_incomplete"),
  missing_fact: z.object({ description: z.string().catch(""), turn_id: z.number().optional() }).catch({ description: "" }),
  conversation_result: z.string().optional(),
  key_facts: clampedStringArray(4),
  important_quotes: clampedStringArray(2),
  agreements_next_step: z.string().optional(),
});

// Only "input_data_incomplete" (the deliberate, narrow escape hatch from
// spec §5) is treated as that branch; anything else -- including a
// missing/mistyped/translated summary_status -- normalizes to "ok" before
// validation, so a model that forgot the discriminator field entirely
// still produces a usable summary instead of failing the whole stage.
export const SummarySchema = z.preprocess((value) => {
  if (value && typeof value === "object" && (value as Record<string, unknown>).summary_status !== "input_data_incomplete") {
    return { ...(value as Record<string, unknown>), summary_status: "ok" };
  }
  return value;
}, z.union([SummaryOkSchema, SummaryIncompleteSchema]));
export type Summary = z.infer<typeof SummarySchema>;

const SUMMARY_PROMPT = `Ты формируешь короткое человеческое summary звонка для агента, который его не слушал.

ПРИОРИТЕТ ИСТОЧНИКОВ (обязательно к соблюдению)
1. JSON предыдущих этапов (facts/needs/outcome) — основной источник фактов, потребностей, ограничений, результата, договорённостей, следующего шага, цитат.
2. Транскрибация — используется только для связности, естественной формулировки, точного воспроизведения цитат и разрешения неоднозначности. Транскрибация НЕ разрешает: добавлять факты, которых нет в JSON; самостоятельно менять потребность; самостоятельно определять новый следующий шаг; считать предложение агента согласованной договорённостью.

Если транскрибация содержит важный факт, которого нет в JSON — верни summary_status:"input_data_incomplete" с missing_fact вместо того, чтобы молча использовать этот факт.

ФОРМАТ "ИТОГ РАЗГОВОРА" (conversation_result)
- Связный деловой текст, простой стиль, без канцелярита и покадрового пересказа.
- Адаптивный объём: очень короткий/одна тема — 2 предложения; стандартный звонок — 3 предложения; сложный звонок с несколькими требованиями — до 4 предложений; нет содержательного разговора — 1-2 предложения. Не растягивай искусственно.
- Не выводи неизвестные данные, не дублируй карточку без необходимости.

КЛЮЧЕВЫЕ ФАКТЫ (key_facts, максимум 4, по приоритету)
1. Главное требование клиента. 2. Бюджет/финансирование/срок, если влияют на работу. 3. Ключевое ограничение или возражение. 4. Готовность к действию или существенное условие. 5. Важный незакрытый вопрос.
НЕ включай автоматически: адрес объекта, стоимость объекта, площадь, этаж, имя агента, имя клиента, технический канал связи, данные уже видимые в карточке CRM ({{crm_fields_visible}}), малозначимые подробности, все найденные потребности подряд.

ВАЖНЫЕ ЦИТАТЫ (important_quotes, максимум 2) — только если реально передают позицию, ограничение или готовность клиента.

ДОГОВОРЁННОСТИ / СЛЕДУЮЩИЙ ШАГ (agreements_next_step) — одно предложение. Если шаг не согласован — так и напиши, это не ошибка.

ТРАНСКРИБАЦИЯ
{{transcript}}

FACTS.JSON
{{facts}}

NEEDS.JSON
{{needs}}

OUTCOME.JSON
{{outcome}}

Верни СТРОГО валидный JSON без markdown и пояснений. Если данных достаточно:
{"summary_status": "ok", "conversation_result": string, "key_facts": [string, максимум 4], "important_quotes": [string, максимум 2], "agreements_next_step": string}
Если транскрибация содержит важный факт, отсутствующий в JSON:
{"summary_status": "input_data_incomplete", "missing_fact": {"description": string, "turn_id": number}}`;

// ── Stage 5: Summary Quality Gate (spec §9-§14) — единая форма для AI и человека ──

export const CRITERION_KEYS = ["faithfulness", "completeness", "usefulness", "agreements_next_step", "format"] as const;
export type CriterionKey = (typeof CRITERION_KEYS)[number];

export const CRITERION_LABELS: Record<CriterionKey, string> = {
  faithfulness: "Достоверность",
  completeness: "Полнота критически важной информации",
  usefulness: "Полезность для агента",
  agreements_next_step: "Договорённости и следующий шаг",
  format: "Формат, структура и краткость",
};

// Равные веса по 20% на критерий -- прямое требование задачи (переопределяет
// иллюстративный пример из §13 приложенной спеки, где веса были 30/25/20/15/10).
export const CRITERION_WEIGHT = 0.2;

// A missing/malformed criterion here must never silently pass as a 4 --
// that would inflate the score exactly where honesty matters most.
// looseScore04's own fallback is deliberately 2 (a below-passing "existing
// but weak" score), and a criterion whose sub-object is missing entirely
// also lands on raw_score:2, not on a full parse failure.
const CriterionRawSchema = z.object({ raw_score: looseScore04(2), comment: z.string().optional() }).catch({ raw_score: 2 });
export const QualityScoresRawSchema = z.object({
  faithfulness: CriterionRawSchema,
  completeness: CriterionRawSchema,
  usefulness: CriterionRawSchema,
  agreements_next_step: CriterionRawSchema,
  format: CriterionRawSchema,
});
export type QualityScoresRaw = z.infer<typeof QualityScoresRawSchema>;

const QualityIssueSchema = z.object({
  type: looseEnum(CALL_SUMMARY_ERROR_TYPES, "FORMAT_VIOLATION"),
  critical: looseBool(false),
  comment: z.string().optional(),
});
export type QualityIssue = z.infer<typeof QualityIssueSchema>;

export const QualityJudgeRawSchema = z.object({
  scores: QualityScoresRawSchema,
  issues: z.array(QualityIssueSchema).catch([]),
});
export type QualityJudgeRaw = z.infer<typeof QualityJudgeRawSchema>;

export type QualityDecision = "PASS" | "PASS_WITH_MINOR_ISSUES" | "REGENERATE_SUMMARY" | "REVIEW_REQUIRED";

export type QualityReport = Readonly<{
  evaluation_version: string;
  scores: Record<CriterionKey, { raw_score: number; score: number; weight: number; comment?: string }>;
  overall_score: number;
  blocking_errors: readonly QualityIssue[];
  decision: QualityDecision;
}>;

/**
 * The one deterministic function both the AI judge's raw scores and a
 * saved human evaluation are run through -- guarantees "AI и человек
 * используют одинаковые критерии/шкалу/веса/правила расчёта" (spec §9).
 * raw_score 0-4 -> criterion score 0-100 (§11), overall = simple average
 * over five equally-weighted criteria (§10-11), any issue marked
 * `critical` caps the overall at 60% (§12.1), then threshold decision (§14).
 */
export function computeQualityDecision(scores: QualityScoresRaw, issues: readonly QualityIssue[]): QualityReport {
  const blockingErrors = issues.filter((issue) => issue.critical);
  const perCriterion = Object.fromEntries(
    CRITERION_KEYS.map((key) => {
      const raw = scores[key].raw_score;
      return [key, { raw_score: raw, score: (raw / 4) * 100, weight: CRITERION_WEIGHT, comment: scores[key].comment }];
    }),
  ) as QualityReport["scores"];

  let overall = CRITERION_KEYS.reduce((sum, key) => sum + perCriterion[key].score * CRITERION_WEIGHT, 0);
  if (blockingErrors.length > 0) overall = Math.min(overall, 60);
  overall = Math.round(overall);

  const decision: QualityDecision = overall >= 95 ? "PASS" : overall >= 90 ? "PASS_WITH_MINOR_ISSUES" : overall >= 80 ? "REGENERATE_SUMMARY" : "REVIEW_REQUIRED";

  return { evaluation_version: "call_summary_quality_v1", scores: perCriterion, overall_score: overall, blocking_errors: blockingErrors, decision };
}

const QUALITY_GATE_PROMPT = `Ты — независимый оценщик качества summary звонка. Оцени ГОТОВЫЙ ТЕКСТ summary (не сам разговор) по пяти критериям, используя ТОЛЬКО дискретную шкалу 0-4 для каждого критерия:
4 — Полностью соответствует. 3 — Есть одно несущественное замечание. 2 — Есть существенный недостаток, но summary остаётся полезным. 1 — Серьёзная ошибка, требуется переработка. 0 — Критерий не выполнен.

КРИТЕРИИ (по 20% каждый)
1. Достоверность (faithfulness) — все ли факты, выводы и цитаты summary подтверждены транскрибацией и JSON? Блокирующие ошибки (если есть любая из них — отметь issue с critical:true): перепутана роль клиента/агента, придуман факт, искажён бюджет, искажён срок, неверно указана договорённость, клиенту приписано предложение агента, цитата меняет смысл.
2. Полнота (completeness) — передано ли всё критически важное для продолжения работы (цель обращения, потребность, требования, бюджет/срок, ограничение/возражение, результат, незакрытые вопросы — если они были в разговоре)?
3. Полезность для агента (usefulness) — позволяет ли summary быстро понять клиента и продолжить работу без прослушивания записи?
4. Договорённости и следующий шаг (agreements_next_step) — понятно ли, что дальше, кто отвечает и когда? Если шага не было согласовано и summary честно об этом пишет — это НЕ ошибка, снижать оценку нельзя.
5. Формат, структура и краткость (format) — краткость, структура, отсутствие дублей и повторов.

Также отметь любые найденные проблемы как issues по справочнику типов: ${CALL_SUMMARY_ERROR_TYPES.join(", ")}. Используй critical:true только для действительно блокирующих ошибок (см. критерий 1).

ПРОВЕРЯЕМОЕ SUMMARY
{{summary}}

FACTS.JSON
{{facts}}

NEEDS.JSON
{{needs}}

OUTCOME.JSON
{{outcome}}

ТРАНСКРИБАЦИЯ (для проверки соответствия)
{{transcript}}

Верни СТРОГО валидный JSON без markdown и пояснений по схеме:
{
  "scores": {
    "faithfulness": {"raw_score": 0-4, "comment": string},
    "completeness": {"raw_score": 0-4, "comment": string},
    "usefulness": {"raw_score": 0-4, "comment": string},
    "agreements_next_step": {"raw_score": 0-4, "comment": string},
    "format": {"raw_score": 0-4, "comment": string}
  },
  "issues": [{"type": "FACT_INVENTED", "critical": boolean, "comment": string}]
}`;

// ── Stage config (data-driven, editable in the panel — same convention as ad-copy-test-bench.ts) ──

export type CallSummaryStageId = "facts" | "needs" | "outcome" | "summary" | "quality_gate";

export type CallSummaryStageConfig = Readonly<{
  id: CallSummaryStageId;
  enabled: boolean;
  name: string;
  type: "llm" | "judge";
  model: string;
  prompt: string;
  outKey: string;
  // Generous per-stage output budgets -- a real, messy call transcript
  // needs real room for evidence-heavy structured JSON; the shared BYOK
  // client's own default (2000) reliably truncates facts/needs/outcome
  // output on non-trivial calls (confirmed live against AI Tunnel: a
  // ~2.7k-character transcript produced a response cut off mid-JSON).
  maxTokens: number;
  // A hung request should fail loudly in well under a minute, not leave
  // the user staring at "выполняется…" -- confirmed live one such call
  // took 48.8s before failing anyway.
  timeoutMs: number;
}>;

// Defaults picked from MODEL_OPTIONS' own "(AI Tunnel)"-labeled entries
// -- unlike "gpt-5-mini"/"claude-sonnet-4.5" (labeled "(OpenAI)"/
// "(Anthropic)"), these are the models this app's own catalog marks as
// verified against the AI Tunnel proxy, which every stage gets routed
// through unconditionally once "AI Tunnel" is the selected provider in
// Настройки (callModelByName forwards whatever model string a stage is
// configured with, regardless of that model's own label/vendor). Still
// fully editable per stage in the panel regardless of provider.
const DEFAULT_EXTRACTION_MODEL = "gpt-4o-mini";
const DEFAULT_JUDGE_MODEL = "deepseek-v3.2-exp";

export function defaultCallSummaryStages(): CallSummaryStageConfig[] {
  return [
    { id: "facts", enabled: true, name: "1. Факты и цитаты", type: "llm", model: DEFAULT_EXTRACTION_MODEL, prompt: FACTS_PROMPT, outKey: "facts", maxTokens: 4000, timeoutMs: 45000 },
    { id: "needs", enabled: true, name: "2. Потребности клиента", type: "llm", model: DEFAULT_EXTRACTION_MODEL, prompt: NEEDS_PROMPT, outKey: "needs", maxTokens: 3000, timeoutMs: 45000 },
    { id: "outcome", enabled: true, name: "3. Результат звонка и следующий шаг", type: "llm", model: DEFAULT_EXTRACTION_MODEL, prompt: OUTCOME_PROMPT, outKey: "outcome", maxTokens: 3000, timeoutMs: 45000 },
    { id: "summary", enabled: true, name: "4. Генерация summary", type: "llm", model: DEFAULT_EXTRACTION_MODEL, prompt: SUMMARY_PROMPT, outKey: "summary", maxTokens: 2500, timeoutMs: 45000 },
    { id: "quality_gate", enabled: true, name: "5. Summary Quality Gate", type: "judge", model: DEFAULT_JUDGE_MODEL, prompt: QUALITY_GATE_PROMPT, outKey: "quality_gate", maxTokens: 2500, timeoutMs: 45000 },
  ];
}

// ── JSON repair (duplicated, small, self-contained -- see file header for why this isn't imported from ad-copy-test-bench.ts) ──

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function extractBraceSpan(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}

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

function closeUnbalancedBrackets(text: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") stack.pop();
  }
  return stack.length > 0 ? text + stack.reverse().join("") : text;
}

export type JsonRepairResult = Readonly<{ ok: boolean; value?: unknown; repaired: boolean; rawText: string; error?: string }>;

export function repairAndParseJson(raw: string): JsonRepairResult {
  try {
    return { ok: true, value: parseJsonResponse(raw), repaired: false, rawText: raw };
  } catch {
    // fall through to repair
  }
  let candidate = extractBraceSpan(raw.trim().replace(/```json/gi, "").replace(/```/g, "").trim());
  candidate = candidate.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  candidate = fixControlCharsInsideStrings(candidate);
  candidate = candidate.replace(/,(\s*[}\]])/g, "$1");
  candidate = closeUnbalancedBrackets(candidate);
  try {
    return { ok: true, value: JSON.parse(candidate), repaired: true, rawText: raw };
  } catch (error) {
    return { ok: false, repaired: false, rawText: raw, error: errorMessage(error) };
  }
}

// ── Run engine ──

const COST_PER_1K_TOKENS: Record<string, number> = {
  "gpt-5-mini": 0.0006,
  "claude-sonnet-4.5": 0.006,
  "deepseek-v3.2-exp": 0.0004,
  "deepseek-v4-flash": 0.0004,
  "gpt-4o-mini": 0.0006,
  "gemini-2.5-flash-lite": 0.0003,
  "qwen3-235b-a22b-2507": 0.0004,
  "mistral-small-3.2-24b-instruct": 0.0004,
};
function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}
function estimateCost(model: string, tokens: number): number {
  return (tokens / 1000) * (COST_PER_1K_TOKENS[model] ?? 0.001);
}

function tmpl(str: string, vars: Readonly<Record<string, string>>): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}
function j(value: unknown): string {
  return value === undefined ? "—" : JSON.stringify(value, null, 2);
}

export type CallSummaryStageStatus = "idle" | "running" | "ok" | "bad";
export type CallSummaryStageReport = Readonly<{
  stageId: CallSummaryStageId;
  status: CallSummaryStageStatus;
  attempt?: number;
  output?: unknown;
  rawResponse?: string;
  jsonRepaired?: boolean;
  error?: string;
  durationMs?: number;
  tokens?: number;
  costUsd?: number;
}>;

export type CallSummaryPipelineResult = Readonly<{
  reports: Readonly<Record<CallSummaryStageId, CallSummaryStageReport>>;
  facts?: FactsQuotes;
  needs?: Needs;
  outcome?: Outcome;
  summary?: Summary;
  aiQualityReport?: QualityReport;
  retryCount: number;
  totalTokensEstimate: number;
  totalCostUsd: number;
  totalDurationMs: number;
  technicalError?: string;
}>;

const STAGE_SCHEMAS: Record<CallSummaryStageId, z.ZodTypeAny> = {
  facts: FactsQuotesSchema,
  needs: NeedsSchema,
  outcome: OutcomeSchema,
  summary: SummarySchema,
  quality_gate: QualityJudgeRawSchema,
};

const MAX_SUMMARY_ATTEMPTS = 2; // spec §14: "для MVP можно разрешить только один повтор"

export async function runCallSummaryPipeline(
  stages: readonly CallSummaryStageConfig[],
  transcript: string,
  crmFieldsVisible: readonly string[],
  onUpdate: (reports: Readonly<Record<string, CallSummaryStageReport>>) => void,
): Promise<CallSummaryPipelineResult> {
  const startAll = Date.now();
  let reports: Record<string, CallSummaryStageReport> = Object.fromEntries(
    stages.map((stage) => [stage.id, { stageId: stage.id, status: "idle" as const }]),
  );
  const emit = () => onUpdate({ ...reports });
  const setReport = (id: string, patch: Partial<CallSummaryStageReport>) => {
    reports = { ...reports, [id]: { ...reports[id], ...patch, stageId: id as CallSummaryStageId } };
    emit();
  };
  emit();

  let totalTokens = 0;
  let totalCostUsd = 0;

  const byId = new Map(stages.filter((s) => s.enabled).map((stage) => [stage.id, stage]));
  const ctx: { facts?: FactsQuotes; needs?: Needs; outcome?: Outcome; summary?: Summary; quality_gate?: QualityJudgeRaw } = {};
  // Declared here (before any early `return finalize(...)` below) so
  // `finalize()`'s closure never hits a temporal-dead-zone
  // ReferenceError on an early technical-error exit from stage 1/2/3.
  let retryCount = 0;
  let aiQualityReport: QualityReport | undefined;

  async function runStage(id: CallSummaryStageId, promptVars: Readonly<Record<string, string>>, attempt?: number): Promise<{ ok: boolean; parsed?: unknown }> {
    const stage = byId.get(id);
    if (!stage) return { ok: false };
    const startedMs = Date.now();
    setReport(id, { status: "running", attempt });
    try {
      const prompt = tmpl(stage.prompt, promptVars);
      const text = await callModelByName(prompt, stage.model, { maxTokens: stage.maxTokens, timeoutMs: stage.timeoutMs });
      const tokens = estimateTokens(prompt) + estimateTokens(text);
      const cost = estimateCost(stage.model, tokens);
      totalTokens += tokens;
      totalCostUsd += cost;

      const repair = repairAndParseJson(text);
      if (!repair.ok) {
        const preview = text.trim().slice(0, 200);
        setReport(id, {
          status: "bad",
          error: `JSON не удалось разобрать: ${repair.error}. Ответ модели (первые 200 символов): «${preview}${text.trim().length > 200 ? "…" : ""}»`,
          rawResponse: text,
          attempt,
          durationMs: Date.now() - startedMs,
          tokens,
          costUsd: cost,
        });
        return { ok: false };
      }
      const schema = STAGE_SCHEMAS[id];
      const validated = schema.safeParse(repair.value);
      if (!validated.success) {
        const issues = validated.error.issues.slice(0, 5).map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ");
        setReport(id, { status: "bad", error: `Ответ не соответствует контракту этапа: ${issues}`, rawResponse: text, jsonRepaired: repair.repaired, attempt, durationMs: Date.now() - startedMs, tokens, costUsd: cost });
        return { ok: false };
      }
      setReport(id, { status: "ok", output: validated.data, rawResponse: text, jsonRepaired: repair.repaired, attempt, durationMs: Date.now() - startedMs, tokens, costUsd: cost });
      return { ok: true, parsed: validated.data };
    } catch (error) {
      setReport(id, { status: "bad", error: errorMessage(error), attempt, durationMs: Date.now() - startedMs });
      return { ok: false };
    }
  }

  const factsResult = await runStage("facts", { transcript });
  if (!factsResult.ok) {
    return finalize("Этап «Факты и цитаты» завершился с технической ошибкой.");
  }
  ctx.facts = factsResult.parsed as FactsQuotes;

  const needsResult = await runStage("needs", { transcript, facts: j(ctx.facts) });
  if (!needsResult.ok) return finalize("Этап «Потребности» завершился с технической ошибкой.");
  ctx.needs = needsResult.parsed as Needs;

  const outcomeResult = await runStage("outcome", { transcript, facts: j(ctx.facts) });
  if (!outcomeResult.ok) return finalize("Этап «Результат и следующий шаг» завершился с технической ошибкой.");
  ctx.outcome = outcomeResult.parsed as Outcome;

  for (let attempt = 1; attempt <= MAX_SUMMARY_ATTEMPTS; attempt += 1) {
    const summaryResult = await runStage(
      "summary",
      { transcript, facts: j(ctx.facts), needs: j(ctx.needs), outcome: j(ctx.outcome), crm_fields_visible: crmFieldsVisible.join(", ") || "нет" },
      attempt,
    );
    if (!summaryResult.ok) return finalize("Этап «Генерация summary» завершился с технической ошибкой.");
    ctx.summary = summaryResult.parsed as Summary;

    const gateResult = await runStage(
      "quality_gate",
      { summary: j(ctx.summary), facts: j(ctx.facts), needs: j(ctx.needs), outcome: j(ctx.outcome), transcript },
      attempt,
    );
    if (!gateResult.ok) return finalize("Этап «Summary Quality Gate» завершился с технической ошибкой.");
    ctx.quality_gate = gateResult.parsed as QualityJudgeRaw;
    aiQualityReport = computeQualityDecision(ctx.quality_gate.scores, ctx.quality_gate.issues);
    retryCount = attempt - 1;

    if (aiQualityReport.decision !== "REGENERATE_SUMMARY" || attempt >= MAX_SUMMARY_ATTEMPTS) break;
  }

  return finalize();

  function finalize(technicalError?: string): CallSummaryPipelineResult {
    return {
      reports: reports as Record<CallSummaryStageId, CallSummaryStageReport>,
      facts: ctx.facts,
      needs: ctx.needs,
      outcome: ctx.outcome,
      summary: ctx.summary,
      aiQualityReport,
      retryCount,
      totalTokensEstimate: Math.round(totalTokens),
      totalCostUsd,
      totalDurationMs: Date.now() - startAll,
      technicalError,
    };
  }
}

// ── Per-stage mini-dashboard (compact numeric summary shown next to each stage card, not just raw JSON) ──

export type StageStatChip = Readonly<{ label: string; value: string }>;

/** Pure function: derives a short, stage-specific row of numbers from that stage's own validated output -- no LLM call, no side effects, safe to compute on every render. */
export function stageStatChips(stageId: CallSummaryStageId, output: unknown): readonly StageStatChip[] {
  if (output === undefined || output === null) return [];
  switch (stageId) {
    case "facts": {
      const data = output as Partial<FactsQuotes>;
      return [
        { label: "Фактов", value: String(data.facts?.length ?? 0) },
        { label: "Цитат", value: String(data.quotes?.length ?? 0) },
        { label: "Конфликтов", value: String(data.conflicts?.length ?? 0) },
        { label: "Не найдено", value: String(data.missing_critical_facts?.length ?? 0) },
      ];
    }
    case "needs": {
      const data = output as Partial<Needs>;
      return [
        { label: "Уверенность", value: data.confidence !== undefined ? `${Math.round(data.confidence * 100)}%` : "—" },
        { label: "Параметров", value: String(data.requirements?.object_parameters?.length ?? 0) },
        { label: "Ограничений", value: String(data.requirements?.limitations?.length ?? 0) },
        { label: "Локаций", value: String(data.requirements?.locations?.length ?? 0) },
      ];
    }
    case "outcome": {
      const data = output as Partial<Outcome>;
      return [
        { label: "Тип", value: data.conversation_outcome?.type ?? "—" },
        { label: "Договорённостей", value: String(data.agreements?.length ?? 0) },
        { label: "Шаг согласован", value: data.next_step?.is_agreed ? "да" : "нет" },
        { label: "Открытых вопросов", value: String(data.conversation_outcome?.unresolved_questions?.length ?? 0) },
      ];
    }
    case "summary": {
      const data = output as Summary;
      if (data.summary_status === "input_data_incomplete") return [{ label: "Статус", value: "неполные данные" }];
      return [
        { label: "Ключевых фактов", value: String(data.key_facts?.length ?? 0) },
        { label: "Цитат", value: String(data.important_quotes?.length ?? 0) },
        { label: "Символов", value: String(data.conversation_result?.length ?? 0) },
      ];
    }
    case "quality_gate": {
      const data = output as QualityJudgeRaw;
      const report = computeQualityDecision(data.scores, data.issues);
      return [
        { label: "Итог", value: `${report.overall_score}%` },
        { label: "Решение", value: report.decision },
        { label: "Блокеров", value: String(report.blocking_errors.length) },
      ];
    }
    default:
      return [];
  }
}
