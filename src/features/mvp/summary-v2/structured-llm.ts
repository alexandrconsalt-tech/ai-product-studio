"use client";

import { loadAiTunnelApiKey, loadAiTunnelBaseUrl, loadAnthropicApiKey, loadOpenAiApiKey, loadSelectedLlmProvider } from "@/shared/llm/browser-direct-provider";
import type { z } from "zod";

export type StructuredLlmResponse<T> = Readonly<{ data: T; model: string; durationMs: number }>;

export async function callStructuredLlm<T>(
  prompt: string,
  schemaName: string,
  jsonSchema: Record<string, unknown>,
  validator: z.ZodType<T>,
  model: string,
): Promise<StructuredLlmResponse<T>> {
  const provider = loadSelectedLlmProvider();
  if (provider === "mock") throw new Error("mock_provider_not_supported_for_summary_v2");
  const apiKey = provider === "ai-tunnel" ? loadAiTunnelApiKey() : provider === "openai-direct" ? loadOpenAiApiKey() : loadAnthropicApiKey();
  if (!apiKey) throw new Error("api_key_missing");

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const started = performance.now();
    try {
      const response = await fetch("/api/summary-v2-llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey,
          baseUrl: provider === "ai-tunnel" ? loadAiTunnelBaseUrl() : undefined,
          model,
          prompt,
          schemaName,
          jsonSchema,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(payload?.error ?? `provider_http_${response.status}`));
      const parsed = validator.safeParse(payload.output);
      if (!parsed.success) throw new Error(`schema_validation_failed: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
      return { data: parsed.data, model: String(payload.model ?? model), durationMs: Math.round(performance.now() - started) };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("structured_output_failed");
}
