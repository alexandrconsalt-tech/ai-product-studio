import type { Run, RunMetric } from "@/entities/Run/model/types";

export type MetricComparison = Readonly<{
  name: string;
  unit?: string;
  baseline?: number;
  candidate?: number;
  delta?: number;
  percentChange?: number;
}>;

export type RunComparison = Readonly<{
  baselineRunId: string;
  candidateRunId: string;
  statusChanged: boolean;
  baselineStatus: Run["status"];
  candidateStatus: Run["status"];
  metrics: readonly MetricComparison[];
  outputEqual: boolean;
}>;

function metricsByName(metrics: readonly RunMetric[]): Map<string, RunMetric> {
  return new Map(metrics.map((metric) => [metric.name, metric]));
}

/**
 * Compares two runs metric-by-metric and flags whether their
 * (JSON-serialized) output differs. This is the mechanism behind
 * "only promote a version if the metric improved" (CLAUDE.md §18/§29)
 * -- it does not itself decide promote/reject, it produces the
 * comparison data a caller (a UI, a CI check, a human) decides from.
 */
export function compareRuns(baseline: Run, candidate: Run): RunComparison {
  const baselineMetrics = metricsByName(baseline.metrics);
  const candidateMetrics = metricsByName(candidate.metrics);
  const names = new Set([...baselineMetrics.keys(), ...candidateMetrics.keys()]);

  const metrics: MetricComparison[] = [...names].map((name) => {
    const baselineMetric = baselineMetrics.get(name);
    const candidateMetric = candidateMetrics.get(name);
    const delta = baselineMetric && candidateMetric ? candidateMetric.value - baselineMetric.value : undefined;
    const percentChange = delta !== undefined && baselineMetric && baselineMetric.value !== 0 ? Number(((delta / baselineMetric.value) * 100).toFixed(2)) : undefined;
    return {
      name,
      unit: candidateMetric?.unit ?? baselineMetric?.unit,
      baseline: baselineMetric?.value,
      candidate: candidateMetric?.value,
      delta,
      percentChange,
    };
  });

  return {
    baselineRunId: baseline.id,
    candidateRunId: candidate.id,
    statusChanged: baseline.status !== candidate.status,
    baselineStatus: baseline.status,
    candidateStatus: candidate.status,
    metrics,
    outputEqual: JSON.stringify(baseline.output) === JSON.stringify(candidate.output),
  };
}
