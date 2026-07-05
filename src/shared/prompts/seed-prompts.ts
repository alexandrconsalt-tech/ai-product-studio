import { emptyPromptRegistry, type PromptRegistry } from "./prompt-registry";

/**
 * Real prompt bodies for the two demo `Prompt` entities seeded in
 * `demo-data.ts` (`prompt_call_summary`, `prompt_quality_check`).
 * Version "1.0.0" matches the `Prompt.version` field on those same
 * records so the two stay traceable to each other.
 *
 * `prompt_call_summary`'s output schema matches
 * `src/shared/model/call-analysis-summary.ts` exactly -- this is the
 * real business case from CLAUDE.md §3.3, not a placeholder.
 */
const CALL_SUMMARY_TEMPLATE = `Ты анализируешь транскрипт телефонного звонка между клиентом и агентом/контакт-центром.

Транскрипт:
{{transcript}}

Верни строго JSON со следующими полями (без пояснений и текста вне JSON):
{
  "кто": string,
  "тип_контакта": "contact_center" | "agent",
  "потребность": string,
  "бюджет": string (опционально),
  "срок": string (опционально),
  "способ_оплаты": string (опционально),
  "вопросы": string[],
  "статус": "new" | "thinking" | "in_progress" | "won" | "lost",
  "действие": string,
  "цитаты": string[] (минимум одна дословная цитата из транскрипта, обязательно)
}

Правила:
- Никогда не указывай конфиденциальные данные объекта (адрес, точную стоимость сделки), если контакт обработан контакт-центром (тип_контакта = "contact_center").
- Указывай имя клиента в поле "кто" только если уверен в его правильном произношении/написании из транскрипта.
- Поле "действие" всегда должно содержать конкретный следующий шаг, а не общую фразу.
- Каждое ключевое утверждение должно быть подкреплено цитатой в поле "цитаты".`;

const QUALITY_CHECK_TEMPLATE = `Ты проверяешь качество структурированного summary звонка перед сохранением в CRM.

Транскрипт:
{{transcript}}

Summary для проверки:
{{summary_json}}

Верни строго JSON:
{
  "approved": boolean,
  "confidence": number (0-1),
  "issues": string[]
}

Отклоняй (approved: false), если: отсутствует цитата хотя бы для одного ключевого поля, поле "действие" сформулировано неконкретно, или тип_контакта "contact_center" содержит данные объекта.`;

/**
 * Real template for the second demo pipeline, "Lead Qualification"
 * (CLAUDE.md §M.8, §30 BR-4). `real-stage.ts`'s `asStringVariables`
 * maps a plain-string upstream payload to both `transcript` and
 * `value` -- this prompt uses `{{value}}` since "lead description" is
 * not call-transcript-specific vocabulary the way `prompt_call_summary`
 * is.
 */
const LEAD_QUALIFICATION_TEMPLATE = `Ты оцениваешь входящий лид для приоритизации в очереди Sales.

Описание лида:
{{value}}

Верни строго JSON со следующими полями (без пояснений и текста вне JSON):
{
  "платежеспособность": "low" | "medium" | "high",
  "срок_покупки": string,
  "hotness": number (0-1),
  "обоснование": string,
  "цитаты": string[] (минимум одна дословная цитата из описания лида, обязательно)
}

Правила:
- hotness должен явно комбинировать платежеспособность и срок покупки -- не добавляй четвёртый сигнал (BR-4).
- Каждое ключевое утверждение должно быть подкреплено цитатой в поле "цитаты".`;

/**
 * Real template for the third demo pipeline, "Chat Classification".
 */
const CHAT_CLASSIFICATION_TEMPLATE = `Ты классифицируешь входящее сообщение чата поддержки.

Сообщение:
{{value}}

Верни строго JSON со следующими полями (без пояснений и текста вне JSON):
{
  "категория": "вопрос" | "жалоба" | "похвала" | "техническая_проблема" | "другое",
  "тональность": "positive" | "neutral" | "negative",
  "требует_эскалации": boolean,
  "цитаты": string[] (минимум одна дословная цитата из сообщения, обязательно)
}

Правила:
- "требует_эскалации" = true при явном указании на критичность, срочность или повторяющуюся проблему.
- Каждое ключевое утверждение должно быть подкреплено цитатой в поле "цитаты".`;

