import type { ExperimentRun } from "../domain/schema";

export type BenchmarkRow = {
  key: string; label: string; runs: number; evaluated: number; publishableRate: number | null; criticalErrorRate: number | null;
  averageQuality: number | null; averageGeometry: number | null; averageSourceFidelity: number | null; averageManualCorrections: number | null;
  averageQaScore: number | null; averageAutoFixes: number | null; averageLatency: number | null; averageCost: number | null;
};

const correctionsAsNumber = (value: NonNullable<ExperimentRun["userEvaluation"]>["manualCorrections"]) => value === "5+" ? 5 : Number(value);

export function aggregateFloorPlanRuns(runs: ExperimentRun[]): BenchmarkRow[] {
  const combinations = [
    ["model-a", "end-to-end", "Модель A · End-to-end"], ["model-b", "end-to-end", "Модель B · End-to-end"],
    ["model-a", "direct", "Модель A · Direct"], ["model-b", "direct", "Модель B · Direct"],
    ["model-a", "structured", "Модель A · Structured"], ["model-b", "structured", "Модель B · Structured"],
  ] as const;
  return combinations.map(([provider, pipeline, label]) => {
    const group = runs.filter((run) => run.provider === provider && run.pipeline === pipeline && !run.error);
    const evaluated = group.filter((run) => run.userEvaluation);
    const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    return {
      key: `${provider}-${pipeline}`, label: group[0]?.model ? `${label} · ${group[0].model}` : label, runs: group.length, evaluated: evaluated.length,
      publishableRate: evaluated.length ? 100 * evaluated.filter((run) => run.userEvaluation?.publishable && !run.userEvaluation.criticalGeometryError).length / evaluated.length : null,
      criticalErrorRate: evaluated.length ? 100 * evaluated.filter((run) => run.userEvaluation?.criticalGeometryError).length / evaluated.length : null,
      averageQuality: average(evaluated.map((run) => run.userEvaluation!.visualQuality)),
      averageGeometry: average(evaluated.map((run) => run.userEvaluation!.geometryAccuracy)),
      averageSourceFidelity: average(evaluated.flatMap((run) => typeof run.userEvaluation?.sourceFidelity === "number" ? [run.userEvaluation.sourceFidelity] : [])),
      averageManualCorrections: average(evaluated.map((run) => correctionsAsNumber(run.userEvaluation!.manualCorrections))),
      averageQaScore: average(group.flatMap((run) => typeof run.qa?.score === "number" ? [run.qa.score] : [])),
      averageAutoFixes: average(group.flatMap((run) => typeof run.autoFixAttempts === "number" ? [run.autoFixAttempts] : [])),
      averageLatency: average(group.map((run) => run.totalDuration ?? run.processingTime)),
      averageCost: average(group.flatMap((run) => run.estimatedCost === null ? [] : [run.estimatedCost])),
    };
  }).filter((row) => row.runs > 0 || row.key.endsWith("end-to-end"));
}
