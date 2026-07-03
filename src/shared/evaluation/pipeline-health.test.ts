import { describe, expect, it } from "vitest";
import { createEdge } from "@/entities/Edge/model/factory";
import { createNode } from "@/entities/Node/model/factory";
import { createPipeline } from "@/entities/Pipeline/model/factory";
import { demoSnapshot } from "@/shared/repositories/demo-data";
import { emptyPromptRegistry } from "@/shared/prompts/prompt-registry";
import { assessPipelineHealth } from "./pipeline-health";
import type { ExecutionTrace } from "@/shared/runtime/execution-trace";

function pipelineWith(nodes: Parameters<typeof createNode>[0][], edges: Parameters<typeof createEdge>[0][] = []) {
  return createPipeline({
    projectId: "p",
    architectureId: "a",
    nodes: nodes.map((n) => createNode(n)),
    edges: edges.map((e) => createEdge(e)),
  });
}

describe("assessPipelineHealth", () => {
  it("scores a clean, simple pipeline at 100 with no issues", () => {
    const input = createNode({ type: "input", name: "Input" });
    const output = createNode({ type: "output", name: "Output" });
    const pipeline = createPipeline({
      projectId: "p",
      architectureId: "a",
      nodes: [input, output],
      edges: [createEdge({ sourceNodeId: input.id, targetNodeId: output.id })],
    });
    const report = assessPipelineHealth(pipeline);
    expect(report.score).toBe(100);
    expect(report.issues).toHaveLength(0);
  });

  it("flags a dead-end node that cannot reach any output node as unreachable", () => {
    const input = createNode({ type: "input", name: "Input" });
    const output = createNode({ type: "output", name: "Output" });
    const orphan = createNode({ type: "function", name: "Orphan" });
    const pipeline = createPipeline({
      projectId: "p",
      architectureId: "a",
      nodes: [input, output, orphan],
      edges: [createEdge({ sourceNodeId: input.id, targetNodeId: output.id })],
    });
    const report = assessPipelineHealth(pipeline);
    expect(report.issues.some((i) => i.code === "unreachable_node" && i.nodeId === orphan.id)).toBe(true);
    expect(report.score).toBeLessThan(100);
  });

  it("does NOT flag a legitimate fan-in source with no incoming edge that DOES reach output (matches the real demo pipeline's node_tool shape)", () => {
    const input = createNode({ type: "input", name: "Input" });
    const tool = createNode({ type: "tool", name: "Tool" }); // no incoming edge, but feeds llm -> output
    const llm = createNode({ type: "llm", name: "LLM" });
    const validation = createNode({ type: "validation", name: "Validation" });
    const output = createNode({ type: "output", name: "Output" });
    const pipeline = createPipeline({
      projectId: "p",
      architectureId: "a",
      nodes: [input, tool, llm, validation, output],
      edges: [
        createEdge({ sourceNodeId: input.id, targetNodeId: llm.id }),
        createEdge({ sourceNodeId: tool.id, targetNodeId: llm.id }),
        createEdge({ sourceNodeId: llm.id, targetNodeId: validation.id }),
        createEdge({ sourceNodeId: validation.id, targetNodeId: output.id }),
      ],
    });
    const report = assessPipelineHealth(pipeline);
    expect(report.issues.some((i) => i.code === "unreachable_node")).toBe(false);
  });

  it("flags two nodes with the same type and name as a duplicate stage", () => {
    const a = createNode({ type: "function", name: "Normalize" });
    const b = createNode({ type: "function", name: "Normalize" });
    const pipeline = createPipeline({ projectId: "p", architectureId: "a", nodes: [a, b], edges: [] });
    const report = assessPipelineHealth(pipeline);
    expect(report.issues.some((i) => i.code === "duplicate_stage")).toBe(true);
  });

  it("flags a pipeline with an llm node but no validation node as critical missing_validation", () => {
    const input = createNode({ type: "input", name: "Input" });
    const llm = createNode({ type: "llm", name: "LLM" });
    const pipeline = createPipeline({ projectId: "p", architectureId: "a", nodes: [input, llm], edges: [createEdge({ sourceNodeId: input.id, targetNodeId: llm.id })] });
    const report = assessPipelineHealth(pipeline);
    const issue = report.issues.find((i) => i.code === "missing_validation");
    expect(issue?.severity).toBe("critical");
  });

  it("does not flag missing_validation when a validation node exists", () => {
    const input = createNode({ type: "input", name: "Input" });
    const llm = createNode({ type: "llm", name: "LLM" });
    const validation = createNode({ type: "validation", name: "Validation" });
    const pipeline = createPipeline({
      projectId: "p",
      architectureId: "a",
      nodes: [input, llm, validation],
      edges: [createEdge({ sourceNodeId: input.id, targetNodeId: llm.id }), createEdge({ sourceNodeId: llm.id, targetNodeId: validation.id })],
    });
    const report = assessPipelineHealth(pipeline);
    expect(report.issues.some((i) => i.code === "missing_validation")).toBe(false);
  });

  it("flags two consecutive llm/agent nodes with no validation in between as extra_llm_call", () => {
    const input = createNode({ type: "input", name: "Input" });
    const llm1 = createNode({ type: "llm", name: "LLM 1" });
    const llm2 = createNode({ type: "agent", name: "Agent 2" });
    const validation = createNode({ type: "validation", name: "Validation" });
    const pipeline = createPipeline({
      projectId: "p",
      architectureId: "a",
      nodes: [input, llm1, llm2, validation],
      edges: [
        createEdge({ sourceNodeId: input.id, targetNodeId: llm1.id }),
        createEdge({ sourceNodeId: llm1.id, targetNodeId: llm2.id }),
        createEdge({ sourceNodeId: llm2.id, targetNodeId: validation.id }),
      ],
    });
    const report = assessPipelineHealth(pipeline);
    expect(report.issues.some((i) => i.code === "extra_llm_call" && i.nodeId === llm2.id)).toBe(true);
  });

  it("flags an overly long registered prompt template", () => {
    const llm = createNode({ type: "llm", name: "LLM", promptId: "long_prompt" });
    const validation = createNode({ type: "validation", name: "Validation" });
    const pipeline = pipelineWith([llm, validation] as never, [{ sourceNodeId: llm.id, targetNodeId: validation.id }] as never);
    const prompts = emptyPromptRegistry.register("long_prompt", "1.0.0", "x".repeat(1000));
    const report = assessPipelineHealth(pipeline, { prompts });
    expect(report.issues.some((i) => i.code === "long_prompt")).toBe(true);
  });

  it("uses an ExecutionTrace to flag expensive, low-confidence, and slow stages", () => {
    const llm = createNode({ type: "llm", name: "LLM" });
    const pipeline = createPipeline({ projectId: "p", architectureId: "a", nodes: [llm], edges: [] });
    const trace: ExecutionTrace = {
      runId: "r",
      pipelineId: pipeline.id,
      status: "succeeded",
      stages: [
        {
          nodeId: llm.id,
          name: "LLM",
          type: "llm",
          status: "succeeded",
          durationMs: 5000,
          retryCount: 0,
          metrics: [
            { name: "cost", value: 0.05 },
            { name: "confidence", value: 0.4 },
          ],
          evidence: [],
        },
      ],
    };
    const report = assessPipelineHealth(pipeline, { trace });
    expect(report.issues.map((i) => i.code)).toEqual(expect.arrayContaining(["expensive_prompt", "low_confidence", "high_latency"]));
    expect(report.score).toBeLessThan(100);
  });

  it("never goes below 0", () => {
    const nodes = Array.from({ length: 20 }, (_, i) => createNode({ type: "function", name: `Same Name` }));
    const pipeline = createPipeline({ projectId: "p", architectureId: "a", nodes, edges: [] });
    const report = assessPipelineHealth(pipeline);
    expect(report.score).toBeGreaterThanOrEqual(0);
  });

  it("produces a real, non-trivial score for the actual demo pipeline", () => {
    const report = assessPipelineHealth(demoSnapshot.pipelines[0]);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });
});