/**
 * Real templates for the fourth demo pipeline, "Pipeline Lab v3"
 * (CLAUDE.md §M.11 integration). These are the SAME prompt bodies as
 * `defaultPipeline()` in public/pipeline-lab-v3.html, adapted only
 * where that file's own `{{ctx.x}}` dot-path syntax doesn't match
 * this registry's `{{snake_case}}`-only variable regex
 * (prompt-registry.ts's `VARIABLE_PATTERN`) -- e.g. `{{ctx.facts}}`
 * becomes `{{facts}}`. Kept in sync with the real tool's wording by
 * hand; the standalone tool has its own independent template engine
 * and does not read from this registry.
 */
const PIPELINE_LAB_FACTS_TEMPLATE = `Ты — Fact Agent пайплайна анализа звонков по недвижимости.
Извлеки ФАКТЫ из транскрипции. Верни СТРОГО валидный JSON без markdown и пояснений.
Если факт не прозвучал — ставь null. Отсутствие данных — это нормально, ничего не выдумывай.
Для каждого факта, где возможно, приведи ДОСЛОВНУЮ цитату из транскрипции.

Схема:
{
  "client_name": <имя клиента или null>,
  "budget": <число в рублях или null>,
  "budget_citation": <дословная цитата или null>,
  "source_of_funds": [<массив из: "наличные","ипотека одобрена","ипотека в процессе","продажа своей квартиры","не определено">],
  "city_or_district": <город/район или null>,
  "phone_mentioned": <true/false — звучал ли номер телефона>
}

Транскрипция:
{{transcript}}`;

const PIPELINE_LAB_NEEDS_TEMPLATE = `Ты — Need Agent пайплайна анализа звонков по недвижимости.
Определи ПОТРЕБНОСТИ клиента из транскрипции. Верни СТРОГО валидный JSON без markdown.
Если потребность не обсуждалась — null или "не определено". Ничего не выдумывай.

Схема:
{
  "interested_in": [<из: "Новостройки","Вторичка","Ипотека","Строительство","Аренда">],
  "property_requirements": <краткое описание требований к объекту или null>,
  "timeline": <из: "до 1 месяца","2-3 месяца","3-6 месяцев","более 6 месяцев","не определено">,
  "timeline_citation": <дословная цитата или null>
}

Транскрипция:
{{transcript}}`;

const PIPELINE_LAB_OUTCOME_TEMPLATE = `Ты — Outcome Agent пайплайна анализа звонков по недвижимости.
Определи РЕЗУЛЬТАТ звонка. Верни СТРОГО валидный JSON без markdown.
Для следующего шага приведи ДОСЛОВНУЮ цитату из транскрипции, если она есть.

Схема:
{
  "call_result": <из: "назначен показ","назначен повторный звонок","клиент думает","отказ","нецелевой звонок">,
  "next_step": <конкретный следующий шаг или null>,
  "next_step_citation": <дословная цитата или null>,
  "agreements": [<достигнутые договорённости строками>]
}

Транскрипция:
{{transcript}}`;

const PIPELINE_LAB_SUMMARY_TEMPLATE = `Ты — Summary Agent. Составь ОДНО короткое саммари звонка (1-2 предложения, деловой тон) для карточки в CRM.
Саммари передаёт ТОЛЬКО суть и результат разговора (что решили / какой следующий шаг).
НЕ пересказывай и не перечисляй данные, которые уже показаны в отдельных карточках CRM: характеристики объекта (площадь, этаж, локацию), способ оплаты, источник средств, документы (собственники, обременения) и потребности клиента — их повторение в саммари ЗАПРЕЩЕНО, даже если они есть в данных ниже.
ЗАПРЕЩЕНО упоминать: номера телефонов, точные адреса, цены и суммы бюджета —
они уже есть в структурированных полях карточки CRM.
Верни СТРОГО валидный JSON без markdown (без поля highlights — краткие пункты не нужны, только один текст):
{
  "summary": <1-2 предложения: результат звонка и следующий шаг, без повторения структурированных фактов и потребностей>
}

Результат звонка: {{outcome}}
Потребности (только для контекста, не пересказывать): {{needs}}
Факты (только для контекста, не пересказывать): {{facts}}`;

const PIPELINE_LAB_CHECK_TEMPLATE = `Ты — независимый Check Agent (кросс-вендорная проверка).
Сверь саммари с данными хранилища и транскрипцией. Верни СТРОГО валидный JSON без markdown:
{
  "score": <0-100, точность и полнота саммари>,
  "hallucinations": [<утверждения саммари, которых НЕТ в данных или транскрипции>],
  "pii_found": [<телефоны, точные адреса или суммы, просочившиеся в саммари>],
  "issues": [<прочие проблемы строками>]
}

Саммари: {{summary}}
Данные хранилища: {{store}}

Транскрипция:
{{transcript}}`;

