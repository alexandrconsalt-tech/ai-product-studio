import { describe, expect, it } from "vitest";
import { createSummaryFixtureContext } from "./fixtures";
import { buildSummaryPlanV3 } from "./summary-plan";

describe("Summary Plan v3 deadline rendering", () => {
  it("ранжирует P0 перед P1 и не включает P2 без рабочей необходимости", () => {
    const fixture = createSummaryFixtureContext();
    const plan = buildSummaryPlanV3({
      ...fixture.store,
      call_result: "Клиент отказался продолжать из-за цены и расходов на ремонт.",
      requirements: [
        { id: "blocking", need_type: "deal_constraint", value: "Выход на сделку возможен после получения разрешения на продажу", evidence: "Разрешение ещё не получено.", source_turn_ids: ["turn-1"] },
        { id: "budget", need_type: "budget", value: "Бюджет до 9 млн", evidence: "Бюджет до 9 млн.", source_turn_ids: ["turn-2"] },
        { id: "context", need_type: "additional_context", value: "Клиент давно изучает рынок", evidence: "Давно смотрю предложения.", source_turn_ids: ["turn-3"] },
      ],
    });

    expect(plan.version).toBe("summary-plan-v3.2.0");
    const keyMeanings = plan.meanings.filter((meaning) => meaning.block === "key_facts");
    expect(keyMeanings[0]?.priority).toBe("P0");
    expect(keyMeanings.slice(1).every((meaning) => meaning.priority === "P1")).toBe(true);
    expect(keyMeanings.map((meaning) => meaning.meaningId)).not.toContain("context");
    expect(plan.meanings.filter((meaning) => meaning.priority === "P0").every((meaning) => meaning.required)).toBe(true);
  });

  it("не теряет самостоятельный юридический P0 после удаления legacy-агрегатора", () => {
    const fixture = createSummaryFixtureContext();
    const plan = buildSummaryPlanV3({
      ...fixture.store,
      requirements: [],
      facts: [
        ...fixture.store.facts,
        {
          id: "legal-risk",
          type: "legal_or_document_status",
          value: "На квартире сохраняется обременение, блокирующее сделку",
          evidence: "Снять обременение до сделки пока невозможно.",
          source_turn_ids: ["turn-legal"],
        },
      ],
    });

    expect(plan.meanings).toContainEqual(expect.objectContaining({
      meaningId: "legal-risk",
      block: "key_facts",
      priority: "P0",
      required: true,
      label: "Юридический статус",
    }));
  });

  it("рендерит подтверждённую пятницу с датой и временем грамматически корректно", () => {
    const fixture = createSummaryFixtureContext();
    const plan = buildSummaryPlanV3({
      ...fixture.store,
      primary_next_step: {
        action: "Провести просмотр",
        owner: "Агент",
        deadline: "пятница, 15-е число, 14:00",
        channel: "личная встреча",
        status: "confirmed",
      },
    });
    expect(plan.meanings.find((meaning) => meaning.block === "next_step")?.text)
      .toBe("Агент проведёт просмотр в пятницу, 15-го, в 14:00.");
  });

  it("берёт подтверждённое финансирование из CRM-атрибута и не ранжирует карточечную ипотеку продавца без запроса клиента", () => {
    const fixture = createSummaryFixtureContext();
    const plan = buildSummaryPlanV3({
      ...fixture.store,
      facts: [
        ...fixture.store.facts,
        {
          id: "seller-mortgage",
          type: "mortgage",
          value: "квартира находится в ипотеке Сбербанка",
          evidence: "Агент сообщил об ипотеке продавца.",
          source_turn_ids: ["turn-seller"],
        },
      ],
      requirements: [],
      attributes: {
        ...fixture.store.attributes,
        funding_source: {
          id: "funding",
          value: "наличные / депозит",
          evidence: "Клиент: деньги на счету, родители покупают квартиру.",
          source_turn_ids: ["turn-client"],
        },
      },
    });

    expect(plan.meanings).toContainEqual(expect.objectContaining({
      meaningId: "verified_funding_context",
      text: "Деньги находятся на счёте, покупку оплачивают родители",
      required: true,
    }));
    expect(plan.meanings.some((meaning) => meaning.meaningId === "verified_legal_context")).toBe(false);
  });

  it("не дублирует purchase_intent в key facts, если цель уже есть в conversation result", () => {
    const fixture = createSummaryFixtureContext();
    const plan = buildSummaryPlanV3({
      ...fixture.store,
      requirements: [{
        id: "purchase-intent",
        need_type: "purchase_intent",
        value: "покупка квартиры для себя",
        evidence: "Клиент подбирает квартиру для себя.",
        source_turn_ids: ["turn-client"],
      }],
    });

    expect(plan.meanings.some((meaning) => meaning.meaningId === "purchase-intent")).toBe(false);
  });

  it("не выводит generic purchase в key facts", () => {
    const fixture = createSummaryFixtureContext();
    const plan = buildSummaryPlanV3({
      ...fixture.store,
      requirements: [
        { id: "generic-purchase", need_type: "business_need", value: "покупка квартиры", evidence: "Клиент покупает квартиру.", source_turn_ids: ["turn-1"] },
        { id: "interest", need_type: "interest", value: "Новостройки в центре", evidence: "Интересуют новостройки в центре.", source_turn_ids: ["turn-2"] },
      ],
      attributes: {
        ...fixture.store.attributes,
        interested_in: [{ id: "crm-interest", value: "Новостройки", evidence: "Интересуют новостройки в центре.", source_turn_ids: ["turn-2"] }],
      },
    });

    expect(plan.meanings.some((meaning) => meaning.meaningId === "generic-purchase")).toBe(false);
    expect(plan.meanings.some((meaning) => meaning.meaningId === "interest")).toBe(false);
  });
});
