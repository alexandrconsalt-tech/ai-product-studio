import { describe, expect, it, vi } from "vitest";
import { AI_SUMMARY_V3_PIPELINE_VERSION } from "../contracts/constants";
import { FactsV3Contract } from "../contracts/facts/v3/contract";
import { createContractManifest } from "../contracts/manifest";
import { NeedsV3Contract } from "../contracts/needs/v3/contract";
import { defineContract } from "../contracts/schema-utils";
import { z } from "zod";
import { aiTunnelFailClosedTransport, executeStructuredCompletion, type StructuredProviderTransport } from "./structured-output";

const manifest = createContractManifest(AI_SUMMARY_V3_PIPELINE_VERSION);
const base = {
  stageId: "facts",
  manifestHash: manifest.manifestHash,
  contract: FactsV3Contract,
  prompt: "visible prompt",
  promptHash: "a".repeat(64),
  provider: "mock-attested",
  model: "test-model",
};
const attestation = { requested: true, forwarded: true, accepted: true, structuredResponseReturned: true };

describe("Structured Output transport", () => {
  it("passes the Registry schema and validates with the same Zod contract", async () => {
    const transport = vi.fn<StructuredProviderTransport>(async () => ({
      ok: true,
      structuredValue: FactsV3Contract.fixtures.valid,
      rawResponse: { id: "response-1" },
      attestation,
    }));
    const result = await executeStructuredCompletion({ ...base, transport });
    expect(result.ok).toBe(true);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0][0].responseFormat.json_schema.schema).toBe(FactsV3Contract.schema);
    expect(result.diagnostic.schemaHash).toBe(FactsV3Contract.schemaHash);
  });

  it("repairs at most once with the same schema and never disables response_format", async () => {
    const transport = vi.fn<StructuredProviderTransport>()
      .mockResolvedValueOnce({ ok: true, structuredValue: {}, rawResponse: {}, attestation })
      .mockResolvedValueOnce({ ok: true, structuredValue: FactsV3Contract.fixtures.valid, rawResponse: {}, attestation });
    const result = await executeStructuredCompletion({ ...base, transport });
    expect(result.ok).toBe(true);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls[0][0].responseFormat).toEqual(transport.mock.calls[1][0].responseFormat);
    expect(result.diagnostic.repairAttempted).toBe(true);
  });

  it("returns schema technical error after the second failure", async () => {
    const transport: StructuredProviderTransport = async () => ({ ok: true, structuredValue: {}, rawResponse: {}, attestation });
    const result = await executeStructuredCompletion({ ...base, transport });
    expect(result).toMatchObject({ ok: false, error: { errorCode: "SCHEMA_VALIDATION_ERROR" }, diagnostic: { attemptCount: 2 } });
  });

  it("does not extract JSON from markdown", async () => {
    const transport: StructuredProviderTransport = async () => ({
      ok: true,
      rawText: "```json\n{}\n```",
      rawResponse: {},
      attestation,
    });
    const result = await executeStructuredCompletion({ ...base, transport });
    expect(result).toMatchObject({ ok: false, error: { errorCode: "JSON_DECODE_ERROR" } });
  });

  it("fails closed for AI Tunnel without calling a text fallback", async () => {
    const result = await executeStructuredCompletion({ ...base, provider: "ai-tunnel", transport: aiTunnelFailClosedTransport });
    expect(result).toMatchObject({
      ok: false,
      error: { errorCode: "STRUCTURED_OUTPUT_UNAVAILABLE" },
      diagnostic: { structuredOutputApplied: false, attemptCount: 1 },
    });
  });

  it("does not retry a provider schema rejection without response_format", async () => {
    const transport = vi.fn<StructuredProviderTransport>(async () => ({
      ok: false,
      errorCode: "PROVIDER_SCHEMA_ERROR",
      message: "schema rejected",
      attestation: { requested: true, forwarded: true, accepted: false, structuredResponseReturned: false },
    }));
    const result = await executeStructuredCompletion({ ...base, transport });
    expect(result).toMatchObject({ ok: false, error: { errorCode: "PROVIDER_SCHEMA_ERROR" } });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("blocks an incompatible Registry schema before dispatch and reports requested=false", async () => {
    const invalidContract = defineContract({
      id: "invalid.root.union.v3",
      stageId: "invalid",
      description: "test-only invalid provider schema",
      validator: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("a"), value: z.string() }).strict(),
        z.object({ kind: z.literal("b"), value: z.number() }).strict(),
      ]),
      fixtures: {
        valid: { kind: "a", value: "ok" },
        missing_required: {},
        extra_legacy_field: { kind: "a", value: "ok", extra: true },
        invalid_enum: { kind: "c", value: "no" },
        invalid_nested_type: { kind: "a", value: 1 },
      },
    });
    const transport = vi.fn<StructuredProviderTransport>();
    const result = await executeStructuredCompletion({
      ...base,
      contract: invalidContract,
      transport,
    });
    expect(result).toMatchObject({
      ok: false,
      error: { errorCode: "OPENAI_STRUCTURED_SCHEMA_INVALID" },
      diagnostic: {
        structuredOutputRequested: false,
        attemptCount: 0,
        validationStatus: "invalid",
      },
    });
    expect(transport).not.toHaveBeenCalled();
  });

  it("does not accept valid JSON as proof when attestation is incomplete", async () => {
    const transport: StructuredProviderTransport = async () => ({
      ok: true,
      structuredValue: FactsV3Contract.fixtures.valid,
      rawResponse: {},
      attestation: { ...attestation, forwarded: false },
    });
    const result = await executeStructuredCompletion({ ...base, transport });
    expect(result).toMatchObject({ ok: false, error: { errorCode: "STRUCTURED_OUTPUT_UNAVAILABLE" } });
  });

  it("does not hide a normalization invariant failure behind LLM repair", async () => {
    const value = structuredClone(NeedsV3Contract.fixtures.valid) as Record<string, any>;
    value.structured_crm_attributes.funding_source.value = "наличными";
    value.structured_crm_attributes.funding_source.evidence = "  Оплачу наличными.  ";
    const transport = vi.fn<StructuredProviderTransport>(async () => ({
      ok: true,
      structuredValue: value,
      rawResponse: {},
      attestation,
    }));
    const result = await executeStructuredCompletion({
      ...base,
      stageId: "needs",
      contract: NeedsV3Contract,
      transport,
    });
    expect(result).toMatchObject({
      ok: false,
      error: { errorCode: "NORMALIZATION_INVARIANT_VIOLATION" },
      diagnostic: {
        attemptCount: 1,
        repairAttempted: false,
        normalizationStatus: "failed",
      },
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
