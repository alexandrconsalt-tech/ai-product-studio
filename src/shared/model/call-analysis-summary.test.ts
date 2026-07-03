import { describe, expect, it } from "vitest";
import { CallAnalysisSummarySchema } from "./call-analysis-summary";

const validSummary = {
  кто: "Александр, покупатель",
  тип_контакта: "agent" as const,
  потребность: "Трёхкомнатная квартира с видом на парк, переезд до конца квартала.",
  бюджет: "12-14 млн ₽",
  срок: "до конца квартала",
  способ_оплаты: "ипотека",
  вопросы: ["Есть ли рассрочка от застройщика?"],
  статус: "thinking" as const,
  действие: "Отправить подборку из 3 квартир, перезвонить через 2 дня.",
  цитаты: ["Хотим успеть переехать до Нового года"],
};

describe("CallAnalysisSummarySchema (CLAUDE.md §3.3 / §14.3)", () => {
  it("accepts the full shape from the real business case", () => {
    expect(CallAnalysisSummarySchema.safeParse(validSummary).success).toBe(true);
  });

  it("accepts the minimal required fields without the optional ones", () => {
    const { бюджет, срок, способ_оплаты, ...minimal } = validSummary;
    expect(CallAnalysisSummarySchema.safeParse(minimal).success).toBe(true);
  });

  it("rejects a summary with zero citations (grounding requirement, §14.3)", () => {
    const invalid = { ...validSummary, цитаты: [] };
    expect(CallAnalysisSummarySchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects an undocumented тип_контакта", () => {
    const invalid = { ...validSummary, тип_контакта: "webhook" };
    expect(CallAnalysisSummarySchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects an undocumented статус", () => {
    const invalid = { ...validSummary, статус: "urgent" };
    expect(CallAnalysisSummarySchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects a missing действие (BR rule: an actionable next step is mandatory)", () => {
    const { действие, ...invalid } = validSummary;
    expect(CallAnalysisSummarySchema.safeParse(invalid).success).toBe(false);
  });
});
