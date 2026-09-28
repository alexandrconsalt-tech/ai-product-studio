import { describe, expect, it } from "vitest";
import { floorPlanSceneSchema, type FloorPlanScene } from "./schema";
import { validateFloorPlanScene } from "../validation/validate-scene";
import { renderFloorPlanSvg } from "../renderer/svg-renderer";

export const validScene: FloorPlanScene = {
  document: { type: "bti_plan", confidence: 0.98 },
  floorPlan: {
    sourceWidth: 1400, sourceHeight: 1000,
    walls: [
      { id: "w1", type: "exterior", start: { x: 0.1, y: 0.1 }, end: { x: 0.9, y: 0.1 }, thickness: 0.02, confidence: 0.98 },
      { id: "w2", type: "exterior", start: { x: 0.9, y: 0.1 }, end: { x: 0.9, y: 0.9 }, thickness: 0.02, confidence: 0.98 },
    ],
    rooms: [{ id: "r1", type: "room", sourceLabel: "1", polygon: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.9, y: 0.9 }, { x: 0.1, y: 0.9 }], area: { value: 19.6, confidence: 0.99 }, confidence: 0.96 }],
    doors: [{ id: "d1", type: "door", wallId: "w1", position: 0.4, width: 0.08, swing: "left_in", confidence: 0.91 }],
    windows: [{ id: "win1", type: "window", wallId: "w2", position: 0.5, width: 0.12, confidence: 0.95 }],
    openings: [], balconies: [], fixtures: [], furniture: [], dimensions: [], labels: [],
  },
  areas: { total: { value: 19.6, source: "ocr", confidence: 0.99 }, living: null },
  sourceFacts: [], warnings: [],
  confidence: { geometry: 0.94, ocr: 0.98, topology: 0.96, overall: 0.95 }, ambiguities: [],
};

describe("floorPlanSceneSchema", () => {
  it("принимает нормализованную сцену", () => { expect(floorPlanSceneSchema.parse(validScene).floorPlan.walls).toHaveLength(2); });
  it("отклоняет координаты вне canvas", () => { expect(() => floorPlanSceneSchema.parse({ ...validScene, floorPlan: { ...validScene.floorPlan, walls: [{ ...validScene.floorPlan.walls[0], start: { x: -0.1, y: 0.1 } }] } })).toThrow(); });
});

describe("deterministic floor plan", () => {
  it("валидирует архитектурные ссылки", () => { expect(validateFloorPlanScene(validScene)).toEqual({ errors: [], warnings: [] }); });
  it("возвращает ошибку для двери без стены", () => { const scene = { ...validScene, floorPlan: { ...validScene.floorPlan, doors: [{ ...validScene.floorPlan.doors[0], wallId: "missing" }] } }; expect(validateFloorPlanScene(scene).errors[0]?.code).toBe("missing_wall_reference"); });
  it("рендерит повторяемый SVG без raster assets", () => { const first = renderFloorPlanSvg(validScene); expect(first).toBe(renderFloorPlanSvg(validScene)); expect(first).toContain("<svg"); expect(first).not.toContain("base64"); });
});
