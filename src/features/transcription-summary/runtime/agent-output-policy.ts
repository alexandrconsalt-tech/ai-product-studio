import type { FactsV3 } from "../contracts/facts/v3/contract";
import type { NeedsV3 } from "../contracts/needs/v3/contract";
import type { OutcomeV3 } from "../contracts/outcome/v3/contract";
import type { TranscriptV3 } from "../contracts/transcript/v3/contract";
import { selectUsefulClientQuotesV3 } from "./quote-policy";

export type AgentOutputPolicyTransformationV3 = Readonly<{
  ruleId: string;
  fieldPath: string;
  reason: string;
  originalValue: unknown;
  normalizedValue: unknown;
}>;

export type AgentOutputPolicyResultV3<T> = Readonly<{
  value: T;
  transformations: readonly AgentOutputPolicyTransformationV3[];
}>;

function normalized(value: unknown): string {
  return String(value ?? "").normalize("NFKC").toLocaleLowerCase("ru-RU").replace(/ё/gu, "е").replace(/\s+/gu, " ").trim();
}

function changed(
  transformations: AgentOutputPolicyTransformationV3[],
  ruleId: string,
  fieldPath: string,
  reason: string,
  before: unknown,
  after: unknown,
) {
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  transformations.push({ ruleId, fieldPath, reason, originalValue: before, normalizedValue: after });
}

function isNameFact(fact: FactsV3["confirmed_facts"][number]): boolean {
  return /^(?:name|client_name|имя|фио)$/u.test(normalized(fact.predicate))
    || /(?:меня\s+\p{L}+\s+зовут|представил(?:ся|ась))/iu.test(normalized(fact.evidence));
}

function isNonWorkingContactFact(fact: FactsV3["confirmed_facts"][number]): boolean {
  return /^(?:contact_reason|call_source|lead_source|причина обращения|источник обращения)$/u.test(normalized(fact.predicate))
    || /(?:ответ на объявлен|по объявлению звон)/iu.test(normalized(fact.value));
}

function isOutcomeFact(fact: FactsV3["confirmed_facts"][number]): boolean {
  const value = normalized(`${fact.predicate} ${fact.value}`);
  return /(?:viewing_appointment|appointment|meeting|просмотр|встреч|показ|перезвон|звонок|отправк|договоренн)/iu.test(value);
}

function isObjectCardFact(fact: FactsV3["confirmed_facts"][number]): boolean {
  const predicate = normalized(fact.predicate);
  return /^(?:phone_last_digits|phone|телефон|price|цена|address|адрес|area|площадь|floor|этаж|complex|residential_complex|жк|object_code|код_объекта)$/u.test(predicate)
    || /(?:номер\s+телефона|последн\S*\s+цифр\S*\s+телефон)/iu.test(normalized(`${fact.value} ${fact.evidence}`));
}

type FactPriorityV3 = "critical" | "important" | "secondary" | "noise";

function factPriority(fact: FactsV3["confirmed_facts"][number]): FactPriorityV3 {
  if (isNameFact(fact) || isNonWorkingContactFact(fact) || isOutcomeFact(fact) || isObjectCardFact(fact)) return "noise";
  const source = normalized(`${fact.predicate} ${fact.value} ${fact.evidence}`);
  if (/(?:client_goal|explicit_objection|цель|мотив|возраж|отказ|юрид|огранич|источник\s+средств|funding|финанс|наличн|депозит|деньг\S*\s+на\s+счет|бюджет|budget|срок|term|препятств|услови\S*\s+продолж|позици\S*\s+клиент)/u.test(source)) return "critical";
  if (/(?:документ|собствен|обремен|дду|ипотек|задат|аванс|ремонт|прям\S*\s+отказ)/u.test(source)) return "important";
  return "secondary";
}

function recoveredFact(
  turn: TranscriptV3["turns"][number],
  category: string,
  kind: FactsV3["confirmed_facts"][number]["kind"],
  subject: FactsV3["confirmed_facts"][number]["subject"],
  predicate: string,
  value: string,
): FactsV3["confirmed_facts"][number] {
  return {
    id: `recovered-${category}-${turn.id}`,
    kind,
    subject,
    predicate,
    value,
    source_turn_ids: [turn.id],
    evidence: turn.text,
    confidence: 1,
    verification_status: "extracted",
  };
}

