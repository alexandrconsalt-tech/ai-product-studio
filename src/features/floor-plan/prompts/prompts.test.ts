import { describe, expect, it } from "vitest";
import type { FloorPlanQa, FloorPlanScene } from "../domain/schema";
import { buildFloorPlanAnalysisPrompt, FLOOR_PLAN_ANALYSIS_PROMPT } from "./floor-plan-analysis";
import { buildFloorPlanFixPrompt } from "./floor-plan-fix";
import { buildFloorPlanGenerationPrompt } from "./floor-plan-generation";
import { buildFloorPlanQaPrompt } from "./floor-plan-qa";

const scene = { floorPlan: { rooms: [] }, sourceFacts: [] } as unknown as FloorPlanScene;
const qa = { errors: ["window mismatch"] } as FloorPlanQa;

describe("floor-plan prompts", () => {
  it("фиксирует запрет на домыслы и приоритет геометрии на каждом этапе", () => {
    expect(FLOOR_PLAN_ANALYSIS_PROMPT).toMatch(/Never infer|never fabricate/);
    expect(buildFloorPlanAnalysisPrompt("Пользовательский промпт")).toMatch(/unreadable.*Never copy/i);
    expect(buildFloorPlanGenerationPrompt(scene, "standard", { roomNames: true, roomAreas: true, wallDimensions: true, cardinalDirections: true, furniture: true })).toMatch(/Never reproduce an unreadable|sourceLabel/);
    expect(buildFloorPlanQaPrompt(scene)).toMatch(/only in Russian|successful observation/);
    expect(buildFloorPlanFixPrompt(scene, qa)).toMatch(/Completely erase|window mismatch/);
  });
});
