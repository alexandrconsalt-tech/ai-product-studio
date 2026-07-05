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
  return Boolean(loadAnthropicApiKey() || loadOpenAiApiKey());
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

/** Prefers Anthropic when both keys are set (matches Pipeline Lab v3's own default vendor). */
export async function callBrowserLlm(prompt: string): Promise<string> {
  if (loadAnthropicApiKey()) return callAnthropic(prompt);
  if (loadOpenAiApiKey()) return callOpenAi(prompt);
  throw new Error("Не задан ни один API-ключ (Anthropic или OpenAI). Задайте его в разделе «Настройки».");
}

/** Same tolerant parsing Pipeline Lab v3's own parseJSON does (strips ```json fences, trims to the outer braces). */
export function parseJsonResponse<T>(raw: string): T {
  let text = raw.trim().replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  return JSON.parse(text) as T;
}