function recoverCriticalFacts(
  transcript: Pick<TranscriptV3, "turns"> | undefined,
  current: readonly FactsV3["confirmed_facts"][number][],
): FactsV3["confirmed_facts"][number][] {
  if (!transcript) return [];
  const existing = new Set(current.flatMap((fact) =>
    fact.source_turn_ids.map((turnId) => `${turnId}:${normalized(fact.predicate)}`)));
  const recovered: FactsV3["confirmed_facts"][number][] = [];
  const add = (turn: TranscriptV3["turns"][number], category: string, fact: FactsV3["confirmed_facts"][number]) => {
    const key = `${turn.id}:${normalized(fact.predicate)}`;
    if (existing.has(key)) return;
    existing.add(key);
    recovered.push(fact);
  };
  transcript.turns.forEach((turn) => {
    const text = normalized(turn.text);
    if (turn.speaker === "client") {
      if (/(?:ищу|подбираю|хочу\s+купить|покупаю)[^.!?]{0,100}(?:квартир|дом|участ|недвижим)/u.test(text)) {
        add(turn, "goal", recoveredFact(turn, "goal", "client_fact", "client", "client_goal", turn.text));
      }
      if (/(?:наличн|без\s+ипотек|деньг\S*\s+(?:на\s+счет|на\s+депозит)|свои\s+деньг)/u.test(text)) {
        add(turn, "funding", recoveredFact(turn, "funding", "client_fact", "client", "funding_source", "наличные / депозит"));
      }
      if (/(?:бюджет[^.!?]{0,50}(?:до|около|не\s+более|\d)|готов\S*\s+(?:потратить|заплатить)|рассматрива\S*\s+до)/u.test(text)) {
        add(turn, "budget", recoveredFact(turn, "budget", "client_fact", "client", "client_budget", turn.text));
      }
      if (/(?:хочу|планирую|нужно|надо)[^.!?]{0,80}(?:купить|выйти\s+на\s+сделк)[^.!?]{0,60}(?:до|через|в\s+течение|месяц|недел|год)/u.test(text)) {
        add(turn, "term", recoveredFact(turn, "term", "client_fact", "client", "purchase_term", turn.text));
      }
      if (/(?:дорог|высок\S*\s+цен|не\s+устраива\S*\s+цен|отказыва|не\s+буду|не\s+готов)[^.!?]{0,120}(?:цен|ремонт|расход)|(?:цен|ремонт|расход)[^.!?]{0,120}(?:отказыва|не\s+буду|не\s+готов|не\s+подход)/u.test(text)) {
        add(turn, "objection", recoveredFact(turn, "objection", "requirement_signal", "client", "explicit_objection", turn.text));
      }
      if (/(?:для\s+себя|для\s+родител|для\s+ребенк|для\s+инвестиц|под\s+сдач)/u.test(text)) {
        add(turn, "purpose", recoveredFact(turn, "purpose", "client_fact", "client", "purchase_purpose", turn.text));
      }
    }
    if (turn.speaker === "agent" && (
      /(?:\b(?:\d+|один|два|две|три|четыре|несколько)\s+собственник|приобретен\S*\s+по\s+дду|находит\S*\s+в\s+ипотек|есть\s+обременен|никто\s+не\s+прописан|прописан\S*\s+нет|задаток\S*\s+(?:состав|нужен|необходим)|документ\S*[^.!?]{0,30}(?:готов|подготов))/u.test(text)
    )) {
      add(turn, "legal", recoveredFact(turn, "legal", "property_fact", "property", "legal_or_document_status", turn.text));
    }
  });
  return recovered;
}

