import { describe, expect, it } from "vitest";
import { createEdge } from "./factory";
import { EdgeSchema } from "./schema";

describe("Edge", () => {
  it("factory produces a schema-valid edge without a condition", () => {
    const edge = createEdge({ sourceNodeId: "node_a", targetNodeId: "node_b" });
    expect(EdgeSchema.safeParse(edge).success).toBe(true);
    expect(edge.condition).toBeUndefined();
  });

  it("accepts a conditional edge with an expression", () => {
    const edge = createEdge({
      sourceNodeId: "node_validation",
      targetNodeId: "node_review",
      condition: { expression: "confidence < 0.72", description: "low confidence routes to human review" },
    });
    expect(EdgeSchema.safeParse(edge).success).toBe(true);
  });

  it("rejects a condition with an empty expression", () => {
    const edge = createEdge({
      sourceNodeId: "node_validation",
      targetNodeId: "node_store",
      condition: { expression: "" },
    });
    expect(EdgeSchema.safeParse(edge).success).toBe(false);
  });
});
