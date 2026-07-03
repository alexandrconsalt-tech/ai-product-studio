import { describe, expect, it } from "vitest";
import { MockLLMProvider } from "./mock-provider";

describe("MockLLMProvider", () => {
  const provider = new MockLLMProvider();

  it("never throws and always returns finishReason 'stop'", async () => {
    const result = await provider.complete({ model: "mock-model", messages: [{ role: "user", content: "hello" }] });
    expect(result.finishReason).toBe("stop");
    expect(result.model).toBe("mock-model");
  });

  it("echoes the last user message in the content", async () => {
    const result = await provider.complete({
      model: "x",
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "first" },
        { role: "assistant", content: "reply" },
        { role: "user", content: "second and last" },
      ],
    });
    expect(result.content).toContain("second and last");
    expect(result.content).not.toContain("first");
  });

  it("returns a JSON string when responseFormat is 'json'", async () => {
    const result = await provider.complete({ model: "x", messages: [{ role: "user", content: "data" }], responseFormat: "json" });
    expect(() => JSON.parse(result.content)).not.toThrow();
  });

  it("reports non-zero, non-random token usage derived from input length", async () => {
    const short = await provider.complete({ model: "x", messages: [{ role: "user", content: "hi" }] });
    const long = await provider.complete({ model: "x", messages: [{ role: "user", content: "hi".repeat(200) }] });
    expect(long.usage.promptTokens).toBeGreaterThan(short.usage.promptTokens);
    expect(short.usage.totalTokens).toBe(short.usage.promptTokens + short.usage.completionTokens);
  });
});
