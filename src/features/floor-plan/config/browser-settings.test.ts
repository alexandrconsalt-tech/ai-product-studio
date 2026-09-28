// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { clearFloorPlanApiKey, loadFloorPlanBrowserSettings, saveFloorPlanBrowserSettings } from "./browser-settings";

describe("AI Tunnel Floor Plan browser settings", () => {
  beforeEach(() => window.localStorage.clear());

  it("не подставляет модели по умолчанию и сохраняет выбор пользователя", () => {
    expect(loadFloorPlanBrowserSettings().models["model-a"]).toEqual({ visionModel: "", imageModel: "", qaModel: "" });
    saveFloorPlanBrowserSettings({
      apiKey: " sk-aitunnel-secret ",
      baseUrl: "https://api.aitunnel.ru/v1/",
      models: {
        "model-a": { visionModel: " vision-a ", imageModel: " image-a ", qaModel: " qa-a " },
        "model-b": { visionModel: "vision-b", imageModel: "image-b", qaModel: "qa-b" },
      },
    });
    expect(loadFloorPlanBrowserSettings()).toMatchObject({
      apiKey: "sk-aitunnel-secret",
      models: { "model-a": { visionModel: "vision-a", imageModel: "image-a", qaModel: "qa-a" } },
    });
  });

  it("удаляет только ключ, сохраняя выбранные модели", () => {
    saveFloorPlanBrowserSettings({ apiKey: "secret", baseUrl: "https://api.aitunnel.ru/v1", models: { "model-a": { visionModel: "v", imageModel: "i", qaModel: "q" }, "model-b": { visionModel: "v2", imageModel: "i2", qaModel: "q2" } } });
    clearFloorPlanApiKey();
    expect(loadFloorPlanBrowserSettings()).toMatchObject({ apiKey: "", models: { "model-a": { visionModel: "v", imageModel: "i" } } });
  });

  it("использует legacy vision-модель как QA-модель", () => {
    window.localStorage.setItem("ai-floor-plan.aitunnel-settings.v2", JSON.stringify({ models: { "model-a": { visionModel: "legacy-vision", imageModel: "legacy-image" } } }));
    expect(loadFloorPlanBrowserSettings().models["model-a"].qaModel).toBe("legacy-vision");
  });
});
