import type { ExperimentRun, FloorPlanEvaluation } from "../domain/schema";

const STORAGE_KEY = "ai-floor-plan.experiment-runs.v1";

export function loadExperimentRuns(): ExperimentRun[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

export function saveExperimentRuns(runs: ExperimentRun[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(runs.slice(0, 500))); }
  catch { localStorage.setItem(STORAGE_KEY, JSON.stringify(runs.slice(0, 100).map((run) => ({ ...run, structuredResult: null })))); }
}

export function appendExperimentRuns(runs: ExperimentRun[]): ExperimentRun[] {
  const next = [...runs, ...loadExperimentRuns()]; saveExperimentRuns(next); return next;
}

export function updateRunEvaluation(runId: string, evaluation: FloorPlanEvaluation): ExperimentRun[] {
  const next = loadExperimentRuns().map((run) => run.id === runId ? { ...run, userEvaluation: evaluation } : run);
  saveExperimentRuns(next); return next;
}

export function selectExperimentRun(runId: string): ExperimentRun[] {
  const selected = loadExperimentRuns().find((run) => run.id === runId);
  if (!selected) return loadExperimentRuns();
  const next = loadExperimentRuns().map((run) => ({
    ...run,
    selectedAsFinal: run.sourceHash === selected.sourceHash ? run.id === runId : run.selectedAsFinal,
  }));
  saveExperimentRuns(next);
  return next;
}

export function deleteExperimentRun(runId: string): ExperimentRun[] {
  const next = loadExperimentRuns().filter((run) => run.id !== runId); saveExperimentRuns(next); return next;
}

export function clearExperimentRuns(): void { localStorage.removeItem(STORAGE_KEY); }
