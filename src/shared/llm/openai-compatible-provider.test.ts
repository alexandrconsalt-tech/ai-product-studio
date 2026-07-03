import { describe, expect, it, vi } from "vitest";
import { OpenAiCompatibleProvider } from "./openai-compatible-provider";
import { LLMProviderError } from "./types";

function fakeFetch(response: Partial<Response> & { jsonBody?: unknown; textBody?: string }) {
  return vi.fn().mockResolvedValue({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: async () => response.jsonBody,
    text: async () => response.textBody ?? "",
  } as Response);
}

describe("OpenAiCompatibleProvider", () => {
  it("sends the expected request shape and parses a successful response", async () => {
    const fetchImpl = fakeFetch({
      jsonBody: {
        model: "gpt-mock",
        choices: [{ message: { content: "hello back" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      },
    });
    const provider = new OpenAiCompatibleProvider({ name: "test-provider", apiKey: "sk-test", baseUrl: "https://example.com/v1", fetchImpl });

    const result = await provider.complete({ model: "gpt-mock", messages: [{ role: "user", content: "hi" }], temperature: 0.2 });

    expect(result).toMatchObject({ content: "hello back", finishReason: "stop", usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer sk-test" }),
      }),
    );
    const body = JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({ model: "gpt-mock", temperature: 0.2 });
  });

  it("strips a trailing slash from baseUrl", async () => {
    const fetchImpl = fakeFetch({ jsonBody: { model: "x", choices: [{ message: { content: "ok" } }] } });
    const provider = new OpenAiCompatibleProvider({ name: "t", apiKey: "k", baseUrl: "https://example.com/v1/", fetchImpl });
    await provider.complete({ model: "x", messages: [{ role: "user", content: "hi" }] });
    expect(fetchImpl).toHaveBeenCalledWith("https://example.com/v1/chat/completions", expect.anything());
  });

  it("throws a retryable LLMProviderError on a 500 response", async () => {
    const fetchImpl = fakeFetch({ ok: false, status: 500, textBody: "server error" });
    const provider = new OpenAiCompatibleProvider({ name: "t", apiKey: "k", baseUrl: "https://example.com", fetchImpl });
    await expect(provider.complete({ model: "x", messages: [] })).rejects.toMatchObject({ retryable: true } satisfies Partial<LLMProviderError>);
  });

  it("throws a retryable LLMProviderError on 429 rate limit", async () => {
    const fetchImpl = fakeFetch({ ok: false, status: 429 });
    const provider = new OpenAiCompatibleProvider({ name: "t", apiKey: "k", baseUrl: "https://example.com", fetchImpl });
    await expect(provider.complete({ model: "x", messages: [] })).rejects.toMatchObject({ retryable: true });
  });

  it("throws a non-retryable LLMProviderError on 400/401", async () => {
    const fetchImpl = fakeFetch({ ok: false, status: 401 });
    const provider = new OpenAiCompatibleProvider({ name: "t", apiKey: "k", baseUrl: "https://example.com", fetchImpl });
    await expect(provider.complete({ model: "x", messages: [] })).rejects.toMatchObject({ retryable: false });
  });

  it("throws a non-retryable error when the response has no message content", async () => {
    const fetchImpl = fakeFetch({ jsonBody: { model: "x", choices: [{}] } });
    const provider = new OpenAiCompatibleProvider({ name: "t", apiKey: "k", baseUrl: "https://example.com", fetchImpl });
    await expect(provider.complete({ model: "x", messages: [] })).rejects.toMatchObject({ retryable: false });
  });

  it("throws a retryable error on a network failure", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const provider = new OpenAiCompatibleProvider({ name: "t", apiKey: "k", baseUrl: "https://example.com", fetchImpl });
    await expect(provider.complete({ model: "x", messages: [] })).rejects.toMatchObject({ retryable: true });
  });
});