export function applyFactsAgentOutputPolicyV3(
  value: FactsV3,
  transcript?: Pick<TranscriptV3, "turns">,
): AgentOutputPolicyResultV3<FactsV3> {
  const transformations: AgentOutputPolicyTransformationV3[] = [];
  const filteredFacts = value.confirmed_facts.filter((fact) => factPriority(fact) !== "noise");
  const recoveredFacts = recoverCriticalFacts(transcript, filteredFacts);
  const priorityOrder: Record<FactPriorityV3, number> = { critical: 0, important: 1, secondary: 2, noise: 3 };
  const facts = [...filteredFacts, ...recoveredFacts]
    .map((fact, index) => ({ fact, index }))
    .sort((left, right) => priorityOrder[factPriority(left.fact)] - priorityOrder[factPriority(right.fact)] || left.index - right.index)
    .map(({ fact }) => fact);
  const quotes = [...selectUsefulClientQuotesV3(value.quotes)];
  changed(transformations, "facts.remove-nonbusiness-name.v1", "confirmed_facts", "Client names are not working facts.", value.confirmed_facts, facts);
  changed(transformations, "facts.remove-object-card-data.v1", "confirmed_facts", "Phone fragments and object-card parameters are not confirmed business facts.", value.confirmed_facts, facts);
  changed(transformations, "facts.recover-critical-source-meanings.v1", "confirmed_facts", "Explicit critical client and legal meanings are restored deterministically from their original turns.", filteredFacts, facts);
  changed(transformations, "facts.rank-working-meanings.v1", "confirmed_facts", "Working facts are ordered critical, important, secondary; noise is excluded.", [...filteredFacts, ...recoveredFacts], facts);
  changed(transformations, "facts.select-useful-client-quotes.v1", "quotes", "Quotes are limited to two client motives, objections or constraints that add meaning beyond ordinary facts.", value.quotes, quotes);
  return { value: { ...value, confirmed_facts: facts, quotes }, transformations };
}

function isOutcomeNeed(item: NeedsV3["business_needs"][number]): boolean {
  return /(?:осмотр|просмотр|встреч|показ|позвон|перезвон|звонок|созвон|отправ|пришл|направ|договоренн|appointment|meeting|viewing)/iu.test(normalized(`${item.need_type} ${item.value}`));
}

function isNonWorkingContactNeed(item: NeedsV3["business_needs"][number]): boolean {
  return /(?:contact_reason|call_source|lead_source|причина обращения|источник обращения)/iu.test(normalized(item.need_type))
    || /(?:ответ на объявлен|по объявлению звон)/iu.test(normalized(item.value));
}

function isObjectCardNeed(item: NeedsV3["business_needs"][number]): boolean {
  const value = normalized(`${item.need_type} ${item.value}`);
  if (/(?:budget|бюджет|financial_constraint|финансов\S*\s+огранич)/u.test(value)
    || /(?:мой\s+бюджет|готов\S*\s+(?:потратить|заплатить)|рассматрива\S*\s+до)/iu.test(item.evidence)) return false;
  return /(?:property_detail|specific\s+(?:apartment|property)|конкретн\S*\s+(?:квартир|объект)|цена\s*:|адрес\s*:|этаж\s*:|площадь\s*:|комплекс\s*:|жк\s+|\d+(?:[.,]\d+)?\s*(?:m|млн|м²|кв\.?)|ипотек\S*\s+у\s+сбер)/iu.test(value);
}

function isSpecificObjectInterestNeed(item: NeedsV3["business_needs"][number]): boolean {
  const value = normalized(`${item.need_type} ${item.value} ${item.evidence}`);
  return /(?:двухкомнатн\S*\s+квартир\S*\s*\(?интерес\)?|интерес\S*\s+(?:к|по)\s+(?:эт|конкретн)|покупк\S*\s+(?:эт|конкретн)\S*\s+(?:объект|квартир)|параметр\S*\s+(?:объявлен|текущ\S*\s+объект)|обычн\S*\s+покупк\S*\s+конкретн)/u.test(value);
}

function addsWorkingSpecificity(item: NeedsV3["business_needs"][number]): boolean {
  return /(?:огранич|проблем|не\s+хвата|невозмож|зависит|критич|обязательн|лимит|бюджет|не\s+может|требует\s+реш)/iu.test(`${item.need_type} ${item.value} ${item.evidence}`);
}

