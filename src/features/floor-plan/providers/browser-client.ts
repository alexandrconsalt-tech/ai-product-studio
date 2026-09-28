"use client";

import type { FloorPlanBrowserSettings } from "../config/browser-settings";
import type { FloorPlanGenerationOptions, FloorPlanQa, FloorPlanScene, FloorPlanStageTelemetry, FloorPlanStyle } from "../domain/schema";
import type { FloorPlanPipelineClient, PipelineSource, StageResult } from "../pipeline/orchestrator";

async function generatedFile(dataUrl: string): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], "generated-floor-plan.png", { type: blob.type || "image/png" });
}

export class BrowserFloorPlanPipelineClient implements FloorPlanPipelineClient {
  constructor(private readonly settings: FloorPlanBrowserSettings & { apiKey: string }) {}

  private form(action: string, pipelineId: string, source: PipelineSource, model: string): FormData {
    const form = new FormData();
    form.set("action", action); form.set("pipelineId", pipelineId); form.set("source", source.file);
    form.set("width", String(source.width)); form.set("height", String(source.height)); form.set("page", String(source.page));
    form.set("apiKey", this.settings.apiKey); form.set("baseUrl", this.settings.baseUrl); form.set("model", model);
    return form;
  }

  private async post<T>(form: FormData): Promise<T> {
    const response = await fetch("/api/floor-plan", { method: "POST", body: form });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new FloorPlanStageError(typeof payload.error === "string" ? payload.error : "Не удалось выполнить этап AI-пайплайна.", payload.telemetry);
    return payload as T;
  }

  analyze(input: { pipelineId: string; source: PipelineSource; model: string; prompt: string }): Promise<StageResult<{ scene: FloorPlanScene }>> {
    const form = this.form("analyze", input.pipelineId, input.source, input.model); form.set("prompt", input.prompt);
    return this.post(form);
  }

  generate(input: { pipelineId: string; source: PipelineSource; styleReferences: File[]; model: string; prompt: string; scene: FloorPlanScene; style: FloorPlanStyle; options: FloorPlanGenerationOptions }): Promise<StageResult<{ dataUrl: string; mimeType: string }>> {
    const form = this.form("generate", input.pipelineId, input.source, input.model);
    form.set("scene", JSON.stringify(input.scene)); form.set("style", input.style); form.set("options", JSON.stringify(input.options)); form.set("prompt", input.prompt);
    for (const reference of input.styleReferences) form.append("styleReference", reference);
    return this.post(form);
  }

  async verify(input: { pipelineId: string; source: PipelineSource; generatedDataUrl: string; model: string; prompt: string; scene: FloorPlanScene; style: FloorPlanStyle; options: FloorPlanGenerationOptions; afterFix: boolean }): Promise<StageResult<{ qa: FloorPlanQa }>> {
    const form = this.form("verify", input.pipelineId, input.source, input.model);
    form.set("generated", await generatedFile(input.generatedDataUrl)); form.set("scene", JSON.stringify(input.scene)); form.set("style", input.style); form.set("options", JSON.stringify(input.options)); form.set("afterFix", String(input.afterFix)); form.set("prompt", input.prompt);
    return this.post(form);
  }

  async fix(input: { pipelineId: string; source: PipelineSource; styleReferences: File[]; generatedDataUrl: string; model: string; prompt: string; scene: FloorPlanScene; qa: FloorPlanQa; style: FloorPlanStyle; options: FloorPlanGenerationOptions }): Promise<StageResult<{ dataUrl: string; mimeType: string }>> {
    const form = this.form("fix", input.pipelineId, input.source, input.model);
    form.set("generated", await generatedFile(input.generatedDataUrl)); form.set("scene", JSON.stringify(input.scene)); form.set("qa", JSON.stringify(input.qa)); form.set("style", input.style); form.set("options", JSON.stringify(input.options)); form.set("prompt", input.prompt);
    return this.post(form);
  }
}

export class FloorPlanStageError extends Error {
  constructor(message: string, readonly telemetry?: FloorPlanStageTelemetry) { super(message); }
}
