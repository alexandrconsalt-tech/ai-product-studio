import { describe, expect, it, vi } from "vitest";
import { FactsV3Contract } from "../contracts/facts/v3/contract";
import { runControlledOpenAiAcceptance } from "./openai-controlled-adapter";

function response(payload: unknown, status = 200, requestId = "req_test"): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "x-request-id": requestId,
    },
  });
}

function accepted(value: unknown) {
  return response({
    id: "chatcmpl_test",
    object: "chat.completion",
    choices: [{ message: { content: JSON.stringify(value) } }],
  });
}

describe("controlled OpenAI acceptance adapter", () => {
  it("sends the exact Registry schema and returns safe evidence", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => (
      accepted(FactsV3Contract.fixtures.valid)
    ));
    const result = await runControlledOpenAiAcceptance({
      apiKey: "test-only-secret",
      contract: FactsV3Contract,
      prompt: "synthetic fixture",
      fetchImpl,
    });
    expect(result).toMatchObject({
      ok: true,
      diagnostic: {
        provider: "openai",
        providerRequestId: "req_test",
        contractId: "facts.agent.output.v3",
        schemaHash: FactsV3Contract.schemaHash,
        responseFormatRequested: true,
        providerAcceptedRequest: true,
        responseType: "chat.completion",
        zodValidationPassed: true,
        attemptCount: 1,
      },
    });
    const request = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
    expect(request.response_format).toEqual({
      type: "json_schema",
      json_schema: {
        name: "facts_agent_output_v3",
        strict: true,
        schema: FactsV3Contract.schema,
      },
    });
    expect(JSON.stringify(result)).not.toContain("test-only-secret");
  });

  it("uses the same schema for one repair and never falls back to text", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => accepted({}))
      .mockResolvedValueOnce(accepted({}))
      .mockResolvedValueOnce(accepted(FactsV3Contract.fixtures.valid));
    const result = await runControlledOpenAiAcceptance({
      apiKey: "test",
      contract: FactsV3Contract,
      prompt: "synthetic fixture",
      allowRepair: true,
      fetchImpl,
    });
    expect(result).toMatchObject({
      ok: true,
      diagnostic: { repairAttempted: true, attemptCount: 2 },
    });
    const first = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
    const second = JSON.parse(String(fetchImpl.mock.calls[1][1]?.body));
    expect(second.response_format).toEqual(first.response_format);
    expect(first.response_format.type).toBe("json_schema");
  });

  it.each([
    [
      "invalid schema",
      response({ error: { code: "invalid_json_schema", message: "response_format schema is invalid" } }, 400),
      "STRUCTURED_OUTPUT_SCHEMA_REJECTED",
    ],
    [
      "unsupported model",
      response({ error: { code: "model_not_found", message: "model does not support structured outputs" } }, 404),
      "STRUCTURED_OUTPUT_UNAVAILABLE",
    ],
    [
      "provider failure",
      response({ error: { code: "server_error", message: "provider unavailable" } }, 500),
      "PROVIDER_ERROR",
    ],
  ])("maps %s without fallback", async (_name, providerResponse, errorCode) => {
    const fetchImpl = vi.fn(async () => providerResponse);
    const result = await runControlledOpenAiAcceptance({
      apiKey: "test",
      contract: FactsV3Contract,
      prompt: "synthetic fixture",
      allowRepair: true,
      fetchImpl,
    });
    expect(result).toMatchObject({
      ok: false,
      error: { errorCode },
      diagnostic: { attemptCount: 1, zodValidationPassed: false },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("maps timeout without a quality score", async () => {
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    const result = await runControlledOpenAiAcceptance({
      apiKey: "test",
      contract: FactsV3Contract,
      prompt: "synthetic fixture",
      timeoutMs: 1,
      fetchImpl,
    });
    expect(result).toMatchObject({ ok: false, error: { errorCode: "TIMEOUT" } });
    expect(result).not.toHaveProperty("score");
  });
});
