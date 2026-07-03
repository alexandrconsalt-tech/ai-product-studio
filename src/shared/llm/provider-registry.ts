import type { ModelProvider } from "@/entities/Model/model/types";
import { mockLLMProvider } from "./mock-provider";
import { OpenAiCompatibleProvider } from "./openai-compatible-provider";
import type { LLMProvider } from "./types";

export type LLMProviderRegistry = Readonly<{
  resolve(provider: ModelProvider): LLMProvider;
  withProvider(provider: ModelProvider, llmProvider: LLMProvider): LLMProviderRegistry;
}>;

function createRegistry(providers: Readonly<Partial<Record<ModelProvider, LLMProvider>>>): LLMProviderRegistry {
  return {
    resolve(provider) {
      return providers[provider] ?? mockLLMProvider;
    },
    withProvider(provider, llmProvider) {
      return createRegistry({ ...providers, [provider]: llmProvider });
    },
  };
}

/**
 * Every `ModelProvider` (CLAUDE.md/entities/Model's own enum -- reused
 * here rather than inventing a parallel one) resolves to the mock
 * provider by default. No real network call happens anywhere in this
 * repository unless a caller explicitly configures a real provider,
 * either via `withProvider` or `configureFromEnv`.
 */
export const defaultLLMProviderRegistry: LLMProviderRegistry = createRegistry({});

/**
 * Reads `OPENAI_API_KEY` (and optionally `OPENAI_BASE_URL`) from
 * `process.env` and, if present, returns a registry with a real
 * `OpenAiCompatibleProvider` wired up for the "openai" `ModelProvider`.
 * This function must be called explicitly by whoever wants real LLM
 * calls -- it is never invoked automatically at import time or by the
 * Pipeline Executor's default registry, per CLAUDE.md §49 SEC-1 (no
 * secret handling happens implicitly).
 */
export function configureFromEnv(registry: LLMProviderRegistry = defaultLLMProviderRegistry): LLMProviderRegistry {
  const apiKey = typeof process !== "undefined" ? process.env.OPENAI_API_KEY : undefined;
  if (!apiKey) return registry;
  const baseUrl = (typeof process !== "undefined" && process.env.OPENAI_BASE_URL) || "https://api.openai.com/v1";
  return registry.withProvider("openai", new OpenAiCompatibleProvider({ name: "openai", apiKey, baseUrl }));
}
