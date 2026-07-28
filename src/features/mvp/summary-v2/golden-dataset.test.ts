import { describe, expect, it } from "vitest";
import { SUMMARY_V2_GOLDEN_DATASET } from "./golden-dataset";

describe("Summary Pipeline v2 Golden Dataset", () => {
  it("содержит фиксированные 30 размеченных звонков", () => {
    expect(SUMMARY_V2_GOLDEN_DATASET).toHaveLength(30);
    expect(new Set(SUMMARY_V2_GOLDEN_DATASET.map((item) => item.id)).size).toBe(30);
    for (const item of SUMMARY_V2_GOLDEN_DATASET) {
      expect(item.transcript.length).toBeGreaterThan(20);
      expect(item.expected.outcome).not.toBe("");
      expect(item.expected.forbiddenErrors.length).toBeGreaterThan(0);
    }
  });
});
