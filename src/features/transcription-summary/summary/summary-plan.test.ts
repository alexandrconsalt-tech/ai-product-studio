import { describe, expect, it } from "vitest";
import { createSummaryFixtureContext } from "./fixtures";
import { buildSummaryPlanV3 } from "./summary-plan";

describe("Summary Plan v3 deadline rendering", () => {
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
    expect(plan.meanings.some((meaning) => meaning.meaningId === "interest")).toBe(true);
  });
});
