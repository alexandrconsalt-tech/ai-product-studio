import { describe, expect, it } from "vitest";
import { confidenceFromTemperature } from "./confidence";

describe("confidenceFromTemperature", () => {
  it("defaults to temperature 0.3 when undefined", () => {
    expect(confidenceFromTemperature(undefined)).toBeCloseTo(0.9, 2);
  });

  it("returns higher confidence for lower temperature", () => {
    expect(confidenceFromTemperature(0)).toBeGreaterThan(confidenceFromTemperature(1));
  });

  it("clamps to the 0.5-0.95 range for extreme temperatures", () => {
    expect(confidenceFromTemperature(-5)).toBeLessThanOrEqual(0.95);
    expect(confidenceFromTemperature(100)).toBeGreaterThanOrEqual(0.5);
  });
});
