import { describe, expect, it } from "vitest";
import { createNode } from "@/entities/Node/model/factory";
import { defaultStageRegistry } from "./stage-registry";
import type { ExecutionContext } from "./types";

function context(): ExecutionContext {
  return { runId: "run_1", pipelineId: "pipeline_1", variables: new Map() };
}

describe("defaultStageRegistry", () => {
  it("resolves a mock handler for every node type", async () => {
    const node = createNode({ type: "llm", name: "x", temperature: 0.5 });
    const handler = defaultStageRegistry.get("llm");
    const result = await handler({ node, payload: "x", context: context() });
    expect(result.payload).toMatchObject({ mock: true });
  });

  it("withOverride swaps a single node type's handler without mutating the original registry", async () => {
    const customHandler = async () => ({ payload: "custom" });
    const overridden = defaultStageRegistry.withOverride("llm", customHandler);

    const node = createNode({ type: "llm", name: "x" });
    const overriddenResult = await overridden.get("llm")({ node, payload: "x", context: context() });
    expect(overriddenResult.payload).toBe("custom");

    const originalResult = await defaultStageRegistry.get("llm")({ node, payload: "x", context: context() });
    expect(originalResult.payload).not.toBe("custom");
  });

  it("other node types are unaffected by an override", async () => {
    const overridden = defaultStageRegistry.withOverride("llm", async () => ({ payload: "custom" }));
    const node = createNode({ type: "store", name: "x" });
    const result = await overridden.get("store")({ node, payload: { a: 1 }, context: context() });
    expect(result.payload).toMatchObject({ a: 1, stored: true });
  });
});
