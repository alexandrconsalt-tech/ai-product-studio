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

export function applyFactsAgentOutputPolicyV3(value: FactsV3): AgentOutputPolicyResultV3<FactsV3> {
  const transformations: AgentOutputPolicyTransformationV3[] = [];
  const facts = value.confirmed_facts.filter((fact) => !isNameFact(fact) && !isNonWorkingContactFact(fact) && !isOutcomeFact(fact));
  const quotes = [...selectUsefulClientQuotesV3(value.quotes)];
  changed(transformations, "facts.remove-nonbusiness-name.v1", "confirmed_facts", "Client names are not working facts.", value.confirmed_facts, facts);
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

export function applyNeedsAgentOutputPolicyV3(value: NeedsV3): AgentOutputPolicyResultV3<NeedsV3> {
  const transformations: AgentOutputPolicyTransformationV3[] = [];
  const businessNeeds = value.business_needs.filter((item) => !isOutcomeNeed(item) && !isNonWorkingContactNeed(item));
  const propertyRequirements = value.property_requirements.filter((item) => !isOutcomeNeed(item) && !isNonWorkingContactNeed(item));
  changed(transformations, "needs.remove-outcome-actions.v1", "business_needs", "Meetings, viewings, calls and deliveries belong to Outcome, not Needs.", value.business_needs, businessNeeds);
  changed(transformations, "needs.remove-outcome-actions.v1", "property_requirements", "Meetings, viewings, calls and deliveries belong to Outcome, not property requirements.", value.property_requirements, propertyRequirements);
  return { value: { ...value, business_needs: businessNeeds, property_requirements: propertyRequirements }, transformations };
}

function roleOwner(value: string): string {
  const owner = normalized(value);
  if (/(?:^|\s)(?:агент|agent|оператор|operator)(?:\s|$)/u.test(owner)) return "Агент";
  if (/(?:^|\s)(?:клиент|client)(?:\s|$)/u.test(owner)) return "Клиент";
  return value.trim();
}

function normalizedViewingAction(value: string): string {
  return /(?:осмотр|просмотр|показ|встреч)/iu.test(normalized(value)) ? "Провести просмотр" : value.trim();
}

function normalizedChannel(value: string, action: string): string {
  if (/(?:осмотр|просмотр|показ|встреч)/iu.test(normalized(action))
    && /(?:на объекте|личн|in_person)/iu.test(normalized(value))) return "личная встреча";
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
  return /(?:^|\s)(?:провести|посмотреть|показать|осмотреть|встретиться|приехать|позвонить|перезвонить|созвониться|связаться|отправить|прислать|направить|передать|подготовить|уточнить|подтвердить|забронировать|внести|подписать)(?:ся)?(?:\s|$)/iu.test(normalized(action));
}

function compactCallResult(outcome: OutcomeV3): string {
  if (outcome.primary_next_step.status !== "confirmed") return outcome.call_result.trim();
  const action = normalized(outcome.primary_next_step.action);
  if (/(?:осмотр|просмотр|показ)/u.test(action)) return "Просмотр согласован.";
  if (/(?:встреч)/u.test(action)) return "Встреча согласована.";
  if (/(?:позвон|перезвон|созвон)/u.test(action)) return "Договорились о повторном звонке.";
  if (/(?:отправ|пришл|направ)/u.test(action)) return "Отправка согласована.";
  return outcome.call_result.trim();
}

export function applyOutcomeAgentOutputPolicyV3(value: OutcomeV3): AgentOutputPolicyResultV3<OutcomeV3> {
  const transformations: AgentOutputPolicyTransformationV3[] = [];
  const agreements = value.agreements
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
  const primary = {
    ...value.primary_next_step,
    action: normalizedViewingAction(value.primary_next_step.action),
    owner: roleOwner(value.primary_next_step.owner),
    deadline: deadlineWithConfirmedWeekday(value.primary_next_step.deadline, primaryEvidence),
    channel: normalizedChannel(value.primary_next_step.channel, value.primary_next_step.action),
  };
  const callResult = compactCallResult(value);
  changed(transformations, "outcome.compact-call-result.v1", "call_result", "call_result contains only the confirmed conversation outcome and excludes Facts/Needs/next-step details.", value.call_result, callResult);
  changed(transformations, "outcome.confirmed-agreements-only.v1", "agreements", "Unconfirmed proposals with status=not_defined are not agreements.", value.agreements, agreements);
  changed(transformations, "outcome.role-owner.v1", "primary_next_step", "Named owners and viewing terminology are normalized to role-based v3 semantics.", value.primary_next_step, primary);
  return { value: { call_result: callResult, agreements, primary_next_step: primary }, transformations };
}
