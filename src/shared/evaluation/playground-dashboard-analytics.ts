import type { PlaygroundTestRun } from "@/entities/PlaygroundTestRun/model/types";

/**
 * Aggregates a slice of PlaygroundTestRun history (already limited to the
 * user-selected range -- last 5/10/20/50/100 -- by the Dashboard screen)
 * into the stat-card/chart numbers Dashboard renders. Pure and side-effect
 * free so it's independently testable (PT-1) without a store or DOM.
 */

export type DashboardSeriesPoint = Readonly<{ runId: string; timestamp: string; value: number }>;

export type DashboardStats = Readonly<{
  runCount: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageQualityScore: number;
  averageConfidence: number;
  averageCostUsd: number;
  lastCostUsd: number;
  minCostUsd: number;
  maxCostUsd: number;
  averageDurationMs: number;
  averageErrorCount: number;
  averageWarningCount: number;
  qualityScoreSeries: readonly DashboardSeriesPoint[];
  costSeries: readonly DashboardSeriesPoint[];
  durationSeries: readonly DashboardSeriesPoint[];
  confidenceSeries: readonly DashboardSeriesPoint[];
}>;

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toSeries(runs: readonly PlaygroundTestRun[], pick: (run: PlaygroundTestRun) => number | undefined): DashboardSeriesPoint[] {
  // Runs are stored newest-first (playground-test-run-store.ts); charts
  // read left-to-right as oldest-to-newest, so reverse here once.
  return [...runs]
    .reverse()
    .map((run) => ({ runId: run.id, timestamp: run.finishedAt, value: pick(run) }))
    .filter((point): point is DashboardSeriesPoint => point.value !== undefined);
}

export function computeDashboardStats(runs: readonly PlaygroundTestRun[]): DashboardStats {
  const successCount = runs.filter((run) => run.status === "succeeded").length;
  const failureCount = runs.length - successCount;
  const costs = runs.map((run) => run.costUsd);
  const qualityScores = runs.map((run) => run.qualityScore).filter((value): value is number => value !== undefined);
  const confidences = runs.map((run) => run.confidence).filter((value): value is number => value !== undefined);
  const durations = runs.map((run) => run.durationMs);

  return {
    runCount: runs.length,
    successCount,
    failureCount,
    successRate: runs.length === 0 ? 0 : successCount / runs.length,
    averageQualityScore: average(qualityScores),
    averageConfidence: average(confidences),
    averageCostUsd: average(costs),
    // runs[0] is the most recent (newest-first storage order).
    lastCostUsd: runs[0]?.costUsd ?? 0,
    minCostUsd: costs.length === 0 ? 0 : Math.min(...costs),
    maxCostUsd: costs.length === 0 ? 0 : Math.max(...costs),
    averageDurationMs: average(durations),
    averageErrorCount: average(runs.map((run) => run.errorCount)),
    averageWarningCount: average(runs.map((run) => run.warningCount)),
    qualityScoreSeries: toSeries(runs, (run) => run.qualityScore),
    costSeries: toSeries(runs, (run) => run.costUsd),
    durationSeries: toSeries(runs, (run) => run.durationMs),
    confidenceSeries: toSeries(runs, (run) => run.confidence),
  };
}
