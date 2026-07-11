"use client";

/**
 * Shared browser-side "bring your own key" LLM caller, extracted from
 * public/pipeline-lab-v3.html's callAnthropic/callOpenAI/callModel so
 * Product's AI Assist (dictated/typed idea -> structured product card)
 * reuses the exact same credentials and call path Pipeline Lab v3
 * already uses, instead of a second, parallel integration.
 *
 * Deliberately NOT the Mock LLM Provider
 * (src/shared/llm/provider-registry.ts) -- that one backs the Production
 * Pipeline Runtime and is unreachable from the browser for a *real*
 * model per CLAUDE.md §8.1.1 (client components can't read
 * OPENAI_API_KEY). This one calls a real model directly from the
 * browser using a key the user pastes in once, the same way Pipeline
 * Lab v3 already does -- same localStorage keys, same OpenAI CORS
 * workaround via `/api/openai-proxy`.
 */

const ANTHROPIC_KEY_STORAGE = "pipelineLabV3.anthropicApiKey";
const OPENAI_KEY_STORAGE = "pipelineLabV3.openaiApiKey";
const AI_TUNNEL_KEY_STORAGE = "aiTunnelApiKey";
const AI_TUNNEL_BASE_URL_STORAGE = "aiTunnelBaseUrl";
const SELECTED_LLM_PROVIDER_STORAGE = "selectedLlmProvider";

export const DEFAULT_AI_TUNNEL_BASE_URL = "https://api.aitunnel.ru/v1";
export type SelectedLlmProvider = "ai-tunnel" | "openai-direct" | "anthropic-direct" | "mock";

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";
const DEFAULT_OPENAI_MODEL = "gpt-5-mini";

export function loadAnthropicApiKey(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ANTHROPIC_KEY_STORAGE) ?? "";
}

export function loadOpenAiApiKey(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(OPENAI_KEY_STORAGE) ?? "";
}

export function loadAiTunnelApiKey(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(AI_TUNNEL_KEY_STORAGE) ?? "";
}

export function loadAiTunnelBaseUrl(): string {
  if (typeof window === "undefined") return DEFAULT_AI_TUNNEL_BASE_URL;
  return window.localStorage.getItem(AI_TUNNEL_BASE_URL_STORAGE) || DEFAULT_AI_TUNNEL_BASE_URL;
}

export function loadSelectedLlmProvider(): SelectedLlmProvider {
  if (typeof window === "undefined") return "mock";
  const saved = window.localStorage.getItem(SELECTED_LLM_PROVIDER_STORAGE);
  if (saved === "ai-tunnel" || saved === "openai-direct" || saved === "anthropic-direct" || saved === "mock") return saved;
  if (loadAnthropicApiKey()) return "anthropic-direct";
  if (loadOpenAiApiKey()) return "openai-direct";
  return "mock";
}

function loadExplicitSelectedLlmProvider(): SelectedLlmProvider | null {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(SELECTED_LLM_PROVIDER_STORAGE);
  return saved === "ai-tunnel" || saved === "openai-direct" || saved === "anthropic-direct" || saved === "mock" ? saved : null;
}

export function saveAiTunnelSettings(key: string, baseUrl: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AI_TUNNEL_KEY_STORAGE, key);
  window.localStorage.setItem(AI_TUNNEL_BASE_URL_STORAGE, baseUrl || DEFAULT_AI_TUNNEL_BASE_URL);
}

export function clearAiTunnelApiKey(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AI_TUNNEL_KEY_STORAGE);
}

export function saveSelectedLlmProvider(provider: SelectedLlmProvider): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SELECTED_LLM_PROVIDER_STORAGE, provider);
}

// Managed from the Настройки (Settings) screen, src/features/mvp/screens/
// settings-screen.tsx -- same localStorage keys public/pipeline-lab-v3.html
// itself reads (its own "API-ключи" card is hidden, not deleted, since the
// two share this storage by being same-origin), so a key saved once here
// applies to every product's Pipeline Lab v3 instance.
export function saveAnthropicApiKey(key: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ANTHROPIC_KEY_STORAGE, key);
}
export function clearAnthropicApiKey(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ANTHROPIC_KEY_STORAGE);
}
export function saveOpenAiApiKey(key: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OPENAI_KEY_STORAGE, key);
}
export function clearOpenAiApiKey(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(OPENAI_KEY_STORAGE);
}

export function hasBrowserLlmKeyConfigured(): boolean {
  const provider = loadSelectedLlmProvider();
  if (provider === "mock") return true;
  if (provider === "ai-tunnel") return Boolean(loadAiTunnelApiKey());
  if (provider === "openai-direct") return Boolean(loadOpenAiApiKey());
  return Boolean(loadAnthropicApiKey());
}

