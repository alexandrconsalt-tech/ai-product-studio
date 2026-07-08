import { describe, expect, it } from "vitest";
import { createPlaygroundTestRun } from "@/entities/PlaygroundTestRun/model/factory";
import { withCappedRun } from "./playground-test-run-store";

describe("withCappedRun", () => {
  it("replaces an existing run with the same id instead of duplicating it", () => {
    const first = createPlaygroundTestRun({
      id: "playground_test_run_1",
      projectId: "project_1",
      source: "pipeline-lab-v3",
      status: "succeeded",
      stageCount: 1,
      errorCount: 0,
      warningCount: 0,
      tokens: 10,
      costUsd: 0.01,
      durationMs: 100,
      startedAt: "2026-07-08T10:00:00.000Z",
      finishedAt: "2026-07-08T10:00:01.000Z",
    });
    const updated = { ...first, qualityScore: 93, decision: "AUTO_SAVE" };

    const state = withCappedRun({ project_1: [first] }, updated);

    expect(state.project_1).toHaveLength(1);
    expect(state.project_1[0]).toMatchObject({ id: "playground_test_run_1", qualityScore: 93, decision: "AUTO_SAVE" });
  });
});
