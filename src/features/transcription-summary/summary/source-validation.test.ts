import { describe, expect, it } from "vitest";
import { buildSummaryAgentInput } from "./input-builder";
import { createSummaryFixtureContext } from "./fixtures";
import { processSummaryOutput } from "./source-validation";

function context() {
  const fixture = createSummaryFixtureContext();
  const built = buildSummaryAgentInput({
    manifest: fixture.manifest,
    conversationStore: fixture.store,
    transcript: fixture.transcript,
  });
  if (!built.ok) throw new Error(built.error.message);
  return { fixture, input: built.value };
}

describe("Summary exact output", () => {
  it("принимает ровно четыре пользовательских поля", () => {
    const { fixture, input } = context();
    const result = processSummaryOutput(input, fixture.output);
    expect(result).toMatchObject({ ok: true, repetitionGuardStatus: "unchanged" });
    if (result.ok) {
      expect(Object.keys(result.value).sort()).toEqual(
        ["conversation_result", "key_facts", "next_step", "quotes"].sort(),
      );
    }
  });

  it("отклоняет дополнительные технические поля", () => {
    const { fixture, input } = context();
    expect(processSummaryOutput(input, {
      ...fixture.output,
      metadata: { confidence: 1 },
    })).toMatchObject({
      ok: false,
      error: { errorCode: "SUMMARY_OUTPUT_SCHEMA_INVALID" },
    });
  });

  it("удаляет необязательную цитату без точного источника и продолжает pipeline", () => {
    const { fixture, input } = context();
    const result = processSummaryOutput(input, {
      ...fixture.output,
      quotes: [{ text: "Этой фразы в звонке нет." }],
    });
    expect(result).toMatchObject({
      ok: true,
      value: { quotes: [] },
      quoteDiagnostics: [{
        summary_quote: "Этой фразы в звонке нет.",
        matched_source_quote_id: null,
        mismatch_reason: "NOT_EXACT_SOURCE_SUBSTRING",
      }],
    });
  });

  it("не переписывает Summary после генерации", () => {
    const { fixture, input } = context();
    const source = structuredClone(fixture.output);
    const result = processSummaryOutput(input, source);
    expect(result.ok).toBe(true);
    expect(source).toEqual(fixture.output);
    if (result.ok) expect(result.value).toEqual(fixture.output);
  });
});
