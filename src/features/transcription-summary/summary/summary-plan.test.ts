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
        deadline: "пятница, 15-го числа, 14:00",
        channel: "личная встреча",
        status: "confirmed",
      },
    });
    expect(plan.meanings.find((meaning) => meaning.block === "next_step")?.text)
      .toBe("Агент проведёт просмотр в пятницу, 15-го, в 14:00.");
  });
});
