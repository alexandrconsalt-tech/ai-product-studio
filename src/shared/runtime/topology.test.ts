import { describe, expect, it } from "vitest";
import { createEdge } from "@/entities/Edge/model/factory";
import { createNode } from "@/entities/Node/model/factory";
import { createPipeline } from "@/entities/Pipeline/model/factory";
import { CyclicPipelineError, evaluateCondition, incomingEdges, outgoingEdges, topologicalOrder } from "./topology";

describe("topologicalOrder", () => {
  it("orders a simple linear pipeline input -> llm -> output", () => {
    const input = createNode({ type: "input", name: "Input" });
    const llm = createNode({ type: "llm", name: "LLM" });
    const output = createNode({ type: "output", name: "Output" });
    const pipeline = createPipeline({
      projectId: "p",
      architectureId: "a",
      nodes: [output, input, llm],
      edges: [createEdge({ sourceNodeId: input.id, targetNodeId: llm.id }), createEdge({ sourceNodeId: llm.id, targetNodeId: output.id })],
    });

    const order = topologicalOrder(pipeline).map((node) => node.id);
    expect(order).toEqual([input.id, llm.id, output.id]);
  });

  it("handles fan-in (two sources feeding one node)", () => {
    const router = createNode({ type: "router", name: "Router" });
    const tool = createNode({ type: "tool", name: "Tool" });
    const llm = createNode({ type: "llm", name: "LLM" });
    const pipeline = createPipeline({
      projectId: "p",
      architectureId: "a",
      nodes: [llm, router, tool],
      edges: [createEdge({ sourceNodeId: router.id, targetNodeId: llm.id }), createEdge({ sourceNodeId: tool.id, targetNodeId: llm.id })],
    });

    const order = topologicalOrder(pipeline).map((node) => node.id);
    expect(order.indexOf(llm.id)).toBeGreaterThan(order.indexOf(router.id));
    expect(order.indexOf(llm.id)).toBeGreaterThan(order.indexOf(tool.id));
  });

  it("throws CyclicPipelineError for a cyclic graph", () => {
    const a = createNode({ type: "function", name: "A" });
    const b = createNode({ type: "function", name: "B" });
    const pipeline = createPipeline({
      projectId: "p",
      architectureId: "a",
      nodes: [a, b],
      edges: [createEdge({ sourceNodeId: a.id, targetNodeId: b.id }), createEdge({ sourceNodeId: b.id, targetNodeId: a.id })],
    });

    expect(() => topologicalOrder(pipeline)).toThrow(CyclicPipelineError);
  });

  it("orders the exact demo-pipeline shape correctly (input/router/tool/llm/validation/store/review/output)", () => {
    const input = createNode({ id: "node_input", type: "input", name: "Input" });
    const router = createNode({ id: "node_router", type: "router", name: "Router" });
    const tool = createNode({ id: "node_tool", type: "tool", name: "Tool" });
    const llm = createNode({ id: "node_llm", type: "llm", name: "LLM" });
    const validation = createNode({ id: "node_validation", type: "validation", name: "Validation" });
    const store = createNode({ id: "node_store", type: "store", name: "Store" });
    const review = createNode({ id: "node_review", type: "human_review", name: "Review" });
    const output = createNode({ id: "node_output", type: "output", name: "Output" });
    const pipeline = createPipeline({
      projectId: "p",
      architectureId: "a",
      nodes: [input, router, tool, llm, validation, store, review, output],
      edges: [
        createEdge({ sourceNodeId: input.id, targetNodeId: router.id }),
        createEdge({ sourceNodeId: router.id, targetNodeId: llm.id }),
        createEdge({ sourceNodeId: tool.id, targetNodeId: llm.id }),
        createEdge({ sourceNodeId: llm.id, targetNodeId: validation.id }),
        createEdge({ sourceNodeId: validation.id, targetNodeId: store.id, condition: { field: "confidence", operator: "gte", value: 0.72 } }),
        createEdge({ sourceNodeId: validation.id, targetNodeId: review.id, condition: { field: "confidence", operator: "lt", value: 0.72 } }),
        createEdge({ sourceNodeId: review.id, targetNodeId: store.id }),
        createEdge({ sourceNodeId: store.id, targetNodeId: output.id }),
      ],
    });

    const order = topologicalOrder(pipeline).map((node) => node.id);
    expect(order.indexOf(validation.id)).toBeGreaterThan(order.indexOf(llm.id));
    expect(order.indexOf(store.id)).toBeGreaterThan(order.indexOf(validation.id));
    expect(order.indexOf(store.id)).toBeGreaterThan(order.indexOf(review.id));
    expect(order.indexOf(output.id)).toBe(order.length - 1);
  });
});

describe("incomingEdges / outgoingEdges", () => {
  it("finds the correct edges for a fan-in node", () => {
    const a = createNode({ type: "function", name: "A" });
    const b = createNode({ type: "function", name: "B" });
    const c = createNode({ type: "function", name: "C" });
    const pipeline = createPipeline({
      projectId: "p",
      architectureId: "a",
      nodes: [a, b, c],
      edges: [createEdge({ sourceNodeId: a.id, targetNodeId: c.id }), createEdge({ sourceNodeId: b.id, targetNodeId: c.id })],
    });

    expect(incomingEdges(pipeline, c.id)).toHaveLength(2);
    expect(outgoingEdges(pipeline, a.id)).toHaveLength(1);
    expect(outgoingEdges(pipeline, c.id)).toHaveLength(0);
  });
});

describe("evaluateCondition", () => {
  const edgeWith = (operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte", value: number) =>
    createEdge({ sourceNodeId: "a", targetNodeId: "b", condition: { field: "confidence", operator, value } });

  it("an edge with no condition is always active", () => {
    const edge = createEdge({ sourceNodeId: "a", targetNodeId: "b" });
    expect(evaluateCondition(edge, { confidence: 0.1 })).toBe(true);
    expect(evaluateCondition(edge, undefined)).toBe(true);
  });

  it("evaluates gte/lt exactly like the demo pipeline's confidence routing", () => {
    expect(evaluateCondition(edgeWith("gte", 0.72), { confidence: 0.72 })).toBe(true);
    expect(evaluateCondition(edgeWith("gte", 0.72), { confidence: 0.71 })).toBe(false);
    expect(evaluateCondition(edgeWith("lt", 0.72), { confidence: 0.71 })).toBe(true);
    expect(evaluateCondition(edgeWith("lt", 0.72), { confidence: 0.72 })).toBe(false);
  });

  it("covers eq/neq/gt/lte", () => {
    expect(evaluateCondition(edgeWith("eq", 1), { confidence: 1 })).toBe(true);
    expect(evaluateCondition(edgeWith("neq", 1), { confidence: 1 })).toBe(false);
    expect(evaluateCondition(edgeWith("gt", 0.5), { confidence: 0.6 })).toBe(true);
    expect(evaluateCondition(edgeWith("lte", 0.5), { confidence: 0.5 })).toBe(true);
  });

  it("treats a missing or non-numeric field as not satisfied, not an error", () => {
    const edge = edgeWith("gte", 0.5);
    expect(evaluateCondition(edge, {})).toBe(false);
    expect(evaluateCondition(edge, { confidence: "high" })).toBe(false);
    expect(evaluateCondition(edge, null)).toBe(false);
  });
});
