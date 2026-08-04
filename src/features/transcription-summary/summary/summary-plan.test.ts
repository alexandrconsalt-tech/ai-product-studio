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
});