/**
 * Real templates for the fifth demo pipeline, "Генерация текстов
 * объявлений" (Ad Copy Generation, real-estate listings). Field names
 * referenced via `{{snake_case}}` match `src/shared/model/ad-copy-*.ts`
 * exactly -- CRM fields flow through stages 1-2 (Validation/Normalization,
 * both passthrough) unchanged, so the Benefit Extraction prompt below
 * sees the raw CRM fields directly; Generation and the Checker see a
 * fan-in merge of CRM + upstream stage output (Storage, `real-stage.ts`'s
 * `asRecord` array-merge), so they can reference both sets of variables.
 */
const AD_COPY_BENEFITS_TEMPLATE = `Ты — эксперт по анализу объектов недвижимости и продающему копирайтингу.
Проанализируй структурированные данные объекта недвижимости и определи преимущества, уникальное торговое предложение, целевую аудиторию и продающие тезисы.

Данные объекта:
Тип сделки: {{deal_type}}
Тип объекта: {{object_type}}
Город: {{city}}
Район: {{district}}
Улица: {{street}}
Комнат: {{rooms}}
Площадь: {{area}} м²
Этаж: {{floor}} из {{total_floors}}
Цена: {{price}}
Описание: {{description}}
Особенности: {{features}}
Ремонт: {{renovation}}
Балкон: {{balcony}}
Санузел: {{bathroom}}
Вид из окна: {{view}}
Инфраструктура: {{infrastructure}}
Парковка: {{parking}}
Ипотека: {{mortgage}}

Верни СТРОГО валидный JSON без markdown и пояснений с полями:
{
  "advantages": string[] (3-6 конкретных преимуществ объекта на основе реальных данных выше, ничего не выдумывай),
  "usp": string (одно уникальное торговое предложение — главный аргумент в пользу покупки),
  "strengths": string[] (сильные стороны локации, дома, планировки),
  "target_audience": string (для кого этот объект подходит лучше всего: семья, инвестор, молодая пара и т.д.),
  "selling_points": string[] (3-5 продающих тезисов для текста объявления),
  "style": string (рекомендуемый стиль объявления: деловой, эмоциональный, премиальный и т.д.)
}

Правила:
- Не выдумывай факты, которых нет в данных объекта.
- Если площадь, цена или район выделяются на рынке — обязательно укажи это как преимущество.
- target_audience должен логически следовать из типа объекта, площади, района и цены.`;

const AD_COPY_GENERATION_TEMPLATE = `Ты — профессиональный копирайтер объявлений недвижимости.
Составь продающее объявление на основе данных объекта и его преимуществ.

Данные объекта:
Тип сделки: {{deal_type}}
Тип объекта: {{object_type}}
Город: {{city}}
Район: {{district}}
Комнат: {{rooms}}, Площадь: {{area}} м², Этаж {{floor}} из {{total_floors}}
Цена: {{price}}
Ремонт: {{renovation}}, Балкон: {{balcony}}, Вид: {{view}}

Преимущества, УТП, целевая аудитория и стиль объявления (JSON от предыдущего этапа "Агент извлечения преимуществ" — используй поля advantages/usp/selling_points/target_audience/style, если они присутствуют):
{{value}}

Верни СТРОГО валидный JSON без markdown и пояснений с полями:
{
  "title": string (заголовок объявления, до 70 символов, содержит ключевые характеристики — тип объекта, район/город, ключевое преимущество),
  "description": string (текст объявления 3-6 предложений, продающая структура: зацепка -> характеристики -> преимущества -> призыв, без канцеляризмов и воды, на грамотном русском языке),
  "cta": string (короткий призыв к действию — записаться на просмотр, позвонить, оставить заявку)
}

Правила:
- Используй только факты из данных объекта и преимущества из JSON-контекста выше, ничего не выдумывай.
- Пиши в стиле и для целевой аудитории, указанных в JSON-контексте, если они там присутствуют.
- Не используй канцеляризмы, штампы и избыточные превосходные степени ("уникальный", "эксклюзивный") без основания в фактах.
- CTA должен быть конкретным действием, а не общей фразой.`;

