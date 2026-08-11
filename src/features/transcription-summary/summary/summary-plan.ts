import type { ConversationStoreV3 } from "../contracts/conversation-store/v3/contract";
import { selectUsefulClientQuotesV3 } from "../runtime/quote-policy";

export const SUMMARY_PLAN_VERSION = "summary-plan-v3.2.0" as const;
export type SummaryMeaningPriority = "P0" | "P1" | "P2";

export type SummaryPlanBlock = "conversation_result" | "key_facts" | "next_step" | "quotes";

export type SummaryPlanMeaning = Readonly<{
  meaningId: string;
  kind: "client_goal" | "conversation_result" | "key_fact" | "primary_next_step" | "quote";
  block: SummaryPlanBlock;
  text: string;
  required: boolean;
  exclusive: boolean;
  priority?: SummaryMeaningPriority;
  label?: string;
  sourceIds: readonly string[];
}>;

export type SummaryPlanV3 = Readonly<{
  version: typeof SUMMARY_PLAN_VERSION | "summary-plan-v3.1.0";
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
  const actor = /(?:^|\s)(?:agent|агент|operator|оператор)(?:\s|$)/u.test(owner) ? "Агент"
    : /(?:^|\s)(?:client|клиент)(?:\s|$)/u.test(owner) ? "Клиент"
      : text(step.owner);
  const action = text(step.action)
    .replace(/^провести\s+просмотр(?:\s+объекта)?(?=\s|$)/iu, "проведёт просмотр")
    .replace(/^отправить(?=\s|$)/iu, "отправит")
    .replace(/^позвонить(?=\s|$)/iu, "позвонит")
    .replace(/^перезвонить(?=\s|$)/iu, "перезвонит")
    .replace(/^уточнить(?=\s|$)/iu, "уточнит")
    .replace(/^связаться(?=\s|$)/iu, "свяжется")
    .replace(/^встретиться(?=\s|$)/iu, "встретится")
    .replace(/\s+и\s+сообщить(?=\s|,|$)/iu, " и сообщит")
    .replace(/\s+и\s+подтвердить(?=\s|,|$)/iu, " и подтвердит")
    .replace(/\s+и\s+уточнить(?=\s|,|$)/iu, " и уточнит");
  const actionLower = action.toLocaleLowerCase("ru-RU");
  const actorPrefix = actor && !actionLower.startsWith(actor.toLocaleLowerCase("ru-RU")) ? `${actor} ` : "";
  const parts = [`${actorPrefix}${action.charAt(0).toLocaleLowerCase("ru-RU")}${action.slice(1)}`];
  const add = (value: unknown) => {
    const normalized = text(value);
    if (normalized && !parts.join(" ").toLocaleLowerCase("ru-RU").includes(normalized.toLocaleLowerCase("ru-RU"))) {
      parts.push(normalized);
    }
  };
  const deadline = text(step.deadline)
    .replace(/^пятница,?\s*пятнадцатого,?\s*(?:в\s*)?(\d{1,2}:\d{2})$/iu, "в пятницу, 15-го, в $1")
    .replace(/^пятница,?\s*(\d+)\s+число,?\s*(?:в\s*)?(\d{1,2}:\d{2})$/iu, "в пятницу, $1-го, в $2")
    .replace(/^пятница,?\s*(\d+)-(?:е|ое|го)(?:\s+числ[оа])?,?\s*(?:в\s*)?(\d{1,2}:\d{2})$/iu, "в пятницу, $1-го, в $2");
  add(deadline);
  const channel = text(step.channel);
  if (!/(?:личн|на объекте|in_person)/iu.test(channel)) add(/^(?:e-?mail|электронная почта)$/iu.test(channel)
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

function clientGoalText(fact: Record<string, unknown>): string {
  const evidence = text(fact.evidence);
  const type = factType(fact);
  if (/(?:searching_for|подбира)/u.test(type) && /(?:себе|для\s+себя)/iu.test(evidence)) {
    return "Клиент подбирает квартиру для себя";
  }
  return text(fact);
}

function fundingContextText(facts: readonly Record<string, unknown>[]): string {
  const source = facts.map((fact) => `${text(fact)} ${text(fact.evidence)}`).join(" ");
  if (/деньг\S*\s+на\s+счет/iu.test(source) && /родител\S*\s+покуп/iu.test(source)) {
    return "Деньги находятся на счёте, покупку оплачивают родители";
  }
  if (/деньг\S*\s+на\s+счет/iu.test(source)) return "Деньги находятся на счёте";
  if (/(?:свои|собственн)\S*\s+(?:деньг|средств)|за\s+наличн/iu.test(source)) return "наличные / собственные средства";
  return facts.map(text).filter(Boolean).join("; ");
}

function outcomeMeaning(item: Record<string, unknown>): boolean {
  return /(?:осмотр|просмотр|встреч|показ|позвон|перезвон|звонок|созвон|отправ|пришл|направ|договоренн|appointment|meeting|viewing)/iu.test(
    `${text(item.need_type)} ${text(item.value)}`,
  );
}

function keyPriority(item: Record<string, unknown>): number {
  const value = `${text(item.need_type)} ${text(item.value)} ${factType(item)}`.toLocaleLowerCase("ru-RU");
  if (/(?:бюджет|budget|руб|₽|млн|миллион)/u.test(value)) return 0;
  if (/(?:ипотек|funding|финанс|средств|депозит|наличн)/u.test(value)) return 1;
  if (/(?:срок|term|месяц|покупк)/u.test(value)) return 2;
  if (/(?:возраж|огранич|юрид|не рассматрива|критич)/u.test(value)) return 3;
  return 4;
}

function semanticPriority(item: Record<string, unknown>): SummaryMeaningPriority {
  const value = `${text(item.need_type)} ${text(item.value)} ${factType(item)} ${text(item.evidence)}`.toLocaleLowerCase("ru-RU");
  if (/(?:отказ|не\s+буду\s+продолж|не\s+готов\S*\s+покуп|причин\S*\s+отказ|юрид\S*\s+риск|обремен|несколько\s+собственник|долг|блокир|без\s+котор|критич\S*\s+огранич|открыт\S*\s+вопрос|выход\s+на\s+сделк\S*\s+возможен\s+после|после\s+получения\s+разрешен\S*\s+на\s+продаж)/u.test(value)) return "P0";
  if (/(?:цель|бюджет|funding|финанс|ипотек|наличн|депозит|срок|term|требован|возраж|огранич|важн|нужн|не\s+рассматрива)/u.test(value)) return "P1";
  return "P2";
}

function semanticLabel(item: Record<string, unknown>): string {
  const value = `${text(item.need_type)} ${text(item.value)} ${factType(item)} ${text(item.evidence)}`.toLocaleLowerCase("ru-RU");
  if (/(?:задат|аванс)/u.test(value)) return "Задаток";
  if (/(?:прямая\s+продаж|продаж\S*\s+прям|тип\s+продаж)/u.test(value)) return "Продажа";
  if (/(?:бюджет|budget|руб|₽|млн|миллион)/u.test(value)) return "Бюджет";
  if (/(?:funding|финанс|ипотек|наличн|депозит|средств|деньг)/u.test(value)) return "Финансирование";
  if (/(?:срок|term|месяц|недел)/u.test(value)) return "Срок";
  if (/(?:открыт\S*\s+вопрос|нужно\s+уточн|ожидает\s+ответ)/u.test(value)) return "Открытый вопрос";
  if (/(?:возраж|отказ|не\s+подход|дорог|высок\S*\s+цен)/u.test(value)) return "Возражение";
  if (/(?:документ|оригинал|подготовк\S*\s+документ|объедин\S*\s+дол|снят\S*\s+зарегистрирован)/u.test(value)) return "Документы";
  if (/(?:юрид|собствен|дду|обремен|пропис|зарегистрирован|долг)/u.test(value)) return "Юридический статус";
  if (/(?:выход\s+на\s+сделк|разрешен\S*\s+на\s+продаж)/u.test(value)) return "Ограничение сделки";
  if (/(?:огранич|не\s+рассматрива|критич|только|не\s+менее|не\s+более)/u.test(value)) return "Ограничение";
  return "Требование";
}

function semanticTokens(value: string): ReadonlySet<string> {
  return new Set(value
    .normalize("NFKC")
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/gu, "е")
    .match(/[\p{L}\p{N}]+/gu)
    ?.filter((token) => token.length > 2) ?? []);
}

function semanticOverlap(left: string, right: string): number {
  const leftTokens = semanticTokens(left);
  const rightTokens = semanticTokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  let shared = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) shared += 1;
  return shared / Math.min(leftTokens.size, rightTokens.size);
}

