import { expect, test, type Page } from "@playwright/test";

type ScreenExpectation = {
  view: string;
  heading: string;
  marker: string;
};

const screens: ScreenExpectation[] = [
  { view: "product", heading: "Продукт", marker: "Создать продукт" },
  { view: "playground", heading: "Песочница", marker: "Выберите продукт" },
  { view: "summary-review", heading: "Оценка качества Summary", marker: "Запуски Pipeline" },
  { view: "summary-report", heading: "Отчёт по оценке", marker: "AI Score vs Human Score" },
  { view: "dashboard", heading: "Дашборд", marker: "Период истории" },
  { view: "settings", heading: "Настройки", marker: "API-ключи" },
];

function collectRuntimeErrors(page: Page): string[] {
  const errors: string[] = [];

  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });

  return errors;
}

test("ключевые экраны открываются без runtime-ошибок", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);

  for (const screen of screens) {
    const response = await page.goto(`/?view=${screen.view}`, { waitUntil: "domcontentloaded" });

    expect(response?.ok(), `${screen.view}: HTTP-ответ должен быть успешным`).toBeTruthy();
    await expect(page.getByRole("heading", { level: 1, name: screen.heading }).first()).toBeVisible();
    await expect(page.getByText(screen.marker, { exact: false }).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/Runtime ZodError|Runtime Error|Application error/i);
  }

  expect(runtimeErrors, runtimeErrors.join("\n")).toEqual([]);
});
