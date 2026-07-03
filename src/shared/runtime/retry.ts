import type { RetryPolicy } from "./types";

export const defaultRetryPolicy: RetryPolicy = {
  maxAttempts: 3,
  backoffMs: (attempt) => Math.min(1000, 50 * 2 ** (attempt - 1)),
};

export const noRetryPolicy: RetryPolicy = {
  maxAttempts: 1,
  backoffMs: () => 0,
};

export type RetryableError = Readonly<{ retryable: boolean }>;

function isRetryable(error: unknown): boolean {
  if (error && typeof error === "object" && "retryable" in error) {
    return Boolean((error as RetryableError).retryable);
  }
  return true;
}

/**
 * Runs `fn` with retries per `policy`. Retries only while
 * `attempt < policy.maxAttempts` AND the thrown error is retryable
 * (an error object with `retryable: false` stops immediately --
 * matches the fallback hierarchy idea in CLAUDE.md §13: not every
 * failure deserves a retry). `onRetry` fires before each retry sleep,
 * not before the first attempt.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  policy: RetryPolicy,
  onRetry?: (attempt: number, error: unknown) => void,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      const hasMoreAttempts = attempt < policy.maxAttempts;
      if (!hasMoreAttempts || !isRetryable(error)) {
        throw error;
      }
      onRetry?.(attempt, error);
      const delay = policy.backoffMs(attempt);
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}
