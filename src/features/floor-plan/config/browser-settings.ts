"use client";

import type { FloorPlanProvider } from "../domain/schema";

export const DEFAULT_AI_TUNNEL_FLOOR_PLAN_BASE_URL = "https://api.aitunnel.ru/v1";

export type FloorPlanModelSettings = {
  visionModel: string;
  imageModel: string;
  qaModel: string;
};

export type FloorPlanBrowserSettings = {
  apiKey: string;
  baseUrl: string;
  models: Record<FloorPlanProvider, FloorPlanModelSettings>;
};

const STORAGE_KEY = "ai-floor-plan.aitunnel-settings.v2";

export const DEFAULT_FLOOR_PLAN_BROWSER_SETTINGS: FloorPlanBrowserSettings = {
  apiKey: "",
  baseUrl: DEFAULT_AI_TUNNEL_FLOOR_PLAN_BASE_URL,
  models: {
    "model-a": { visionModel: "", imageModel: "", qaModel: "" },
    "model-b": { visionModel: "", imageModel: "", qaModel: "" },
  },
};

export function loadFloorPlanBrowserSettings(): FloorPlanBrowserSettings {
  if (typeof window === "undefined") return DEFAULT_FLOOR_PLAN_BROWSER_SETTINGS;
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<FloorPlanBrowserSettings>;
    return {
      apiKey: typeof value.apiKey === "string" ? value.apiKey : "",
      baseUrl: typeof value.baseUrl === "string" && value.baseUrl.trim() ? value.baseUrl : DEFAULT_AI_TUNNEL_FLOOR_PLAN_BASE_URL,
      models: {
        "model-a": {
          ...DEFAULT_FLOOR_PLAN_BROWSER_SETTINGS.models["model-a"], ...value.models?.["model-a"],
          qaModel: value.models?.["model-a"]?.qaModel || value.models?.["model-a"]?.visionModel || "",
        },
        "model-b": {
          ...DEFAULT_FLOOR_PLAN_BROWSER_SETTINGS.models["model-b"], ...value.models?.["model-b"],
          qaModel: value.models?.["model-b"]?.qaModel || value.models?.["model-b"]?.visionModel || "",
        },
      },
    };
  } catch {
    return DEFAULT_FLOOR_PLAN_BROWSER_SETTINGS;
  }
}

export function saveFloorPlanBrowserSettings(value: FloorPlanBrowserSettings): FloorPlanBrowserSettings {
  const next: FloorPlanBrowserSettings = {
    apiKey: value.apiKey.trim(),
    baseUrl: value.baseUrl.trim() || DEFAULT_AI_TUNNEL_FLOOR_PLAN_BASE_URL,
    models: {
      "model-a": { visionModel: value.models["model-a"].visionModel.trim(), imageModel: value.models["model-a"].imageModel.trim(), qaModel: value.models["model-a"].qaModel.trim() },
      "model-b": { visionModel: value.models["model-b"].visionModel.trim(), imageModel: value.models["model-b"].imageModel.trim(), qaModel: value.models["model-b"].qaModel.trim() },
    },
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearFloorPlanApiKey(): FloorPlanBrowserSettings {
  return saveFloorPlanBrowserSettings({ ...loadFloorPlanBrowserSettings(), apiKey: "" });
}
