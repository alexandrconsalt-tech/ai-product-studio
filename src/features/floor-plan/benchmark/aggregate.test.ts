import { describe, expect, it } from "vitest";
import { aggregateFloorPlanRuns } from "./aggregate";
import type { ExperimentRun, FloorPlanEvaluation } from "../domain/schema";

const evaluation = (publishable: boolean, criticalGeometryError: boolean): FloorPlanEvaluation => ({
  checklist: { walls: true, rooms: true, windows: true, doors: true, openings: true, areas: true, dimensions: true, balconies: true, fixtures: true, noInvented: true, publishableWithoutFixes: publishable },
  geometryAccuracy: publishable ? 5 : 2, sourceFidelity: publishable ? 5 : 3, visualQuality: 4,
  manualCorrections: publishable ? "0" : "5+", publishable, criticalGeometryError, comment: "",
});
const run = (id: string, result: FloorPlanEvaluation): ExperimentRun => ({ id, timestamp: "2026-09-08T00:00:00.000Z", source: { name: "plan.png", type: "image/png", width: 1000, height: 1000, page: 1, pages: 1 }, sourceHash: id, provider: "model-a", model: "configured-model", modelVersion: null, pipeline: "end-to-end", promptVersion: "v1", processingTime: 1000, result: { kind: "image", artifactStored: false }, structuredResult: null, validation: null, userEvaluation: result, estimatedCost: null, usage: null, error: null });

describe("aggregateFloorPlanRuns", () => {
  it("главную метрику считает только для publishable без critical error", () => {
    const row = aggregateFloorPlanRuns([run("1", evaluation(true, false)), run("2", evaluation(true, true))])[0];
    expect(row.publishableRate).toBe(50); expect(row.criticalErrorRate).toBe(50); expect(row.averageLatency).toBe(1000);
    expect(row.averageSourceFidelity).toBe(5); expect(row.averageManualCorrections).toBe(0);
  });

  it("не ломает старые оценки без соответствия исходнику и не подставляет им выдуманный балл", () => {
    const legacy = evaluation(false, false);
    delete legacy.sourceFidelity;
    const row = aggregateFloorPlanRuns([run("legacy", legacy)])[0];
    expect(row.evaluated).toBe(1);
    expect(row.averageSourceFidelity).toBeNull();
    expect(row.averageManualCorrections).toBe(5);
  });
});
