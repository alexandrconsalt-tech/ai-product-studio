import { describe, expect, it } from "vitest";
import { createNode, createNodePort } from "./factory";
import { NodeSchema, NodeTypeSchema } from "./schema";

describe("Node", () => {
  it("factory produces a schema-valid node with defaults filled in", () => {
    const node = createNode({ type: "llm", name: "Need Extractor" });
    expect(NodeSchema.safeParse(node).success).toBe(true);
    expect(node.inputPorts).toEqual([]);
    expect(node.outputPorts).toEqual([]);
    expect(node.tools).toEqual([]);
    expect(node.metadata).toEqual({});
    expect(node.version).toBe("1.0.0");
  });

  it("accepts all ten documented node types", () => {
    const types = ["agent", "llm", "function", "router", "tool", "store", "validation", "human_review", "input", "output"];
    for (const type of types) {
      expect(NodeTypeSchema.safeParse(type).success).toBe(true);
    }
  });

  it("rejects an undocumented node type", () => {
    expect(NodeTypeSchema.safeParse("webhook").success).toBe(false);
  });

  it("rejects temperature outside the 0-2 range", () => {
    const node = createNode({ type: "llm", name: "x", temperature: 2.5 });
    expect(NodeSchema.safeParse(node).success).toBe(false);
  });

  it("createNodePort generates a prefixed id when none is given", () => {
    const port = createNodePort({ name: "transcript" });
    expect(port.id.startsWith("port_")).toBe(true);
  });
});