function coveredByConversationResult(item: Record<string, unknown>, callResult: string): boolean {
  const candidate = `${text(item)} ${text(item.evidence)}`;
  if (semanticOverlap(candidate, callResult) >= 0.6) return true;
  const terminalRefusal = /(?:отказ|не\s+подход|не\s+буду\s+продолж|завершил\S*\s+разговор)/iu;
  return terminalRefusal.test(candidate) && terminalRefusal.test(callResult);
}

function coveredByCrm(item: Record<string, unknown>, coverage: SummaryPlanV3["crmCoverage"]): boolean {
  const value = `${text(item.need_type)} ${text(item.value)} ${factType(item)}`.toLocaleLowerCase("ru-RU");
  if (coverage.fundingSource && /(?:ипотек|funding|финанс|средств|депозит|наличн)/u.test(value)) return true;
  if (coverage.purchaseTerm && /(?:срок|term|месяц)/u.test(value)) return true;
  if (coverage.interest && /(?:интерес|interest)/u.test(value)) return true;
  return false;
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

  const attributes = record(store.attributes);
  const interest = attributes.interested_in ?? attributes.interest;
  const crmCoverage: SummaryPlanV3["crmCoverage"] = {
    fundingSource: definedAttribute(attributes.funding_source),
    purchaseTerm: definedAttribute(attributes.purchase_term),
    interest: definedAttribute(interest),
  };

  store.facts.map(record).forEach((fact, index) => {
    const type = factType(fact);
    if (!/(?:client_goal|client goal|goal|цель обращения|searching_for|подбирает\s+для)/u.test(type)) return;
    const meaningId = id(fact, `client_goal_${index + 1}`);
    add({
      meaningId,
      kind: "client_goal",
      block: "conversation_result",
      text: clientGoalText(fact),
      required: true,
      exclusive: false,
      priority: "P1",
      label: "Цель",
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
      priority: "P0",
      sourceIds: ["conversation_result"],
    });
  }

  const financingFacts = store.facts.map(record).filter((fact) =>
    /(?:financing|funding|источник\s+средств|финанс)/u.test(factType(fact))
    && /(?:деньг\S*\s+на\s+счет|родител\S*\s+покуп|собственн\S*\s+средств|свои\s+деньг|за\s+наличн)/iu.test(`${text(fact)} ${text(fact.evidence)}`));
  const fundingAttribute = record(attributes.funding_source);
  const verifiedFundingSources = financingFacts.length
    ? financingFacts
    : definedAttribute(fundingAttribute)
      && /(?:деньг\S*\s+на\s+счет|родител\S*\s+покуп|собственн\S*\s+средств|свои\s+деньг|за\s+наличн)/iu.test(text(fundingAttribute.evidence))
      ? [fundingAttribute]
      : [];
  const conditionalViewingAgreement = store.agreements.map(record).find((agreement) =>
    /(?:если\s+(?:что|получится|сможем|подтверд)|при\s+подтвержден)/iu.test(text(agreement.evidence))
    && /(?:завтра|следующ\S*\s+день)/iu.test(text(agreement.evidence)));
  if (conditionalViewingAgreement) {
    add({
      meaningId: "conditional_viewing",
      kind: "conversation_result",
      block: "conversation_result",
      text: "При подтверждении просмотр можно будет согласовать на завтра.",
      required: true,
      exclusive: false,
      priority: "P0",
      sourceIds: sourceIds(conditionalViewingAgreement, "conditional_viewing"),
    });
  }
  const viewingStatusPending = /(?:подтверд|сообщ|уточн)[^.!?]{0,100}(?:возможност|доступн|просмотр)/iu.test(text(store.primary_next_step.action));
  if (viewingStatusPending
    && !/(?:ожидает\s+подтвержден|пока\s+не\s+подтвержден)/iu.test(text(store.call_result))
    && !meanings.some((meaning) => meaning.meaningId === "viewing_status_pending")) {
    add({
      meaningId: "viewing_status_pending",
      kind: "conversation_result",
      block: "conversation_result",
      text: "Возможность просмотра пока не подтверждена.",
      required: true,
      exclusive: false,
      priority: "P0",
      sourceIds: ["primary_next_step"],
    });
  }
  const conditionalSource = store.sources.map(record).find((source) =>
    /(?:если[^.!?]{0,80}(?:показ|просмотр)|при\s+подтвержден[^.!?]{0,80}(?:показ|просмотр))/iu.test(text(source.text))
    && /завтра/iu.test(text(source.text)));
  if (conditionalSource && !meanings.some((meaning) => meaning.meaningId === "conditional_viewing")) {
    add({
      meaningId: "conditional_viewing",
      kind: "conversation_result",
      block: "conversation_result",
      text: "При подтверждении просмотр можно будет согласовать на завтра.",
      required: true,
      exclusive: false,
      priority: "P0",
      sourceIds: [text(conditionalSource.turn_id) || "conditional_viewing"],
    });
  }

  const goalTexts = meanings
    .filter((meaning) => meaning.kind === "client_goal")
    .map((meaning) => meaning.text.toLocaleLowerCase("ru-RU"));
  const requirementIds = new Set(store.requirements.map(record).map((item, index) => id(item, `requirement_${index + 1}`)));
  const candidatePriority = (item: Record<string, unknown>): SummaryMeaningPriority => {
    const priority = semanticPriority(item);
    const type = `${factType(item)} ${text(item.need_type)}`.toLocaleLowerCase("ru-RU");
    if (/(?:additional_context|дополнительн\S*\s+контекст)/u.test(type)) return "P2";
    return requirementIds.has(id(item, "")) && priority === "P2" ? "P1" : priority;
  };
  const rankedCandidates = [
    ...store.requirements.map(record),
    ...store.facts.map(record).filter((fact) =>
      /(?:objection|constraint|legal|requirement|возраж|огранич|юрид|отриц)/u.test(factType(fact))),
  ]
    .filter((item) => !outcomeMeaning(item))
    .filter((item) => !coveredByConversationResult(item, text(store.call_result)))
    .filter((item) => !(crmCoverage.interest && /(?:интерес|interest)/u.test(
      `${factType(item)} ${text(item.need_type)}`.toLocaleLowerCase("ru-RU"),
    )))
    .filter((item) => !goalTexts.some((goal) => {
      const candidate = text(item).toLocaleLowerCase("ru-RU");
      return candidate.length >= 5 && goal.includes(candidate);
    }))
    .filter((item) => !(
      financingFacts.length > 0
      && /(?:ипотек|funding|финанс|средств|депозит|наличн)/u.test(
        `${text(item.need_type)} ${text(item.value)} ${factType(item)}`.toLocaleLowerCase("ru-RU"),
      )
    ))
    .filter((item) => !/(?:^intent$|client_goal|^goal$|intent_to_purchase|purchase_intent|searching_for)/u.test(
      `${factType(item)} ${text(item.need_type).toLocaleLowerCase("ru-RU")}`,
    ))
    .filter((item) => !/^(?:покупка|купить)\s+(?:квартир(?:а|у|ы)?|недвижимость)(?:\s+для\s+себя)?[.!]?$/iu.test(text(item)))
    .filter((item) => candidatePriority(item) !== "P2")
    .filter((item, index, values) => values.findIndex((candidate) => id(candidate, `key_fact_${index + 1}`) === id(item, `key_fact_${index + 1}`)) === index)
    .filter((item, index, values) => values.findIndex((candidate) => semanticOverlap(text(candidate), text(item)) >= 0.9) === index)
    .sort((left, right) => {
      const order: Record<SummaryMeaningPriority, number> = { P0: 0, P1: 1, P2: 2 };
      return order[candidatePriority(left)] - order[candidatePriority(right)] || keyPriority(left) - keyPriority(right);
    });
  const p0Candidates = rankedCandidates.filter((item) => candidatePriority(item) === "P0");
  const p1Candidates = rankedCandidates.filter((item) => candidatePriority(item) === "P1");
  const includeFundingMeaning = verifiedFundingSources.length > 0 && p0Candidates.length < 4;
  if (includeFundingMeaning) {
    add({
      meaningId: "verified_funding_context",
      kind: "key_fact",
      block: "key_facts",
      text: fundingContextText(verifiedFundingSources),
      required: true,
      exclusive: false,
      priority: "P1",
      label: "Финансирование",
      sourceIds: [...new Set(verifiedFundingSources.flatMap((fact, index) => sourceIds(fact, `funding_${index + 1}`)))],
    });
  }
  const keyCandidates = p0Candidates.length > 4
    ? p0Candidates
    : [
        ...p0Candidates,
        ...p1Candidates.slice(0, Math.max(0, 4 - p0Candidates.length - (includeFundingMeaning ? 1 : 0))),
      ];
  keyCandidates.forEach((item, index) => {
    const meaningId = id(item, `key_fact_${index + 1}`);
    add({
      meaningId,
      kind: "key_fact",
      block: "key_facts",
      text: text(item),
      required: candidatePriority(item) === "P0" || !coveredByCrm(item, crmCoverage),
      exclusive: false,
      priority: candidatePriority(item),
      label: semanticLabel(item),
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
    priority: "P0",
    sourceIds: ["primary_next_step"],
  });

  const clientSources = store.sources.map(record).filter((source) => text(source.speaker) === "client");
  const selectedQuotes = selectUsefulClientQuotesV3(store.quotes.map(record).flatMap((quote) => {
    const sourceId = text(quote.source_turn_id);
    const source = clientSources.find((item) => text(item.turn_id) === sourceId)
      ?? clientSources.find((item) => text(item.text).includes(text(quote.text)));
    if (!source) return [];
    return [{ quote, speaker: "client", text: text(source.text), source }];
  }).filter((item) => !/(?:\bадрес\b|улиц\S*|проспект\S*|переул\S*|шоссе|\bдом\s+\d|финанс|ипотек|наличн|депозит|следующ\S*\s+шаг)/iu.test(item.text)));
  selectedQuotes.forEach((item, index) => {
    const quote = item.quote;
    const meaningId = id(quote, `quote_${index + 1}`);
    add({
      meaningId,
      kind: "quote",
      block: "quotes",
      text: item.text,
      required: false,
      exclusive: false,
      priority: "P2",
      sourceIds: sourceIds(quote, meaningId),
    });
  });

  const priorityOrder: Record<SummaryMeaningPriority, number> = { P0: 0, P1: 1, P2: 2 };
  const orderedMeanings = [
    ...meanings.filter((meaning) => meaning.block === "conversation_result" && meaning.kind === "client_goal"),
    ...meanings.filter((meaning) => meaning.block === "conversation_result" && meaning.kind !== "client_goal"),
    ...meanings.filter((meaning) => meaning.block === "key_facts")
      .sort((left, right) => priorityOrder[left.priority ?? "P2"] - priorityOrder[right.priority ?? "P2"]),
    ...meanings.filter((meaning) => meaning.block === "next_step"),
    ...meanings.filter((meaning) => meaning.block === "quotes"),
  ];
  return Object.freeze({
    version: SUMMARY_PLAN_VERSION,
    meanings: Object.freeze(orderedMeanings),
    crmCoverage: Object.freeze(crmCoverage),
  });
}
