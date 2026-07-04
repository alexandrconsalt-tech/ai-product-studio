import { describe, expect, it } from "vitest";
import type { ExecutionEvent } from "@/shared/runtime/types";
import { withCappedTrace } from "./execution-trace-store";

function fakeEvents(runId: string): readonly ExecutionEvent[] {
  return [{ type: "run_started", timestamp: "2026-07-04T00:00:00.000Z", runId, pipelineId: "p" }];
}

describe("withCappedTrace", () => {
  it("adds a new run's trace", () => {
    const result = withCappedTrace({}, "run_1", fakeEvents("run_1"));
    expect(Object.keys(result)).toEqual(["run_1"]);
  });

  it("overwrites an existing run's trace without evicting others", () => {
    const existing = { run_1: fakeEvents("run_1"), run_2: fakeEvents("run_2") };
    const result = withCappedTrace(existing, "run_1", fakeEvents("run_1"));
    expect(Object.keys(result)).toEqual(["run_2", "run_1"]);
  });

  it("evicts the oldest trace once the cap (20) is exceeded", () => {
    const existing = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`run_${i}`, fakeEvents(`run_${i}`)]));
    const result = withCappedTrace(existing, "run_new", fakeEvents("run_new"));
    expect(Object.keys(result)).toHaveLength(20);
    expect(result.run_0).toBeUndefined();
    expect(result.run_1).toBeDefined();
    expect(result.run_new).toBeDefined();
  });
});
