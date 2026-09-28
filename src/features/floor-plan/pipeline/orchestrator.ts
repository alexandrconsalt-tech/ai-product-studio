import type {
  FloorPlanGenerationOptions, FloorPlanPipelineStatus, FloorPlanQa, FloorPlanScene, FloorPlanStageTelemetry, FloorPlanStyle,
} from "../domain/schema";
import type { FloorPlanAiStageId } from "../config/pipeline-settings";

export type FloorPlanModelConfiguration = { analysisModel: string; generationModel: string; qaModel: string; fixModel: string };
export type FloorPlanPromptConfiguration = Record<FloorPlanAiStageId, string>;
export type PipelineSource = { file: File; width: number; height: number; page: number };
export type StageResult<T> = T & { telemetry: FloorPlanStageTelemetry };

export interface FloorPlanPipelineClient {
  analyze(input: { pipelineId: string; source: PipelineSource; model: string; prompt: string }): Promise<StageResult<{ scene: FloorPlanScene }>>;
  generate(input: { pipelineId: string; source: PipelineSource; styleReferences: File[]; model: string; prompt: string; scene: FloorPlanScene; style: FloorPlanStyle; options: FloorPlanGenerationOptions }): Promise<StageResult<{ dataUrl: string; mimeType: string }>>;
  verify(input: { pipelineId: string; source: PipelineSource; generatedDataUrl: string; model: string; prompt: string; scene: FloorPlanScene; style: FloorPlanStyle; options: FloorPlanGenerationOptions; afterFix: boolean }): Promise<StageResult<{ qa: FloorPlanQa }>>;
  fix(input: { pipelineId: string; source: PipelineSource; styleReferences: File[]; generatedDataUrl: string; model: string; prompt: string; scene: FloorPlanScene; qa: FloorPlanQa; style: FloorPlanStyle; options: FloorPlanGenerationOptions }): Promise<StageResult<{ dataUrl: string; mimeType: string }>>;
}

export type FloorPlanPipelineResult = {
  pipelineId: string; status: "completed" | "failed"; scene: FloorPlanScene; dataUrl: string; mimeType: string;
  qa: FloorPlanQa; autoFixAttempts: number; telemetry: FloorPlanStageTelemetry[]; totalDuration: number;
};

function isBetterQa(candidate: FloorPlanQa, current: FloorPlanQa): boolean {
  if (candidate.passed !== current.passed) return candidate.passed;
  if (candidate.score !== current.score) return candidate.score > current.score;
  return candidate.errors.length + candidate.warnings.length < current.errors.length + current.warnings.length;
}

export async function executeFloorPlanPipeline(input: {
  pipelineId: string; source: PipelineSource; styleReferences?: File[]; models: FloorPlanModelConfiguration; prompts: FloorPlanPromptConfiguration; style: FloorPlanStyle;
  options: FloorPlanGenerationOptions; client: FloorPlanPipelineClient; onStatus?: (status: FloorPlanPipelineStatus) => void;
  onTelemetry?: (telemetry: FloorPlanStageTelemetry[]) => void;
}): Promise<FloorPlanPipelineResult> {
  const started = Date.now();
  const telemetry: FloorPlanStageTelemetry[] = [];
  const record = (value: FloorPlanStageTelemetry) => { telemetry.push(value); input.onTelemetry?.([...telemetry]); };
  try {
  input.onStatus?.("analyzing");
  const analysis = await input.client.analyze({ pipelineId: input.pipelineId, source: input.source, model: input.models.analysisModel, prompt: input.prompts.analysis });
  record(analysis.telemetry);

  input.onStatus?.("generating");
  const generated = await input.client.generate({
    pipelineId: input.pipelineId, source: input.source, styleReferences: input.styleReferences ?? [], model: input.models.generationModel,
    prompt: input.prompts.generation, scene: analysis.scene, style: input.style, options: input.options,
  });
  record(generated.telemetry);

  input.onStatus?.("verifying");
  let verification = await input.client.verify({
    pipelineId: input.pipelineId, source: input.source, generatedDataUrl: generated.dataUrl,
    model: input.models.qaModel, prompt: input.prompts.qa, scene: analysis.scene, style: input.style, options: input.options, afterFix: false,
  });
  record(verification.telemetry);
  const initialVerification = verification;
  let finalImage = generated;
  let autoFixAttempts = 0;

  if (!verification.qa.passed) {
    input.onStatus?.("fixing");
    const fixed = await input.client.fix({
      pipelineId: input.pipelineId, source: input.source, styleReferences: input.styleReferences ?? [], generatedDataUrl: generated.dataUrl,
      model: input.models.fixModel, prompt: input.prompts.fix, scene: analysis.scene, qa: verification.qa, style: input.style, options: input.options,
    });
    record(fixed.telemetry);
    autoFixAttempts = 1;
    input.onStatus?.("verifying");
    const fixedVerification = await input.client.verify({
      pipelineId: input.pipelineId, source: input.source, generatedDataUrl: fixed.dataUrl,
      model: input.models.qaModel, prompt: input.prompts.qa, scene: analysis.scene, style: input.style, options: input.options, afterFix: true,
    });
    record(fixedVerification.telemetry);
    if (isBetterQa(fixedVerification.qa, initialVerification.qa)) {
      finalImage = fixed;
      verification = fixedVerification;
    } else verification = initialVerification;
  }

  const status = verification.qa.passed ? "completed" : "failed";
  input.onStatus?.(status);
  return {
    pipelineId: input.pipelineId, status, scene: analysis.scene, dataUrl: finalImage.dataUrl, mimeType: finalImage.mimeType,
    qa: verification.qa, autoFixAttempts, telemetry, totalDuration: Date.now() - started,
  };
  } catch (error) {
    const failedTelemetry = error && typeof error === "object" && "telemetry" in error ? (error as { telemetry?: FloorPlanStageTelemetry }).telemetry : undefined;
    if (failedTelemetry) record(failedTelemetry);
    input.onStatus?.("failed");
    throw error;
  }
}
