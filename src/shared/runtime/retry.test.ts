import { describe, expect, it, vi } from "vitest";
import { defaultRetryPolicy, noRetryPolicy, withRetry } from "./retry";

describe("withRetry", () => {
  it("returns the result immediately on first-attempt success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, defaultRetryPolicy);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and eventually succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValue("ok");
    const onRetry = vi.fn();
    const result = await withRetry(fn, { maxAttempts: 3, backoffMs: () => 0 }, onRetry);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting maxAttempts", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));
    await expect(withRetry(fn, { maxAttempts: 2, backoffMs: () => 0 })).rejects.toThrow("always fails");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry at all with noRetryPolicy", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fails"));
    await expect(withRetry(fn, noRetryPolicy)).rejects.toThrow("fails");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("stops immediately for a non-retryable error even with attempts remaining", async () => {
    const fn = vi.fn().mockRejectedValue({ retryable: false, message: "fatal" });
    await expect(withRetry(fn, defaultRetryPolicy)).rejects.toMatchObject({ retryable: false });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("passes the current attempt number to fn", async () => {
    const attempts: number[] = [];
    const fn = vi.fn().mockImplementation(async (attempt: number) => {
      attempts.push(attempt);
      if (attempt < 3) throw new Error("retry me");
      return "done";
    });
    await withRetry(fn, { maxAttempts: 3, backoffMs: () => 0 });
    expect(attempts).toEqual([1, 2, 3]);
  });
});
