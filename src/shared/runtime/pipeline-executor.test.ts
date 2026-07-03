import { describe, expect, it } from "vitest";
import { createEdge } from "@/entities/Edge/model/factory";
import { createNode } from "@/entities/Node/model/factory";
import { createPipeline } from "@/entities/Pipeline/model/factory";
import { executePipeline } from "./pipeline-executor";
import { noRetryPolicy } from "./retry";
import type { ExecutionEvent } from "./types";

describe("executePipeline (Mock Stage)", () => {
  it("runs a simple linear pipeline to completion and produces a succeeded Run", async () => {
    const input = createNode({ type: "input", name: "Input" });
    const llm = createNode({ type: "llm", name: "LLM", temperature: 0.3 });
    const output = createNode({ type: "output", name: "Output" });
    const pipeline = createPipeline({
      projectId: "p",
      architectureId: "a",
      nodes: [input, llm, output],
      edges: [createEdge({ sourceNodeId: input.id, targetNodeId: llm.id }), createEdge({ sourceNodeId: llm.id, targetNodeId: output.id })],
    });

    const run = await executePipeline(pipeline, "hello transcript");

    expect(run.status).toBe("succeeded");
    expect(run.pipelineId).toBe(pipeline.id);
    expect(run.output).toMatchObject({ mock: true, confidence: expect.any(Number) });
    expect(run.logs.some((l) => l.message.includes("completed"))).toBe(true);
  });

  it("emits the expected event sequence for a successful run", async () => {
    const input = createNode({ type: "input", name: "Input" });
    const output = createNode({ type: "output", name: "Output" });
    const pipeline = createPipeline({
      projectId: "p",
      architectureId: "a",
      nodes: [input, output],
      edges: [createEdge({ sourceNodeId: input.id, targetNodeId: output.id })],
    });

    const events: ExecutionEvent[] = [];
    await executePipeline(pipeline, "x", { onEvent: (event) => events.push(event) });

    const types = events.map((e) => e.type);
    expect(types[0]).toBe("run_started");
    expect(types).toContain("stage_started");
    expect(types).toContain("stage_completed");
    expect(types[types.length - 1]).toBe("run_completed");
    expect(events.every((e) => e.runId && e.pipelineId === pipeline.id)).toBe(true);
  });

  it("routes correctly on a confidence branch and skips the untaken side (demo-pipeline shape)", async () => {
    const input = createNode({ type: "input", name: "Input" });
    const llm = createNode({ type: "llm", name: "LLM", temperature: 0 }); // temperature 0 -> high confidence (>= 0.72)
    const validation = createNode({ type: "validation", name: "Validation" });
    const store = createNode({ type: "store", name: "Store" });
    const review = createNode({ type: "human_review", name: "Review" });
    const output = createNode({ type: "output", name: "Output" });
    const pipeline = createPipeline({
      projectId: "p",
      architectureId: "a",
      nodes: [input, llm, validation, store, review, output],
      edges: [
        createEdge({ sourceNodeId: input.id, targetNodeId: llm.id }),
        createEdge({ sourceNodeId: llm.id, targetNodeId: validation.id }),
        createEdge({ sourceNodeId: validation.id, targetNodeId: store.id, condition: { field: "confidence", operator: "gte", value: 0.72 } }),
        createEdge({ sourceNodeId: validation.id, targetNodeId: review.id, condition: { field: "confidence", operator: "lt", value: 0.72 } }),
        createEdge({ sourceNodeId: store.id, targetNodeId: output.id }),
        createEdge({ sourceNodeId: review.id, targetNodeId: output.id }),
      ],
    });

    const events: ExecutionEvent[] = [];
    const run = await executePipeline(pipeline, "x", { onEvent: (e) => events.push(e) });

    expect(run.status).toBe("succeeded");
    const skipped = events.filter((e) => e.type === "stage_skipped").map((e) => e.nodeId);
    expect(skipped).toEqual([review.id]);
    const completed = events.filter((e) => e.type === "stage_completed").map((e) => e.nodeId);
    expect(completed).toContain(store.id);
    expect(completed).not.toContain(review.id);
  });

  it("takes the human_review branch when confidence is low", async () => {
    const input = createNode({ type: "input", name: "Input" });
    const llm = createNode({ type: "llm", name: "LLM", temperature: 2 }); // max temperature -> low confidence (< 0.72)
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

    const skipped = events.filter((e) => e.type === "stage_skipped").map((e) => e.nodeId);
    const completed = events.filter((e) => e.type === "stage_completed").map((e) => e.nodeId);
    expect(skipped).toEqual([store.id]);
    expect(completed).toContain(review.id);
  });

  it("marks the Run failed when a stage exhausts its retries, and does not run downstream nodes", async () => {
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
      throw new Error("simulated stage failure");
    });

    const events: ExecutionEvent[] = [];
    const run = await executePipeline(pipeline, "x", { registry: failingRegistry, retryPolicy: noRetryPolicy, onEvent: (e) => events.push(e) });

    expect(run.status).toBe("failed");
    expect(run.logs.some((l) => l.level === "error")).toBe(true);
    expect(events.map((e) => e.type)).toContain("stage_failed");
    expect(events.map((e) => e.type)).toContain("run_failed");
    expect(events.some((e) => e.nodeId === output.id)).toBe(false);
  });

  it("retries a transiently-failing stage and still succeeds", async () => {
    let calls = 0;
    const input = createNode({ type: "input", name: "Input" });
    const flaky = createNode({ type: "llm", name: "Flaky" });
    const pipeline = createPipeline({
      projectId: "p",
      architectureId: "a",
      nodes: [input, flaky],
      edges: [createEdge({ sourceNodeId: input.id, targetNodeId: flaky.id })],
    });

    const registry = (await import("./stage-registry")).defaultStageRegistry.withOverride("llm", async () => {
      calls++;
      if (calls < 2) throw new Error("transient");
      return { payload: { ok: true } };
    });

    const events: ExecutionEvent[] = [];
    const run = await executePipeline(pipeline, "x", { registry, retryPolicy: { maxAttempts: 3, backoffMs: () => 0 }, onEvent: (e) => events.push(e) });

    expect(run.status).toBe("succeeded");
    expect(calls).toBe(2);
    expect(events.map((e) => e.type)).toContain("stage_retrying");
  });

  it("fails cleanly for a cyclic pipeline without running any node", async () => {
    const a = createNode({ type: "function", name: "A" });
    const b = createNode({ type: "function", name: "B" });
    const pipeline = createPipeline({
      projectId: "p",
      architectureId: "a",
      nodes: [a, b],
      edges: [createEdge({ sourceNodeId: a.id, targetNodeId: b.id }), createEdge({ sourceNodeId: b.id, targetNodeId: a.id })],
    });

    const events: ExecutionEvent[] = [];
    const run = await executePipeline(pipeline, "x", { onEvent: (e) => events.push(e) });

    expect(run.status).toBe("failed");
    expect(events.some((e) => e.type === "stage_started")).toBe(false);
    expect(events.map((e) => e.type)).toEqual(["run_started", "run_failed"]);
  });
});
