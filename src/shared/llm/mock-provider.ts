import type { LLMCompletionRequest, LLMCompletionResult, LLMProvider } from "./types";

/**
 * Deterministic, offline LLMProvider. Never makes a network call.
 * This is the default provider everywhere -- a real provider must be
 * explicitly configured (see provider-registry.ts) before any code
 * path can make an actual model call, so nothing in this repository
 * silently starts spending money or sending data to a third party.
 */
function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}

function lastUserMessage(request: LLMCompletionRequest): string {
  const lastUser = [...request.messages].reverse().find((message) => message.role === "user");
  return lastUser?.content ?? "";
}

export class MockLLMProvider implements LLMProvider {
  readonly name = "mock";

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResult> {
    const promptText = request.messages.map((message) => message.content).join("\n");
    const promptTokens = estimateTokens(promptText);
    const input = lastUserMessage(request);

    const content =
      request.responseFormat === "json"
        ? JSON.stringify({ mock: true, model: request.model, echo: input.slice(0, 200) })
        : `[mock:${request.model}] ${input.slice(0, 200)}`;

    const completionTokens = estimateTokens(content);

    return {
      content,
      usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
      latencyMs: Math.round(20 + promptText.length * 0.1),
      model: request.model,
      finishReason: "stop",
    };
  }
}

export const mockLLMProvider = new MockLLMProvider();
