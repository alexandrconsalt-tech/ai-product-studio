// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { loadFloorPlanPipelineSettings, saveFloorPlanPipelineSettings } from "./pipeline-settings";

describe("Floor Plan pipeline settings", () => {
  beforeEach(() => window.localStorage.clear());

  it("не назначает модели по умолчанию", () => {
    const value = loadFloorPlanPipelineSettings();
    expect(Object.values(value.stages).every((stage) => stage.model === "")).toBe(true);
    expect(value.stages.analysis.prompt).toContain("architectural floor-plan");
  });

  it("сохраняет отдельные модели и промпты каждого AI-этапа", () => {
    const value = loadFloorPlanPipelineSettings();
    value.stages.analysis = { model: "vision-a", prompt: "Мой анализ" };
    value.stages.generation = { model: "image-a", prompt: "Моя генерация" };
    saveFloorPlanPipelineSettings(value);
    expect(loadFloorPlanPipelineSettings().stages).toMatchObject({
      analysis: { model: "vision-a", prompt: "Мой анализ" },
      generation: { model: "image-a", prompt: "Моя генерация" },
    });
  });

  it("мигрирует модели A из предыдущих настроек", () => {
    window.localStorage.setItem("ai-floor-plan.aitunnel-settings.v2", JSON.stringify({ models: { "model-a": { visionModel: "legacy-vision", imageModel: "legacy-image", qaModel: "legacy-qa" } } }));
    expect(loadFloorPlanPipelineSettings().stages).toMatchObject({
      analysis: { model: "legacy-vision" }, generation: { model: "legacy-image" }, qa: { model: "legacy-qa" }, fix: { model: "legacy-image" },
    });
  });
});
