import { describe, expect, it } from "vitest";
import { createRun } from "@/entities/Run/model/factory";
import type { CallAnalysisSummary } from "@/shared/model/call-analysis-summary";
import type { GoldenExample } from "./golden-dataset";
import { contactTypeMatchScorer, hasActionScorer, minCitationsScorer, noLeakedDataInContactCenterScorer, schemaValidScorer, statusMatchScorer } from "./scorers";

const validSummary: CallAnalysisSummary = {
  кто: "Клиент",
  тип_контакта: "agent",
  потребность: "Трёхкомнатная квартира с видом на парк",
  вопросы: [],
  статус: "in_progress",
  действие: "Отправить подборку из 3 квартир и перезвонить через 2 дня",
  цитаты: ["Хочу трёхкомнатную квартиру с видом на парк"],
};

function exampleWith(expected: Partial<GoldenExample["expected"]>): GoldenExample {
  return { id: "ex", transcript: "x", expected: { minCitations: 1, ...expected } };
}

describe("schemaValidScorer", () => {
  it("passes for a real CallAnalysisSummary output", () => {
    const run = createRun({ pipelineId: "p", input: "x", output: validSummary });
    expect(schemaValidScorer(run, exampleWith({})).passed).toBe(true);
  });

  it("fails for a non-conforming output (e.g. the mock LLM provider's generic echo)", () => {
    const run = createRun({ pipelineId: "p", input: "x", output: { mock: true, echo: "..." } });
    expect(schemaValidScorer(run, exampleWith({})).passed).toBe(false);
  });
});

describe("minCitationsScorer", () => {
  it("passes when цитаты meets the minimum", () => {
    const run = createRun({ pipelineId: "p", input: "x", output: validSummary });
    expect(minCitationsScorer(run, exampleWith({ minCitations: 1 })).passed).toBe(true);
  });

  it("fails when цитаты is below the minimum", () => {
    const run = createRun({ pipelineId: "p", input: "x", output: validSummary });
    expect(minCitationsScorer(run, exampleWith({ minCitations: 2 })).passed).toBe(false);
  });
});

describe("hasActionScorer", () => {
  it("fails for a trivially short действие", () => {
    const run = createRun({ pipelineId: "p", input: "x", output: { ...validSummary, действие: "ок" } });
    expect(hasActionScorer(run, exampleWith({})).passed).toBe(false);
  });

  it("passes for a concrete действие", () => {
    const run = createRun({ pipelineId: "p", input: "x", output: validSummary });
    expect(hasActionScorer(run, exampleWith({})).passed).toBe(true);
  });
});

describe("noLeakedDataInContactCenterScorer (CLAUDE.md §30 BR-2)", () => {
  it("is not applicable (passes) for an agent-routed summary", () => {
    const run = createRun({ pipelineId: "p", input: "x", output: { ...validSummary, тип_контакта: "agent", потребность: "Звонить по номеру +7 999 123 45 67" } });
    expect(noLeakedDataInContactCenterScorer(run, exampleWith({})).passed).toBe(true);
  });

  it("fails when a contact_center summary contains a phone-number-like pattern", () => {
    const run = createRun({ pipelineId: "p", input: "x", output: { ...validSummary, тип_контакта: "contact_center", потребность: "Перезвонить на +7 999 123 45 67" } });
    expect(noLeakedDataInContactCenterScorer(run, exampleWith({})).passed).toBe(false);
  });

  it("passes when a contact_center summary has no leaked data", () => {
    const run = createRun({ pipelineId: "p", input: "x", output: { ...validSummary, тип_контакта: "contact_center" } });
    expect(noLeakedDataInContactCenterScorer(run, exampleWith({})).passed).toBe(true);
  });
});

describe("contactTypeMatchScorer / statusMatchScorer", () => {
  it("passes with no expectation set", () => {
    const run = createRun({ pipelineId: "p", input: "x", output: validSummary });
    expect(contactTypeMatchScorer(run, exampleWith({})).passed).toBe(true);
    expect(statusMatchScorer(run, exampleWith({})).passed).toBe(true);
  });

  it("checks the expected value when set", () => {
    const run = createRun({ pipelineId: "p", input: "x", output: validSummary });
    expect(contactTypeMatchScorer(run, exampleWith({ тип_контакта: "agent" })).passed).toBe(true);
    expect(contactTypeMatchScorer(run, exampleWith({ тип_контакта: "contact_center" })).passed).toBe(false);
    expect(statusMatchScorer(run, exampleWith({ статус: "in_progress" })).passed).toBe(true);
    expect(statusMatchScorer(run, exampleWith({ статус: "won" })).passed).toBe(false);
  });
});
