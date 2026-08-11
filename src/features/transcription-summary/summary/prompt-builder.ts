import { createHash } from "node:crypto";
import { SummaryV3Contract } from "../contracts/summary/v3/contract";
import { stableStringify } from "../contracts/schema-utils";
import type { SummaryAgentInputV3 } from "../contracts/summary-input/v3/contract";
import { buildSummaryPlanV3, type SummaryPlanV3 } from "./summary-plan";

export type SummaryResolvedPromptV3 = Readonly<{
  basePrompt: string;
  resolvedPrompt: string;
  promptVersion: string;
  promptHash: string;
  storeId: string;
  storeContentHash: string;
  contractId: string;
  contractVersion: string;
  schemaHash: string;
}>;

export function buildSummaryPromptV3(
  input: SummaryAgentInputV3,
  summaryPlan: SummaryPlanV3 = buildSummaryPlanV3(input.conversationStore),
): SummaryResolvedPromptV3 {
  const basePrompt = [
    "SYSTEM ROLE",
    "Ты — Summary Agent v3. Формируй краткое рабочее саммари разговора для продолжения работы агентом.",
    "",
    "BUSINESS RULES",
    "- SUMMARY PLAN уже ранжирован: включи все P0; включи selected P1; P2 используй только если он присутствует в Plan.",
    "- Агент за 5–10 секунд должен понять цель клиента, выясненное, препятствие/влияющий фактор, итог разговора и следующий шаг.",
    "- Не создавай покадровый пересказ.",
    "- conversation_result: 1–3 коротких предложения; цель + ключевая ситуация + терминальный результат. Не повторяй точное действие, deadline, место или channel next step.",
    "- key_facts: 0–4, каждый пункт добавляет новый meaning. Используй только label из SUMMARY PLAN; generic labels «Ключевой факт», «Ключевой факт 2», «Информация» запрещены.",
    "- quotes по умолчанию []; максимум 2 только для уникального возражения, мотива или жёсткого условия. Цитата должна быть полной точной репликой клиента.",
    "- Не цитируй цель просмотра, адрес, финансирование или следующий шаг.",
    "- Не выводи служебные ID, confidence, verification statuses и technical metadata.",
    "- Не включай имя клиента и агента: используй только роли Клиент и Агент.",
    "- Не добавляй оценочные характеристики вроде «существенное ограничение», если такая оценка прямо не подтверждена источником.",
    "- Не дублируй CRM-card данные без необходимости для смысла разговора.",
    "- Источник средств и срок покупки добавляй в текст только при реальной рабочей ценности; не дублируй CRM-карточку.",
    "- Не включай карточечные параметры текущего объекта, «двухкомнатная квартира (интерес)», оценочные формулировки модели и длинные юридические пересказы.",
    "- Один meaning может находиться только в одном блоке; conversation_result и key_facts не должны повторять друг друга.",
    "- Состав блоков задан SUMMARY PLAN. Ты формулируешь текст, но не переносишь meaning между блоками и не удаляешь required meaning.",
    "- primary_next_step выводи только в next_step; точное действие, время, место и канал не повторяй в conversation_result.",
  ].join("\n");
  const sourcePriority = [
    "SOURCE PRIORITY",
    "1. Conversation Store v3 — структурированный источник извлечённых данных.",
    "2. Полная транскрипция — равноправный источник для восстановления связей реплик, ролей, контекста, основного смысла и проверки Store.",
    "3. При конфликте выбирай формулировку, достоверно подтверждённую транскрипцией.",
    "4. Не добавляй сведения, которых нет ни в Store, ни в транскрипции.",
  ].join("\n");
  const constraints = [
    "OUTPUT CONSTRAINTS",
    `- key_facts: максимум ${input.outputPolicy.maxKeyFacts}, каждый элемент содержит только label и value.`,
    `- quotes: максимум ${input.outputPolicy.maxQuotes}, каждый элемент содержит только text.`,
    "- next_step: одно предложение только из primary_next_step; при status=not_defined верни строго «Следующий шаг не согласован.».",
    "- Верни ровно четыре поля: conversation_result, key_facts, quotes, next_step.",
    "- Верни только объект по JSON Schema; markdown и свободный текст запрещены.",
  ].join("\n");
  const resolvedPrompt = [
    basePrompt,
    `OUTPUT CONTRACT REFERENCE\n${SummaryV3Contract.id}@${SummaryV3Contract.version}\nschema_hash=${SummaryV3Contract.schemaHash}\nJSON_SCHEMA=${stableStringify(SummaryV3Contract.schema)}`,
    `CONVERSATION STORE V3 PAYLOAD\n${stableStringify(input.conversationStore)}`,
    `SUMMARY PLAN\n${stableStringify(summaryPlan)}`,
    `FULL TRANSCRIPT CONTEXT\n${stableStringify(input.transcriptContext)}`,
    sourcePriority,
    constraints,
  ].join("\n\n");
  return Object.freeze({
    basePrompt,
    resolvedPrompt,
    promptVersion: input.meta.summaryPromptVersion,
    promptHash: createHash("sha256").update(resolvedPrompt).digest("hex"),
    storeId: input.meta.storeId,
    storeContentHash: input.conversationStore.content_hash,
    contractId: SummaryV3Contract.id,
    contractVersion: SummaryV3Contract.version,
    schemaHash: SummaryV3Contract.schemaHash,
  });
}
