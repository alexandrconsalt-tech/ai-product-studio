import { afterEach, describe, expect, it, vi } from "vitest";
import type { FloorPlanQa, FloorPlanScene } from "../domain/schema";
import { AiTunnelFloorPlanImageProvider, AiTunnelFloorPlanVisionProvider } from "./server-adapters";

const source = { bytes: new Uint8Array([1, 2, 3]), mimeType: "image/png", filename: "plan.png", width: 100, height: 100, page: 1 };
const scene: FloorPlanScene = {
  document: { type: "scan", confidence: 1 }, floorPlan: { sourceWidth: 100, sourceHeight: 100, walls: [], rooms: [], doors: [], windows: [], openings: [], balconies: [], fixtures: [], furniture: [], dimensions: [], labels: [] },
  areas: { total: null, living: null }, sourceFacts: [], warnings: [], confidence: { geometry: 1, ocr: 1, topology: 1, overall: 1 }, ambiguities: [],
};
const qaChecks = Object.fromEntries(["roomCount", "topology", "walls", "windows", "doors", "doorSwings", "balconies", "labels", "areas", "dimensions", "fixtures", "hallucinations"].map((key) => [key, { passed: true, score: 1, details: "ok" }])) as FloorPlanQa["checks"];
const qa: FloorPlanQa = { passed: true, score: 0.99, errors: [], warnings: [], checks: qaChecks };

describe("AI Tunnel floor-plan adapters", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("отправляет два reference image на исправление и сохраняет стоимость", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [{ b64_json: "AQID", media_type: "image/png" }], model: "image-model", usage: { cost_rub: 3.4 } })));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new AiTunnelFloorPlanImageProvider("secret", "https://api.aitunnel.ru/v1", "image-model").generate([source, source], "fix");
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.aitunnel.ru/v1/images/generations");
    expect(body.input_references).toHaveLength(2);
    expect(result.costRub).toBe(3.4);
  });

  it("использует strict FloorPlan JSON schema для анализа", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(scene) } }], model: "vision-model", usage: { prompt_tokens: 10 } })));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new AiTunnelFloorPlanVisionProvider("secret", "https://api.aitunnel.ru/v1", "vision-model").analyze(source, "analyze");
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.response_format).toMatchObject({ type: "json_schema", json_schema: { name: "floor_plan_analysis", strict: true } });
    const wallSchema = body.response_format.json_schema.schema.properties.floorPlan.properties.walls.items;
    expect(body.response_format.json_schema.schema.$schema).toBeUndefined();
    expect(wallSchema.required).toContain("sourceReference");
    expect(wallSchema.properties.sourceReference.anyOf).toContainEqual({ type: "null" });
    expect(result.scene.floorPlan.rooms).toEqual([]);
  });

  it("повторяет Vision-запрос в JSON Mode, если провайдер отклонил strict schema", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "Invalid JSON schema" } }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(scene) } }], model: "vision-model" })));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new AiTunnelFloorPlanVisionProvider("secret", "https://api.aitunnel.ru/v1", "vision-model").analyze(source, "analyze");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).response_format).toEqual({ type: "json_object" });
    expect(result.scene.document.type).toBe("scan");
  });

  it("не повторяет Vision-запрос при ошибке авторизации", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { message: "Unauthorized" } }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new AiTunnelFloorPlanVisionProvider("secret", "https://api.aitunnel.ru/v1", "vision-model").analyze(source, "analyze")).rejects.toThrow("Unauthorized");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("передаёт original и generated в QA и валидирует ответ", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(qa) } }], model: "qa-model", usage: { cost_rub: 0.7 } })));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new AiTunnelFloorPlanVisionProvider("secret", "https://api.aitunnel.ru/v1", "qa-model").verify(source, source, "verify");
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.messages[0].content.filter((part: { type: string }) => part.type === "image_url")).toHaveLength(2);
    expect(body.response_format.json_schema.name).toBe("floor_plan_qa");
    expect(result.qa).toEqual({ ...qa, checks: Object.fromEntries(Object.entries(qa.checks).map(([key, check]) => [key, { ...check, details: "Проверка пройдена." }])) });
  });

  it("не пропускает QA ниже порога 0.9 даже при passed=true от модели", async () => {
    const lowScore = { ...qa, score: 0.89 };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(lowScore) } }], model: "qa-model" }))));
    const result = await new AiTunnelFloorPlanVisionProvider("secret", "https://api.aitunnel.ru/v1", "qa-model").verify(source, source, "verify");
    expect(result.qa.passed).toBe(false);
  });
});
