import { describe, expect, it } from "vitest";
import { createRun } from "@/entities/Run/model/factory";
import type { ExecutionTrace } from "@/shared/runtime/execution-trace";
import { computeCostAnalytics } from "./cost-analytics";

describe("computeCostAnalytics", () => {
  it("returns all-zero for an empty run list", () => {
    const report = computeCostAnalytics([]);
    expect(report).toMatchObject({ totalCostUsd: 0, averageCostPerRun: 0, averageLatencyMs: 0, averageConfidence: 0, runCount: 0, topExpensiveStages: [] });
  });

  it("sums cost and averages latency/confidence across runs", () => {
    const runs = [
      createRun({ pipelineId: "p", input: "x", costUsd: 0.01, latencyMs: 100, metrics: [{ name: "confidence", value: 0.9 }] }),
      createRun({ pipelineId: "p", input: "x", costUsd: 0.03, latencyMs: 300, metrics: [{ name: "confidence", value: 0.7 }] }),
    ];
    const report = computeCostAnalytics(runs);
    expect(report.totalCostUsd).toBeCloseTo(0.04, 5);
    expect(report.averageCostPerRun).toBeCloseTo(0.02, 5);
    expect(report.averageLatencyMs).toBe(200);
    expect(report.averageConfidence).toBeCloseTo(0.8, 5);
    expect(report.runCount).toBe(2);
  });

  it("ranks top expensive stages by total cost across traces", () => {
    const traces: ExecutionTrace[] = [
      {
        runId: "r1",
        pipelineId: "p",
        status: "succeeded",
        stages: [
          { nodeId: "n1", name: "Cheap", type: "function", status: "succeeded", retryCount: 0, metrics: [{ name: "cost", value: 0.001 }], evidence: [] },
          { nodeId: "n2", name: "Expensive", type: "llm", status: "succeeded", retryCount: 0, metrics: [{ name: "cost", value: 0.05 }], evidence: [] },
        ],
      },
    ];
    const report = computeCostAnalytics([], traces);
    expect(report.topExpensiveStages[0]).toMatchObject({ nodeId: "n2", name: "Expensive" });
  });

  it("caps topExpensiveStages at 5 entries", () => {
    const stages = Array.from({ length: 8 }, (_, i) => ({
      nodeId: `n${i}`,
      name: `Stage ${i}`,
      type: "llm" as const,
      status: "succeeded" as const,
      retryCount: 0,
      metrics: [{ name: "cost", value: i }],
      evidence: [],
    }));
    const traces: ExecutionTrace[] = [{ runId: "r", pipelineId: "p", status: "succeeded", stages }];
    const report = computeCostAnalytics([], traces);
    expect(report.topExpensiveStages).toHaveLength(5);
  });
});
