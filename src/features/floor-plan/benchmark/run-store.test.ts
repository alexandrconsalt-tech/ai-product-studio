// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { ExperimentRun, FloorPlanEvaluation } from "../domain/schema";
import { loadExperimentRuns, saveExperimentRuns, selectExperimentRun, updateRunEvaluation } from "./run-store";

const run = (userEvaluation: FloorPlanEvaluation | null): ExperimentRun => ({
  id: "run-1",
  timestamp: "2026-09-08T00:00:00.000Z",
  source: { name: "plan.png", type: "image/png", width: 1000, height: 1000, page: 1, pages: 1 },
  sourceHash: "hash",
  provider: "model-a",
  model: "model",
  modelVersion: null,
  pipeline: "direct",
  promptVersion: "v1",
  processingTime: 100,
  result: { kind: "image", artifactStored: false },
  structuredResult: null,
  validation: null,
  userEvaluation,
  estimatedCost: null,
  usage: null,
  error: null,
});

const evaluation = (sourceFidelity?: number): FloorPlanEvaluation => ({
  checklist: {
    walls: true, rooms: true, windows: true, doors: true, openings: true, areas: true,
    dimensions: true, balconies: true, fixtures: true, noInvented: true, publishableWithoutFixes: true,
  },
  geometryAccuracy: 5,
  sourceFidelity,
  visualQuality: 4,
  manualCorrections: "0",
  publishable: true,
  criticalGeometryError: false,
  comment: "Проверено",
});

describe("floor-plan run store", () => {
  afterEach(() => window.localStorage.clear());

  it("сохраняет оценку с соответствием исходнику и повторно загружает её", () => {
    saveExperimentRuns([run(null)]);
    updateRunEvaluation("run-1", evaluation(5));
    expect(loadExperimentRuns()[0].userEvaluation).toEqual(evaluation(5));
  });

  it("повторно загружает старую оценку без нового поля", () => {
    saveExperimentRuns([run(evaluation())]);
    expect(loadExperimentRuns()[0].userEvaluation).toEqual(evaluation());
  });

  it("помечает выбранный результат финальным", () => {
    saveExperimentRuns([{ ...run(null), id: "first" }, { ...run(null), id: "second" }]);
    const selected = selectExperimentRun("second");
    expect(selected.find((item) => item.id === "first")?.selectedAsFinal).toBe(false);
    expect(selected.find((item) => item.id === "second")?.selectedAsFinal).toBe(true);
  });
});
