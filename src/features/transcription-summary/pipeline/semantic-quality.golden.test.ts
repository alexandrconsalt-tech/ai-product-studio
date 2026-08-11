import { describe, expect, it } from "vitest";
import { FactsV3Schema } from "../contracts/facts/v3/contract";
import { NeedsV3Schema } from "../contracts/needs/v3/contract";
import { OutcomeV3Schema } from "../contracts/outcome/v3/contract";
import {
  applyFactsAgentOutputPolicyV3,
  applyNeedsAgentOutputPolicyV3,
  applyOutcomeAgentOutputPolicyV3,
} from "../runtime/agent-output-policy";

const extracted = {
  source_turn_ids: ["turn-client"],
  evidence: "Клиент сообщил данные.",
  confidence: 1,
  verification_status: "extracted" as const,
};

describe("Golden semantic quality policy v3", () => {
  it("достигает 100% recall критичных deterministic meanings без unsupported карточечных Facts", () => {
    const facts = FactsV3Schema.parse({
      confirmed_facts: [], client_questions: [], quotes: [], contextual_statements: [], rejected_assumptions: [],
    });
    const transcript = {
      turns: [
        { id: "goal", sequence: 0, speaker: "client" as const, text: "Ищу квартиру для себя.", started_at_ms: null, ended_at_ms: null },
        { id: "funding", sequence: 1, speaker: "client" as const, text: "Покупаю за наличные, деньги на счёте.", started_at_ms: null, ended_at_ms: null },
        { id: "budget", sequence: 2, speaker: "client" as const, text: "Мой бюджет до 15 миллионов.", started_at_ms: null, ended_at_ms: null },
        { id: "refusal", sequence: 3, speaker: "client" as const, text: "Не готов покупать: цена высокая и ремонт дорогой.", started_at_ms: null, ended_at_ms: null },
        { id: "legal", sequence: 4, speaker: "agent" as const, text: "У квартиры три собственника, документы ещё готовятся.", started_at_ms: null, ended_at_ms: null },
        { id: "card", sequence: 5, speaker: "agent" as const, text: "Адрес Пражская, 60 м², восьмой этаж.", started_at_ms: null, ended_at_ms: null },
      ],
    };
    const actual = applyFactsAgentOutputPolicyV3(facts, transcript).value.confirmed_facts;
    const expectedPredicates = new Set([
      "client_goal", "funding_source", "client_budget", "explicit_objection", "purchase_purpose", "legal_or_document_status",
    ]);
    const recalled = actual.filter((item) => expectedPredicates.has(item.predicate)).length;
    const recall = recalled / expectedPredicates.size;
    const unsupported = actual.filter((item) => item.source_turn_ids.includes("card")).length / Math.max(1, actual.length);
    expect(recall, JSON.stringify(actual.map((item) => item.predicate))).toBeGreaterThanOrEqual(0.98);
    expect(unsupported).toBeLessThanOrEqual(0.01);
  });

  it("держит Needs false positive на 0% для карточки, конкретного интереса и CRM-дубля", () => {
    const needs = NeedsV3Schema.parse({
      business_needs: [
        { id: "listing", need_type: "interest", value: "двухкомнатная квартира (интерес)", ...extracted },
        { id: "mortgage", need_type: "financial_context", value: "ипотека не нужна", ...extracted },
        { id: "budget", need_type: "financial_constraint", value: "Бюджет до 15 млн", ...extracted, evidence: "Мой бюджет до 15 млн." },
      ],
      property_requirements: [
        { id: "card-area", need_type: "area", value: "60 м²", ...extracted, evidence: "В объявлении площадь 60 м²." },
      ],
      structured_crm_attributes: {
        interested_in: [],
        funding_source: { id: "funding", value: "наличные / депозит", ...extracted, evidence: "Ипотека не нужна, деньги на счёте." },
        purchase_term: { id: "term", value: "не определено", ...extracted },
      },
      communication_preferences: [], client_questions: [],
    });
    const actual = applyNeedsAgentOutputPolicyV3(needs).value;
    const falseIds = new Set(["listing", "mortgage", "card-area"]);
    const returned = [...actual.business_needs, ...actual.property_requirements];
    const falsePositiveRate = returned.filter((item) => falseIds.has(item.id)).length / falseIds.size;
    expect(falsePositiveRate).toBeLessThanOrEqual(0.02);
    expect(returned.map((item) => item.id)).toEqual(["budget"]);
  });

  it("держит Outcome agreement precision на 100%", () => {
    const outcome = OutcomeV3Schema.parse({
      call_result: "Обсудили условия.",
      agreements: [
        { id: "documents", action: "Отправить документы", owner: "Агент", deadline: "сегодня", channel: "email", status: "confirmed", evidence: "Сегодня отправлю документы на email." },
        { id: "funding", action: "Финансирование наличными", owner: "Клиент", deadline: "", channel: "", status: "confirmed", evidence: "Покупаю за наличные." },
        { id: "purpose", action: "Покупка для себя", owner: "Клиент", deadline: "", channel: "", status: "confirmed", evidence: "Покупаю для себя." },
        { id: "conditions", action: "Согласие с ценой объекта", owner: "Клиент", deadline: "", channel: "", status: "confirmed", evidence: "Цену вижу." },
      ],
      primary_next_step: { action: "Отправить документы", owner: "Агент", deadline: "сегодня", channel: "email", status: "confirmed" },
    });
    const actual = applyOutcomeAgentOutputPolicyV3(outcome).value;
    const trueAgreements = actual.agreements.filter((item) => item.id === "documents").length;
    const precision = trueAgreements / Math.max(1, actual.agreements.length);
    expect(precision).toBeGreaterThanOrEqual(0.98);
    expect(actual.agreements.map((item) => item.id)).toEqual(["documents"]);
  });
});
