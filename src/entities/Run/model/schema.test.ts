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

  it("factory defaults evidence to an empty array (added 2026-07-03, CLAUDE.md §14.3/§24)", () => {
    const run = createRun({ pipelineId: "pipeline_1", input: "x" });
    expect(run.evidence).toEqual([]);
  });

  it("accepts explicit evidence quotes", () => {
    const run = createRun({ pipelineId: "pipeline_1", input: "x", evidence: ["Клиент сказал: хочу переехать до конца квартала."] });
    expect(RunSchema.safeParse(run).success).toBe(true);
    expect(run.evidence).toHaveLength(1);
  });
});
