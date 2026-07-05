import { describe, expect, it } from "vitest";
import { createPlaygroundTestRun } from "@/entities/PlaygroundTestRun/model/factory";
import { computeDashboardStats } from "./playground-dashboard-analytics";

function run(overrides: Partial<Parameters<typeof createPlaygroundTestRun>[0]> = {}) {
  return createPlaygroundTestRun({
    projectId: "project_1",
    source: "pipeline-lab-v3",
    status: "succeeded",
    stageCount: 10,
    errorCount: 0,
    warningCount: 0,
    tokens: 1000,
    costUsd: 0.01,
    durationMs: 5000,
    confidence: 0.9,
    qualityScore: 90,
    startedAt: "2026-07-05T10:00:00.000Z",
    finishedAt: "2026-07-05T10:00:05.000Z",
    ...overrides,
  });
}

describe("computeDashboardStats", () => {
  it("returns all-zero for an empty run list", () => {
    const stats = computeDashboardStats([]);
    expect(stats).toMatchObject({
      runCount: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 0,
      averageQualityScore: 0,
      averageConfidence: 0,
      averageCostUsd: 0,
      lastCostUsd: 0,
      minCostUsd: 0,
      maxCostUsd: 0,
      qualityScoreSeries: [],
      costSeries: [],
    });
  });

  it("averages metrics and computes success rate across mixed runs (newest-first input)", () => {
    const runs = [
      run({ id: "r3", status: "failed", errorCount: 2, costUsd: 0.05, qualityScore: undefined, confidence: undefined }),
      run({ id: "r2", costUsd: 0.02, qualityScore: 80, confidence: 0.7 }),
      run({ id: "r1", costUsd: 0.01, qualityScore: 90, confidence: 0.9 }),
    ];
    const stats = computeDashboardStats(runs);
    expect(stats.runCount).toBe(3);
    expect(stats.successCount).toBe(2);
    expect(stats.failureCount).toBe(1);
    expect(stats.successRate).toBeCloseTo(2 / 3, 5);
    expect(stats.averageQualityScore).toBeCloseTo(85, 5);
    expect(stats.averageConfidence).toBeCloseTo(0.8, 5);
    expect(stats.averageCostUsd).toBeCloseTo((0.05 + 0.02 + 0.01) / 3, 5);
    expect(stats.minCostUsd).toBeCloseTo(0.01, 5);
    expect(stats.maxCostUsd).toBeCloseTo(0.05, 5);
    // runs[0] (r3) is the most recent per the newest-first storage convention.
    expect(stats.lastCostUsd).toBeCloseTo(0.05, 5);
  });

  it("orders series oldest-to-newest and drops points missing that metric", () => {
    const runs = [run({ id: "r2", qualityScore: 80 }), run({ id: "r1", qualityScore: undefined })];
    const stats = computeDashboardStats(runs);
    expect(stats.qualityScoreSeries.map((point) => point.runId)).toEqual(["r2"]);
    expect(stats.costSeries.map((point) => point.runId)).toEqual(["r1", "r2"]);
  });
});
