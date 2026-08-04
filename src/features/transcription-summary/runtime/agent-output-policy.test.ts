import { describe, expect, it } from "vitest";
import { FactsV3Schema } from "../contracts/facts/v3/contract";
import { NeedsV3Schema } from "../contracts/needs/v3/contract";
import { OutcomeV3Schema } from "../contracts/outcome/v3/contract";
import {
  applyFactsAgentOutputPolicyV3,
  applyNeedsAgentOutputPolicyV3,
  applyOutcomeAgentOutputPolicyV3,
} from "./agent-output-policy";

const evidence = {
  source_turn_ids: ["turn-1"], evidence: "Клиент сообщил данные.", confidence: 1,
  verification_status: "extracted" as const,
};

describe("agent output policy v3", () => {
  it("удаляет имя и просмотр из Facts и оставляет только полезную клиентскую цитату", () => {
    const facts = FactsV3Schema.parse({
      confirmed_facts: [
        { id: "name", kind: "client_fact", subject: "client", predicate: "client_name", value: "Татьяна", ...evidence },
        { id: "goal", kind: "client_fact", subject: "client", predicate: "client_goal", value: "Ищет новостройку", ...evidence },
        { id: "view", kind: "requirement_signal", subject: "conversation", predicate: "viewing_appointment", value: "Просмотр в пятницу", ...evidence },
        { id: "contact", kind: "client_fact", subject: "client", predicate: "contact_reason", value: "ответ на объявление", ...evidence },
      ],
      client_questions: [], contextual_statements: [], rejected_assumptions: [],
      quotes: [
        { id: "agent", speaker: "agent", text: "Встретимся в пятницу.", source_turn_id: "turn-1", supports_fact_ids: [], confidence: 1, verification_status: "extracted" },
        { id: "weak", speaker: "client", text: "Меня Татьяна зовут.", source_turn_id: "turn-1", supports_fact_ids: [], confidence: 1, verification_status: "extracted" },
        { id: "useful", speaker: "client", text: "Шумную квартиру не рассматриваю, потому что для меня важна тишина.", source_turn_id: "turn-1", supports_fact_ids: ["goal"], confidence: 1, verification_status: "extracted" },
      ],
    });
    const result = applyFactsAgentOutputPolicyV3(facts);
    expect(result.value.confirmed_facts.map((fact) => fact.id)).toEqual(["goal"]);
    expect(result.value.quotes.map((quote) => quote.id)).toEqual(["useful"]);
  });

  it("удаляет просмотр, звонок и отправку из Needs, не анализируя evidence", () => {
    const needs = NeedsV3Schema.parse({
      business_needs: [
        { id: "view", need_type: "action", value: "Посмотреть квартиру", ...evidence },
        { id: "budget", need_type: "budget", value: "До 8 миллионов", ...evidence, evidence: "После просмотра обсудили бюджет." },
        { id: "contact", need_type: "contact_reason", value: "ответ на объявление", ...evidence },
      ],
      property_requirements: [{ id: "send", need_type: "action", value: "Отправить документы", ...evidence }],
      structured_crm_attributes: {
        interested_in: [],
        funding_source: { id: "funding", value: "не определено", ...evidence },
        purchase_term: { id: "term", value: "не определено", ...evidence },
      },
      communication_preferences: [], client_questions: [],
    });
    const result = applyNeedsAgentOutputPolicyV3(needs);
    expect(result.value.business_needs.map((item) => item.id)).toEqual(["budget"]);
    expect(result.value.property_requirements).toEqual([]);
  });

  it("сжимает Outcome, удаляет not_defined и нормализует owner/action", () => {
    const outcome = OutcomeV3Schema.parse({
      call_result: "Клиент Татьяна ищет новостройку, бюджет 8 млн; просмотр назначен в пятницу в 14:00.",
      agreements: [
        { id: "confirmed", action: "Показ вариантов", owner: "Менеджер Анна, агент", deadline: "15-е, 14:00", channel: "on-site", status: "confirmed", evidence: "Да, давайте в пятницу. Договорились." },
        { id: "fact-as-agreement", action: "Бюджет до восьми миллионов", owner: "Клиент", deadline: "", channel: "телефон", status: "confirmed", evidence: "Рассматриваю до восьми миллионов." },
        { id: "proposal", action: "Позвонить", owner: "Агент", deadline: "", channel: "", status: "not_defined", evidence: "Можно позвонить." },
      ],
      primary_next_step: { action: "Посмотреть квартиру", owner: "Менеджер Анна, агент", deadline: "15-е, 14:00", channel: "на объекте", status: "confirmed" },
    });
    const result = applyOutcomeAgentOutputPolicyV3(outcome).value;
    expect(result.call_result).toBe("Просмотр согласован.");
    expect(result.agreements).toHaveLength(1);
    expect(result.primary_next_step).toMatchObject({ action: "Провести просмотр", owner: "Агент", deadline: "пятница, 15-е, 14:00", channel: "личная встреча" });
  });

  it("удаляет телефон и параметры карточки объекта из Facts", () => {
    const facts = FactsV3Schema.parse({
      confirmed_facts: [
        { id: "phone", kind: "client_fact", subject: "client", predicate: "phone_last_digits", value: "9066", ...evidence },
        { id: "price", kind: "property_fact", subject: "property", predicate: "price", value: "23 млн", ...evidence },
        { id: "area", kind: "property_fact", subject: "property", predicate: "area", value: "37,8 м²", ...evidence },
        { id: "funding", kind: "client_fact", subject: "client", predicate: "financing", value: "деньги на счету", ...evidence },
      ],
      client_questions: [], contextual_statements: [], rejected_assumptions: [], quotes: [],
    });
    expect(applyFactsAgentOutputPolicyV3(facts).value.confirmed_facts.map((item) => item.id)).toEqual(["funding"]);
  });

  it("не превращает карточку объекта в requirements или Новостройки", () => {
    const needs = NeedsV3Schema.parse({
      business_needs: [{ id: "card", need_type: "interest", value: "Квартира за 23 млн", ...evidence }],
      property_requirements: [
        { id: "area", need_type: "property_detail", value: "Площадь: 37,8 м²", ...evidence, evidence: "В объявлении указано 37,8 м²." },
        { id: "quiet", need_type: "constraint", value: "Тихая квартира", ...evidence, evidence: "Мне важна тишина." },
      ],
      structured_crm_attributes: {
        interested_in: [{ id: "interest", value: "Новостройки", ...evidence, evidence: "Квартира приобретена по ДДУ." }],
        funding_source: { id: "funding", value: "наличные / депозит", ...evidence, evidence: "Деньги на счету." },
        purchase_term: { id: "term", value: "не определено", ...evidence },
      },
      communication_preferences: [], client_questions: [],
    });
    const result = applyNeedsAgentOutputPolicyV3(needs).value;
    expect(result.business_needs).toEqual([]);
    expect(result.property_requirements.map((item) => item.id)).toEqual(["quiet"]);
    expect(result.structured_crm_attributes.interested_in).toEqual([]);
    expect(result.structured_crm_attributes.funding_source.value).toBe("наличные / депозит");
  });

  it("сохраняет условный просмотр и назначает подтверждённым шагом вечерний звонок", () => {
    const outcome = OutcomeV3Schema.parse({
      call_result: "Просмотр согласован.",
      agreements: [{
        id: "viewing", action: "Провести просмотр", owner: "Агент", deadline: "сегодня вечером",
        channel: "phone", status: "confirmed",
        evidence: "Сегодня вечером точно скажу. Если что, тогда завтра смогу показать.",
      }],
      primary_next_step: { action: "Провести просмотр", owner: "Агент", deadline: "сегодня вечером", channel: "phone", status: "confirmed" },
    });
    const result = applyOutcomeAgentOutputPolicyV3(outcome).value;
    expect(result.call_result).toBe("Клиент ожидает подтверждения возможности просмотра.");
    expect(result.agreements[0]).toMatchObject({ action: "Сообщить клиенту о возможности просмотра", channel: "телефон" });
    expect(result.primary_next_step).toMatchObject({
      action: "Позвонить клиенту и сообщить, доступна ли квартира для просмотра",
      deadline: "сегодня вечером", channel: "телефон", status: "confirmed",
    });
  });
});
