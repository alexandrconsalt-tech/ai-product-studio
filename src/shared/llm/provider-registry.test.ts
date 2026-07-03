import { afterEach, describe, expect, it, vi } from "vitest";
import { mockLLMProvider } from "./mock-provider";
import { configureFromEnv, defaultLLMProviderRegistry } from "./provider-registry";

describe("defaultLLMProviderRegistry", () => {
  it("resolves every ModelProvider to the mock provider by default", () => {
    const providers = ["openai", "anthropic", "google", "local", "other"] as const;
    for (const provider of providers) {
      expect(defaultLLMProviderRegistry.resolve(provider)).toBe(mockLLMProvider);
    }
  });

  it("withProvider overrides a single provider without mutating the original registry", () => {
    const custom = { name: "custom", complete: vi.fn() };
    const overridden = defaultLLMProviderRegistry.withProvider("openai", custom);

    expect(overridden.resolve("openai")).toBe(custom);
    expect(overridden.resolve("anthropic")).toBe(mockLLMProvider);
    expect(defaultLLMProviderRegistry.resolve("openai")).toBe(mockLLMProvider);
  });
});

describe("configureFromEnv", () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns the registry unchanged when OPENAI_API_KEY is not set", () => {
    delete process.env.OPENAI_API_KEY;
    const registry = configureFromEnv();
    expect(registry.resolve("openai")).toBe(mockLLMProvider);
  });

  it("wires a real OpenAI-compatible provider for 'openai' when OPENAI_API_KEY is set", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const registry = configureFromEnv();
    const resolved = registry.resolve("openai");
    expect(resolved).not.toBe(mockLLMProvider);
    expect(resolved.name).toBe("openai");
  });

  it("does not affect other ModelProviders", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const registry = configureFromEnv();
    expect(registry.resolve("anthropic")).toBe(mockLLMProvider);
  });
});
