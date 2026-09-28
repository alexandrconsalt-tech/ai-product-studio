"use client";

import { FLOOR_PLAN_ANALYSIS_PROMPT } from "../prompts/floor-plan-analysis";
import { FLOOR_PLAN_FIX_PROMPT } from "../prompts/floor-plan-fix";
import { FLOOR_PLAN_GENERATION_PROMPT } from "../prompts/floor-plan-generation";
import { FLOOR_PLAN_QA_PROMPT } from "../prompts/floor-plan-qa";
import { loadFloorPlanBrowserSettings } from "./browser-settings";

export type FloorPlanAiStageId = "analysis" | "generation" | "qa" | "fix";
export type FloorPlanAiStageSettings = { model: string; prompt: string };
export type FloorPlanPipelineSettings = { version: 1; stages: Record<FloorPlanAiStageId, FloorPlanAiStageSettings> };

const STORAGE_KEY = "ai-floor-plan.pipeline-settings.v1";

export const DEFAULT_FLOOR_PLAN_PIPELINE_SETTINGS: FloorPlanPipelineSettings = {
  version: 1,
  stages: {
    analysis: { model: "", prompt: FLOOR_PLAN_ANALYSIS_PROMPT },
    generation: { model: "", prompt: FLOOR_PLAN_GENERATION_PROMPT },
    qa: { model: "", prompt: FLOOR_PLAN_QA_PROMPT },
    fix: { model: "", prompt: FLOOR_PLAN_FIX_PROMPT },
  },
};

function normalizeStage(value: unknown, fallback: FloorPlanAiStageSettings): FloorPlanAiStageSettings {
  if (!value || typeof value !== "object") return fallback;
  const stage = value as Partial<FloorPlanAiStageSettings>;
  return {
    model: typeof stage.model === "string" ? stage.model.trim() : fallback.model,
    prompt: typeof stage.prompt === "string" && stage.prompt.trim() ? stage.prompt : fallback.prompt,
  };
}

export function loadFloorPlanPipelineSettings(): FloorPlanPipelineSettings {
  if (typeof window === "undefined") return DEFAULT_FLOOR_PLAN_PIPELINE_SETTINGS;
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<FloorPlanPipelineSettings> | null;
    if (saved?.stages) {
      return { version: 1, stages: {
        analysis: normalizeStage(saved.stages.analysis, DEFAULT_FLOOR_PLAN_PIPELINE_SETTINGS.stages.analysis),
        generation: normalizeStage(saved.stages.generation, DEFAULT_FLOOR_PLAN_PIPELINE_SETTINGS.stages.generation),
        qa: normalizeStage(saved.stages.qa, DEFAULT_FLOOR_PLAN_PIPELINE_SETTINGS.stages.qa),
        fix: normalizeStage(saved.stages.fix, DEFAULT_FLOOR_PLAN_PIPELINE_SETTINGS.stages.fix),
      } };
    }
  } catch { /* migrate from the previous A/B settings below */ }
  const legacy = loadFloorPlanBrowserSettings().models["model-a"];
  return { version: 1, stages: {
    analysis: { ...DEFAULT_FLOOR_PLAN_PIPELINE_SETTINGS.stages.analysis, model: legacy.visionModel },
    generation: { ...DEFAULT_FLOOR_PLAN_PIPELINE_SETTINGS.stages.generation, model: legacy.imageModel },
    qa: { ...DEFAULT_FLOOR_PLAN_PIPELINE_SETTINGS.stages.qa, model: legacy.qaModel },
    fix: { ...DEFAULT_FLOOR_PLAN_PIPELINE_SETTINGS.stages.fix, model: legacy.imageModel },
  } };
}

export function saveFloorPlanPipelineSettings(value: FloorPlanPipelineSettings): FloorPlanPipelineSettings {
  const next: FloorPlanPipelineSettings = { version: 1, stages: {
    analysis: normalizeStage(value.stages.analysis, DEFAULT_FLOOR_PLAN_PIPELINE_SETTINGS.stages.analysis),
    generation: normalizeStage(value.stages.generation, DEFAULT_FLOOR_PLAN_PIPELINE_SETTINGS.stages.generation),
    qa: normalizeStage(value.stages.qa, DEFAULT_FLOOR_PLAN_PIPELINE_SETTINGS.stages.qa),
    fix: normalizeStage(value.stages.fix, DEFAULT_FLOOR_PLAN_PIPELINE_SETTINGS.stages.fix),
  } };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function resetFloorPlanPipelinePrompts(value: FloorPlanPipelineSettings): FloorPlanPipelineSettings {
  return saveFloorPlanPipelineSettings({ version: 1, stages: {
    analysis: { ...value.stages.analysis, prompt: DEFAULT_FLOOR_PLAN_PIPELINE_SETTINGS.stages.analysis.prompt },
    generation: { ...value.stages.generation, prompt: DEFAULT_FLOOR_PLAN_PIPELINE_SETTINGS.stages.generation.prompt },
    qa: { ...value.stages.qa, prompt: DEFAULT_FLOOR_PLAN_PIPELINE_SETTINGS.stages.qa.prompt },
    fix: { ...value.stages.fix, prompt: DEFAULT_FLOOR_PLAN_PIPELINE_SETTINGS.stages.fix.prompt },
  } });
}