function duplicatesStructuredAttribute(item: NeedsV3["business_needs"][number], value: NeedsV3): boolean {
  const source = normalized(`${item.need_type} ${item.value} ${item.evidence}`);
  const attributes = value.structured_crm_attributes;
  if (attributes.funding_source.value !== "не определено"
    && /(?:funding|финанс|ипотек|наличн|депозит|деньг\S*\s+на\s+счет|свои\s+деньг)/u.test(source)) return !addsWorkingSpecificity(item);
  if (attributes.purchase_term.value !== "не определено"
    && /(?:purchase_term|срок\S*\s+покуп|месяц|недел)/u.test(source)) return !addsWorkingSpecificity(item);
  if (attributes.interested_in.length > 0
    && /(?:interested|интерес\S*\s+к|новострой|ипотек|строительств)/u.test(source)) return !addsWorkingSpecificity(item);
  return false;
}

function hasExplicitPurchaseTermEvidence(item: NeedsV3["structured_crm_attributes"]["purchase_term"]): boolean {
  if (item.value === "не определено") return true;
  const evidence = normalized(item.evidence);
  if (/(?:сигнал|предполож|вероятн|можно\s+считать|быстр\S*\s+заинтересован)/u.test(evidence)) return false;
  return /(?:клиент[^.!?]{0,160}(?:срок|планир|ближайш|месяц|недел|год)|(?:в\s+ближайш|через|в\s+течение|срок\S*\s+покуп)[^.!?]{0,80}(?:дн|недел|месяц|год))/u.test(evidence);
}

export function applyNeedsAgentOutputPolicyV3(value: NeedsV3): AgentOutputPolicyResultV3<NeedsV3> {
  const transformations: AgentOutputPolicyTransformationV3[] = [];
  const businessNeeds = value.business_needs.filter((item) =>
    !isOutcomeNeed(item)
    && !isNonWorkingContactNeed(item)
    && !isObjectCardNeed(item)
    && !isSpecificObjectInterestNeed(item)
    && !duplicatesStructuredAttribute(item, value));
  const explicitClientCriterion = (item: NeedsV3["property_requirements"][number]) =>
    /(?:нужн\S*|важн\S*|(?:^|\s)только(?:\s|$)|не\s+рассматрива\S*|не\s+менее|не\s+более|хоч\S*\s+(?:не\s+)?(?:менее|более)|обязательн\S*|требован\S*|критери\S*)/iu.test(item.evidence);
  const propertyRequirements = value.property_requirements.filter((item) =>
    !isOutcomeNeed(item) && !isNonWorkingContactNeed(item) && explicitClientCriterion(item));
  const interestedIn = value.structured_crm_attributes.interested_in.filter((item) =>
    item.value !== "Новостройки" || /(?:новострой|новый\s+дом|первичн\S*\s+рын)/iu.test(item.evidence));
  const purchaseTerm = hasExplicitPurchaseTermEvidence(value.structured_crm_attributes.purchase_term)
    ? value.structured_crm_attributes.purchase_term
    : { ...value.structured_crm_attributes.purchase_term, value: "не определено" as const };
  changed(transformations, "needs.remove-outcome-actions.v1", "business_needs", "Meetings, viewings, calls and deliveries belong to Outcome, not Needs.", value.business_needs, businessNeeds);
  changed(transformations, "needs.remove-object-card-data.v1", "business_needs", "A concrete listing parameter is not a client need.", value.business_needs, businessNeeds);
  changed(transformations, "needs.remove-specific-object-interest.v1", "business_needs", "Ordinary interest in the current listing is not a business need.", value.business_needs, businessNeeds);
  changed(transformations, "needs.deduplicate-structured-attributes.v1", "business_needs", "A CRM attribute is the canonical representation when the business need adds no separate working constraint.", value.business_needs, businessNeeds);
  changed(transformations, "needs.remove-outcome-actions.v1", "property_requirements", "Meetings, viewings, calls and deliveries belong to Outcome, not property requirements.", value.property_requirements, propertyRequirements);
  changed(transformations, "needs.explicit-client-criteria-only.v1", "property_requirements", "Object-card facts are not client requirements without explicit client criterion language.", value.property_requirements, propertyRequirements);
  changed(transformations, "needs.direct-interest-evidence.v1", "structured_crm_attributes.interested_in", "A residential complex or DDU mention is not direct evidence of a new-build interest.", value.structured_crm_attributes.interested_in, interestedIn);
  changed(transformations, "needs.explicit-purchase-term-evidence.v1", "structured_crm_attributes.purchase_term", "Purchase term requires an explicit client time horizon and cannot be inferred from urgency or a proposed viewing.", value.structured_crm_attributes.purchase_term, purchaseTerm);
  return {
    value: {
      ...value,
      business_needs: businessNeeds,
      property_requirements: propertyRequirements,
      structured_crm_attributes: {
        ...value.structured_crm_attributes,
        interested_in: interestedIn,
        purchase_term: purchaseTerm,
      },
    },
    transformations,
  };
}

