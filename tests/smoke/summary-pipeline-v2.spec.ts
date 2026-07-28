import { expect, test, type Page } from "@playwright/test";

const evidence = [{ speaker: "client", quote: "Бюджет до восьми миллионов", turn_id: "turn-2" }];

async function mockSummaryV2Llm(page: Page) {
  await page.route("**/api/summary-v2-llm", async (route) => {
    const body = route.request().postDataJSON() as { schemaName: string; model: string };
    let output: unknown;
    if (body.schemaName === "call_intelligence_v2") {
      output = {
        call_type: "OBJECT_INQUIRY",
        client_intent: { value: "Купить новостройку", evidence },
        facts: [{ id: "fact-budget", category: "budget", value: "до 8 млн ₽", evidence }],
        requirements: [{ id: "req-object", category: "property_type", value: "новостройка", evidence }],
        objections: [], open_questions: [],
        agreements: [{ id: "agreement-send", category: "agreement", value: "отправить варианты", evidence }],
        next_step: { status: "CONFIRMED", action: "Отправить варианты", responsible: "AGENT", deadline: null, channel: "WhatsApp", evidence },
        call_outcome: { type: "FOLLOW_UP_REQUIRED", description: "Отправка вариантов", evidence },
        structured_attributes: { interested_in: ["Новостройки"], funding_source: "ипотека одобрена", purchase_timeline: "2–3 месяца" },
        financial_data: {
          budget: { amount_min: null, amount_max: 8000000, currency: "RUB", evidence },
          funding_source: { value: "ипотека одобрена", evidence },
          mortgage_status: { value: "APPROVED", evidence },
          down_payment: { amount: null, currency: "RUB", evidence: [] },
          sale_of_existing_property: { value: "NOT_DEFINED", evidence: [] },
        },
        critical_information: ["Бюджет до 8 млн ₽"],
        summary_inputs: { primary_goal: "Купить новостройку", main_result: "Отправка вариантов", key_requirements: ["новостройка"], main_objection: null, agreement_and_next_step: "Отправить варианты" },
      };
    } else if (body.schemaName === "evidence_verifier_v2") {
      output = {
        items: [
          { id: "fact-budget", verdict: "VERIFIED", reason: "Подтверждено" },
          { id: "req-object", verdict: "VERIFIED", reason: "Подтверждено" },
          { id: "agreement-send", verdict: "VERIFIED", reason: "Подтверждено" },
        ],
        next_step: { verdict: "VERIFIED", reason: "Подтверждено" },
        outcome: { verdict: "VERIFIED", reason: "Подтверждено" },
        structured_attributes: { interested_in: "VERIFIED", funding_source: "VERIFIED", purchase_timeline: "VERIFIED" },
        issues: [],
      };
    } else if (body.schemaName === "summary_generator_v2") {
      output = {
        overview: "Клиент ищет новостройку с бюджетом до 8 млн ₽. Согласована отправка подходящих вариантов.",
        key_facts: ["Бюджет до 8 млн ₽", "Ипотека одобрена"],
        quotes: ["Бюджет до восьми миллионов"],
        agreement_next_step: "Агент отправит варианты в WhatsApp.",
      };
    } else {
      output = {
        criterion: body.schemaName.replace("_judge_v2", ""),
        status: "SUCCESS", decision: "PASS", score: 100, confidence: 0.92, critical_error: false,
        issues: [], passed_checks: ["Проверка пройдена"], failed_checks: [], recommendation: null,
      };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ output, model: body.model }) });
  });
}

test("Summary Pipeline v2 независимо запускается и сохраняет отчёт после перезагрузки", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("selectedLlmProvider", "openai-direct");
    window.localStorage.setItem("pipelineLabV3.openaiApiKey", "test-key");
  });
  await mockSummaryV2Llm(page);
  await page.goto("/?view=playground");
  await page.getByLabel("Выбрать продукт").selectOption("project_summary_pipeline_v2");

  await expect(page.getByRole("heading", { name: "Summary Pipeline v2", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Запустить Summary Pipeline v2" }).click();

  await expect(page.getByText("AUTO_SAVE", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("100.0%")).toBeVisible();
  await expect(page.getByText("PUBLISHED", { exact: true })).toBeVisible();
  await expect(page.getByText("CRM Publish v2", { exact: true })).toBeVisible();
  await expect(page.getByText("Оценка: не рассчитана").first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Запустить Summary Pipeline v2" })).toBeVisible();
  await page.goto("/?view=dashboard");
  await page.getByLabel("Выбрать продукт").selectOption("project_summary_pipeline_v2");
  await expect(page.getByTestId("run-history-row")).toHaveCount(1);
  await page.getByTestId("run-history-row").click();
  await expect(page.getByText("Итоговое саммари")).toBeVisible();
  await expect(page.getByText("Клиент ищет новостройку", { exact: false }).first()).toBeVisible();
});

test("v1 остаётся отдельным доступным продуктом", async ({ page }) => {
  await page.goto("/?view=playground");
  const selector = page.getByLabel("Выбрать продукт");
  await expect(selector.locator('option[value="project_transcription_summary_module"]')).toHaveCount(1);
  await expect(selector.locator('option[value="project_summary_pipeline_v2"]')).toHaveCount(1);
});
