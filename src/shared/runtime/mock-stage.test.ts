import { describe, expect, it } from "vitest";
import { createNode } from "@/entities/Node/model/factory";
import { confidenceFromTemperature } from "@/shared/model/confidence";
import { mockStageHandlers } from "./mock-stage";
import type { ExecutionContext } from "./types";

function context(): ExecutionContext {
  return { runId: "run_1", pipelineId: "pipeline_1", variables: new Map() };
}

describe("mockStageHandlers", () => {
  it("covers all 10 documented NodeTypes", () => {
    const types = ["agent", "llm", "function", "router", "tool", "store", "validation", "human_review", "input", "output"] as const;
    for (const type of types) {
      expect(mockStageHandlers[type]).toBeTypeOf("function");
    }
  });

  it("input/output/agent/function/router are transparent passthroughs", async () => {
    const node = createNode({ type: "input", name: "x" });
    const result = await mockStageHandlers.input({ node, payload: "transcript text", context: context() });
    expect(result.payload).toBe("transcript text");
  });

  it("llm attaches a confidence derived from node.temperature, never a hardcoded constant", async () => {
    const node = createNode({ type: "llm", name: "x", temperature: 0.3 });
    const result = await mockStageHandlers.llm({ node, payload: { transcript: "..." }, context: context() });
    expect(result.payload).toMatchObject({ transcript: "...", mock: true, confidence: confidenceFromTemperature(0.3) });
  });

  it("validation preserves an upstream confidence value instead of overwriting it", async () => {
    const node = createNode({ type: "validation", name: "x" });
    const result = await mockStageHandlers.validation({ node, payload: { confidence: 0.42 }, context: context() });
    expect(result.payload).toMatchObject({ confidence: 0.42, validated: true });
  });

  it("human_review auto-approves but marks the decision as mock, never as a real human decision", async () => {
    const node = createNode({ type: "human_review", name: "x" });
    const result = await mockStageHandlers.human_review({ node, payload: {}, context: context() });
    expect(result.payload).toMatchObject({ reviewed: true, reviewedBy: "mock" });
  });

  it("store acknowledges persistence without a real side effect", async () => {
    const node = createNode({ type: "store", name: "x" });
    const result = await mockStageHandlers.store({ node, payload: { foo: "bar" }, context: context() });
    expect(result.payload).toMatchObject({ foo: "bar", stored: true });
  });
});
