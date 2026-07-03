import { describe, expect, it } from "vitest";
import { createEdge } from "@/entities/Edge/model/factory";
import { createNode } from "@/entities/Node/model/factory";
import { createPipeline } from "./factory";
import { PipelineSchema } from "./schema";

describe("Pipeline", () => {
  it("factory defaults status to draft with empty nodes/edges", () => {
    const pipeline = createPipeline({ projectId: "project_1", architectureId: "architecture_1" });
    expect(pipeline.status).toBe("draft");
    expect(PipelineSchema.safeParse(pipeline).success).toBe(true);
  });

  it("accepts a minimal call-analysis-shaped pipeline (input -> llm -> output)", () => {
    const input = createNode({ type: "input", name: "Audio Input" });
    const llm = createNode({ type: "llm", name: "Structured Summary" });
    const output = createNode({ type: "output", name: "CRM Write-back" });
    const edges = [
      createEdge({ sourceNodeId: input.id, targetNodeId: llm.id }),
      createEdge({ sourceNodeId: llm.id, targetNodeId: output.id }),
    ];
    const pipeline = createPipeline({
      projectId: "project_1",
      architectureId: "architecture_1",
      nodes: [input, llm, output],
      edges,
    });
    expect(PipelineSchema.safeParse(pipeline).success).toBe(true);
  });

  it("rejects a non-positive zoom in the layout viewport", () => {
    const pipeline = createPipeline({
      projectId: "project_1",
      architectureId: "architecture_1",
      layout: { viewport: { x: 0, y: 0, zoom: 0 } },
    });
    expect(PipelineSchema.safeParse(pipeline).success).toBe(false);
  });
});
