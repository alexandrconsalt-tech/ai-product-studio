import { describe, expect, it } from "vitest";
import { createRun } from "./factory";
import { RunSchema } from "./schema";

describe("Run", () => {
  it("factory defaults status to queued", () => {
    const run = createRun({ pipelineId: "pipeline_1", input: "transcript text" });
    expect(run.status).toBe("queued");
    expect(RunSchema.safeParse(run).success).toBe(true);
  });

  it("accepts unknown input/output payloads (Playground works with arbitrary shapes)", () => {
    const run = createRun({ pipelineId: "pipeline_1", input: { transcript: "..." }, output: { summary: "..." } });
    expect(RunSchema.safeParse(run).success).toBe(true);
  });

  it("rejects negative latency/cost", () => {
    const run = createRun({ pipelineId: "pipeline_1", input: "x", latencyMs: -5 });
    expect(RunSchema.safeParse(run).success).toBe(false);
  });
});
