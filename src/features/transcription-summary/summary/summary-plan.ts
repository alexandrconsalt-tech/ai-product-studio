import type { ConversationStoreV3 } from "../contracts/conversation-store/v3/contract";

export const SUMMARY_PLAN_VERSION = "summary-plan-v3.1.0" as const;

export type SummaryPlanBlock = "conversation_result" | "key_facts" | "next_step" | "quotes";

export type SummaryPlanMeaning = Readonly<{
  meaningId: string;
  kind: "client_goal" | "conversation_result" | "key_fact" | "primary_next_step" | "quote";
  block: SummaryPlanBlock;
  text: string;
  required: boolean;
  exclusive: boolean;
  sourceIds: readonly string[];
}>;

export type SummaryPlanV3 = Readonly<{
  version: typeof SUMMARY_PLAN_VERSION;
  meanings: readonly SummaryPlanMeaning[];
  crmCoverage: Readonly<{
    fundingSource: boolean;
    purchaseTerm: boolean;
    interest: boolean;
  }>;
}>;

function text(value: unknown): string {
  if (typeof value === "string") return value.replace(/\s+/gu, " ").trim();
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    return text(item.normalized_value ?? item.value ?? item.text ?? item.action ?? "");
  }
  return "";
}

function id(item: Record<string, unknown>, fallback: string): string {
  return text(item.id) || fallback;
}

function sourceIds(item: Record<string, unknown>, fallback: string): readonly string[] {
  const values = [
    id(item, fallback),
    ...(Array.isArray(item.source_turn_ids) ? item.source_turn_ids : []),
    ...(Array.isArray(item.source_fact_ids) ? item.source_fact_ids : []),
  ].map(text).filter(Boolean);
  return [...new Set(values)];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function definedAttribute(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(definedAttribute);
  const normalized = text(value).toLocaleLowerCase("ru-RU");
  return Boolean(normalized && normalized !== "не определено" && normalized !== "not_defined");
}

function primaryNextStep(store: ConversationStoreV3): string {
  const step = store.primary_next_step;
  if (step.status === "not_defined" || !text(step.action)) return "Следующий шаг не согласован.";
  const owner = text(step.owner).toLocaleLowerCase("ru-RU");
  const actor = owner === "agent" || owner === "агент" ? "Агент" : text(step.owner);
  const action = text(step.action)
    .replace(/^отправить(?=\s|$)/iu, "отправит")
    .replace(/^позвонить(?=\s|$)/iu, "позвонит")
    .replace(/^перезвонить(?=\s|$)/iu, "перезвонит")
    .replace(/^уточнить(?=\s|$)/iu, "уточнит")
    .replace(/^связаться(?=\s|$)/iu, "свяжется")
    .replace(/^встретиться(?=\s|$)/iu, "встретится");
  const actionLower = action.toLocaleLowerCase("ru-RU");
  const actorPrefix = actor && !actionLower.startsWith(actor.toLocaleLowerCase("ru-RU")) ? `${actor} ` : "";
  const parts = [`${actorPrefix}${action.charAt(0).toLocaleLowerCase("ru-RU")}${action.slice(1)}`];
  const add = (value: unknown) => {
    const normalized = text(value);
    if (normalized && !parts.join(" ").toLocaleLowerCase("ru-RU").includes(normalized.toLocaleLowerCase("ru-RU"))) {
      parts.push(normalized);
    }
  };
  add(step.deadline);
  const channel = text(step.channel);
  add(/^(?:e-?mail|электронная почта)$/iu.test(channel)
    ? "по электронной почте"
    : /^(?:phone|телефон|звонок)$/iu.test(channel)
      ? "по телефону"
      : /^(?:telegram|whatsapp|max)$/iu.test(channel)
        ? `в ${channel}`
        : channel);
  return `${parts.join(" ").replace(/[.;\s]+$/u, "")}.`;
}

function factType(item: Record<string, unknown>): string {
  return text(item.predicate ?? item.type ?? item.kind).toLocaleLowerCase("ru-RU");
}

/**
 * Builds the deterministic composition plan from the typed canonical Store.
 * The Store is the production v3 representation of Canonical Summary Context;
 * this function does not re-rank or mutate it.
 */
export function buildSummaryPlanV3(store: ConversationStoreV3): SummaryPlanV3 {
  const meanings: SummaryPlanMeaning[] = [];
  const used = new Set<string>();
  const add = (meaning: SummaryPlanMeaning) => {
    if (!meaning.text || used.has(meaning.meaningId)) return;
    used.add(meaning.meaningId);
    meanings.push(meaning);
  };

  store.facts.map(record).forEach((fact, index) => {
    const type = factType(fact);
    if (!/(?:client_goal|client goal|goal|цель обращения)/u.test(type)) return;
    const meaningId = id(fact, `client_goal_${index + 1}`);
    add({
      meaningId,
      kind: "client_goal",
      block: "conversation_result",
      text: text(fact),
      required: true,
      exclusive: false,
      sourceIds: sourceIds(fact, meaningId),
    });
  });

  if (text(store.call_result)) {
    add({
      meaningId: "conversation_result",
      kind: "conversation_result",
      block: "conversation_result",
      text: text(store.call_result),
      required: true,
      exclusive: false,
      sourceIds: ["conversation_result"],
    });
  }

  const keyCandidates = [
    ...store.requirements.map(record),
    ...store.facts.map(record).filter((fact) =>
      /(?:objection|constraint|legal|requirement|возраж|огранич|юрид|отриц)/u.test(factType(fact))),
  ];
  keyCandidates.slice(0, 4).forEach((item, index) => {
    const meaningId = id(item, `key_fact_${index + 1}`);
    add({
      meaningId,
      kind: "key_fact",
      block: "key_facts",
      text: text(item),
      required: true,
      exclusive: false,
      sourceIds: sourceIds(item, meaningId),
    });
  });

  add({
    meaningId: "primary_next_step",
    kind: "primary_next_step",
    block: "next_step",
    text: primaryNextStep(store),
    required: true,
    exclusive: true,
    sourceIds: ["primary_next_step"],
  });

  store.quotes.map(record).slice(0, 2).forEach((quote, index) => {
    const meaningId = id(quote, `quote_${index + 1}`);
    add({
      meaningId,
      kind: "quote",
      block: "quotes",
      text: text(quote),
      required: false,
      exclusive: false,
      sourceIds: sourceIds(quote, meaningId),
    });
  });

  const attributes = record(store.attributes);
  const interest = attributes.interested_in ?? attributes.interest;
  return Object.freeze({
    version: SUMMARY_PLAN_VERSION,
    meanings: Object.freeze(meanings),
    crmCoverage: Object.freeze({
      fundingSource: definedAttribute(attributes.funding_source),
      purchaseTerm: definedAttribute(attributes.purchase_term),
      interest: definedAttribute(interest),
    }),
  });
}