/** Same masking Pipeline Lab v3's own maskKey does: first 10 chars + last 4, never the full key. */
export function maskApiKey(key: string): string {
  return key.length > 10 ? `${key.slice(0, 10)}…${key.slice(-4)}` : key;
}

type AnthropicTextBlock = Readonly<{ type: string; text?: string }>;

async function callAnthropic(prompt: string, model: string = DEFAULT_ANTHROPIC_MODEL): Promise<string> {
  const apiKey = loadAnthropicApiKey();
  if (!apiKey) throw new Error("Не задан API-ключ Anthropic — задайте его в разделе «Настройки».");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model, max_tokens: 2000, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(`Anthropic API ${res.status}${detail?.error?.message ? `: ${detail.error.message}` : ""}`);
  }
  const data = await res.json();
  return ((data.content ?? []) as AnthropicTextBlock[]).filter((block) => block.type === "text").map((block) => block.text ?? "").join("\n");
}

// Same CORS constraint documented in src/app/api/openai-proxy/route.ts:
// OpenAI does not send browser-CORS headers, so this goes through that
// existing stateless relay instead of a direct fetch.
async function callOpenAi(prompt: string, model: string = DEFAULT_OPENAI_MODEL): Promise<string> {
  const apiKey = loadOpenAiApiKey();
  if (!apiKey) throw new Error("Не задан API-ключ OpenAI — задайте его в разделе «Настройки».");
  const res = await fetch("/api/openai-proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, model, prompt }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OpenAI API ${res.status}${data?.error?.message ? `: ${data.error.message}` : ""}`);
  return data?.choices?.[0]?.message?.content ?? "";
}

type OpenAiCompatibleResponse = Readonly<{
  choices?: readonly { message?: { content?: string } }[];
}>;

async function callAiTunnel(prompt: string, model: string, temperature = 0.2, maxTokens = 2000): Promise<string> {
  const apiKey = loadAiTunnelApiKey();
  if (!apiKey) throw new Error("Не задан API-ключ AI Tunnel — задайте его в разделе «Настройки».");
  const baseUrl = loadAiTunnelBaseUrl().replace(/\/+$/, "");
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature, max_tokens: maxTokens }),
  });
  const data = (await res.json().catch(() => ({}))) as OpenAiCompatibleResponse & { error?: { message?: string } };
  if (!res.ok) throw new Error(`AI Tunnel API ${res.status}${data.error?.message ? `: ${data.error.message}` : ""}`);
  return data.choices?.[0]?.message?.content ?? "";
}

export type AiTunnelConnectionResult = "success" | "invalid-key" | "insufficient-funds" | "model-unavailable" | "rate-limit" | "network-error" | "unknown-error";

export async function testAiTunnelConnection(model: string): Promise<AiTunnelConnectionResult> {
  try {
    await callAiTunnel("Ответь одним словом: работает", model, 0, 2000);
    return "success";
  } catch (error) {
    if (error instanceof TypeError) return "network-error";
    const message = error instanceof Error ? error.message : String(error);
    if (/API\s+401|invalid.*(?:key|token)|unauthorized|неверн.*ключ|недейств.*ключ|ошибк.*авторизац/i.test(message)) return "invalid-key";
    if (/insufficient|balance|funds|credit|billing|API\s+402|недостаточно средств|баланс|пополн/i.test(message)) return "insufficient-funds";
    if (/model.*(?:not found|unavailable|access|exist)|API\s+404|модел.*(?:недоступ|не найден|нет доступа)/i.test(message)) return "model-unavailable";
    if (/API\s+429|rate.?limit|too many requests|превышен.*лимит|слишком много запросов/i.test(message)) return "rate-limit";
    if (/network|failed to fetch|load failed|сетев.*ошиб/i.test(message)) return "network-error";
    return "unknown-error";
  }
}

/**
 * Prefers Anthropic when both keys are set (matches Pipeline Lab v3's
 * own default vendor) -- but a *configured* key isn't the same as a
 * *working* one (expired/revoked/mistyped still passes the `loadX()`
 * presence check and only fails once actually called, e.g. Anthropic's
 * "401 invalid x-api-key"). If Anthropic is configured but the call
 * itself throws, and an OpenAI key is also available, fall back to it
 * instead of hard-failing Product's AI Assist -- the same reasoning
 * `callConfiguredLlm` already applies in the other direction.
 */
