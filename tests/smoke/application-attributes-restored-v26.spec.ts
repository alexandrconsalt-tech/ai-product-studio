import { expect, test } from "@playwright/test";
import grenlandia from "./fixtures/application-attributes-grenlandia.json";
import unknownTimeCallback from "./fixtures/application-attributes-unknown-time-callback.json";

declare let pipeline: any[];
declare let ctx: any;
declare function validateApplicationAttributesExtractor(key: string, value: unknown): unknown;
declare function applicationAttributesTemporalNormalize(rawExpression: string, context: unknown): any;
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
    promptVersion: stage.promptVersion,
    prompt: stage.prompt,
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
  expect(runtime[3].promptVersion).toBe(27);
  expect(runtime[3].prompt).toContain("При нескольких договорённостях выбери последнюю актуальную подтверждённую договорённость");
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

test("Next Contact нормализует утверждённые разговорные сроки", async ({ page }) => {
  const result = await page.evaluate(() => {
    const context = { call_datetime: "2026-09-28T13:59:00+03:00", timezone: "Europe/Moscow" };
    const cases = [
      "сейчас перезвоню", "прямо сейчас", "сразу", "через 15 минут", "через полчаса",
      "чуть-чуть попозже", "чуть позже", "попозже", "немного позже",
      "через час", "в течение часа", "через 2 часа", "сегодня", "сегодня утром",
      "сегодня днём", "сегодня вечером", "завтра", "завтра утром", "завтра днём",
      "завтра вечером", "в среду", "через 30–40 минут", "с 15 до 16",
      "как освобожусь", "как узнаю", "как получится", "когда будет информация",
      "позже, сегодня вечером, в 18:30",
    ];
    return Object.fromEntries(cases.map(raw => [raw, applicationAttributesTemporalNormalize(raw, context).normalized_datetime]));
  });

  expect(result).toEqual({
    "сейчас перезвоню": "2026-09-28T14:09:00+03:00",
    "прямо сейчас": "2026-09-28T14:09:00+03:00",
    "сразу": "2026-09-28T14:09:00+03:00",
    "через 15 минут": "2026-09-28T14:14:00+03:00",
    "через полчаса": "2026-09-28T14:29:00+03:00",
    "чуть-чуть попозже": "2026-09-28T14:29:00+03:00",
    "чуть позже": "2026-09-28T14:29:00+03:00",
    "попозже": "2026-09-28T14:29:00+03:00",
    "немного позже": "2026-09-28T14:29:00+03:00",
    "через час": "2026-09-28T14:59:00+03:00",
    "в течение часа": "2026-09-28T14:59:00+03:00",
    "через 2 часа": "2026-09-28T15:59:00+03:00",
    "сегодня": "2026-09-28T15:59:00+03:00",
    "сегодня утром": "2026-09-28T10:00:00+03:00",
    "сегодня днём": "2026-09-28T14:00:00+03:00",
    "сегодня вечером": "2026-09-28T19:00:00+03:00",
    "завтра": "2026-09-29T10:00:00+03:00",
    "завтра утром": "2026-09-29T10:00:00+03:00",
    "завтра днём": "2026-09-29T14:00:00+03:00",
    "завтра вечером": "2026-09-29T19:00:00+03:00",
    "в среду": "2026-09-30T10:00:00+03:00",
    "через 30–40 минут": "2026-09-28T14:39:00+03:00",
    "с 15 до 16": "2026-09-28T16:00:00+03:00",
    "как освобожусь": "2026-09-28T15:59:00+03:00",
    "как узнаю": "2026-09-28T15:59:00+03:00",
    "как получится": "2026-09-28T15:59:00+03:00",
    "когда будет информация": "2026-09-28T15:59:00+03:00",
    "позже, сегодня вечером, в 18:30": "2026-09-28T18:30:00+03:00",
  });
});

test("Next Contact использует окончание звонка и передаёт SET только для агента", async ({ page }) => {
  const result = await page.evaluate(() => {
    const normalize = (detected: boolean, actor: string, raw: string | null) => {
      const context = {
        call_datetime: "2026-09-28T13:00:00+03:00",
        call_end_datetime: "2026-09-28T13:59:00+03:00",
        timezone: "Europe/Moscow",
      };
      return applicationAttributesNormalizeNextContact({
        detected, next_contact_at: null, precision: detected ? "exact" : "none",
        action: detected ? "callback" : "none", actor, raw_time_expression: raw,
        evidence: detected ? "Агент подтвердил, что перезвонит." : "Клиент: «Хорошо, я перезвоню».",
        confidence: detected ? 0.95 : 0,
      }, context) as any;
    };
    const agent = normalize(true, "agent", "сейчас перезвоню");
    const client = normalize(false, "none", "через час");
    const gate = buildApplicationAttributesQualityGate({
      attributes: { interest: [], funding_source: "не определено", purchase_term: "не определено", next_contact_date: agent },
      attribute_statuses: { interest: "ready", funding_source: "ready", purchase_term: "ready", next_contact_date: "ready" },
      evidence: { interest: [], funding_source: "", purchase_term: "", next_contact_date: "Агент подтвердил, что перезвонит." },
    });
    return { agent, client, gate, crm: buildApplicationAttributesCrmResult(gate) };
  });

  expect(result.agent).toMatchObject({ detected: true, actor: "agent", next_contact_at: "2026-09-28T14:09:00+03:00" });
  expect(result.gate.decisions.next_contact_date).toBe("AUTO_SAVE");
  expect(result.crm).toMatchObject({
    attributes: { next_contact_date: "2026-09-28T14:09:00+03:00" },
    update_actions: { next_contact_date: "SET" },
  });
  expect(result.client).toMatchObject({ detected: false, actor: "none", next_contact_at: null });
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

test("реальный fixture с обязательством агента без времени получает безопасный fallback", async ({ page }) => {
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
  expect(result.semantic).toMatchObject({
    detected: true,
    next_contact_at: "2026-09-28T13:13:58+03:00",
    actor: "agent",
  });
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
