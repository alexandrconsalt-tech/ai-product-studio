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
  it("repairs technical field residue and duplicate key fact labels before acceptance", () => {
    const result = applySummaryPlanAndValidate({
      conversation_result: "Клиент ищет квартиру. next_step). {\"error\":\"bad\"}",
      key_facts: [
        { label: "Бюджет", value: "до 10 млн" },
        { label: "Бюджет", value: "до 10 млн" },
      ],
      quotes: [],
      next_step: "Агент перезвонит сегодня после 18:00 по телефону.",
    }, plan);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect([result.value.conversation_result, ...result.value.key_facts.flatMap((item) => [item.label, item.value]), result.value.next_step].join(" ")).not.toMatch(/next_step|error/iu);
    expect(new Set(result.value.key_facts.map((item) => item.label)).size).toBe(result.value.key_facts.length);
    expect(result.diagnostics.technicalResidue).toEqual([]);
  });

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
    expect(result.value.conversation_result).toBe("Клиент ищет квартиру от 60 м². Отправка подборки согласована. Обсуждение продолжено.");
    expect(result.diagnostics.nextStepDuplicationCount).toBe(0);
  });

  it("повторно удаляет дубль после required-meaning restoration", () => {
    const result = applySummaryPlanAndValidate({
      conversation_result: "Клиент подтвердил готовность приехать.",
      key_facts: [],
      quotes: [],
      next_step: "Клиент встретится с агентом завтра в 19:00 у входа в дом.",
    }, {
      version: "summary-plan-v3.1.0",
      meanings: [
        { meaningId: "conversation_result", kind: "conversation_result", block: "conversation_result", text: "Встреча согласована завтра в 19:00 у входа в дом", required: true, exclusive: false, sourceIds: ["result"] },
        { meaningId: "primary_next_step", kind: "primary_next_step", block: "next_step", text: "Клиент встретится с агентом завтра в 19:00 у входа в дом.", required: true, exclusive: true, sourceIds: ["next"] },
      ],
      crmCoverage: { fundingSource: false, purchaseTerm: false, interest: false },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.conversation_result).not.toContain("19:00");
    expect(result.diagnostics.nextStepDuplicationCount).toBe(0);
  });

  it("сохраняет бюджет при удалении next step из partial Store result", () => {
    const result = applySummaryPlanAndValidate({
      conversation_result: "Клиент ищет квартиру для внучки. Агент позвонит завтра по телефону.",
      key_facts: [],
      quotes: [],
      next_step: "Агент позвонит завтра по телефону.",
    }, {
      version: "summary-plan-v3.1.0",
      meanings: [
        { meaningId: "conversation_result", kind: "conversation_result", block: "conversation_result", text: "Клиент ищет квартиру для внучки с бюджетом до 9 миллионов. Агент позвонит завтра по телефону.", required: true, exclusive: false, sourceIds: ["result"] },
        { meaningId: "primary_next_step", kind: "primary_next_step", block: "next_step", text: "Агент позвонит завтра по телефону.", required: true, exclusive: true, sourceIds: ["next"] },
      ],
      crmCoverage: { fundingSource: false, purchaseTerm: false, interest: false },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.conversation_result).toContain("9 миллионов");
    expect(result.value.conversation_result).not.toContain("завтра");
    expect(result.diagnostics.protectedValueViolations).toEqual([]);
    expect(result.diagnostics.nextStepDuplicationCount).toBe(0);
  });

  it("удаляет время и место встречи из результата при парафразе next step", () => {
    const result = applySummaryPlanAndValidate({
      conversation_result: "Встреча подтверждена: клиент приедет завтра в 19:00 к входу в дом. Стороны связываются только в случае изменений.",
      key_facts: [],
      quotes: [],
      next_step: "Клиент прибыть на встречу/осмотр завтра в 19:00 лично, у входа в дом.",
    }, {
      version: "summary-plan-v3.1.0",
      meanings: [
        { meaningId: "conversation_result", kind: "conversation_result", block: "conversation_result", text: "Встреча согласована завтра в 19:00 у входа в дом", required: true, exclusive: false, sourceIds: ["result"] },
        { meaningId: "primary_next_step", kind: "primary_next_step", block: "next_step", text: "Клиент прибыть на встречу/осмотр завтра в 19:00 лично, у входа в дом.", required: true, exclusive: true, sourceIds: ["next"] },
      ],
      crmCoverage: { fundingSource: false, purchaseTerm: false, interest: false },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.conversation_result).toBe("Стороны связываются только в случае изменений. Просмотр согласован.");
    expect(result.value.conversation_result).not.toContain("19:00");
    expect(result.diagnostics.nextStepDuplicationCount).toBe(0);
  });

  it("оставляет отрицание в dedicated key fact без ложной ошибки conversation_result", () => {
    const result = applySummaryPlanAndValidate({
      conversation_result: "Клиент ищет двухкомнатную квартиру от 60 м² рядом с метро.",
      key_facts: [],
      quotes: [],
      next_step: "Агент отправит подборку завтра по электронной почте.",
    }, {
      version: "summary-plan-v3.1.0",
      meanings: [
        { meaningId: "conversation_result", kind: "conversation_result", block: "conversation_result", text: "Клиент ищет двухкомнатную квартиру и не рассматривает шумные варианты", required: true, exclusive: false, sourceIds: ["result"] },
        { meaningId: "noise", kind: "key_fact", block: "key_facts", text: "шумную квартиру не рассматривает", required: true, exclusive: false, sourceIds: ["turn"] },
        { meaningId: "primary_next_step", kind: "primary_next_step", block: "next_step", text: "Агент отправит подборку завтра по электронной почте.", required: true, exclusive: true, sourceIds: ["next"] },
      ],
      crmCoverage: { fundingSource: false, purchaseTerm: false, interest: false },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.key_facts).toContainEqual({ label: "Ограничение", value: "шумную квартиру не рассматривает" });
    expect(result.diagnostics.protectedValueViolations).toEqual([]);
  });

  it("заменяет согласованное действие кратким результатом без деталей next step", () => {
    const result = applySummaryPlanAndValidate({
      conversation_result: "Клиент ищет квартиру для внучки с бюджетом до 9 миллионов. Агент согласовал следующий шаг — связаться с клиентом с альтернативными вариантами.",
      key_facts: [],
      quotes: [],
      next_step: "Позвонить клиенту с альтернативными вариантами завтра по телефону.",
    }, {
      version: "summary-plan-v3.1.0",
      meanings: [
        { meaningId: "conversation_result", kind: "conversation_result", block: "conversation_result", text: "Клиент ищет квартиру для внучки с бюджетом до 9 миллионов", required: true, exclusive: false, sourceIds: ["result"] },
        { meaningId: "primary_next_step", kind: "primary_next_step", block: "next_step", text: "Позвонить клиенту с альтернативными вариантами завтра по телефону.", required: true, exclusive: true, sourceIds: ["next"] },
      ],
      crmCoverage: { fundingSource: false, purchaseTerm: false, interest: false },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.conversation_result).toBe("Клиент ищет квартиру для внучки с бюджетом до 9 миллионов. Договорились о повторном звонке.");
    expect(result.value.conversation_result).not.toContain("альтернативными вариантами");
    expect(result.diagnostics.nextStepDuplicationCount).toBe(0);
  });

  it("восстанавливает отрицательный смысл из aggregate result после удаления next step", () => {
    const result = applySummaryPlanAndValidate({
      conversation_result: "Клиент ищет квартиру. Агент отправит подборку завтра по электронной почте.",
      key_facts: [],
      quotes: [],
      next_step: "Агент отправит подборку завтра по электронной почте.",
    }, {
      version: "summary-plan-v3.1.0",
      meanings: [
        { meaningId: "conversation_result", kind: "conversation_result", block: "conversation_result", text: "Шум критичен, шумную квартиру не рассматривает. Агент отправит подборку завтра по электронной почте.", required: true, exclusive: false, sourceIds: ["result"] },
        { meaningId: "primary_next_step", kind: "primary_next_step", block: "next_step", text: "Агент отправит подборку завтра по электронной почте.", required: true, exclusive: true, sourceIds: ["next"] },
      ],
      crmCoverage: { fundingSource: false, purchaseTerm: false, interest: false },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.conversation_result).toContain("шумную квартиру не рассматривает");
    expect(result.value.conversation_result).not.toContain("завтра");
    expect(result.value.conversation_result).not.toContain("электронной почте");
    expect(result.diagnostics.protectedValueViolations).toEqual([]);
    expect(result.diagnostics.nextStepDuplicationCount).toBe(0);
  });

  it("удаляет парафразы предложить варианты и предоставить документы", () => {
    const variants = applySummaryPlanAndValidate({
      conversation_result: "Клиент ищет квартиру. Агент подтвердил, что свяжется и предложит варианты.",
      key_facts: [], quotes: [], next_step: "Агент позвонит и предложит альтернативные варианты завтра по телефону.",
    }, {
      version: "summary-plan-v3.1.0",
      meanings: [
        { meaningId: "conversation_result", kind: "conversation_result", block: "conversation_result", text: "Клиент ищет квартиру", required: true, exclusive: false, sourceIds: ["result"] },
        { meaningId: "primary_next_step", kind: "primary_next_step", block: "next_step", text: "Агент позвонит и предложит альтернативные варианты завтра по телефону.", required: true, exclusive: true, sourceIds: ["next"] },
      ],
      crmCoverage: { fundingSource: false, purchaseTerm: false, interest: false },
    });
    expect(variants.ok).toBe(true);
    if (variants.ok) expect(variants.value.conversation_result).not.toContain("предложит варианты");

    const documents = applySummaryPlanAndValidate({
      conversation_result: "Клиент запросил документы. Агент подтвердил готовность предоставить документы.",
      key_facts: [], quotes: [], next_step: "Агент отправит документы сегодня по электронной почте.",
    }, {
      version: "summary-plan-v3.1.0",
      meanings: [
        { meaningId: "conversation_result", kind: "conversation_result", block: "conversation_result", text: "Клиент запросил документы", required: true, exclusive: false, sourceIds: ["result"] },
        { meaningId: "primary_next_step", kind: "primary_next_step", block: "next_step", text: "Агент отправит документы сегодня по электронной почте.", required: true, exclusive: true, sourceIds: ["next"] },
      ],
      crmCoverage: { fundingSource: false, purchaseTerm: false, interest: false },
    });
    expect(documents.ok).toBe(true);
    if (documents.ok) expect(documents.value.conversation_result).not.toContain("предоставить документы");
  });

  it("считает компактный call result покрытым не только в последнем предложении", () => {
    const result = applySummaryPlanAndValidate({
      conversation_result: "Клиент проверяет юридическую чистоту. Агент подтвердил готовность предоставить документы. Ключевое значение: почту.",
      key_facts: [],
      quotes: [],
      next_step: "Агент отправит документы сегодня по электронной почте.",
    }, {
      version: "summary-plan-v3.1.0",
      meanings: [
        { meaningId: "goal", kind: "client_goal", block: "conversation_result", text: "Клиент проверяет юридическую чистоту", required: true, exclusive: false, sourceIds: ["goal"] },
        { meaningId: "conversation_result", kind: "conversation_result", block: "conversation_result", text: "Согласована отправка документов для проверки", required: true, exclusive: false, sourceIds: ["result"] },
        { meaningId: "primary_next_step", kind: "primary_next_step", block: "next_step", text: "Агент отправит документы сегодня по электронной почте.", required: true, exclusive: true, sourceIds: ["next"] },
      ],
      crmCoverage: { fundingSource: false, purchaseTerm: false, interest: false },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.conversation_result).toContain("Отправка документов согласована.");
    expect(result.diagnostics.missingMeaningIds).toEqual([]);
  });
});
