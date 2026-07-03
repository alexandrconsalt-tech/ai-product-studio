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
    .register("prompt_quality_check", "1.0.0", QUALITY_CHECK_TEMPLATE, SEED_TIMESTAMP);
}

export const seededPromptRegistry: PromptRegistry = withSeedPrompts();
