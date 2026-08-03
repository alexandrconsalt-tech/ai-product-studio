import { describe, expect, it } from "vitest";
import type { SummaryPlanV3 } from "./summary-plan";
import { applySummaryPlanAndValidate } from "./structural-validation";

const plan: SummaryPlanV3 = {
  version: "summary-plan-v3.1.0",
  meanings: [
    { meaningId: "goal-1", kind: "client_goal", block: "conversation_result", text: "Клиент ищет квартиру", required: true, exclusive: false, sourceIds: ["turn-1"] },
    { meaningId: "result-1", kind: "conversation_result", block: "conversation_result", text: "Обсуждение продолжено", required: true, exclusive: false, sourceIds: ["result-1"] },
    { meaningId: "area-1", kind: "key_fact", block: "key_facts", text: "от 60 м²", required: true, exclusive: false, sourceIds: ["turn-2"] },
    { meaningId: "noise-1", kind: "key_fact", block: "key_facts", text: "не рассматривает шумную квартиру", required: true, exclusive: false, sourceIds: ["turn-3"] },
    { meaningId: "primary_next_step", kind: "primary_next_step", block: "next_step", text: "Агент перезвонит сегодня после 18:00 по телефону.", required: true, exclusive: true, sourceIds: ["turn-4"] },
  ],
  crmCoverage: { fundingSource: true, purchaseTerm: false, interest: true },
};

describe("Summary Plan and post-final Structural Validator", () => {
  it("restores protected values, negation and removes technical residue", () => {
    const result = applySummaryPlanAndValidate({
      conversation_result: "Клиент ищет квартиру. {\"error\":\"bad\"}",
      key_facts: [
        { label: "Площадь", value: "не объект м²" },
        { label: "Требование", value: "шумная квартира" },
      ],
      quotes: [],
      next_step: "Агент перезвонит сегодня объект:00.",
    }, plan);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      conversation_result: "Клиент ищет квартиру. Обсуждение продолжено.",
      key_facts: [
        { label: "Ключевой факт", value: "от 60 м²" },
        { label: "Ограничение", value: "не рассматривает шумную квартиру" },
      ],
      quotes: [],
      next_step: "Агент перезвонит сегодня после 18:00 по телефону.",
    });
    expect(result.diagnostics).toMatchObject({
      missingMeaningIds: [],
      protectedValueViolations: [],
      technicalResidue: [],
      nextStepDuplicationCount: 0,
    });
  });

  it("keeps the exact next step only in next_step", () => {
    const result = applySummaryPlanAndValidate({
      conversation_result: "Клиент ищет квартиру. Обсуждение продолжено. Агент перезвонит сегодня после 18:00 по телефону.",
      key_facts: [],
      quotes: [],
      next_step: "Агент перезвонит сегодня после 18:00 по телефону.",
    }, plan);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.conversation_result).not.toContain("18:00");
    expect(result.value.next_step).toContain("18:00");
    expect(result.diagnostics.nextStepDuplicationCount).toBe(0);
  });

  it("не требует канал next step повторно в результате разговора", () => {
    const result = applySummaryPlanAndValidate({
      conversation_result: "Клиент ищет квартиру. Отправка вариантов согласована.",
      key_facts: [{ label: "Площадь", value: "от 60 м²" }, { label: "Ограничение", value: "не рассматривает шумную квартиру" }],
      quotes: [],
      next_step: "Агент отправит три варианта сегодня вечером в Telegram.",
    }, {
      ...plan,
      meanings: plan.meanings.map((meaning) => meaning.meaningId === "result-1"
        ? { ...meaning, text: "Отправка трёх вариантов в Telegram согласована" }
        : meaning.meaningId === "primary_next_step"
          ? { ...meaning, text: "Агент отправит три варианта сегодня вечером в Telegram." }
          : meaning),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.conversation_result).not.toContain("Telegram");
    expect(result.value.next_step).toContain("Telegram");
    expect(result.diagnostics.protectedValueViolations).toEqual([]);
  });

  it("удаляет парафразированный дубль action, time и channel до Judges", () => {
    const result = applySummaryPlanAndValidate({
      conversation_result: "Клиент ищет квартиру от 60 м². Агент подтвердил, что завтра пришлёт по электронной почте подборку квартир от 60 м².",
      key_facts: [{ label: "Площадь", value: "от 60 м²" }, { label: "Ограничение", value: "не рассматривает шумную квартиру" }],
      quotes: [],
      next_step: "Агент отправит подборку квартир от 60 м² по электронной почте завтра.",
    }, {
      ...plan,
      meanings: plan.meanings.map((meaning) => meaning.meaningId === "primary_next_step"
        ? { ...meaning, text: "Агент отправит подборку квартир от 60 м² по электронной почте завтра." }
        : meaning),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.conversation_result).toBe("Клиент ищет квартиру от 60 м². Обсуждение продолжено.");
    expect(result.diagnostics.nextStepDuplicationCount).toBe(0);
  });
});