function roleOwner(value: string): string {
  const owner = normalized(value);
  if (/(?:^|\s)(?:агент|agent|оператор|operator)(?:\s|$)/u.test(owner)) return "Агент";
  if (/(?:^|\s)(?:клиент|client)(?:\s|$)/u.test(owner)) return "Клиент";
  return value.trim();
}

function normalizedViewingAction(value: string): string {
  const action = normalized(value);
  if (/(?:позвон|перезвон|сообщ|уточн|подтверд|согласов|узна|провер)/u.test(action)) return value.trim();
  return /(?:осмотр|просмотр|показ|встреч)/iu.test(action) ? "Провести просмотр" : value.trim();
}

function isViewingExecutionAction(value: string): boolean {
  const action = normalized(value);
  return /(?:провести|показать|посмотреть|осмотреть|приехать|встретиться|^просмотр$|^показ$)/u.test(action)
    && !/(?:позвон|перезвон|сообщ|уточн|подтверд|согласов|узна|провер)/u.test(action);
}

function normalizedChannel(value: string, action: string): string {
  if (/(?:осмотр|просмотр|показ|встреч)/iu.test(normalized(action))
    && /(?:на объекте|личн|in[_-]person|on[_-]?site)/iu.test(normalized(value))) return "личная встреча";
  return value.trim();
}

function canonicalWeekday(value: string): string | null {
  const match = normalized(value).match(/(?:^|\s)(понедельник|понедельник[аеу]|вторник|вторник[аеу]|среда|сред[аеу]|четверг|четверг[аеу]|пятница|пятниц[аеу]|суббота|суббот[аеу]|воскресенье)(?:\s|$|[,.])/u)?.[1];
  if (!match) return null;
  if (match.startsWith("понедельник")) return "понедельник";
  if (match.startsWith("вторник")) return "вторник";
  if (match.startsWith("сред")) return "среда";
  if (match.startsWith("четверг")) return "четверг";
  if (match.startsWith("пятниц")) return "пятница";
  if (match.startsWith("суббот")) return "суббота";
  return "воскресенье";
}

function deadlineWithConfirmedWeekday(deadline: string, evidence: string): string {
  const day = canonicalWeekday(evidence);
  if (!day || canonicalWeekday(deadline)) return deadline.trim();
  return `${day}, ${deadline.trim()}`.replace(/,\s*$/u, "");
}

function isOperationalAgreement(action: string): boolean {
  return /(?:^|\s)(?:просмотр|показ|встреча|звонок|отправка|провести|посмотреть|показать|осмотреть|встретиться|приехать|позвонить|перезвонить|созвониться|связаться|сообщить|отправить|прислать|направить|передать|подготовить|уточнить|подтвердить|забронировать|внести|подписать)(?:ся)?(?:\s|$)/iu.test(normalized(action));
}

function isPhoneConfirmationAgreement(action: string, evidence: string): boolean {
  return /(?:номер|телефон|цифр)/iu.test(normalized(`${action} ${evidence}`))
    && /(?:подтверд|верн|правильн)/iu.test(normalized(`${action} ${evidence}`));
}

