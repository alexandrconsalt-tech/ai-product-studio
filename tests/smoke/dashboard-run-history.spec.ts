import { expect, test } from "@playwright/test";

test("запуск Pipeline сохраняется в истории Дашборда даже при переполнении полного отчёта", async ({ page }) => {
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key, value) {
      if (key === "ai-product-studio.playground-test-runs.v1" && value.length > 5_000) {
        throw new DOMException("Storage quota exceeded", "QuotaExceededError");
      }
      originalSetItem.call(this, key, value);
    };
  });
  await page.goto("/?view=playground");
  await expect(page.getByRole("heading", { level: 1, name: "Песочница" })).toBeVisible();
  await expect(page.locator('iframe[title="Pipeline Lab v3"]')).toBeVisible();

  await page.evaluate(() => {
    const finishedAt = new Date().toISOString();
    window.postMessage(
      {
        source: "pipeline-lab-v3",
        type: "run-complete",
        productId: "project_transcription_summary_module",
        payload: {
          id: "playground_test_run_quota_e2e",
          productId: "project_transcription_summary_module",
          productName: "Модуль транскрибации и AI-саммари звонков",
          startedAt: new Date(Date.now() - 1_000).toISOString(),
          finishedAt,
          durationMs: 1_000,
          stageCount: 10,
          errorCount: 0,
          warningCount: 0,
          tokens: 100,
          costUsd: 0.01,
          status: "succeeded",
          summary: "Проверочный запуск сохранён.",
          report: { result: { summary: { summary: "Проверочный запуск сохранён." } }, raw: "x".repeat(200_000) },
        },
      },
      "*",
    );
  });

  await expect.poll(() => page.evaluate(() => {
    const raw = window.localStorage.getItem("ai-product-studio.playground-test-runs.v1");
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { state?: { runsByProjectId?: Record<string, Array<{ id?: string }>> } };
    return Object.values(parsed.state?.runsByProjectId ?? {}).flat().some((run) => run.id === "playground_test_run_quota_e2e");
  })).toBe(true);

  await page.goto("/?view=dashboard");
  await expect(page.getByRole("heading", { level: 1, name: "Дашборд" })).toBeVisible();
  await expect(page.getByText("1 запуск(ов) в выборке · 1 всего", { exact: true })).toBeVisible();
  await expect(page.getByText("История запусков", { exact: true })).toBeVisible();
});
