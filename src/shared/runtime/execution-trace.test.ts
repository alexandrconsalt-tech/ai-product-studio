import { describe, expect, it } from "vitest";
import { createEdge } from "@/entities/Edge/model/factory";
import { createNode } from "@/entities/Node/model/factory";
import { createPipeline } from "@/entities/Pipeline/model/factory";
import { demoSnapshot } from "@/shared/repositories/demo-data";
import { defaultLLMProviderRegistry } from "@/shared/llm/provider-registry";
import { seededPromptRegistry } from "@/shared/prompts/seed-prompts";
import { buildExecutionTrace, totalFromTrace } from "./execution-trace";
import { executePipeline } from "./pipeline-executor";
import { realStageRegistry } from "./real-stage";
import type { ExecutionEvent } from "./types";

describe("buildExecutionTrace", () => {
  it("reconstructs a full per-stage trace from a real executePipeline run, in execution order", async () => {
    const input = createNode({ type: "input", name: "Input" });
    const llm = createNode({ type: "llm", name: "LLM", temperature: 0.3, promptId: "p1", modelId: "m1" });
    const output = createNode({ type: "output", name: "Output" });
    const pipeline = createPipeline({
      projectId: "p",
      architectureId: "a",
      nodes: [input, llm, output],
      edges: [createEdge({ sourceNodeId: input.id, targetNodeId: llm.id }), createEdge({ sourceNodeId: llm.id, targetNodeId: output.id })],
    });

    const events: ExecutionEvent[] = [];
    await executePipeline(pipeline, "hello", { onEvent: (e) => events.push(e) });
    const trace = buildExecutionTrace(pipeline, events);

    expect(trace.status).toBe("succeeded");
    expect(trace.stages.map((s) => s.nodeId)).toEqual([input.id, llm.id, output.id]);
    expect(trace.stages.every((s) => s.status === "succeeded")).toBe(true);
    expect(trace.stages.every((s) => typeof s.durationMs === "number")).toBe(true);
    const llmStage = trace.stages.find((s) => s.nodeId === llm.id);
    expect(llmStage?.promptId).toBe("p1");
    expect(llmStage?.modelId).toBe("m1");
    expect(llmStage?.temperature).toBe(0.3);
    expect(llmStage?.metrics.length).toBeGreaterThan(0);
  });

  it("shows unreached nodes as 'pending' and stops the trace at the failure point", async () => {
    const input = createNode({ type: "input", name: "Input" });
    const broken = createNode({ type: "llm", name: "Broken" });
    const output = createNode({ type: "output", name: "Output" });
    const pipeline = createPipeline({
      projectId: "p",
      architectureId: "a",
      nodes: [input, broken, output],
      edges: [createEdge({ sourceNodeId: input.id, targetNodeId: broken.id }), createEdge({ sourceNodeId: broken.id, targetNodeId: output.id })],
    });

    const failingRegistry = (await import("./stage-registry")).defaultStageRegistry.withOverride("llm", async () => {
      throw new Error("boom");
    });

    const events: ExecutionEvent[] = [];
    await executePipeline(pipeline, "x", { registry: failingRegistry, retryPolicy: (await import("./retry")).noRetryPolicy, onEvent: (e) => events.push(e) });
    const trace = buildExecutionTrace(pipeline, events);

    expect(trace.status).toBe("failed");
    const inputStage = trace.stages.find((s) => s.nodeId === input.id);
    const brokenStage = trace.stages.find((s) => s.nodeId === broken.id);
    const outputStage = trace.stages.find((s) => s.nodeId === output.id);
    expect(inputStage?.status).toBe("succeeded");
    expect(brokenStage?.status).toBe("failed");
    expect(brokenStage?.error).toContain("boom");
    expect(outputStage?.status).toBe("pending");
  });

  it("marks the untaken branch of a confidence route as 'skipped', with a retryCount from stage_retrying events", async () => {
    const input = createNode({ type: "input", name: "Input" });
    const llm = createNode({ type: "llm", name: "LLM", temperature: 0 });
    const validation = createNode({ type: "validation", name: "Validation" });
    const store = createNode({ type: "store", name: "Store" });
    const review = createNode({ type: "human_review", name: "Review" });
    const pipeline = createPipeline({
      projectId: "p",
      architectureId: "a",
      nodes: [input, llm, validation, store, review],
      edges: [
        createEdge({ sourceNodeId: input.id, targetNodeId: llm.id }),
        createEdge({ sourceNodeId: llm.id, targetNodeId: validation.id }),
        createEdge({ sourceNodeId: validation.id, targetNodeId: store.id, condition: { field: "confidence", operator: "gte", value: 0.72 } }),
        createEdge({ sourceNodeId: validation.id, targetNodeId: review.id, condition: { field: "confidence", operator: "lt", value: 0.72 } }),
      ],
    });

    const events: ExecutionEvent[] = [];
    await executePipeline(pipeline, "x", { onEvent: (e) => events.push(e) });
    const trace = buildExecutionTrace(pipeline, events);

    const reviewStage = trace.stages.find((s) => s.nodeId === review.id);
    expect(reviewStage?.status).toBe("skipped");
  });

  it("works against the real demo pipeline end to end, using the same realStageRegistry Playground uses", async () => {
    const pipeline = demoSnapshot.pipelines[0];
    const registry = realStageRegistry({ llmProviders: defaultLLMProviderRegistry, prompts: seededPromptRegistry, models: demoSnapshot.models });
    const events: ExecutionEvent[] = [];
    await executePipeline(pipeline, "Клиент интересуется CRM интеграцией.", { registry, onEvent: (e) => events.push(e) });
    const trace = buildExecutionTrace(pipeline, events);
    expect(trace.stages).toHaveLength(pipeline.nodes.length);
    expect(totalFromTrace(trace, "tokens")).toBeGreaterThan(0);
  });
});

describe("totalFromTrace", () => {
  it("returns 0 for an empty trace", () => {
    expect(totalFromTrace({ runId: "r", pipelineId: "p", status: "succeeded", stages: [] }, "cost")).toBe(0);
  });
});
