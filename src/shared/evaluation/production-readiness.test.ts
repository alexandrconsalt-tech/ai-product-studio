import { describe, expect, it } from "vitest";
import { createEdge } from "@/entities/Edge/model/factory";
import { createNode } from "@/entities/Node/model/factory";
import { createPipeline } from "@/entities/Pipeline/model/factory";
import { createRun } from "@/entities/Run/model/factory";
import { emptyPromptRegistry } from "@/shared/prompts/prompt-registry";
import { demoSnapshot } from "@/shared/repositories/demo-data";
import { assessProductionReadiness } from "./production-readiness";

describe("assessProductionReadiness", () => {
  it("is fully ready for a pipeline with no AI nodes, an output node, cost data, a golden dataset, and passing tests", () => {
    const input = createNode({ type: "input", name: "Input" });
    const output = createNode({ type: "output", name: "Output" });
    const pipeline = createPipeline({ projectId: "p", architectureId: "a", nodes: [input, output], edges: [createEdge({ sourceNodeId: input.id, targetNodeId: output.id })] });
    const runs = [createRun({ pipelineId: pipeline.id, input: "x", costUsd: 0.01 })];

    const report = assessProductionReadiness(pipeline, { runs, goldenDatasetAvailable: true, testsPassing: true });
    expect(report.ready).toBe(true);
    expect(report.checks.every((c) => c.passed)).toBe(true);
  });

  it("fails validation/error_handling when an llm node has no validation gate", () => {
    const input = createNode({ type: "input", name: "Input" });
    const llm = createNode({ type: "llm", name: "LLM", promptId: "p1" });
    const pipeline = createPipeline({ projectId: "p", architectureId: "a", nodes: [input, llm], edges: [createEdge({ sourceNodeId: input.id, targetNodeId: llm.id })] });
    const prompts = emptyPromptRegistry.register("p1", "1.0.0", "x");

    const report = assessProductionReadiness(pipeline, { prompts, goldenDatasetAvailable: false, testsPassing: true });
    const validation = report.checks.find((c) => c.id === "validation");
    const errorHandling = report.checks.find((c) => c.id === "error_handling");
    expect(validation?.passed).toBe(false);
    expect(errorHandling?.passed).toBe(false);
    expect(report.ready).toBe(false);
  });

  it("fails prompt_version when an llm node's prompt is not registered", () => {
    const llm = createNode({ type: "llm", name: "LLM", promptId: "missing" });
    const pipeline = createPipeline({ projectId: "p", architectureId: "a", nodes: [llm], edges: [] });
    const report = assessProductionReadiness(pipeline, { prompts: emptyPromptRegistry, goldenDatasetAvailable: false, testsPassing: true });
    expect(report.checks.find((c) => c.id === "prompt_version")?.passed).toBe(false);
  });

  it("fails cost_estimated when no historical run has cost data", () => {
    const output = createNode({ type: "output", name: "Output" });
    const pipeline = createPipeline({ projectId: "p", architectureId: "a", nodes: [output], edges: [] });
    const report = assessProductionReadiness(pipeline, { runs: [], goldenDatasetAvailable: true, testsPassing: true });
    expect(report.checks.find((c) => c.id === "cost_estimated")?.passed).toBe(false);
  });

  it("fails output_schema when the pipeline has no output node", () => {
    const input = createNode({ type: "input", name: "Input" });
    const pipeline = createPipeline({ projectId: "p", architectureId: "a", nodes: [input], edges: [] });
    const report = assessProductionReadiness(pipeline, { goldenDatasetAvailable: true, testsPassing: true });
    expect(report.checks.find((c) => c.id === "output_schema")?.passed).toBe(false);
  });

  it("reflects golden_dataset and tests_passed exactly as supplied", () => {
    const output = createNode({ type: "output", name: "Output" });
    const pipeline = createPipeline({ projectId: "p", architectureId: "a", nodes: [output], edges: [] });
    const report = assessProductionReadiness(pipeline, { goldenDatasetAvailable: false, testsPassing: false });
    expect(report.checks.find((c) => c.id === "golden_dataset")?.passed).toBe(false);
    expect(report.checks.find((c) => c.id === "tests_passed")?.passed).toBe(false);
    expect(report.ready).toBe(false);
  });

  it("produces a real report for the actual demo pipeline", () => {
    const report = assessProductionReadiness(demoSnapshot.pipelines[0], {
      runs: demoSnapshot.runs,
      goldenDatasetAvailable: true,
      testsPassing: true,
    });
    expect(report.checks).toHaveLength(8);
  });
});
