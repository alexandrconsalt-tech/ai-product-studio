import { NextResponse } from "next/server";
import { z } from "zod";
import { AiTunnelFloorPlanImageProvider, AiTunnelFloorPlanVisionProvider, normalizeAiTunnelBaseUrl } from "@/features/floor-plan/providers/server-adapters";
import { buildFloorPlanAnalysisPrompt, FLOOR_PLAN_ANALYSIS_PROMPT, FLOOR_PLAN_ANALYSIS_PROMPT_VERSION } from "@/features/floor-plan/prompts/floor-plan-analysis";
import { buildFloorPlanGenerationPrompt, FLOOR_PLAN_GENERATION_PROMPT, FLOOR_PLAN_GENERATION_PROMPT_VERSION } from "@/features/floor-plan/prompts/floor-plan-generation";
import { buildFloorPlanQaPrompt, FLOOR_PLAN_QA_PROMPT, FLOOR_PLAN_QA_PROMPT_VERSION } from "@/features/floor-plan/prompts/floor-plan-qa";
import { buildFloorPlanFixPrompt, FLOOR_PLAN_FIX_PROMPT, FLOOR_PLAN_FIX_PROMPT_VERSION } from "@/features/floor-plan/prompts/floor-plan-fix";
import { floorPlanQaSchema, floorPlanSceneSchema, type FloorPlanPipelineStage, type FloorPlanStageTelemetry } from "@/features/floor-plan/domain/schema";

export const runtime = "nodejs";
export const maxDuration = 300;

const actionSchema = z.enum(["analyze", "generate", "verify", "fix"]);
const styleSchema = z.enum(["vladis", "standard"]);
const optionsSchema = z.object({ roomNames: z.boolean(), roomAreas: z.boolean(), wallDimensions: z.boolean(), cardinalDirections: z.boolean(), furniture: z.boolean() });
const promptSchema = z.string().trim().min(1).max(30_000);
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

function publicError(action: z.infer<typeof actionSchema>): string {
  if (action === "analyze") return "Не удалось распознать планировку. Проверьте качество исходника или выберите другую Vision-модель.";
  if (action === "generate") return "Не удалось создать 2D-планировку. Попробуйте другую image-модель.";
  if (action === "verify") return "Не удалось автоматически проверить результат. Попробуйте другую QA-модель.";
  return "Не удалось исправить найденные расхождения. Попробуйте повторную генерацию.";
}

function sourceFrom(file: File, width: number, height: number, page: number) {
  return file.arrayBuffer().then((buffer) => ({ bytes: new Uint8Array(buffer), mimeType: file.type, filename: file.name, width, height, page }));
}

function readJson<T>(form: FormData, key: string, schema: z.ZodType<T>): T {
  const value = form.get(key);
  if (typeof value !== "string") throw new Error(`missing_${key}`);
  return schema.parse(JSON.parse(value));
}

function readPrompt(form: FormData, fallback: string): string {
  const value = form.get("prompt");
  return typeof value === "string" && value.trim() ? promptSchema.parse(value) : fallback;
}

function telemetry(stage: FloorPlanPipelineStage, model: string, started: number, result: { usage: Record<string, number> | null; costRub: number | null }): FloorPlanStageTelemetry {
  return { stage, provider: "ai-tunnel", model, durationMs: Date.now() - started, usage: result.usage, costRub: result.costRub };
}

