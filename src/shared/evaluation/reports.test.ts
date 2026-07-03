import { describe, expect, it } from "vitest";
import { buildReportEnvelope } from "./reports";

describe("buildReportEnvelope", () => {
  it("wraps the given data with a reportType and generatedAt", () => {
    const envelope = buildReportEnvelope("run_report", { id: "run_1" }, "2026-07-03T00:00:00.000Z");
    expect(envelope).toEqual({ reportType: "run_report", generatedAt: "2026-07-03T00:00:00.000Z", data: { id: "run_1" } });
  });

  it("defaults generatedAt to the current time when not provided", () => {
    const before = Date.now();
    const envelope = buildReportEnvelope("pipeline_configuration", { id: "pipeline_1" });
    const after = Date.now();
    const generatedAtMs = new Date(envelope.generatedAt).getTime();
    expect(generatedAtMs).toBeGreaterThanOrEqual(before);
    expect(generatedAtMs).toBeLessThanOrEqual(after);
  });
});
