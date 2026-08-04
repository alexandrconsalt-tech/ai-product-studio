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
        { id: "confirmed", action: "Посмотреть квартиру", owner: "Менеджер Анна, агент", deadline: "15-е, 14:00", channel: "на объекте", status: "confirmed", evidence: "Да, давайте в пятницу. Договорились." },
        { id: "proposal", action: "Позвонить", owner: "Агент", deadline: "", channel: "", status: "not_defined", evidence: "Можно позвонить." },
      ],
      primary_next_step: { action: "Посмотреть квартиру", owner: "Менеджер Анна, агент", deadline: "15-е, 14:00", channel: "на объекте", status: "confirmed" },
    });
    const result = applyOutcomeAgentOutputPolicyV3(outcome).value;
    expect(result.call_result).toBe("Просмотр согласован.");
    expect(result.agreements).toHaveLength(1);
    expect(result.primary_next_step).toMatchObject({ action: "Провести просмотр", owner: "Агент", deadline: "пятница, 15-е, 14:00", channel: "личная встреча" });
  });
});
