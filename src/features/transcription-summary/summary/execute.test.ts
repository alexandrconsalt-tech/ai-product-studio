import { describe, expect, it, vi } from "vitest";
import type { StructuredProviderTransport } from "../runtime/structured-output";
import { createSummaryFixtureContext } from "./fixtures";
import { executeSummaryAgentV3 } from "./execute";

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
    const result = await executeSummaryAgentV3({
      manifest: fixture.manifest,
      conversationStore: fixture.store,
      transcript: fixture.transcript,
      provider: "openai-direct",
      model: "gpt-5-mini",
      transport: transportReturning(fixture.output),
    });
    expect(result).toMatchObject({
      ok: true,
      value: fixture.output,
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
