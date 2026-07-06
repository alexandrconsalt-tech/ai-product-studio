// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { callBrowserLlm, clearAnthropicApiKey, clearOpenAiApiKey, saveAnthropicApiKey, saveOpenAiApiKey } from "./browser-direct-provider";

function anthropicResponse(text: string): Response {
  return new Response(JSON.stringify({ content: [{ type: "text", text }] }), { status: 200, headers: { "Content-Type": "application/json" } });
}
function anthropicError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { message } }), { status, headers: { "Content-Type": "application/json" } });
}
function openAiResponse(text: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("callBrowserLlm", () => {
  afterEach(() => {
    clearAnthropicApiKey();
    clearOpenAiApiKey();
    vi.unstubAllGlobals();
  });

  it("calls Anthropic when only its key is configured", async () => {
    saveAnthropicApiKey("sk-ant-valid-key");
    const fetchMock = vi.fn().mockResolvedValue(anthropicResponse("hello from claude"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callBrowserLlm("prompt");

    expect(result).toBe("hello from claude");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.anthropic.com/v1/messages");
  });

  it("falls back to OpenAI when a configured Anthropic key is invalid (real 401) and an OpenAI key is also configured", async () => {
    saveAnthropicApiKey("sk-ant-invalid-key");
    saveOpenAiApiKey("sk-openai-valid-key");
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("anthropic.com")) return Promise.resolve(anthropicError(401, "invalid x-api-key"));
      return Promise.resolve(openAiResponse("hello from gpt"));
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callBrowserLlm("prompt");

    expect(result).toBe("hello from gpt");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rethrows the Anthropic error when it fails and no OpenAI key is configured to fall back to", async () => {
    saveAnthropicApiKey("sk-ant-invalid-key");
    const fetchMock = vi.fn().mockResolvedValue(anthropicError(401, "invalid x-api-key"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(callBrowserLlm("prompt")).rejects.toThrow("invalid x-api-key");
  });

  it("calls OpenAI directly when only its key is configured", async () => {
    saveOpenAiApiKey("sk-openai-valid-key");
    const fetchMock = vi.fn().mockResolvedValue(openAiResponse("hello from gpt"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callBrowserLlm("prompt");

    expect(result).toBe("hello from gpt");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/openai-proxy");
  });

  it("throws a clear error when neither key is configured", async () => {
    await expect(callBrowserLlm("prompt")).rejects.toThrow("Не задан ни один API-ключ");
  });
});
