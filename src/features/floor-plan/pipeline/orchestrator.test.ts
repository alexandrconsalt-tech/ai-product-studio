// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type { FloorPlanQa, FloorPlanScene, FloorPlanStageTelemetry } from "../domain/schema";
import { executeFloorPlanPipeline, type FloorPlanPipelineClient } from "./orchestrator";

const checks = Object.fromEntries(["roomCount", "topology", "walls", "windows", "doors", "doorSwings", "balconies", "labels", "areas", "dimensions", "fixtures", "hallucinations"].map((key) => [key, { passed: true, score: 1, details: "ok" }])) as FloorPlanQa["checks"];
const qa = (passed: boolean): FloorPlanQa => ({ passed, score: passed ? 0.98 : 0.6, errors: passed ? [] : ["Смещена стена"], warnings: [], checks });
const telemetry = (stage: FloorPlanStageTelemetry["stage"]): FloorPlanStageTelemetry => ({ stage, provider: "ai-tunnel", model: stage, durationMs: 10, usage: { input_tokens: 1 }, costRub: 1 });
const source = { file: new File(["image"], "plan.png", { type: "image/png" }), width: 100, height: 100, page: 1 };
const scene: FloorPlanScene = {
  document: { type: "scan", confidence: 1 },
  floorPlan: { sourceWidth: 100, sourceHeight: 100, walls: [], rooms: [], doors: [], windows: [], openings: [], balconies: [], fixtures: [], furniture: [], dimensions: [], labels: [] },
  areas: { total: null, living: null }, sourceFacts: [], warnings: [], confidence: { geometry: 1, ocr: 1, topology: 1, overall: 1 }, ambiguities: [],
};

function client(firstQa: FloorPlanQa, secondQa = qa(true), recognizedScene = scene): FloorPlanPipelineClient {
  let verification = 0;
  return {
    analyze: vi.fn(async () => ({ scene: recognizedScene, telemetry: telemetry("analysis") })),
    generate: vi.fn(async () => ({ dataUrl: "data:image/png;base64,AA==", mimeType: "image/png", telemetry: telemetry("generation") })),
    verify: vi.fn(async () => ({ qa: verification++ === 0 ? firstQa : secondQa, telemetry: telemetry(verification === 1 ? "qa" : "qa-after-fix") })),
    fix: vi.fn(async () => ({ dataUrl: "data:image/png;base64,AQ==", mimeType: "image/png", telemetry: telemetry("fix") })),
  };
}

const input = (pipelineClient: FloorPlanPipelineClient, onStatus = vi.fn()) => ({
  pipelineId: "pipeline-1", source, models: { analysisModel: "gemini-vision", generationModel: "gpt-image", qaModel: "gemini-qa", fixModel: "gemini-image" },
  prompts: { analysis: "analysis prompt", generation: "generation prompt", qa: "qa prompt", fix: "fix prompt" },
  style: "standard" as const, options: { roomNames: true, roomAreas: true, wallDimensions: true, cardinalDirections: false, furniture: false },
  client: pipelineClient, onStatus,
});

describe("executeFloorPlanPipeline", () => {
  it("выполняет analysis → generation → QA без исправления при успешной проверке", async () => {
    const pipelineClient = client(qa(true));
    const onStatus = vi.fn();
    const result = await executeFloorPlanPipeline(input(pipelineClient, onStatus));
    expect(result.status).toBe("completed");
    expect(result.autoFixAttempts).toBe(0);
    expect(result.telemetry.map((item) => item.stage)).toEqual(["analysis", "generation", "qa"]);
    expect(pipelineClient.fix).not.toHaveBeenCalled();
    expect(onStatus.mock.calls.flat()).toEqual(["analyzing", "generating", "verifying", "completed"]);
  });

  it("делает ровно один auto-fix и повторную QA", async () => {
    const pipelineClient = client(qa(false), qa(false));
    const result = await executeFloorPlanPipeline(input(pipelineClient));
    expect(result.status).toBe("failed");
    expect(result.autoFixAttempts).toBe(1);
    expect(result.telemetry.map((item) => item.stage)).toEqual(["analysis", "generation", "qa", "fix", "qa-after-fix"]);
    expect(pipelineClient.fix).toHaveBeenCalledTimes(1);
    expect(pipelineClient.verify).toHaveBeenCalledTimes(2);
  });

  it("откатывает auto-fix, если повторная QA оценила его хуже", async () => {
    const first = { ...qa(false), score: 0.72 };
    const worse = { ...qa(false), score: 0.41, errors: ["Стало хуже"] };
    const pipelineClient = client(first, worse);
    const result = await executeFloorPlanPipeline(input(pipelineClient));
    expect(result.dataUrl).toBe("data:image/png;base64,AA==");
    expect(result.qa.score).toBe(0.72);
    expect(result.autoFixAttempts).toBe(1);
    expect(pipelineClient.verify).toHaveBeenNthCalledWith(1, expect.objectContaining({ style: "standard", options: expect.objectContaining({ wallDimensions: true }) }));
  });

  it.each(["bti_plan", "marketing_plan", "hand_drawn"] as const)("обрабатывает тип исходника %s тем же model-agnostic pipeline", async (documentType) => {
    const recognizedScene: FloorPlanScene = { ...scene, document: { type: documentType, confidence: 0.9 } };
    const result = await executeFloorPlanPipeline(input(client(qa(true), qa(true), recognizedScene)));
    expect(result.status).toBe("completed");
    expect(result.scene.document.type).toBe(documentType);
  });

  it("передаёт телеметрию упавшего этапа и ставит failed", async () => {
    const pipelineClient = client(qa(true));
    const failure = Object.assign(new Error("Публичная ошибка анализа"), { telemetry: { ...telemetry("analysis"), error: "Публичная ошибка анализа" } });
    vi.mocked(pipelineClient.analyze).mockRejectedValue(failure);
    const onStatus = vi.fn();
    const onTelemetry = vi.fn();
    await expect(executeFloorPlanPipeline({ ...input(pipelineClient, onStatus), onTelemetry })).rejects.toThrow("Публичная ошибка анализа");
    expect(onStatus.mock.calls.flat()).toEqual(["analyzing", "failed"]);
    expect(onTelemetry).toHaveBeenLastCalledWith([expect.objectContaining({ stage: "analysis", error: "Публичная ошибка анализа" })]);
  });
});
