import type { Run } from "@/entities/Run/model/types";
import type { ExecutionTrace } from "@/shared/runtime/execution-trace";

/**
 * Aggregate Cost Analytics across historical runs (persisted, survive
 * reload) plus, where available, in-session ExecutionTrace data for a
 * per-stage cost breakdown (traces are session-only, §M.2, so
 * "top expensive stages" is only as complete as the traces captured
 * this session -- this is stated in the UI, not hidden).
 */

export type StageCostEntry = Readonly<{ nodeId: string; name: string; totalCost: number; runCount: number }>;

export type CostAnalyticsReport = Readonly<{
  totalCostUsd: number;
  averageCostPerRun: number;
  averageLatencyMs: number;
  averageConfidence: number;
  runCount: number;
  topExpensiveStages: readonly StageCostEntry[];
}>;

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function computeCostAnalytics(runs: readonly Run[], traces: readonly ExecutionTrace[] = []): CostAnalyticsReport {
  const costs = runs.map((run) => run.costUsd).filter((value): value is number => value !== undefined);
  const latencies = runs.map((run) => run.latencyMs).filter((value): value is number => value !== undefined);
  const confidences = runs.flatMap((run) => run.metrics.filter((m) => m.name === "confidence").map((m) => m.value));

  const stageCosts = new Map<string, StageCostEntry>();
  for (const trace of traces) {
    for (const stage of trace.stages) {
      const cost = stage.metrics.find((m) => m.name === "cost")?.value;
      if (cost === undefined) continue;
      const existing = stageCosts.get(stage.nodeId) ?? { nodeId: stage.nodeId, name: stage.name, totalCost: 0, runCount: 0 };
      stageCosts.set(stage.nodeId, { ...existing, totalCost: existing.totalCost + cost, runCount: existing.runCount + 1 });
    }
  }

  return {
    totalCostUsd: costs.reduce((sum, value) => sum + value, 0),
    averageCostPerRun: average(costs),
    averageLatencyMs: average(latencies),
    averageConfidence: average(confidences),
    runCount: runs.length,
    topExpensiveStages: [...stageCosts.values()].sort((a, b) => b.totalCost - a.totalCost).slice(0, 5),
  };
}
