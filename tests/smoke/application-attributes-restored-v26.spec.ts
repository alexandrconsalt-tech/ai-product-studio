import { expect, test } from "@playwright/test";
import grenlandia from "./fixtures/application-attributes-grenlandia.json";
import unknownTimeCallback from "./fixtures/application-attributes-unknown-time-callback.json";

declare let pipeline: any[];
declare let ctx: any;
declare function validateApplicationAttributesExtractor(key: string, value: unknown): unknown;
declare function applicationAttributesNormalizeNextContact(value: unknown, context: unknown): unknown;
declare function buildApplicationAttributesQualityGate(judge: unknown): any;
declare function buildApplicationAttributesCrmResult(gate: unknown): any;

const projectId = "project_72f7b30d-0d09-49fd-81b7-82a8b8f88c4f";
const projectUrl = `/pipeline-lab-v26.html?projectId=${projectId}&productName=${encodeURIComponent("AI Атрибуты в Заявке")}`;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ projectId }) => {
    localStorage.setItem("selectedLlmProvider", "mock");
    localStorage.removeItem(`pipelineLabV3.pipelineConfig.restored-v26.${projectId}`);
  }, { projectId });
  await page.goto(projectUrl);
});

test("Playground использует точный семиэтапный локальный runtime v26", async ({ page }) => {
  await expect(page.locator("#applicationRuntimeLabel")).toHaveText("Локальный эталон v26 · 7 этапов");
  await expect(page.locator("#stages .stage")).toHaveCount(7);

  const runtime = await page.evaluate(() => pipeline.map((stage) => ({
    outKey: stage.outKey,
    provider: stage.provider,
    model: stage.model,
    responseContract: stage.responseContract,
    actualExecutor: stage.actualExecutor,
  })));

  expect(runtime.map((stage) => stage.outKey)).toEqual([
    "interest_extractor",
    "funding_source_extractor",
    "purchase_term_extractor",
    "next_contact_date_extractor",
    "attributes_judge",
    "attributes_quality_gate",
    "crm_attributes_result",
  ]);
  expect(runtime.slice(0, 5).every((stage) => stage.provider === "ai-tunnel" && stage.model === "gpt-5-mini")).toBe(true);
  expect(runtime.slice(0, 5).map((stage) => stage.responseContract)).toEqual([
    "application_interest_extractor_v1",
    "application_funding_source_extractor_v1",
    "application_purchase_term_extractor_v1",
    "application_next_contact_date_extractor_v1",
    "application_attributes_judge_v1",
  ]);
  expect(runtime.slice(5).every((stage) => stage.actualExecutor === "code")).toBe(true);
});

