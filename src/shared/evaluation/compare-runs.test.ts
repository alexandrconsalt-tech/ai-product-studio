import { describe, expect, it } from "vitest";
import { createRun } from "@/entities/Run/model/factory";
import { compareRuns } from "./compare-runs";

describe("compareRuns", () => {
  it("computes delta and percentChange for a metric present in both runs", () => {
    const baseline = createRun({ pipelineId: "p", input: "x", status: "succeeded", metrics: [{ name: "cost", value: 0.01, unit: "usd" }] });
    const candidate = createRun({ pipelineId: "p", input: "x", status: "succeeded", metrics: [{ name: "cost", value: 0.005, unit: "usd" }] });

    const comparison = compareRuns(baseline, candidate);
    const cost = comparison.metrics.find((m) => m.name === "cost");
    expect(cost?.delta).toBeCloseTo(-0.005, 5);
    expect(cost?.percentChange).toBeCloseTo(-50, 1);
  });

  it("flags a metric only present in one run (baseline or candidate undefined)", () => {
    const baseline = createRun({ pipelineId: "p", input: "x", metrics: [] });
    const candidate = createRun({ pipelineId: "p", input: "x", metrics: [{ name: "confidence", value: 0.9 }] });

    const comparison = compareRuns(baseline, candidate);
    const confidence = comparison.metrics.find((m) => m.name === "confidence");
    expect(confidence?.baseline).toBeUndefined();
    expect(confidence?.candidate).toBe(0.9);
    expect(confidence?.delta).toBeUndefined();
  });

  it("detects a status change", () => {
    const baseline = createRun({ pipelineId: "p", input: "x", status: "succeeded" });
    const candidate = createRun({ pipelineId: "p", input: "x", status: "failed" });
    expect(compareRuns(baseline, candidate).statusChanged).toBe(true);
  });

  it("detects identical output as outputEqual: true", () => {
    const baseline = createRun({ pipelineId: "p", input: "x", output: { a: 1 } });
    const candidate = createRun({ pipelineId: "p", input: "x", output: { a: 1 } });
    expect(compareRuns(baseline, candidate).outputEqual).toBe(true);
  });

  it("detects different output as outputEqual: false", () => {
    const baseline = createRun({ pipelineId: "p", input: "x", output: { a: 1 } });
    const candidate = createRun({ pipelineId: "p", input: "x", output: { a: 2 } });
    expect(compareRuns(baseline, candidate).outputEqual).toBe(false);
  });
});
