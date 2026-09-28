import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

describe("POST /api/floor-plan", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("не показывает пользователю raw provider error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "secret upstream stack trace" } }), { status: 500 })));
    const form = new FormData();
    form.set("action", "analyze"); form.set("pipelineId", "pipeline-1"); form.set("source", new File(["image"], "plan.png", { type: "image/png" }));
    form.set("width", "100"); form.set("height", "100"); form.set("page", "1"); form.set("apiKey", "secret");
    form.set("baseUrl", "https://api.aitunnel.ru/v1"); form.set("model", "vision-model");
    const response = await POST(new Request("http://localhost/api/floor-plan", { method: "POST", body: form }));
    const payload = await response.json();
    expect(response.status).toBe(502);
    expect(payload.error).toContain("Не удалось распознать планировку");
    expect(payload.error).not.toContain("secret upstream stack trace");
    expect(payload.telemetry).toMatchObject({ stage: "analysis", model: "vision-model", provider: "ai-tunnel", error: payload.error });
  });
});
