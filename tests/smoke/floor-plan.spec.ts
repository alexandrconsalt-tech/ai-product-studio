import { expect, test, type Page } from "@playwright/test";

const scene = {
  document: { type: "bti_plan", confidence: 0.95 },
  floorPlan: { sourceWidth: 1000, sourceHeight: 1000, walls: [{ id: "wall-1", type: "exterior", start: { x: 0.1, y: 0.1 }, end: { x: 0.9, y: 0.1 }, thickness: 0.02, confidence: 0.96 }], rooms: [{ id: "room-1", type: "room", sourceLabel: "1", polygon: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.9, y: 0.9 }, { x: 0.1, y: 0.9 }], area: { value: 20, confidence: 0.98 }, confidence: 0.95 }], doors: [], windows: [], openings: [], balconies: [], fixtures: [], furniture: [], dimensions: [], labels: [] },
  areas: { total: { value: 20, source: "ocr", confidence: 0.98 }, living: null }, sourceFacts: [], warnings: [], confidence: { geometry: 0.95, ocr: 0.98, topology: 0.96, overall: 0.96 }, ambiguities: [],
};
const checkNames = ["roomCount", "topology", "walls", "windows", "doors", "doorSwings", "balconies", "labels", "areas", "dimensions", "fixtures", "hallucinations"];
const checks = Object.fromEntries(checkNames.map((key) => [key, { passed: true, score: 0.98, details: "Совпадает" }]));

function runtimeErrors(page: Page) { const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message)); page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); }); return errors; }
function multipartValue(body: string, name: string): string { return body.match(new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]+)`))?.[1] ?? ""; }

test("AI Floor Plan: configurable pipeline → Vladis reference → QA → result", async ({ page }) => {
  const errors = runtimeErrors(page); const calls: Array<{ action: string; model: string; body: string }> = []; let qaAttempt = 0; let generatedPng = Buffer.alloc(0);
  await page.addInitScript(() => {
    localStorage.setItem("ai-floor-plan.aitunnel-settings.v2", JSON.stringify({ apiKey: "sk-floor-plan-browser-key", baseUrl: "https://api.aitunnel.ru/v1", models: { "model-a": { visionModel: "", imageModel: "", qaModel: "" }, "model-b": { visionModel: "", imageModel: "", qaModel: "" } } }));
    localStorage.setItem("ai-floor-plan.pipeline-settings.v1", JSON.stringify({ version: 1, stages: {
      analysis: { model: "vision-alpha", prompt: "Custom analysis prompt for exact architectural extraction" },
      generation: { model: "image-alpha", prompt: "Custom generation prompt preserving exact geometry" },
      qa: { model: "vision-beta", prompt: "Custom QA prompt comparing original and generated images" },
      fix: { model: "image-beta", prompt: "Custom correction prompt fixing only QA discrepancies" },
    } }));
  });
  await page.route("**/public/aitunnel/models/images", (route) => route.fulfill({ json: { "image-alpha": { provider: "openai", supports_edit: true, max_input_references: 2 }, "image-beta": { provider: "google", supports_edit: true, max_input_references: 2 } } }));
  await page.route("**/public/aitunnel/models/chat", (route) => route.fulfill({ json: { "vision-alpha": { provider: "openai", modalities: { input: ["text", "image"] } }, "vision-beta": { provider: "google", modalities: { input: ["text", "image"] } } } }));
  await page.route("**/api/floor-plan", async (route) => {
    const body = (await route.request().postDataBuffer())?.toString("latin1") ?? ""; const action = multipartValue(body, "action"); const model = multipartValue(body, "model"); calls.push({ action, model, body });
    await new Promise((resolve) => setTimeout(resolve, 120));
    const telemetry = { stage: action === "analyze" ? "analysis" : action === "generate" ? "generation" : action === "fix" ? "fix" : qaAttempt ? "qa-after-fix" : "qa", provider: "ai-tunnel", model, durationMs: 120, usage: { input_tokens: 10, output_tokens: 5 }, costRub: 1.25 };
    if (action === "analyze") return route.fulfill({ json: { scene, promptVersion: "floor-plan-analysis-v1", telemetry } });
    if (action === "generate" || action === "fix") return route.fulfill({ json: { dataUrl: `data:image/png;base64,${generatedPng.toString("base64")}`, mimeType: "image/png", promptVersion: `floor-plan-${action}-v1`, telemetry } });
    const passed = qaAttempt++ > 0;
    return route.fulfill({ json: { qa: { passed, score: passed ? 0.97 : 0.62, errors: passed ? [] : ["Смещена наружная стена"], warnings: [], checks }, promptVersion: "floor-plan-qa-v1", telemetry } });
  });

  await page.goto("/?view=floor-plan");
  await page.getByRole("button", { name: "Пайплайн" }).click();
  await expect(page.getByText("Пайплайн генерации планировки")).toBeVisible();
  await expect(page.getByText("7").first()).toBeVisible();
  await expect(page.getByLabel("Vision-анализ планировки: модель")).toHaveValue("vision-alpha");
  await page.getByLabel("Vision-анализ планировки: промпт").fill("Updated analysis prompt that extracts only visible architecture");
  await page.getByRole("button", { name: "Сохранить пайплайн" }).click();
  expect(await page.evaluate(() => localStorage.getItem("ai-floor-plan.pipeline-settings.v1"))).toContain("Updated analysis prompt");

  await page.getByRole("button", { name: "Тестирование" }).click();
  await page.getByLabel("Планировка Vladis").check();
  generatedPng = await page.screenshot({ type: "png" });
  await page.getByText("Загрузить пример оформления").click();
  await page.locator('input[type="file"][accept^="image/png"]').setInputFiles({ name: "vladis-reference.png", mimeType: "image/png", buffer: generatedPng });
  await page.locator('input[type="file"][accept^=".jpg"]').setInputFiles({ name: "plan.png", mimeType: "image/png", buffer: generatedPng });
  await expect(page.getByText("plan.png", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Создать 2D-планировку" }).click();
  await expect(page.getByText("Vision-анализ", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("Готово", { exact: true }).last()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("QA пройдена", { exact: true })).toBeVisible();
  expect(calls.map((call) => call.action)).toEqual(["analyze", "generate", "verify", "fix", "verify"]);
  expect(calls.map((call) => call.model)).toEqual(["vision-alpha", "image-alpha", "vision-beta", "image-beta", "vision-beta"]);
  expect(calls[0].body).toContain("Updated analysis prompt");
  expect(calls[1].body).toContain("vladis-reference.png");
  expect(calls.every((call) => call.body.includes("sk-floor-plan-browser-key"))).toBe(true);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Скачать" }).click();
  expect((await downloadPromise).suggestedFilename()).toContain("floor-plan.png");
  await page.getByRole("button", { name: "Использовать" }).click();
  await expect(page.getByText("Эта планировка выбрана для использования.")).toBeVisible();
  const evaluation = page.getByText("Ручная оценка").locator("..");
  await evaluation.getByLabel("Соответствие исходнику (1–5)").selectOption("5");
  await evaluation.getByRole("button", { name: "Сохранить оценку" }).click();
  await expect(page.getByText("История планировок")).toBeVisible();
  await page.getByRole("button", { name: "Benchmark" }).click();
  await expect(page.getByText("Документов: 1", { exact: false })).toBeVisible();
  expect(errors, errors.join("\n")).toEqual([]);
});