test("семь этапов проходят сквозным запуском через встроенный provider", async ({ page }) => {
  await page.locator("#sampleBtn").click();
  await page.locator("#runBtn").click();
  await expect(page.locator('[data-application-attributes-result="true"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#runBtn")).toBeEnabled();

  const result = await page.evaluate(() => ctx);
  expect(result.pipeline_execution).toMatchObject({
    steps_total: 7,
    steps_executed: 7,
    steps_successful: 7,
    pipeline_status: "SUCCESS",
  });
  expect(result.attributes_judge.attributes).toMatchObject({
    interest: ["Новостройки"],
    funding_source: "ипотека в процессе",
    purchase_term: "2–3 месяца",
  });
  expect(result.crm_attributes_result.update_actions).toMatchObject({
    interest: "ADD",
    funding_source: "SET",
    purchase_term: "SET",
  });
});

test("локальный contract принимает подтверждённую продажу квартиры без context validator", async ({ page }) => {
  const result = await page.evaluate(() => validateApplicationAttributesExtractor("funding_source_extractor", {
    value: "продажа своей квартиры",
    evidence: "мы продаёмся, быстро берём деньги, едем и заезжаем",
  }));
  expect(result).toEqual({
    value: "продажа своей квартиры",
    evidence: "мы продаёмся, быстро берём деньги, едем и заезжаем",
  });
});

test("Next Contact не переписывает actor агента в client и не выдумывает дату", async ({ page }) => {
  const result = await page.evaluate(() => {
    ctx = {};
    const context = {
      call_datetime: "2026-09-28T12:00:00+03:00",
      timezone: "Europe/Moscow",
      __call_metadata_audit: { mode: "manual" },
    };
    const normalized = applicationAttributesNormalizeNextContact({
      detected: true,
      next_contact_at: null,
      precision: "exact",
      action: "callback",
      actor: "agent",
      raw_time_expression: "Сейчас перезвоню вам. Да позже",
      evidence: "Оператор: «Сейчас перезвоню вам». Клиент: «Хорошо».",
      confidence: 0.9,
    }, context);
    return { semantic: (context as any).next_contact_semantic_result, normalized };
  });

  expect(result.semantic.actor).toBe("agent");
  expect(result.normalized).toMatchObject({
    detected: false,
    next_contact_at: null,
    actor: "none",
  });
  expect(JSON.stringify(result)).not.toContain('"actor":"client"');
});

test("реальный fixture Гренландия сохраняет среду 16:00 как в локальном v26", async ({ page }) => {
  const result = await page.evaluate(({ semantic, createdAt, timezone }) => {
    const context = {
      call_datetime: createdAt,
      timezone,
      __call_metadata_audit: { mode: "manual" },
    };
    return applicationAttributesNormalizeNextContact(semantic, context);
  }, {
    semantic: grenlandia.semantic_result,
    createdAt: grenlandia.communication_created_at,
    timezone: grenlandia.timezone,
  });

  expect(result).toMatchObject({
    detected: true,
    next_contact_at: grenlandia.expected.next_contact_date,
    precision: "exact",
    action: "meeting",
    actor: "agent",
  });
});

test("реальный fixture с неточным callback не получает придуманную дату", async ({ page }) => {
  const result = await page.evaluate(({ semantic, createdAt, timezone }) => {
    const context = {
      call_datetime: createdAt,
      timezone,
      __call_metadata_audit: { mode: "manual" },
    };
    return {
      semantic: applicationAttributesNormalizeNextContact(semantic, context),
      audit: (context as any).next_contact_semantic_result,
    };
  }, {
    semantic: unknownTimeCallback.first_extractor_response,
    createdAt: "2026-09-28T11:13:58+03:00",
    timezone: "Europe/Moscow",
  });

  expect(result.audit).toMatchObject({ detected: true, actor: "agent" });
  expect(result.semantic).toMatchObject({ detected: false, next_contact_at: null, actor: "none" });
});

test("CRM operations применяются после AI результата и не сохраняют неопределённые scalar", async ({ page }) => {
  const result = await page.evaluate(() => {
    const gate = buildApplicationAttributesQualityGate({
      attributes: {
        interest: ["Новостройки"],
        funding_source: "продажа своей квартиры",
        purchase_term: "не определено",
        next_contact_date: null,
      },
      attribute_statuses: {
        interest: "ready",
        funding_source: "ready",
        purchase_term: "ready",
        next_contact_date: "ready",
      },
      evidence: {
        interest: ["Новостройки вас интересуют? Да."],
        funding_source: "Своё продаём.",
        purchase_term: "",
        next_contact_date: "",
      },
    });
    return { gate, crm: buildApplicationAttributesCrmResult(gate) };
  });

  expect(result.gate.decisions).toEqual({
    interest: "AUTO_SAVE",
    funding_source: "AUTO_SAVE",
    purchase_term: "DO_NOT_UPDATE",
    next_contact_date: "DO_NOT_UPDATE",
  });
  expect(result.crm).toMatchObject({
    attributes: {
      interest: null,
      funding_source: "продажа своей квартиры",
      purchase_term: null,
      next_contact_date: null,
    },
    update_actions: {
      interest: "ADD",
      funding_source: "SET",
      purchase_term: "SKIP",
      next_contact_date: "SKIP",
    },
    interest_operations: { add: ["Новостройки"], remove: [], keep: false },
    apply_mode: "ATOMIC_OPERATIONS_ON_LATEST_CRM_STATE",
  });
});
