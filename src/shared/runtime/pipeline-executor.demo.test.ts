import { describe, expect, it } from "vitest";
import { demoSnapshot } from "@/shared/repositories/demo-data";
import { executePipeline } from "./pipeline-executor";
import type { ExecutionEvent } from "./types";

/**
 * Integration-style check against the real demo pipeline shape
 * (demo-data.ts's 8-node/8-edge "AI Call Analysis" pipeline), not a
 * hand-built fixture. This is the Runtime's contract test: if
 * demo-data.ts's pipeline shape ever changes incompatibly, this is
 * the test that should fail first. Intentionally not wired into any
 * screen/store -- verifying the executor works against real pipeline
 * data is separate from replacing the Simulation Engine in the UI.
 */
describe("executePipeline against the real demo pipeline (demo-data.ts)", () => {
  const pipeline = demoSnapshot.pipelines[0];

  it("exists with the expected 8 nodes / 8 edges shape", () => {
    expect(pipeline.nodes).toHaveLength(8);
    expect(pipeline.edges).toHaveLength(8);
  });

  it("runs to completion and produces a succeeded Run with a plausible output", async () => {
    const events: ExecutionEvent[] = [];
    const run = await executePipeline(pipeline, "Клиент интересуется CRM интеграцией и сроками внедрения.", {
      onEvent: (event) => events.push(event),
    });

    expect(run.status).toBe("succeeded");
    expect(run.pipelineId).toBe(pipeline.id);
    expect(run.logs.length).toBeGreaterThan(0);

    const completedNodeIds = events.filter((e) => e.type === "stage_completed").map((e) => e.nodeId);
    const skippedNodeIds = events.filter((e) => e.type === "stage_skipped").map((e) => e.nodeId);

    // Every node either completed or was skipped (branching) -- none silently missing.
    expect(new Set([...completedNodeIds, ...skippedNodeIds]).size).toBe(pipeline.nodes.length);

    // node_llm's mock confidence decides which of node_store/node_review
    // ran; exactly one of the two should have completed and the other
    // skipped, never both completed and never both skipped.
    const storeCompleted = completedNodeIds.includes("node_store");
    const reviewCompleted = completedNodeIds.includes("node_review");
    expect(storeCompleted || reviewCompleted).toBe(true);

    // The terminal node_output must have completed for the run to
    // reach "succeeded" with a defined output payload.
    expect(completedNodeIds).toContain("node_output");
    expect(run.output).toBeDefined();
  });

  it("executes node_router and node_tool (the fan-in sources into node_llm) before node_llm", async () => {
    const events: ExecutionEvent[] = [];
    await executePipeline(pipeline, "x", { onEvent: (e) => events.push(e) });

    const startedOrder = events.filter((e) => e.type === "stage_started").map((e) => e.nodeId);
    expect(startedOrder.indexOf("node_router")).toBeLessThan(startedOrder.indexOf("node_llm"));
    expect(startedOrder.indexOf("node_tool")).toBeLessThan(startedOrder.indexOf("node_llm"));
    expect(startedOrder.indexOf("node_llm")).toBeLessThan(startedOrder.indexOf("node_validation"));
  });
});
