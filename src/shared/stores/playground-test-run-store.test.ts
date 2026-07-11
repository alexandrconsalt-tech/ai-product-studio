// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPlaygroundTestRun } from "@/entities/PlaygroundTestRun/model/factory";
import { usePlaygroundTestRunStore, withCappedRun } from "./playground-test-run-store";

function testRun(id: string, projectId: string, finishedAt = "2026-07-08T10:00:01.000Z") {
  return createPlaygroundTestRun({
    id,
    projectId,
    source: "pipeline-lab-v3",
    status: "succeeded",
    stageCount: 1,
    errorCount: 0,
    warningCount: 0,
    tokens: 10,
    costUsd: 0.01,
    durationMs: 100,
    startedAt: "2026-07-08T10:00:00.000Z",
    finishedAt,
  });
}

describe("withCappedRun", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    usePlaygroundTestRunStore.setState({ runsByProjectId: {} });
  });

  it("replaces an existing run with the same id instead of duplicating it", () => {
    const first = testRun("playground_test_run_1", "project_1");
    const updated = { ...first, qualityScore: 93, decision: "AUTO_SAVE" };

    const state = withCappedRun({ project_1: [first] }, updated);

    expect(state.project_1).toHaveLength(1);
    expect(state.project_1[0]).toMatchObject({ id: "playground_test_run_1", qualityScore: 93, decision: "AUTO_SAVE" });
  });

  it("recordRun merges the latest persisted iframe history before writing a new run", () => {
    const persistedRun = testRun("playground_test_run_persisted", "project_persisted", "2026-07-08T10:00:02.000Z");
    const inMemoryRun = testRun("playground_test_run_memory", "project_memory", "2026-07-08T10:00:03.000Z");
    const newRun = testRun("playground_test_run_new", "project_new", "2026-07-08T10:00:04.000Z");

    usePlaygroundTestRunStore.setState({ runsByProjectId: { project_memory: [inMemoryRun] } });
    window.localStorage.setItem(
      "ai-product-studio.playground-test-runs.v1",
      JSON.stringify({ state: { runsByProjectId: { project_persisted: [persistedRun] } }, version: 0 }),
    );

    usePlaygroundTestRunStore.getState().recordRun(newRun);

    const { runsByProjectId } = usePlaygroundTestRunStore.getState();
    expect(runsByProjectId.project_persisted).toHaveLength(1);
    expect(runsByProjectId.project_memory).toHaveLength(1);
    expect(runsByProjectId.project_new).toHaveLength(1);

    const persisted = JSON.parse(window.localStorage.getItem("ai-product-studio.playground-test-runs.v1") ?? "{}") as {
      state?: { runsByProjectId?: Record<string, unknown[]> };
    };
    expect(Object.keys(persisted.state?.runsByProjectId ?? {}).sort()).toEqual(["project_memory", "project_new", "project_persisted"]);
  });

  it("persists the newest run in compact form when the full report exceeds Local Storage quota", () => {
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function setItem(key, value) {
      if (key === "ai-product-studio.playground-test-runs.v1" && value.length > 5_000) {
        throw new DOMException("Storage quota exceeded", "QuotaExceededError");
      }
      originalSetItem.call(this, key, value);
    });
    const run = {
      ...testRun("playground_test_run_large", "project_large", "2026-07-08T10:00:05.000Z"),
      summary: "Итог запуска сохранён.",
      report: { result: { summary: { summary: "Итог запуска сохранён." } }, raw: "x".repeat(200_000) },
    };

    usePlaygroundTestRunStore.getState().recordRun(run);

    const raw = window.localStorage.getItem("ai-product-studio.playground-test-runs.v1");
    expect(raw).not.toBeNull();
    const persisted = JSON.parse(raw ?? "{}") as {
      state?: { runsByProjectId?: Record<string, Array<{ id?: string; summary?: string; report?: { compacted?: boolean } }>> };
    };
    expect(persisted.state?.runsByProjectId?.project_large?.[0]).toMatchObject({
      id: "playground_test_run_large",
      summary: "Итог запуска сохранён.",
      report: { compacted: true },
    });
  });
});
