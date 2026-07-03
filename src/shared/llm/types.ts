/**
 * Provider-agnostic LLM call abstraction. Nothing in this file talks
 * to a real network -- it only defines the shape every provider
 * (mock or real) must satisfy, so a StageHandler that needs an LLM
 * call depends on `LLMProvider`, never on a specific vendor SDK.
 */

export type LLMMessageRole = "system" | "user" | "assistant";

export type LLMMessage = Readonly<{
  role: LLMMessageRole;
  content: string;
}>;

export type LLMCompletionRequest = Readonly<{
  model: string;
  messages: readonly LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json";
}>;

export type LLMUsage = Readonly<{
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}>;

export type LLMFinishReason = "stop" | "length" | "error";

export type LLMCompletionResult = Readonly<{
  content: string;
  usage: LLMUsage;
  latencyMs: number;
  model: string;
  finishReason: LLMFinishReason;
}>;

/**
 * Thrown by a provider on a failed call. `retryable` lets
 * `withRetry` (src/shared/runtime/retry.ts) decide whether to retry
 * without the caller needing to know provider-specific error codes.
 */
export class LLMProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LLMProviderError";
  }
}

export type LLMProvider = Readonly<{
  name: string;
  complete(request: LLMCompletionRequest): Promise<LLMCompletionResult>;
}>;
