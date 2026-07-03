import { describe, expect, it } from "vitest";
import { createEdge } from "@/entities/Edge/model/factory";
import { createNode } from "@/entities/Node/model/factory";
import { createPipeline } from "@/entities/Pipeline/model/factory";
import { defaultStageRegistry } from "@/shared/runtime/stage-registry";
import type { CallAnalysisSummary } from "@/shared/model/call-analysis-summary";
import { evaluateGoldenDataset } from "./evaluate";
import { ILLUSTRATIVE_CALL_ANALYSIS_DATASET } from "./golden-dataset";

function buildSimplePipeline() {
  const input = createNode({ type: "input", name: "Input" });
  const llm = createNode({ type: "llm", name: "LLM" });
  const output = createNode({ type: "output", name: "Output" });
  return createPipeline({
    projectId: "p",
    architectureId: "a",
    nodes: [input, llm, output],
    edges: [createEdge({ sourceNodeId: input.id, targetNodeId: llm.id }), createEdge({ sourceNodeId: llm.id, targetNodeId: output.id })],
  });
}

describe("evaluateGoldenDataset", () => {
  it("honestly reports failures when the pipeline uses Mock Stage (its output doesn't match CallAnalysisSummarySchema)", async () => {
    const pipeline = buildSimplePipeline();
    const report = await evaluateGoldenDataset(pipeline, ILLUSTRATIVE_CALL_ANALYSIS_DATASET);

    expect(report.totalExamples).toBe(ILLUSTRATIVE_CALL_ANALYSIS_DATASET.examples.length);
    expect(report.passedExamples).toBe(0);
    expect(report.passRate).toBe(0);
    expect(report.results.every((result) => result.scores.some((score) => score.scorerName === "schema_valid" && !score.passed))).toBe(true);
  });

  it("passes examples whose expectations match a stage handler producing a real, correct CallAnalysisSummary", async () => {
    const pipeline = buildSimplePipeline();
    const registry = defaultStageRegistry.withOverride("llm", async ({ payload }) => {
      const transcript = typeof payload === "string" ? payload : JSON.stringify(payload);
      const summary: CallAnalysisSummary = {
        кто: "Клиент",
        тип_контакта: "agent",
        потребность: "Извлечено из транскрипта",
        вопросы: [],
        статус: "in_progress",
        действие: "Перезвонить клиенту с предложением в течение дня",
        цитаты: [transcript.slice(0, 40)],
      };
      return { payload: summary };
    });

    const dataset = { ...ILLUSTRATIVE_CALL_ANALYSIS_DATASET, examples: ILLUSTRATIVE_CALL_ANALYSIS_DATASET.examples.filter((example) => example.expected.тип_контакта === "agent") };
    const report = await evaluateGoldenDataset(pipeline, dataset, { executeOptions: { registry } });

    expect(report.passedExamples).toBe(report.totalExamples);
    expect(report.passRate).toBe(1);
  });

  it("returns one ExampleResult per golden example, each carrying its own Run", async () => {
    const pipeline = buildSimplePipeline();
    const report = await evaluateGoldenDataset(pipeline, ILLUSTRATIVE_CALL_ANALYSIS_DATASET);
    expect(report.results).toHaveLength(ILLUSTRATIVE_CALL_ANALYSIS_DATASET.examples.length);
    expect(report.results.map((r) => r.exampleId)).toEqual(ILLUSTRATIVE_CALL_ANALYSIS_DATASET.examples.map((e) => e.id));
    expect(report.results[0].run.pipelineId).toBe(pipeline.id);
  });
});
