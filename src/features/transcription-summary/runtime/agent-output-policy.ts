import type { FactsV3 } from "../contracts/facts/v3/contract";
import type { NeedsV3 } from "../contracts/needs/v3/contract";
import type { OutcomeV3 } from "../contracts/outcome/v3/contract";
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

export function applyFactsAgentOutputPolicyV3(value: FactsV3): AgentOutputPolicyResultV3<FactsV3> {
  const transformations: AgentOutputPolicyTransformationV3[] = [];
  const facts = value.confirmed_facts.filter((fact) => !isNameFact(fact) && !isNonWorkingContactFact(fact) && !isOutcomeFact(fact) && !isObjectCardFact(fact));
  const quotes = [...selectUsefulClientQuotesV3(value.quotes)];
  changed(transformations, "facts.remove-nonbusiness-name.v1", "confirmed_facts", "Client names are not working facts.", value.confirmed_facts, facts);
  changed(transformations, "facts.remove-object-card-data.v1", "confirmed_facts", "Phone fragments and object-card parameters are not confirmed business facts.", value.confirmed_facts, facts);
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
  return /(?:property_detail|цена\s*:|адрес\s*:|этаж\s*:|площадь\s*:|комплекс\s*:|жк\s+|\d+(?:[.,]\d+)?\s*(?:млн|м²|кв\.?)|ипотек\S*\s+у\s+сбер)/iu.test(value);
}

export function applyNeedsAgentOutputPolicyV3(value: NeedsV3): AgentOutputPolicyResultV3<NeedsV3> {
  const transformations: AgentOutputPolicyTransformationV3[] = [];
  const businessNeeds = value.business_needs.filter((item) => !isOutcomeNeed(item) && !isNonWorkingContactNeed(item) && !isObjectCardNeed(item));
  const explicitClientCriterion = (item: NeedsV3["property_requirements"][number]) =>
    /(?:нужн\S*|важн\S*|(?:^|\s)только(?:\s|$)|не\s+рассматрива\S*|не\s+менее|не\s+более|хоч\S*\s+(?:не\s+)?(?:менее|более)|обязательн\S*|требован\S*|критери\S*)/iu.test(item.evidence);
  const propertyRequirements = value.property_requirements.filter((item) =>
    !isOutcomeNeed(item) && !isNonWorkingContactNeed(item) && explicitClientCriterion(item));
  const interestedIn = value.structured_crm_attributes.interested_in.filter((item) =>
    item.value !== "Новостройки" || /(?:новострой|новый\s+дом|первичн\S*\s+рын)/iu.test(item.evidence));
  changed(transformations, "needs.remove-outcome-actions.v1", "business_needs", "Meetings, viewings, calls and deliveries belong to Outcome, not Needs.", value.business_needs, businessNeeds);
  changed(transformations, "needs.remove-object-card-data.v1", "business_needs", "A concrete listing parameter is not a client need.", value.business_needs, businessNeeds);
  changed(transformations, "needs.remove-outcome-actions.v1", "property_requirements", "Meetings, viewings, calls and deliveries belong to Outcome, not property requirements.", value.property_requirements, propertyRequirements);
  changed(transformations, "needs.explicit-client-criteria-only.v1", "property_requirements", "Object-card facts are not client requirements without explicit client criterion language.", value.property_requirements, propertyRequirements);
  changed(transformations, "needs.direct-interest-evidence.v1", "structured_crm_attributes.interested_in", "A residential complex or DDU mention is not direct evidence of a new-build interest.", value.structured_crm_attributes.interested_in, interestedIn);
  return {
    value: {
      ...value,
      business_needs: businessNeeds,
      property_requirements: propertyRequirements,
      structured_crm_attributes: {
        ...value.structured_crm_attributes,
        interested_in: interestedIn,
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
  return /(?:^|\s)(?:просмотр|показ|встреча|звонок|отправка|провести|посмотреть|показать|осмотреть|встретиться|приехать|позвонить|перезвонить|созвониться|связаться|отправить|прислать|направить|передать|подготовить|уточнить|подтвердить|забронировать|внести|подписать)(?:ся)?(?:\s|$)/iu.test(normalized(action));
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

export function applyOutcomeAgentOutputPolicyV3(value: OutcomeV3): AgentOutputPolicyResultV3<OutcomeV3> {
  const transformations: AgentOutputPolicyTransformationV3[] = [];
  let agreements = value.agreements
    .filter((agreement) => agreement.status === "confirmed" && isOperationalAgreement(agreement.action))
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
  let callResult = compactCallResult({ ...value, agreements, primary_next_step: primary });
  const viewingByPhone = isViewingExecutionAction(primary.action)
    && /(?:phone|телефон|звон)/iu.test(normalized(primary.channel));
  const evidence = agreements.map((item) => item.evidence).join(" ");
  const conditionalViewing = /(?:если[^.!?]{0,80}(?:показ|просмотр|смож\S*\s+показ)|при\s+подтвержден[^.!?]{0,80}(?:показ|просмотр)|возможност\S*\s+просмотр\S*\s+(?:пока\s+)?не\s+подтвержден)/iu.test(normalized(evidence));
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
    agreements = agreements.map((agreement) => ({
      ...agreement,
      action: "Сообщить клиенту о возможности просмотра",
      channel: "телефон",
    }));
    primary = {
      ...primary,
      action: "Позвонить клиенту и сообщить, доступна ли квартира для просмотра",
      channel: "телефон",
    };
    callResult = "Клиент ожидает подтверждения возможности просмотра.";
    changed(transformations, "outcome.canonical-viewing-status-call.v1", "agreements", "A confirmed availability update is rendered as a phone contact, not as a viewing.", originalAgreements, agreements);
    changed(transformations, "outcome.canonical-viewing-status-call.v1", "primary_next_step", "The primary action preserves the confirmed availability call semantics.", originalPrimary, primary);
  }
  changed(transformations, "outcome.compact-call-result.v1", "call_result", "call_result contains only the confirmed conversation outcome and excludes Facts/Needs/next-step details.", value.call_result, callResult);
  changed(transformations, "outcome.confirmed-agreements-only.v1", "agreements", "Unconfirmed proposals with status=not_defined are not agreements.", value.agreements, agreements);
  changed(transformations, "outcome.role-owner.v1", "primary_next_step", "Named owners and viewing terminology are normalized to role-based v3 semantics.", value.primary_next_step, primary);
  return { value: { call_result: callResult, agreements, primary_next_step: primary }, transformations };
}
