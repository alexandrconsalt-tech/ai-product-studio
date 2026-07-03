import { describe, expect, it } from "vitest";
import { seededPromptRegistry } from "./seed-prompts";

describe("seededPromptRegistry", () => {
  it("has version 1.0.0 for both demo prompts, matching demo-data.ts's Prompt.version", () => {
    expect(seededPromptRegistry.resolve("prompt_call_summary").version).toBe("1.0.0");
    expect(seededPromptRegistry.resolve("prompt_quality_check").version).toBe("1.0.0");
  });

  it("prompt_call_summary renders with a transcript variable and mentions every CallAnalysisSummary field", () => {
    const rendered = seededPromptRegistry.render("prompt_call_summary", { transcript: "Здравствуйте, хочу трёхкомнатную квартиру." });
    expect(rendered).toContain("Здравствуйте, хочу трёхкомнатную квартиру.");
    for (const field of ["кто", "тип_контакта", "потребность", "вопросы", "статус", "действие", "цитаты"]) {
      expect(rendered).toContain(field);
    }
  });

  it("prompt_quality_check renders with transcript and summary_json variables", () => {
    const rendered = seededPromptRegistry.render("prompt_quality_check", { transcript: "x", summary_json: '{"кто":"y"}' });
    expect(rendered).toContain('{"кто":"y"}');
  });
});