function stageFor(action: z.infer<typeof actionSchema>, form: FormData): FloorPlanPipelineStage {
  if (action === "analyze") return "analysis";
  if (action === "generate") return "generation";
  if (action === "fix") return "fix";
  return form.get("afterFix") === "true" ? "qa-after-fix" : "qa";
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const parsedAction = actionSchema.safeParse(form?.get("action"));
  if (!form || !parsedAction.success) return NextResponse.json({ error: "Некорректный этап AI-пайплайна." }, { status: 400 });
  const action = parsedAction.data;
  const pipelineId = form.get("pipelineId");
  const file = form.get("source");
  const generated = form.get("generated");
  const apiKeyValue = form.get("apiKey");
  const baseUrlValue = form.get("baseUrl");
  const modelValue = form.get("model");
  const width = Number(form.get("width"));
  const height = Number(form.get("height"));
  const page = Number(form.get("page"));

  if (typeof pipelineId !== "string" || !pipelineId || !(file instanceof File) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return NextResponse.json({ error: "Некорректный запрос к AI-пайплайну." }, { status: 400 });
  }
  if (!file.type.startsWith("image/") || file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "После подготовки ожидается непустое изображение до 20 МБ." }, { status: 400 });
  }
  if (![apiKeyValue, baseUrlValue, modelValue].every((value) => typeof value === "string" && value.trim())) {
    return NextResponse.json({ error: "AI Tunnel не настроен. Добавьте API key в «Настройках» и выберите модели во вкладке «Пайплайн»." }, { status: 503 });
  }

  let baseUrl: string;
  try { baseUrl = normalizeAiTunnelBaseUrl(baseUrlValue as string); }
  catch { return NextResponse.json({ error: "Разрешён только официальный AI Tunnel Base URL." }, { status: 400 }); }
  const apiKey = (apiKeyValue as string).trim();
  const model = (modelValue as string).trim();
  const started = Date.now();

  try {
    const originalSource = await sourceFrom(file, width, height, Number.isFinite(page) ? page : 1);
    if (action === "analyze") {
      const result = await new AiTunnelFloorPlanVisionProvider(apiKey, baseUrl, model).analyze(originalSource, buildFloorPlanAnalysisPrompt(readPrompt(form, FLOOR_PLAN_ANALYSIS_PROMPT)));
      return NextResponse.json({ scene: result.scene, promptVersion: FLOOR_PLAN_ANALYSIS_PROMPT_VERSION, telemetry: telemetry("analysis", model, started, result) });
    }

    const scene = readJson(form, "scene", floorPlanSceneSchema);
    if (action === "generate") {
      const style = styleSchema.parse(form.get("style"));
      const options = readJson(form, "options", optionsSchema);
      const referenceFiles = form.getAll("styleReference");
      if (referenceFiles.length > 1 || referenceFiles.some((reference) => !(reference instanceof File) || !reference.type.startsWith("image/") || reference.size <= 0 || reference.size > MAX_IMAGE_BYTES)) {
        return NextResponse.json({ error: "Можно добавить один непустой референс Vladis до 20 МБ." }, { status: 400 });
      }
      const references = await Promise.all(referenceFiles.map((reference) => sourceFrom(reference as File, width, height, 1)));
      const result = await new AiTunnelFloorPlanImageProvider(apiKey, baseUrl, model).generate([originalSource, ...references], buildFloorPlanGenerationPrompt(scene, style, options, readPrompt(form, FLOOR_PLAN_GENERATION_PROMPT)));
      return NextResponse.json({ dataUrl: result.dataUrl, mimeType: result.mimeType, promptVersion: FLOOR_PLAN_GENERATION_PROMPT_VERSION, telemetry: telemetry("generation", model, started, result) });
    }

    if (!(generated instanceof File) || !generated.type.startsWith("image/") || generated.size <= 0 || generated.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Сгенерированное изображение отсутствует или превышает 20 МБ." }, { status: 400 });
    }
    const generatedSource = await sourceFrom(generated, width, height, Number.isFinite(page) ? page : 1);
    const style = styleSchema.catch("standard").parse(form.get("style"));
    const options = form.get("options") ? readJson(form, "options", optionsSchema) : { roomNames: true, roomAreas: true, wallDimensions: true, cardinalDirections: true, furniture: true };
    if (action === "verify") {
      const afterFix = form.get("afterFix") === "true";
      const result = await new AiTunnelFloorPlanVisionProvider(apiKey, baseUrl, model).verify(originalSource, generatedSource, buildFloorPlanQaPrompt(scene, readPrompt(form, FLOOR_PLAN_QA_PROMPT), style, options));
      return NextResponse.json({ qa: result.qa, promptVersion: FLOOR_PLAN_QA_PROMPT_VERSION, telemetry: telemetry(afterFix ? "qa-after-fix" : "qa", model, started, result) });
    }

    const qa = readJson(form, "qa", floorPlanQaSchema);
    const result = await new AiTunnelFloorPlanImageProvider(apiKey, baseUrl, model).generate([originalSource, generatedSource], buildFloorPlanFixPrompt(scene, qa, readPrompt(form, FLOOR_PLAN_FIX_PROMPT), style, options));
    return NextResponse.json({ dataUrl: result.dataUrl, mimeType: result.mimeType, promptVersion: FLOOR_PLAN_FIX_PROMPT_VERSION, telemetry: telemetry("fix", model, started, result) });
  } catch (error) {
    console.error("[floor-plan-pipeline]", { pipelineId, action, model, error });
    const message = publicError(action);
    return NextResponse.json({ error: message, telemetry: { ...telemetry(stageFor(action, form), model, started, { usage: null, costRub: null }), error: message } }, { status: 502 });
  }
}