function compactCallResult(outcome: OutcomeV3): string {
  if (outcome.primary_next_step.status !== "confirmed") return outcome.call_result.trim();
  const action = normalized(outcome.primary_next_step.action);
  if (isViewingExecutionAction(action)) return "Просмотр согласован.";
  if (/(?:встреч)/u.test(action)) return "Встреча согласована.";
  if (/(?:позвон|перезвон|созвон)/u.test(action)) return "Договорились о повторном звонке.";
  if (/(?:отправ|пришл|направ)/u.test(action)) return "Отправка согласована.";
  return outcome.call_result.trim();
}

function terminalPriceRefusal(transcript: Pick<TranscriptV3, "turns"> | undefined): boolean {
  return transcript?.turns.some((turn) => turn.speaker === "client" && (
    /(?:отказыва|не\s+буду\s+продолжа|не\s+готов\S*\s+покуп|не\s+подход)/iu.test(turn.text)
    && /(?:цен|дорог|расход\S*\s+на\s+ремонт|ремонт)/iu.test(turn.text)
  )) ?? false;
}

function transcriptConfirmsViewingWait(transcript: Pick<TranscriptV3, "turns"> | undefined): boolean {
  const source = transcript?.turns.map((turn) => turn.text).join(" ") ?? "";
  return /(?:ожида|жд\S*)[^.!?]{0,100}(?:подтвержден|звон|ответ)[^.!?]{0,100}(?:просмотр|показ)|(?:уточн|провер|подтверд)[^.!?]{0,100}(?:возможност|доступн)[^.!?]{0,80}(?:просмотр|показ)/iu.test(source);
}

function primaryMatchesAgreement(primary: OutcomeV3["primary_next_step"], agreements: OutcomeV3["agreements"]): boolean {
  if (primary.status !== "confirmed") return false;
  const action = normalized(normalizedViewingAction(primary.action));
  return agreements.some((agreement) => {
    const agreementAction = normalized(normalizedViewingAction(agreement.action));
    const sameViewingStatusMeaning = [action, agreementAction].every((candidate) =>
      /(?:просмотр|показ)/u.test(candidate)
      && /(?:позвон|сообщ|уточн|подтверд|доступн|возможност)/u.test(candidate));
    return agreementAction === action
      || agreementAction.includes(action)
      || action.includes(agreementAction)
      || sameViewingStatusMeaning;
  });
}

