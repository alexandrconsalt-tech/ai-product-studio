import { createHash } from "node:crypto";
import { SummaryV3Contract } from "../contracts/summary/v3/contract";
import { stableStringify } from "../contracts/schema-utils";
import type { SummaryAgentInputV3 } from "../contracts/summary-input/v3/contract";

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
): SummaryResolvedPromptV3 {
  const basePrompt = [
    "SYSTEM ROLE",
    "Ты — Summary Agent v3. Формируй краткое рабочее саммари разговора для продолжения работы агентом.",
    "",
    "BUSINESS RULES",
    "- Передай цель обращения, выясненное, результат, существенное ограничение и подтверждённый следующий шаг.",
    "- Не создавай покадровый пересказ.",
    "- Выбери не более 4 действительно нужных key facts и не более 2 значимых точных цитат.",
    "- Не выводи служебные ID, confidence, verification statuses и technical metadata.",
    "- Не дублируй CRM-card данные без необходимости для смысла разговора.",
    "- Источник средств и срок покупки добавляй в текст только при реальной рабочей ценности; не дублируй CRM-карточку.",
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
    "- next_step: одно конкретное предложение; если договорённости нет, прямо и кратко укажи это без выдумывания действия.",
    "- Верни ровно четыре поля: conversation_result, key_facts, quotes, next_step.",
    "- Верни только объект по JSON Schema; markdown и свободный текст запрещены.",
  ].join("\n");
  const resolvedPrompt = [
    basePrompt,
    `OUTPUT CONTRACT REFERENCE\n${SummaryV3Contract.id}@${SummaryV3Contract.version}\nschema_hash=${SummaryV3Contract.schemaHash}\nJSON_SCHEMA=${stableStringify(SummaryV3Contract.schema)}`,
    `CONVERSATION STORE V3 PAYLOAD\n${stableStringify(input.conversationStore)}`,
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