const AD_COPY_CHECKER_TEMPLATE = `Ты — независимый контролёр качества объявлений недвижимости (самопроверка перед публикацией).
Сверь текст объявления с исходными данными объекта и правилами качества, исправь ошибки.

Исходные данные объекта:
Город: {{city}}, Район: {{district}}, Комнат: {{rooms}}, Площадь: {{area}} м², Цена: {{price}}

Проверяемое объявление и преимущества объекта (JSON от предыдущих этапов — используй поля title/description/cta и advantages, если они присутствуют):
{{value}}

Проверь и верни СТРОГО валидный JSON без markdown и пояснений:
{
  "facts_ok": boolean (все факты в объявлении соответствуют исходным данным, нет придуманных характеристик),
  "style_ok": boolean (стиль соответствует целевой аудитории, без канцеляризмов и штампов),
  "language_ok": boolean (нет орфографических и грамматических ошибок русского языка),
  "prohibited_words_ok": boolean (нет запрещённых слов: "лучший", "гарантия", "100%", вводящих в заблуждение формулировок),
  "readability_score": number (0-100, оценка читаемости текста),
  "seo_ok": boolean (заголовок и описание содержат релевантные для поиска характеристики: район, тип объекта, количество комнат),
  "duplicates_ok": boolean (нет повторов одних и тех же характеристик в заголовке и описании),
  "title": string (исправленный заголовок, если были ошибки — иначе тот же),
  "description": string (исправленное описание, если были ошибки — иначе то же),
  "cta": string (исправленный CTA, если были ошибки — иначе тот же),
  "issues": string[] (список найденных и исправленных проблем, пустой массив если проблем нет)
}

Правила:
- Если найдена ошибка — исправь её прямо в полях title/description/cta, не проси повторной генерации.
- confidence не пересчитывай здесь — это делает следующий этап (Контур качества), он использует confidence, который автоматически прикрепляется к твоему JSON-ответу.`;

/**
 * Fixed, matching `demo-data.ts`'s own `createdAt` constant --
 * deliberately NOT `new Date().toISOString()`. This registry is a
 * module-level singleton evaluated once on the server (SSR) and once
 * again on the client (hydration); a "now" timestamp would differ
 * between the two evaluations and cause a React hydration mismatch
 * wherever a registered version's `registeredAt` is rendered (found
 * via an actual in-browser check against the Prompt Inspector screen).
 */
const SEED_TIMESTAMP = "2026-06-29T10:00:00.000Z";

export function withSeedPrompts(registry: PromptRegistry = emptyPromptRegistry): PromptRegistry {
  return registry
    .register("prompt_call_summary", "1.0.0", CALL_SUMMARY_TEMPLATE, SEED_TIMESTAMP)
    .register("prompt_quality_check", "1.0.0", QUALITY_CHECK_TEMPLATE, SEED_TIMESTAMP)
    .register("prompt_lead_qualification", "1.0.0", LEAD_QUALIFICATION_TEMPLATE, SEED_TIMESTAMP)
    .register("prompt_chat_classification", "1.0.0", CHAT_CLASSIFICATION_TEMPLATE, SEED_TIMESTAMP)
    .register("prompt_pipeline_lab_facts", "1.0.0", PIPELINE_LAB_FACTS_TEMPLATE, SEED_TIMESTAMP)
    .register("prompt_pipeline_lab_needs", "1.0.0", PIPELINE_LAB_NEEDS_TEMPLATE, SEED_TIMESTAMP)
    .register("prompt_pipeline_lab_outcome", "1.0.0", PIPELINE_LAB_OUTCOME_TEMPLATE, SEED_TIMESTAMP)
    .register("prompt_pipeline_lab_summary", "1.0.0", PIPELINE_LAB_SUMMARY_TEMPLATE, SEED_TIMESTAMP)
    .register("prompt_pipeline_lab_check", "1.0.0", PIPELINE_LAB_CHECK_TEMPLATE, SEED_TIMESTAMP)
    .register("prompt_ad_benefits", "1.0.0", AD_COPY_BENEFITS_TEMPLATE, SEED_TIMESTAMP)
    .register("prompt_ad_generation", "1.0.0", AD_COPY_GENERATION_TEMPLATE, SEED_TIMESTAMP)
    .register("prompt_ad_checker", "1.0.0", AD_COPY_CHECKER_TEMPLATE, SEED_TIMESTAMP);
}

export const seededPromptRegistry: PromptRegistry = withSeedPrompts();
