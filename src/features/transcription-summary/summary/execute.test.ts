import { describe, expect, it, vi } from "vitest";
import type { StructuredProviderTransport } from "../runtime/structured-output";
import { createSummaryFixtureContext } from "./fixtures";
import { executeSummaryAgentV3 } from "./execute";
import { buildSummaryPlanV3 } from "./summary-plan";

function transportReturning(value: unknown): StructuredProviderTransport {
  return vi.fn(async () => ({
    ok: true as const,
    structuredValue: value,
    rawResponse: { id: "mock-response" },
    attestation: {
      requested: true,
      forwarded: true,
      accepted: true,
      structuredResponseReturned: true,
    },
  }));
}

describe("Summary Agent v3", () => {
  it("генерирует exact Summary из Store и транскрипции", async () => {
    const fixture = createSummaryFixtureContext();
    const plan = buildSummaryPlanV3(fixture.store);
    const providerOutput = {
      conversation_result: `${plan.meanings
        .filter((meaning) => meaning.block === "conversation_result")
        .map((meaning) => meaning.text.replace(/[.!?\s]+$/u, ""))
        .join(". ")}.`,
      key_facts: plan.meanings
        .filter((meaning) => meaning.block === "key_facts")
        .map((meaning) => ({ label: meaning.label ?? "Требование", value: meaning.text })),
      quotes: plan.meanings
        .filter((meaning) => meaning.block === "quotes")
        .map((meaning) => ({ text: meaning.text })),
      next_step: plan.meanings.find((meaning) => meaning.block === "next_step")?.text
        ?? "Следующий шаг не согласован.",
    };
    const result = await executeSummaryAgentV3({
      manifest: fixture.manifest,
      conversationStore: fixture.store,
      transcript: fixture.transcript,
      provider: "openai-direct",
      model: "gpt-5-mini",
      transport: transportReturning(providerOutput),
    });
    expect(result).toMatchObject({
      ok: true,
      value: providerOutput,
      diagnostic: {
        sourceValidationStatus: "valid",
        structuredOutputApplied: true,
      },
    });
  });

  it("не вызывает провайдера без Store", async () => {
    const fixture = createSummaryFixtureContext();
    const transport = transportReturning(fixture.output);
    const result = await executeSummaryAgentV3({
      manifest: fixture.manifest,
      conversationStore: null,
      transcript: fixture.transcript,
      provider: "openai-direct",
      model: "gpt-5-mini",
      transport,
    });
    expect(result).toMatchObject({ ok: false, disposition: "NOT_RUN" });
    expect(transport).not.toHaveBeenCalled();
  });

  it("не принимает несовместимый legacy-формат", async () => {
    const fixture = createSummaryFixtureContext();
    const result = await executeSummaryAgentV3({
      manifest: fixture.manifest,
      conversationStore: fixture.store,
      transcript: fixture.transcript,
      provider: "openai-direct",
      model: "gpt-5-mini",
      transport: transportReturning({ summary_text: "legacy" }),
    });
    expect(result).toMatchObject({
      ok: false,
      disposition: "TECHNICAL_ERROR",
      error: { errorCode: "SUMMARY_OUTPUT_SCHEMA_INVALID" },
    });
  });
});
