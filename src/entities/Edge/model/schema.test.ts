import { describe, expect, it } from "vitest";
import { createEdge } from "./factory";
import { EdgeSchema } from "./schema";

describe("Edge", () => {
  it("factory produces a schema-valid edge without a condition", () => {
    const edge = createEdge({ sourceNodeId: "node_a", targetNodeId: "node_b" });
    expect(EdgeSchema.safeParse(edge).success).toBe(true);
    expect(edge.condition).toBeUndefined();
  });

  it("accepts a conditional edge with a structured {field, operator, value} condition (CLAUDE.md §14.2)", () => {
    const edge = createEdge({
      sourceNodeId: "node_validation",
      targetNodeId: "node_review",
      condition: { field: "confidence", operator: "lt", value: 0.72, description: "low confidence routes to human review" },
    });
    expect(EdgeSchema.safeParse(edge).success).toBe(true);
  });

  it("rejects a condition with an empty field", () => {
    const edge = createEdge({
      sourceNodeId: "node_validation",
      targetNodeId: "node_store",
      condition: { field: "", operator: "gte", value: 0.72 },
    });
    expect(EdgeSchema.safeParse(edge).success).toBe(false);
  });

  it("rejects a condition with an undocumented operator", () => {
    const edge = createEdge({ sourceNodeId: "a", targetNodeId: "b" });
    const invalid = { ...edge, condition: { field: "confidence", operator: "contains", value: 0.72 } };
    expect(EdgeSchema.safeParse(invalid).success).toBe(false);
  });
});
