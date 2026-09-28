import { describe, expect, it } from "vitest";
import type { FloorPlanQa } from "./schema";
import { normalizeFloorPlanQa } from "./normalize-qa";

const checks = Object.fromEntries(["roomCount", "topology", "walls", "windows", "doors", "doorSwings", "balconies", "labels", "areas", "dimensions", "fixtures", "hallucinations"].map((key) => [key, { passed: true, score: 1, details: "Matches original" }])) as FloorPlanQa["checks"];

describe("normalizeFloorPlanQa", () => {
  it("удаляет положительные наблюдения из ошибок и русифицирует реальный дефект", () => {
    const result = normalizeFloorPlanQa({
      passed: false,
      score: 0.83,
      errors: [
        "No geometry/topology discrepancy detected in room count or wall layout.",
        "Potential hallucination risk: generated annotation '?17' is unreadable in the source.",
      ],
      warnings: ["Room rendering is cleaner but remains consistent with the original."],
      checks,
    });
    expect(result.errors).toEqual(["Обнаружена неподтверждённая или нечитаемая подпись «?17». Её необходимо удалить."]);
    expect(result.warnings).toEqual([]);
    expect(result.checks.topology.details).toBe("Проверка пройдена.");
    expect(result.passed).toBe(false);
  });

  it("не пропускает результат с непройденной структурированной проверкой", () => {
    const result = normalizeFloorPlanQa({ passed: true, score: 0.99, errors: [], warnings: [], checks: { ...checks, walls: { passed: false, score: 0.4, details: "Wall mismatch" } } });
    expect(result.passed).toBe(false);
    expect(result.checks.walls.details).toContain("стены");
  });
});