export function applyOutcomeAgentOutputPolicyV3(
  value: OutcomeV3,
  transcript?: Pick<TranscriptV3, "turns">,
): AgentOutputPolicyResultV3<OutcomeV3> {
  const transformations: AgentOutputPolicyTransformationV3[] = [];
  let agreements = value.agreements
    .filter((agreement) => agreement.status === "confirmed"
      && isOperationalAgreement(agreement.action)
      && !isPhoneConfirmationAgreement(agreement.action, agreement.evidence))
    .map((agreement) => ({
      ...agreement,
      action: normalizedViewingAction(agreement.action),
      owner: roleOwner(agreement.owner),
      deadline: deadlineWithConfirmedWeekday(agreement.deadline, agreement.evidence),
      channel: normalizedChannel(agreement.channel, agreement.action),
    }));
  const primaryEvidence = agreements.find((agreement) =>
    normalized(agreement.action) === normalized(normalizedViewingAction(value.primary_next_step.action)))?.evidence
    ?? agreements[0]?.evidence
    ?? "";
  let primary = {
    ...value.primary_next_step,
    action: normalizedViewingAction(value.primary_next_step.action),
    owner: roleOwner(value.primary_next_step.owner),
    deadline: deadlineWithConfirmedWeekday(value.primary_next_step.deadline, primaryEvidence),
    channel: normalizedChannel(value.primary_next_step.channel, value.primary_next_step.action),
  };
  if (!primaryMatchesAgreement(primary, agreements)) {
    const originalPrimary = primary;
    primary = {
      action: "",
      owner: "",
      deadline: "",
      channel: "",
      status: "not_defined",
    };
    changed(transformations, "outcome.require-confirmed-agreement-for-next-step.v1", "primary_next_step", "A primary next step must be backed by the same confirmed operational agreement.", originalPrimary, primary);
  }
  let callResult = compactCallResult({ ...value, agreements, primary_next_step: primary });
  const viewingByPhone = isViewingExecutionAction(primary.action)
    && /(?:phone|телефон|звон)/iu.test(normalized(primary.channel));
  const evidence = agreements.map((item) => item.evidence).join(" ");
  const conditionalViewing = /(?:если[^.!?]{0,80}(?:показ|просмотр|смож\S*\s+показ)|при\s+подтвержден[^.!?]{0,80}(?:показ|просмотр)|возможност\S*\s+просмотр\S*\s+(?:пока\s+)?не\s+подтвержден)/iu.test(normalized(evidence))
    || transcriptConfirmsViewingWait(transcript);
  if (viewingByPhone || (isViewingExecutionAction(primary.action) && conditionalViewing)) {
    const originalAgreements = agreements;
    const originalPrimary = primary;
    agreements = agreements.map((agreement) => isViewingExecutionAction(agreement.action)
      ? { ...agreement, action: "Сообщить клиенту о возможности просмотра", channel: "телефон" }
      : agreement);
    primary = {
      ...primary,
      action: "Позвонить клиенту и сообщить, доступна ли квартира для просмотра",
      channel: "телефон",
    };
    callResult = "Клиент ожидает подтверждения возможности просмотра.";
    changed(transformations, "outcome.preserve-conditional-viewing.v1", "agreements", "A conditional viewing must remain conditional; the confirmed action is the status call.", originalAgreements, agreements);
    changed(transformations, "outcome.action-channel-consistency.v1", "primary_next_step", "A phone deadline belongs to the status call, not to conducting a viewing.", originalPrimary, primary);
  }
  const confirmsViewingAvailability = /(?:подтверд|сообщ|уточн)[^.!?]{0,100}(?:возможност|доступн|просмотр)/iu.test(normalized(primary.action))
    || /(?:подтверд|сообщ|уточн)[^.!?]{0,100}(?:возможност|доступн|просмотр)/iu.test(normalized(evidence));
  if (confirmsViewingAvailability && /(?:звон|phone|телефон)/iu.test(normalized(`${primary.channel} ${evidence}`))) {
    const originalAgreements = agreements;
    const originalPrimary = primary;
    agreements = agreements.map((agreement) => (
      (isViewingExecutionAction(agreement.action) && /(?:phone|телефон|звон)/iu.test(normalized(agreement.channel)))
      || /(?:подтверд|сообщ|уточн)[^.!?]{0,100}(?:возможност|доступн|просмотр)/iu.test(normalized(`${agreement.action} ${agreement.evidence}`))
    )
      ? { ...agreement, action: "Сообщить клиенту о возможности просмотра", channel: "телефон" }
      : agreement);
    primary = {
      ...primary,
      action: "Позвонить клиенту и сообщить, доступна ли квартира для просмотра",
      channel: "телефон",
    };
    callResult = "Клиент ожидает подтверждения возможности просмотра.";
    changed(transformations, "outcome.canonical-viewing-status-call.v1", "agreements", "A confirmed availability update is rendered as a phone contact, not as a viewing.", originalAgreements, agreements);
    changed(transformations, "outcome.canonical-viewing-status-call.v1", "primary_next_step", "The primary action preserves the confirmed availability call semantics.", originalPrimary, primary);
  }
  if (terminalPriceRefusal(transcript)) {
    const originalCallResult = callResult;
    callResult = "Клиент отказался продолжать из-за цены и расходов на ремонт.";
    changed(transformations, "outcome.terminal-price-refusal.v1", "call_result", "A terminal client refusal caused by price and repair costs must remain explicit.", originalCallResult, callResult);
  }
  changed(transformations, "outcome.compact-call-result.v1", "call_result", "call_result contains only the confirmed conversation outcome and excludes Facts/Needs/next-step details.", value.call_result, callResult);
  changed(transformations, "outcome.confirmed-agreements-only.v1", "agreements", "Unconfirmed proposals with status=not_defined are not agreements.", value.agreements, agreements);
  changed(transformations, "outcome.role-owner.v1", "primary_next_step", "Named owners and viewing terminology are normalized to role-based v3 semantics.", value.primary_next_step, primary);
  return { value: { call_result: callResult, agreements, primary_next_step: primary }, transformations };
}
