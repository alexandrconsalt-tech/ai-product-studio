import { describe, expect, it } from "vitest";
import { createEdge } from "@/entities/Edge/model/factory";
import { createNode } from "@/entities/Node/model/factory";
import { createPipeline } from "@/entities/Pipeline/model/factory";
import { defaultStageRegistry } from "@/shared/runtime/stage-registry";
import { runBenchmark, withNodeModel } from "./benchmark";
import { ILLUSTRATIVE_CALL_ANALYSIS_DATASET } from "./golden-dataset";

function buildSimplePipeline() {
  const input = createNode({ type: "input", name: "Input" });
  const llm = createNode({ type: "llm", name: "LLM", modelId: "model_reasoning" });
  const output = createNode({ type: "output", name: "Output" });
  return { pipeline: createPipeline({
    projectId: "p",
    architectureId: "a",
    nodes: [input, llm, output],
    edges: [createEdge({ sourceNodeId: input.id, targetNodeId: llm.id }), createEdge({ sourceNodeId: llm.id, targetNodeId: output.id })],
  }), llmNodeId: llm.id };
}

describe("withNodeModel", () => {
  it("returns a new pipeline with only the target node's modelId changed", () => {
    const { pipeline, llmNodeId } = buildSimplePipeline();
    const updated = withNodeModel(pipeline, llmNodeId, "model_fast");

    expect(updated).not.toBe(pipeline);
    expect(updated.nodes.find((n) => n.id === llmNodeId)?.modelId).toBe("model_fast");
    expect(pipeline.nodes.find((n) => n.id === llmNodeId)?.modelId).toBe("model_reasoning");
  });

  it("leaves other nodes untouched", () => {
    const { pipeline, llmNodeId } = buildSimplePipeline();
    const updated = withNodeModel(pipeline, llmNodeId, "model_fast");
    const otherNodesBefore = pipeline.nodes.filter((n) => n.id !== llmNodeId);
    const otherNodesAfter = updated.nodes.filter((n) => n.id !== llmNodeId);
    expect(otherNodesAfter).toEqual(otherNodesBefore);
  });
});

describe("runBenchmark", () => {
  it("evaluates every variant against the same dataset and labels each result", async () => {
    const { pipeline, llmNodeId } = buildSimplePipeline();
    const fastVariant = withNodeModel(pipeline, llmNodeId, "model_fast");

    const dataset = { ...ILLUSTRATIVE_CALL_ANALYSIS_DATASET, examples: ILLUSTRATIVE_CALL_ANALYSIS_DATASET.examples.slice(0, 2) };
    const report = await runBenchmark(
      [
        { id: "reasoning", label: "Reasoning LLM", pipeline },
        { id: "fast", label: "Fast Classifier", pipeline: fastVariant },
      ],
      dataset,
      { executeOptions: { registry: defaultStageRegistry } },
    );

    expect(report.datasetId).toBe(dataset.id);
    expect(report.results).toHaveLength(2);
    expect(report.results.map((r) => r.variantId)).toEqual(["reasoning", "fast"]);
    expect(report.results[0].evaluation.totalExamples).toBe(2);
    expect(report.results[1].evaluation.results).toHaveLength(2);
  });

  it("keeps per-example results inspectable, not just an aggregate pass rate (CLAUDE.md §28)", async () => {
    const { pipeline } = buildSimplePipeline();
    const dataset = { ...ILLUSTRATIVE_CALL_ANALYSIS_DATASET, examples: ILLUSTRATIVE_CALL_ANALYSIS_DATASET.examples.slice(0, 1) };
    const report = await runBenchmark([{ id: "baseline", label: "Baseline", pipeline }], dataset);
    expect(report.results[0].evaluation.results[0].scores.length).toBeGreaterThan(0);
  });
});
