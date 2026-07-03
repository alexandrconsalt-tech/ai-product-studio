import { describe, expect, it } from "vitest";
import { createEdge } from "@/entities/Edge/model/factory";
import { createNode } from "@/entities/Node/model/factory";
import { createPipeline } from "@/entities/Pipeline/model/factory";
import { CallAnalysisSummarySchema } from "@/shared/model/call-analysis-summary";
import { simulatePipelineRun } from "./simulation-engine";

function buildCallAnalysisPipeline(modelId: string, temperature: number) {
  const input = createNode({ type: "input", name: "Call Transcript" });
  const summaryNode = createNode({ type: "llm", name: "Call Analyzer LLM", promptId: "prompt_call_summary", modelId, temperature });
  const output = createNode({ type: "output", name: "CRM Write-back" });
  return createPipeline({
    projectId: "project_1",
    architectureId: "architecture_1",
    nodes: [input, summaryNode, output],
    edges: [createEdge({ sourceNodeId: input.id, targetNodeId: summaryNode.id }), createEdge({ sourceNodeId: summaryNode.id, targetNodeId: output.id })],
  });
}

describe("simulatePipelineRun (CLAUDE.md §63 debt item 11)", () => {
  it("produces the structured CallAnalysisSummary shape when the pipeline has a node using prompt_call_summary", () => {
    const pipeline = buildCallAnalysisPipeline("model_reasoning", 0.3);
    const { run } = simulatePipelineRun(pipeline, "Клиент интересуется трёхкомнатной квартирой. Есть ли рассрочка?");
    expect(CallAnalysisSummarySchema.safeParse(run.output).success).toBe(true);
  });

  it("derives confidence from Node.temperature instead of a hardcoded constant", () => {
    const pipeline = buildCallAnalysisPipeline("model_reasoning", 0.3);
    const { run } = simulatePipelineRun(pipeline, "Тестовый transcript.");
    const output = run.output as { confidence: number };
    expect(output.confidence).toBeCloseTo(0.9, 2);

    const highTempPipeline = buildCallAnalysisPipeline("model_reasoning", 1.5);
    const { run: highTempRun } = simulatePipelineRun(highTempPipeline, "Тестовый transcript.");
    const highTempOutput = highTempRun.output as { confidence: number };
    expect(highTempOutput.confidence).toBeLessThan(output.confidence);
  });

  it("derives cost/latency from Node.modelId (cheaper model -> lower cost and latency for the same input)", () => {
    const input = "Тестовый transcript одинаковой длины для сравнения моделей по стоимости.";
    const { run: fastRun } = simulatePipelineRun(buildCallAnalysisPipeline("model_fast", 0.3), input);
    const { run: reasoningRun } = simulatePipelineRun(buildCallAnalysisPipeline("model_reasoning", 0.3), input);

    expect(fastRun.costUsd ?? 0).toBeLessThan(reasoningRun.costUsd ?? Infinity);
    expect(fastRun.latencyMs ?? 0).toBeLessThan(reasoningRun.latencyMs ?? Infinity);
  });

  it("falls back to the generic output shape when no node uses prompt_call_summary", () => {
    const genericPipeline = createPipeline({
      projectId: "project_1",
      architectureId: "architecture_1",
      nodes: [createNode({ type: "input", name: "Input" }), createNode({ type: "output", name: "Output" })],
    });
    const { run } = simulatePipelineRun(genericPipeline, "любой transcript");
    const output = run.output as { needs: string[]; risks: string[]; nextAction: string };
    expect(Array.isArray(output.needs)).toBe(true);
    expect(Array.isArray(output.risks)).toBe(true);
    expect(typeof output.nextAction).toBe("string");
  });

  it("always returns status succeeded (documented simulator limitation, CLAUDE.md §12.4 -- no failure path is simulated)", () => {
    const { run } = simulatePipelineRun(buildCallAnalysisPipeline("model_fast", 0.3), "x");
    expect(run.status).toBe("succeeded");
  });
});
