import { describe, expect, it, vi } from "vitest";
import { FactsV3Contract } from "../contracts/facts/v3/contract";
import {
  createOpenAiDirectTransport,
  DEFAULT_AI_API_BASE_URL,
  OPENAI_CHAT_COMPLETIONS_ENDPOINT,
  redactProviderDiagnosticText,
} from "./openai-direct-transport";

const request = {
  provider: "openai-direct",
  model: "gpt-5-mini-2025-08-07",
  prompt: "Обезличенная тестовая транскрипция.",
  schemaId: FactsV3Contract.id,
  schemaHash: FactsV3Contract.schemaHash,
  responseFormat: {
    type: "json_schema" as const,
    json_schema: {
      name: "facts_agent_output_v3",
      strict: true as const,
      schema: FactsV3Contract.schema,
    },
  },
};

function response(status: number, payload: unknown, requestId = "req_safe_123") {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "x-request-id": requestId,
    },
  });
}

describe("Direct OpenAI transport diagnostics", () => {
  it("distinguishes missing, empty and Preview-unavailable keys without dispatch", async () => {
    const fetchImpl = vi.fn();
    const missing = await createOpenAiDirectTransport({
      environment: { NODE_ENV: "development" },
      fetchImpl,
    })(request);
    const empty = await createOpenAiDirectTransport({
      environment: { NODE_ENV: "development", OPENAI_API_KEY: "   " },
      fetchImpl,
    })(request);
    const preview = await createOpenAiDirectTransport({
      environment: { NODE_ENV: "production", VERCEL_ENV: "preview" },
      fetchImpl,
    })(request);

    expect(missing).toMatchObject({
      ok: false,
      errorCode: "OPENAI_API_KEY_MISSING",
      attestation: { requested: false },
      providerDiagnostic: { requestDispatched: false, apiKeyPresent: false },
    });
    expect(empty).toMatchObject({
      ok: false,
      errorCode: "OPENAI_API_KEY_EMPTY",
      providerDiagnostic: { requestDispatched: false },
    });
    expect(preview).toMatchObject({
      ok: false,
      errorCode: "OPENAI_API_KEY_UNAVAILABLE_IN_PREVIEW",
      providerDiagnostic: {
        requestDispatched: false,
        environmentScope: "preview",
      },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    [401, { error: { type: "invalid_request_error", code: "invalid_api_key", param: null, message: "Incorrect API key" } }, "OPENAI_AUTH_FAILED", "auth"],
    [404, { error: { type: "invalid_request_error", code: "model_not_found", param: "model", message: "The model does not exist" } }, "OPENAI_MODEL_UNAVAILABLE", "model"],
    [429, { error: { type: "rate_limit_error", code: "rate_limit_exceeded", param: null, message: "Rate limit reached" } }, "OPENAI_RATE_LIMITED", "rate_limit"],
    [429, { error: { type: "insufficient_quota", code: "insufficient_quota", param: null, message: "Quota exceeded" } }, "OPENAI_QUOTA_EXCEEDED", "quota"],
    [400, { error: { type: "invalid_request_error", code: "invalid_json_schema", param: "response_format", message: "Invalid schema" } }, "OPENAI_STRUCTURED_SCHEMA_INVALID", "schema"],
    [400, { error: { type: "invalid_request_error", code: "invalid_value", param: "messages", message: "Invalid request" } }, "OPENAI_REQUEST_VALIDATION_ERROR", "request_validation"],
  ])("maps HTTP %s to %s", async (status, payload, errorCode, category) => {
    const fetchImpl = vi.fn(async () => response(status as number, payload));
    const result = await createOpenAiDirectTransport({
      environment: { NODE_ENV: "test", OPENAI_API_KEY: "test-secret" },
      fetchImpl,
    })(request);
    expect(result).toMatchObject({
      ok: false,
      errorCode,
      providerDiagnostic: {
        requestDispatched: true,
        httpStatus: status,
        errorCategory: category,
        providerRequestId: "req_safe_123",
      },
    });
  });

  it("classifies timeout and network failures", async () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    const timeout = await createOpenAiDirectTransport({
      environment: { OPENAI_API_KEY: "test-secret" },
      fetchImpl: vi.fn(async () => { throw abort; }),
    })(request);
    const network = await createOpenAiDirectTransport({
      environment: { OPENAI_API_KEY: "test-secret" },
      fetchImpl: vi.fn(async () => { throw new Error("socket unavailable"); }),
    })(request);
    expect(timeout).toMatchObject({
      ok: false,
      errorCode: "OPENAI_TIMEOUT",
      providerDiagnostic: { timeoutNetworkClassification: "timeout" },
    });
    expect(network).toMatchObject({
      ok: false,
      errorCode: "OPENAI_NETWORK_ERROR",
      providerDiagnostic: { timeoutNetworkClassification: "network" },
    });
  });

  it("aborts an individual request at its stage timeout", async () => {
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        }, { once: true });
      })
    );
    const startedAt = Date.now();
    const result = await createOpenAiDirectTransport({
      environment: { OPENAI_API_KEY: "test-secret" },
      fetchImpl,
      timeoutMs: 60_000,
    })({ ...request, timeoutMs: 5 });
    expect(Date.now() - startedAt).toBeLessThan(1_000);
    expect(result).toMatchObject({
      ok: false,
      errorCode: "OPENAI_TIMEOUT",
      providerDiagnostic: { errorCategory: "timeout" },
    });
  });

  it("dispatches Chat Completions Structured Output and records usage and duration", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe("gpt-5-mini");
      expect(body.response_format).toEqual(request.responseFormat);
      expect(body.messages).toHaveLength(1);
      return response(200, {
        id: "chatcmpl-safe",
        object: "chat.completion",
        choices: [{ message: { content: JSON.stringify(FactsV3Contract.fixtures.valid) } }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      });
    });
    const result = await createOpenAiDirectTransport({
      environment: { NODE_ENV: "test", OPENAI_API_KEY: "test-secret" },
      fetchImpl,
    })(request);
    expect(fetchImpl).toHaveBeenCalledWith(
      OPENAI_CHAT_COMPLETIONS_ENDPOINT,
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toMatchObject({
      ok: true,
      attestation: {
        requested: true,
        forwarded: true,
        accepted: true,
        structuredResponseReturned: true,
      },
      providerDiagnostic: {
        requestDispatched: true,
        endpoint: `${DEFAULT_AI_API_BASE_URL}/chat/completions`,
        model: "gpt-5-mini",
        httpStatus: 200,
        structuredOutputNotAppliedReason: null,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      },
    });
    expect(result.providerDiagnostic?.durationMs).toBeGreaterThan(0);
  });

  it("builds the endpoint from AI_API_BASE_URL and prefers it over OPENAI_BASE_URL", async () => {
    const fetchImpl = vi.fn(async () => response(200, {
      id: "chatcmpl-safe",
      choices: [{ message: { content: JSON.stringify(FactsV3Contract.fixtures.valid) } }],
    }));
    const result = await createOpenAiDirectTransport({
      environment: {
        NODE_ENV: "test",
        OPENAI_API_KEY: "test-secret",
        AI_API_BASE_URL: "https://api.aitunnel.ru/v1/",
        OPENAI_BASE_URL: "https://api.openai.com/v1",
      },
      fetchImpl,
    })(request);

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.aitunnel.ru/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-secret" }),
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      providerDiagnostic: {
        endpoint: "https://api.aitunnel.ru/v1/chat/completions",
        model: "gpt-5-mini",
      },
    });
  });

  it("keeps the requested model for a non-AITUNNEL compatible endpoint", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe("gpt-5-mini-2025-08-07");
      return response(200, {
        id: "chatcmpl-safe",
        choices: [{ message: { content: JSON.stringify(FactsV3Contract.fixtures.valid) } }],
      });
    });
    await createOpenAiDirectTransport({
      environment: {
        NODE_ENV: "test",
        OPENAI_API_KEY: "test-secret",
        OPENAI_BASE_URL: "https://compatible.example/v1",
      },
      fetchImpl,
    })(request);

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://compatible.example/v1/chat/completions",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("redacts secrets and PII from provider messages", () => {
    const redacted = redactProviderDiagnosticText(
      "Bearer token sk-example-secret user@example.com +7 (999) 123-45-67",
    );
    expect(redacted).not.toContain("sk-example-secret");
    expect(redacted).not.toContain("user@example.com");
    expect(redacted).not.toContain("999");
    expect(redacted).toContain("[REDACTED_API_KEY]");
  });
});