export async function callBrowserLlm(prompt: string): Promise<string> {
  const selectedProvider = loadExplicitSelectedLlmProvider();
  if (selectedProvider === "ai-tunnel") return callAiTunnel(prompt, DEFAULT_OPENAI_MODEL);
  if (selectedProvider === "openai-direct") return callOpenAi(prompt);
  if (selectedProvider === "anthropic-direct") return callAnthropic(prompt);
  if (selectedProvider === "mock") return JSON.stringify({ mock: true, model: DEFAULT_OPENAI_MODEL, echo: prompt.slice(0, 200) });
  const anthropicKey = loadAnthropicApiKey();
  const openAiKey = loadOpenAiApiKey();
  if (anthropicKey) {
    try {
      return await callAnthropic(prompt);
    } catch (error) {
      if (!openAiKey) throw error;
      return callOpenAi(prompt);
    }
  }
  if (openAiKey) return callOpenAi(prompt);
  throw new Error("Не задан ни один API-ключ (Anthropic или OpenAI). Задайте его в разделе «Настройки».");
}

export type ConfiguredLlmResult = Readonly<{ text: string; vendor: "openai" | "anthropic"; model: string }>;

/**
 * Same BYOK call path as `callBrowserLlm`, but prefers OpenAI/GPT-5 mini
 * first -- for stages whose Architecture explicitly specifies that model
 * (e.g. "Генерация текстов объявлений"'s Benefit Extraction/Generation/
 * Checker agents, all `modelId: "model_gpt5_mini"` in demo-data.ts), so
 * a real run actually uses the configured model rather than whichever
 * vendor happens to be checked first. Falls back to Anthropic if only
 * that key is configured, rather than hard-failing -- still a real
 * model call, just not the specific one the architecture names.
 */
export async function callConfiguredLlm(prompt: string): Promise<ConfiguredLlmResult> {
  const selectedProvider = loadExplicitSelectedLlmProvider();
  if (selectedProvider === "ai-tunnel") return { text: await callAiTunnel(prompt, DEFAULT_OPENAI_MODEL), vendor: "openai", model: DEFAULT_OPENAI_MODEL };
  if (selectedProvider === "openai-direct") return { text: await callOpenAi(prompt), vendor: "openai", model: DEFAULT_OPENAI_MODEL };
  if (selectedProvider === "anthropic-direct") return { text: await callAnthropic(prompt), vendor: "anthropic", model: DEFAULT_ANTHROPIC_MODEL };
  if (selectedProvider === "mock") return { text: JSON.stringify({ mock: true, model: DEFAULT_OPENAI_MODEL, echo: prompt.slice(0, 200) }), vendor: "openai", model: DEFAULT_OPENAI_MODEL };
  if (loadOpenAiApiKey()) return { text: await callOpenAi(prompt), vendor: "openai", model: DEFAULT_OPENAI_MODEL };
  if (loadAnthropicApiKey()) return { text: await callAnthropic(prompt), vendor: "anthropic", model: DEFAULT_ANTHROPIC_MODEL };
  throw new Error("Не задан ни один API-ключ (Anthropic или OpenAI). Задайте его в разделе «Настройки».");
}

/** Same vendor mapping public/pipeline-lab-v3.html's own MODEL_VENDOR uses -- kept in sync by name. */
export const MODEL_VENDOR: Readonly<Record<string, "openai" | "anthropic">> = {
  "gpt-5-mini": "openai",
  "claude-sonnet-4-6": "anthropic",
  "deepseek-v3.2-exp": "openai",
};

export const MODEL_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "gpt-5-mini", label: "GPT-5 mini (OpenAI)" },
  { value: "claude-sonnet-4.5", label: "Claude Sonnet 4.5 (Anthropic)" },
  { value: "deepseek-v3.2-exp", label: "DeepSeek V3.2 Exp (AI Tunnel)" },
];

/**
 * Calls the vendor a specific model name belongs to (per `MODEL_VENDOR`),
 * unlike `callConfiguredLlm` which picks whichever vendor's key happens
 * to be configured. Needed when a stage's configured model matters --
 * e.g. a cross-vendor "Проверщик" stage deliberately using a different
 * vendor than the stage it's checking, the same real-world reason
 * Pipeline Lab v3's own Check Agent defaults to Claude while the
 * Fact/Need/Outcome/Summary agents default to GPT-5 mini.
 */
export async function callModelByName(prompt: string, model: string): Promise<string> {
  const selectedProvider = loadExplicitSelectedLlmProvider();
  if (selectedProvider === "ai-tunnel") return callAiTunnel(prompt, model);
  if (selectedProvider === "openai-direct") return callOpenAi(prompt, model);
  if (selectedProvider === "anthropic-direct") return callAnthropic(prompt, model);
  if (selectedProvider === "mock") return JSON.stringify({ mock: true, model, echo: prompt.slice(0, 200) });
  const vendor = MODEL_VENDOR[model] ?? "anthropic";
  return vendor === "openai" ? callOpenAi(prompt, model) : callAnthropic(prompt, model);
}

/** Same tolerant parsing Pipeline Lab v3's own parseJSON does (strips ```json fences, trims to the outer braces). */
export function parseJsonResponse<T>(raw: string): T {
  let text = raw.trim().replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  return JSON.parse(text) as T;
}
