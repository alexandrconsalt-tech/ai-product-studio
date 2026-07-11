// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  callBrowserLlm,
  callModelByName,
  clearAnthropicApiKey,
  clearOpenAiApiKey,
  loadAiTunnelApiKey,
  loadAiTunnelBaseUrl,
  loadSelectedLlmProvider,
  maskApiKey,
  MODEL_OPTIONS,
  MODEL_VENDOR,
  saveAiTunnelSettings,
  saveAnthropicApiKey,
  saveOpenAiApiKey,
  saveSelectedLlmProvider,
  testAiTunnelConnection,
} from "./browser-direct-provider";

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
    window.localStorage.clear();
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

describe("AI Tunnel browser provider", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("persists one key, base URL and selected provider without changing direct keys", () => {
    saveAnthropicApiKey("sk-ant-existing");
    saveOpenAiApiKey("sk-openai-existing");
    saveAiTunnelSettings("sk-aitunnel-secret-VQeY", "https://tunnel.example/v1");
    saveSelectedLlmProvider("ai-tunnel");

    expect(loadAiTunnelApiKey()).toBe("sk-aitunnel-secret-VQeY");
    expect(loadAiTunnelBaseUrl()).toBe("https://tunnel.example/v1");
    expect(loadSelectedLlmProvider()).toBe("ai-tunnel");
    expect(window.localStorage.getItem("pipelineLabV3.anthropicApiKey")).toBe("sk-ant-existing");
    expect(window.localStorage.getItem("pipelineLabV3.openaiApiKey")).toBe("sk-openai-existing");
    expect(maskApiKey("sk-aitunnel-secret-VQeY")).toBe("sk-aitunne…VQeY");
  });

  it.each([
    "gpt-5-mini",
    "claude-sonnet-4-6",
    "deepseek-v3.2-exp",
    "deepseek-v4-flash",
    "gpt-4o-mini",
    "gemini-2.5-flash-lite",
    "qwen3-235b-a22b-2507",
    "mistral-small-3.2-24b-instruct",
  ])("calls %s through the OpenAI-compatible AI Tunnel endpoint", async (model) => {
    saveAiTunnelSettings("sk-aitunnel-secret", "https://api.aitunnel.ru/v1/");
    saveSelectedLlmProvider("ai-tunnel");
    const fetchMock = vi.fn().mockResolvedValue(openAiResponse("работает"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(callModelByName("prompt", model)).resolves.toBe("работает");

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.aitunnel.ru/v1/chat/completions");
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(request.headers).toEqual(expect.objectContaining({ Authorization: "Bearer sk-aitunnel-secret" }));
    expect(JSON.parse(request.body as string)).toEqual({ model, messages: [{ role: "user", content: "prompt" }], temperature: 0.2, max_tokens: 2000 });
  });

  it("uses the short connection-test payload and maps an invalid key", async () => {
    saveAiTunnelSettings("sk-aitunnel-invalid", "https://api.aitunnel.ru/v1");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "invalid api key" } }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(testAiTunnelConnection("gpt-5-mini")).resolves.toBe("invalid-key");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ model: "gpt-5-mini", messages: [{ role: "user", content: "Ответь одним словом: работает" }], temperature: 0, max_tokens: 2000 });
  });
});

describe("model catalog", () => {
  const newModels: Readonly<Record<string, string>> = {
    "deepseek-v4-flash": "DeepSeek V4 Flash (AI Tunnel)",
    "gpt-4o-mini": "GPT-4o Mini (AI Tunnel)",
    "gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite (AI Tunnel)",
    "qwen3-235b-a22b-2507": "Qwen3 235B A22B (AI Tunnel)",
    "mistral-small-3.2-24b-instruct": "Mistral Small 3.2 24B (AI Tunnel)",
  };

  it("lists all 5 newly added models with their AI Tunnel model id and label", () => {
    for (const [value, label] of Object.entries(newModels)) {
      expect(MODEL_OPTIONS).toContainEqual({ value, label });
    }
  });

  it("does not remove or rename any previously existing model option", () => {
    const existingValues = ["gpt-5-mini", "claude-sonnet-4.5", "deepseek-v3.2-exp"];
    for (const value of existingValues) {
      expect(MODEL_OPTIONS.some((option) => option.value === value)).toBe(true);
    }
  });

  it("maps every new model to a resolvable vendor for the callModelByName fallback path", () => {
    for (const value of Object.keys(newModels)) {
      expect(MODEL_VENDOR[value]).toBeDefined();
    }
  });

  it("has no duplicate model ids", () => {
    const values = MODEL_OPTIONS.map((option) => option.value);
    expect(new Set(values).size).toBe(values.length);
  });
});
