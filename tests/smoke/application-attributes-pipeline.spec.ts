import { expect, test, type Page } from "@playwright/test";
import eventCase from "./fixtures/application-attributes-event-contact.json";
import grenlandia from "./fixtures/application-attributes-grenlandia.json";
import realCases from "./fixtures/application-attributes-real-cases.json";
import unknownTimeCallback from "./fixtures/application-attributes-unknown-time-callback.json";
import clientWeekendCallback from "./fixtures/application-attributes-client-weekend-callback.json";

declare let ctx: any;
declare let pipeline: any[];
declare let callModelWithTransientRetry: (...args: any[]) => Promise<any>;
declare let runStage: (...args: any[]) => Promise<any>;
declare let callAiTunnel: (...args: any[]) => Promise<any>;
declare function applicationAttributesTemporalNormalize(text: string, context: any): any;
declare function applicationAttributesCallMetadata(metadata: any): any;
declare function runPipeline(): Promise<void>;
declare function savePipelineConfig(): void;

const projectId = "project_72f7b30d-0d09-49fd-81b7-82a8b8f88c4f";
const projectUrl = `/pipeline-lab-v3.html?projectId=${projectId}&productName=${encodeURIComponent("AI Атрибуты в Заявке")}`;
const playgroundUrl = `/?view=playground&projectId=${projectId}`;
const configKey = `pipelineLabV3.pipelineConfig.${projectId}`;
const metadataKey = `pipelineLabV3.applicationCommunicationMetadata.${projectId}`;
const absent = () => ({
  interest_extractor: { status: "not_determined", value: null, evidence: [], declined_values: [], decline_evidence: [] },
  funding_source_extractor: { status: "not_determined", value: null, evidence: "" },
  purchase_term_extractor: { status: "not_determined", value: null, evidence: "" },
  next_contact_date_extractor: { status: "not_determined", detected: false, next_contact_at: null, precision: "none", action: "none", actor: "none", raw_time_expression: null, evidence: null, confidence: 0, event_anchor: null },
});
const candidates = (): Record<string, any> => ({
  ...absent(),
  interest_extractor: { status: "determined", value: ["Новостройки", "Ипотека"], evidence: ["Интересует новостройка", "Нужна ипотечная консультация"], declined_values: [], decline_evidence: [] },
  funding_source_extractor: { status: "determined", value: "ипотека одобрена", evidence: "Ипотека одобрена" },
  purchase_term_extractor: { status: "determined", value: "2–3 месяца", evidence: "Покупка через два месяца" },
});
const contact = (expression: string, precision = "exact") => ({ status: "determined", detected: true, next_contact_at: null, precision, action: "callback", actor: "agent", raw_time_expression: expression, evidence: `Агент: Перезвоню ${expression}`, confidence: .96, event_anchor: null });
const contactWithoutTime = (action: "callback" | "message", evidence: string) => ({
  status: "determined", detected: true, next_contact_at: null, precision: "none", action,
  actor: "agent", raw_time_expression: null, evidence, confidence: .9, event_anchor: null,
});

async function installProvider(page: Page, outputs: Record<string, any>, faults: Record<string, string> = {}, delays: Record<string, number> = {}) {
  await page.evaluate(({ outputs, faults, delays }) => {
    const state = window as any;
    state.__testReports = [];
    state.__testCalls = [];
    const originalStage = state.__testOriginalStage || runStage;
    state.__testOriginalStage = originalStage;
    runStage = async (stage, context) => {
      const result = await originalStage(stage, context);
      state.__testReports.push({ stage, report: result });
      return result;
    };
    callModelWithTransientRetry = async (prompt, model, provider, temperature, maxTokens, format) => {
      const key = format.json_schema.name.replace(/^application_/, "").replace(/_v[234]$/, "");
      state.__testCalls.push({ key, prompt, schema: format.json_schema.name, maxTokens });
      if (delays[key]) await new Promise(resolve => setTimeout(resolve, delays[key]));
      if (faults[key] === "network") throw new Error("Provider 503 temporary unavailable");
      if (faults[key] === "json") return { text: "{broken", tokens: 1, actualModel: model, actualProvider: "Test provider" };
      if (faults[key] === "truncated_third" && state.__testCalls.filter((c: any) => c.key === key).length === 3)
        return { text: "", tokens: 1, finishReason: "length", actualModel: model, actualProvider: "Test provider" };
      if ((faults[key] === "truncated_always" || faults[key] === "truncated_once") && (faults[key] === "truncated_always" || state.__testCalls.filter((c: any) => c.key === key).length === 1))
        return { text: "", tokens: 1, finishReason: "length", actualModel: model, actualProvider: "Test provider" };
      let output = outputs[key];
      if (key === "next_contact_date_extractor" && Array.isArray(output))
        output = output[Math.min(state.__testCalls.filter((c: any) => c.key === key).length - 1, output.length - 1)];
      if (["funding_source_extractor", "purchase_term_extractor"].includes(key) && output) output = { context: null, ...output };
      if (key === "attributes_judge") {
        const judgeOverrides = output;
        const match = prompt.match(/ПОДГОТОВЛЕННЫЕ ВХОДЫ EXTRACTOR:\s*\n([^\n]+)/);
        const inputs = JSON.parse(match![1]);
        output = Object.fromEntries(Object.entries(inputs).map(([attribute, input]: [string, any]) => [attribute, {
          verdict: input.status === "technical_error" ? "technical_error" : input.result.status === "not_determined" ? "not_determined" : "accepted",
          status: input.result?.status || "not_determined", reason: "Контролируемая тестовая проверка",
          ...(attribute === "next_contact_date" ? { corrected_value: null } : {}),
          ...(["funding_source", "purchase_term"].includes(attribute) ? { context_verdict: input.result?.context ? "accepted" : "not_present", context_reason: "Проверено" } : {}),
        }]));
        for (const [attribute, override] of Object.entries(judgeOverrides || {}))
          output[attribute] = { ...output[attribute], ...(override as Record<string, any>) };
        for (const [attribute, fault] of Object.entries(faults)) {
          if (fault === "judge_missing") delete output[attribute];
          if (fault === "judge_reject") output[attribute].verdict = "rejected";
          if (fault === "judge_accept_undetermined") output[attribute].verdict = "accepted";
          if (fault === "context_reject") output[attribute].context_verdict = "rejected";
          if (fault === "judge_change_status") output[attribute].status = "explicitly_declined";
          if (fault === "judge_add_value") output[attribute].value = "invented";
        }
      }
      return { text: JSON.stringify(output), tokens: 100, finishReason: "stop", actualModel: model, actualProvider: "Test provider", structuredOutputApplied: true };
    };
  }, { outputs, faults, delays });
}
async function run(page: Page, transcript = "Клиент: Интересует новостройка. Нужна ипотечная консультация. Ипотека одобрена. Покупка через два месяца.\nАгент: Перезвоню завтра в 15:00.") {
  await page.locator("#transcript").fill(transcript);
  await page.locator("#runBtn").click();
  await expect(page.locator('[data-application-attributes-result="true"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#runBtn")).toBeEnabled();
  return page.evaluate(() => ({ result: ctx, reports: (window as any).__testReports, calls: (window as any).__testCalls }));
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ metadataKey }) => {
    localStorage.setItem("selectedLlmProvider", "mock");
    if (!localStorage.getItem(metadataKey)) localStorage.setItem(metadataKey, JSON.stringify({ communication_created_at: "2026-08-13T10:00:00", timezone: "Europe/Moscow" }));
  }, { metadataKey });
});

test("четыре Extractor работают одновременно, Judge получает фиксированный порядок", async ({ page }) => {
  await page.goto(projectUrl);
  await installProvider(page, { ...candidates(), next_contact_date_extractor: contact("завтра в 15:00") }, {}, {
    interest_extractor: 400, funding_source_extractor: 100, purchase_term_extractor: 200, next_contact_date_extractor: 300,
  });
  const { result, calls } = await run(page);
  expect(result.pipeline_performance.extractors_wall_time_ms).toBeLessThan(800);
  expect(result.pipeline_performance.extractors_sum_duration_ms).toBeGreaterThanOrEqual(900);
  expect(calls.slice(0, 4).map((call: any) => call.key)).toEqual([
    "interest_extractor", "funding_source_extractor", "purchase_term_extractor", "next_contact_date_extractor",
  ]);
  expect(calls.at(-1).key).toBe("attributes_judge");
  const judgeInput = JSON.parse(calls.at(-1).prompt.match(/ПОДГОТОВЛЕННЫЕ ВХОДЫ EXTRACTOR:\s*\n([^\n]+)/)[1]);
  expect(Object.keys(judgeInput)).toEqual(["interest", "funding_source", "purchase_term", "next_contact_date"]);
  expect(result.pipeline_performance.judge_duration_ms).toBeGreaterThanOrEqual(0);
});

test("прямая ссылка Песочницы выбирает AI Атрибуты и показывает семь этапов", async ({ page }) => {
  await page.goto(playgroundUrl);
  await expect(page.getByRole("combobox", { name: "Выбрать продукт" })).toHaveValue(projectId);
  const frame = page.frameLocator('iframe[title="Pipeline Lab v3"]');
  await expect(frame.locator("#productTitle")).toHaveText("AI Атрибуты в Заявке");
  await expect(frame.locator("#stages .stage")).toHaveCount(7);
  await expect(frame.locator("#stages")).not.toContainText("Summary");
});

test("сбой Funding не отменяет остальные Extractor и доходит до Judge", async ({ page }) => {
  await page.goto(projectUrl);
  await installProvider(page, { ...candidates(), next_contact_date_extractor: contact("завтра в 15:00") }, { funding_source_extractor: "network" }, {
    interest_extractor: 120, funding_source_extractor: 30, purchase_term_extractor: 90, next_contact_date_extractor: 60,
  });
  const { result, calls } = await run(page);
  expect(calls.filter((call: any) => call.key.endsWith("extractor"))).toHaveLength(4);
  expect(result.interest_extractor.status).toBe("determined");
  expect(result.purchase_term_extractor.status).toBe("determined");
  expect(result.next_contact_date_extractor.status).toBe("determined");
  const judgeInput = JSON.parse(calls.at(-1).prompt.match(/ПОДГОТОВЛЕННЫЕ ВХОДЫ EXTRACTOR:\s*\n([^\n]+)/)[1]);
  expect(judgeInput.funding_source.status).toBe("technical_error");
  expect(judgeInput.interest.status).toBe("ready");
  expect(judgeInput.purchase_term.status).toBe("ready");
  expect(judgeInput.next_contact_date.status).toBe("ready");
  expect(result.attributes_quality_gate.decisions.funding_source).toBe("TECHNICAL_ERROR");
  expect(result.crm_attributes_result.update_actions.funding_source).toBe("ERROR");
});

test("параллельный и последовательный запуск дают одинаковый бизнес-результат", async ({ page }) => {
  const delays = { interest_extractor: 400, funding_source_extractor: 100, purchase_term_extractor: 200, next_contact_date_extractor: 300 };
  const sequentialRoute = async (route: any) => {
    const response = await route.fetch();
    const body = (await response.text()).replace("const parallelExtractors=IS_APPLICATION_ATTRIBUTES_PROJECT", "const parallelExtractors=false");
    await route.fulfill({ response, body });
  };
  const cases = [
    { transcript: "Клиент: Интересует новостройка. Нужна ипотечная консультация. Ипотека одобрена. Покупка через два месяца.\nАгент: Перезвоню завтра в 15:00.", outputs: { ...candidates(), next_contact_date_extractor: contact("завтра в 15:00") } },
    { transcript: "Клиент: Пока не определился.\nАгент: Понял.", outputs: absent() },
    { transcript: clientWeekendCallback.transcript, outputs: { ...absent(), next_contact_date_extractor: { ...contact("на выходных", "range"), actor: "client", evidence: "Клиент: на выходных я вам позвоню" } } },
  ];
  const semantic = (result: any) => ({
    extractors: Object.fromEntries(["interest_extractor", "funding_source_extractor", "purchase_term_extractor", "next_contact_date_extractor"].map(key => [key, result[key]])),
    judge_verdicts: result.attributes_judge.judge_verdicts,
    gate_decisions: result.attributes_quality_gate.decisions,
    values_for_save: result.attributes_quality_gate.values_for_save,
    attributes: result.crm_attributes_result.attributes,
    update_actions: result.crm_attributes_result.update_actions,
    pending_attributes: result.crm_attributes_result.pending_attributes,
    next_contact_resolution: result.crm_attributes_result.next_contact_resolution,
    declined_interest_values: result.crm_attributes_result.declined_interest_values,
  });
  for(const [index, regression] of cases.entries()){
    await page.goto(projectUrl);
    await installProvider(page, regression.outputs, {}, index===0?delays:{});
    const parallel=(await run(page,regression.transcript)).result;
    await page.route("**/pipeline-lab-v3.html?*",sequentialRoute);
    await page.goto(projectUrl);
    await installProvider(page,regression.outputs,{},index===0?delays:{});
    const sequential=(await run(page,regression.transcript)).result;
    await page.unroute("**/pipeline-lab-v3.html?*",sequentialRoute);
    expect(semantic(parallel)).toEqual(semantic(sequential));
    expect(parallel.pipeline_performance.extractors_wall_time_ms).not.toBeNull();
    expect(sequential.pipeline_performance.extractors_wall_time_ms).toBeNull();
    expect(parallel.pipeline_performance.llm_total_tokens).toBe(sequential.pipeline_performance.llm_total_tokens);
    expect(parallel.pipeline_performance.llm_total_cost).toBe(sequential.pipeline_performance.llm_total_cost);
    if(index===0){
      expect(parallel.pipeline_performance.pipeline_wall_time_ms).toBeLessThan(sequential.pipeline_performance.pipeline_wall_time_ms);
      console.log("ATTRIBUTES_BENCHMARK",JSON.stringify({sequential:sequential.pipeline_performance,parallel:parallel.pipeline_performance}));
    }
  }
});

test("AI Tunnel передаёт reasoning только по настройке и сохраняет usage", async ({ page }) => {
  await page.goto(projectUrl);
  const observed = await page.evaluate(async () => {
    localStorage.setItem("aiTunnelApiKey", "test-only-key");
    const requests: any[] = [];
    const originalFetch = window.fetch;
    window.fetch = async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ choices: [{ message: { content: "{}" }, finish_reason: "stop" }], usage: {
        prompt_tokens: 12, completion_tokens: 8, total_tokens: 20, completion_tokens_details: { reasoning_tokens: 5 }, cost_rub: 0.02,
      } }), { status: 200 });
    };
    try {
      const base = await callAiTunnel("test", "gpt-5-mini", 0, 2000);
      const configured = await callAiTunnel("test", "gpt-5-mini", 0, 2000, null, { reasoningEffort: "low" });
      return { requests, base: base.providerAudit, configured: configured.providerAudit };
    } finally { window.fetch = originalFetch; }
  });
  expect(observed.requests[0].reasoning).toBeUndefined();
  expect(observed.requests[1].reasoning).toEqual({ effort: "low" });
  expect(observed.base).toMatchObject({ input_tokens: 12, output_tokens: 8, reasoning_tokens: 5, total_tokens: 20, cost_rub: 0.02, provider_finish_reason: "stop" });
  expect(observed.configured).toMatchObject(observed.base);
});

test("миграция v28 обновляет контракт и сохраняет оригинал, модели и историю", async ({ page }) => {
  await page.addInitScript(({ configKey }) => {
    const stages = ["interest_extractor", "funding_source_extractor", "purchase_term_extractor", "attributes_judge", "attributes_quality_gate", "crm_attributes_result"].map(outKey => ({ outKey, enabled: true, type: outKey === "attributes_judge" ? "check" : "llm", name: outKey, prompt: "Старый пользовательский промпт {{transcript}}", promptVersion: 2, promptEdited: true, model: "gpt-5-mini", provider: "ai-tunnel", maxTokens: 3210 }));
    localStorage.setItem(configKey, JSON.stringify({ version: 14, stages, deletedStageOutKeys: [] }));
    localStorage.setItem("ai-product-studio.playground-test-runs.v1", "existing-history");
  }, { configKey });
  await page.goto(projectUrl);
  const value = await page.evaluate(({ configKey }) => ({
    saved: JSON.parse(localStorage.getItem(configKey)!),
    before: JSON.parse(localStorage.getItem(configKey + ".before-v27")!),
    history: localStorage.getItem("ai-product-studio.playground-test-runs.v1"),
    runtime: pipeline,
  }), { configKey });
  expect(value.before.stages).toHaveLength(6);
  expect(value.before.stages[0].prompt).toContain("Старый пользовательский");
  expect(value.runtime).toHaveLength(7);
  expect(value.runtime[0]).toMatchObject({ promptVersion: 33, maxTokens: 3210, model: "gpt-5-mini", responseContract: "application_interest_extractor_v3" });
  expect(value.history).toBe("existing-history");
  await page.reload();
  expect(await page.evaluate(key => localStorage.getItem(key + ".before-v27"), configKey)).toBe(JSON.stringify(value.before));
});

test("новые правки промпта сохраняются после reload; runtime передаёт transcript один раз", async ({ page }) => {
  await page.goto(projectUrl);
  await page.evaluate(() => {
    const stage = pipeline[0];
    stage.prompt += "\nДополнительное правило пользователя. {{transcript}}";
    stage.promptSource = "user_override"; stage.promptEdited = true;
    savePipelineConfig();
  });
  await page.reload();
  expect(await page.evaluate(() => pipeline[0].prompt)).toContain("Дополнительное правило пользователя");
  await installProvider(page, absent());
  const transcript = "Клиент: UNIQUE_TRANSCRIPT_PERSISTENCE_123";
  const { calls } = await run(page, transcript);
  expect(calls).toHaveLength(5);
  for (const call of calls) expect(call.prompt.split(transcript)).toHaveLength(2);
});

test("user_override отправляет пять коротких промптов без legacy policy и сохраняет structured output", async ({ page }) => {
  await page.goto(projectUrl);
  const keys = ["interest_extractor", "funding_source_extractor", "purchase_term_extractor", "next_contact_date_extractor", "attributes_judge"];
  const templates = Object.fromEntries(keys.map(key => [key, `Актуальный пользовательский prompt ${key}: {{transcript}}`])) as Record<string, string>;
  await page.evaluate(templates => {
    for (const stage of pipeline.filter(stage => templates[stage.outKey])) {
      stage.prompt = templates[stage.outKey];
      stage.promptSource = "user_override";
      stage.promptEdited = true;
      stage.promptVersion = 31;
    }
    savePipelineConfig();
  }, templates);
  await page.reload();
  expect(await page.evaluate(() => Object.fromEntries(pipeline.filter(stage => stage.promptSource === "user_override").map(stage => [stage.outKey, stage.prompt])))).toMatchObject(templates);
  await installProvider(page, { ...candidates(), next_contact_date_extractor: contact("завтра в 15:00") });
  const transcript = "Клиент: UNIQUE_OVERRIDE_TRANSCRIPT_456.\nАгент: Перезвоню завтра в 15:00.";
  const { result, calls, reports } = await run(page, transcript);
  expect(calls).toHaveLength(5);
  expect(reports).toHaveLength(7);
  expect(result.pipeline_execution).toMatchObject({ steps_total: 7, steps_executed: 7 });
  const expectedSchemas: Record<string, string> = {
    interest_extractor: "application_interest_extractor_v3",
    funding_source_extractor: "application_funding_source_extractor_v3",
    purchase_term_extractor: "application_purchase_term_extractor_v3",
    next_contact_date_extractor: "application_next_contact_date_extractor_v4",
    attributes_judge: "application_attributes_judge_v4",
  };
  for (const key of keys) {
    const call = calls.find((item: any) => item.key === key);
    const report = reports.find((item: any) => item.stage.outKey === key).report;
    expect(call.schema).toBe(expectedSchemas[key]);
    expect(call.prompt).toBe(report.resolved_prompt);
    expect(call.prompt).toContain(templates[key].replace("{{transcript}}", transcript));
    expect(call.prompt.split(transcript)).toHaveLength(2);
    expect(call.prompt).not.toContain("ОБЯЗАТЕЛЬНЫЙ АЛГОРИТМ ЧЕТЫРЁХ АТРИБУТОВ v33");
    expect(call.prompt).not.toContain("КОНТЕКСТ ПЕРЕУСТУПКИ И СРОКА СДАЧИ v33");
    expect(call.prompt).not.toContain("ПРОВЕРКА ПЕРЕУСТУПКИ И ВСТРЕЧИ v33");
    expect(report.contract_audit).toMatchObject({ response_schema_id: expectedSchemas[key], parser_schema_id: expectedSchemas[key], structured_output_requested: true });
    expect(report.parseErr).toBeNull();
  }
  for (const key of keys.slice(0, 4)) expect(calls.find((item: any) => item.key === key).prompt).toBe(templates[key].replace("{{transcript}}", transcript));
  const judgePrompt = calls.find((item: any) => item.key === "attributes_judge").prompt;
  expect(judgePrompt).toContain("ПОДГОТОВЛЕННЫЕ ВХОДЫ EXTRACTOR:\n");
  expect(judgePrompt).toContain('"interest":{"status":"ready"');
});

test("старые policy-хвосты в сохранённом override не попадают в resolved_prompt", async ({ page }) => {
  await page.goto(projectUrl);
  await page.evaluate(() => {
    const stage = pipeline.find(item => item.outKey === "funding_source_extractor")!;
    const state = window as any;
    stage.prompt = "Текущий пользовательский prompt: {{transcript}}"
      + "\n\n" + state.__AI_APPLICATION_ATTRIBUTES_V30_ADDITIONS__.funding_source_extractor
      + "\n\n" + state.__AI_APPLICATION_ATTRIBUTES_V32_ADDITIONS__.funding_source_extractor
      + "\n\n" + state.ApplicationAttributesPolicy.policyFor("funding_source_extractor");
    stage.promptSource = "user_override";
    stage.promptEdited = true;
    savePipelineConfig();
  });
  await page.reload();
  await installProvider(page, absent());
  const transcript = "Клиент: LEGACY_SUFFIX_TRANSCRIPT_789";
  const { calls, reports } = await run(page, transcript);
  const prompt = calls.find((item: any) => item.key === "funding_source_extractor").prompt;
  expect(prompt).toBe(`Текущий пользовательский prompt: ${transcript}`);
  expect(reports.find((item: any) => item.stage.outKey === "funding_source_extractor").report.resolved_prompt).toBe(prompt);
});

test("все четыре атрибута проходят UI → Judge → deterministic Gate → CRM и экспорт", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(projectUrl);
  await installProvider(page, { ...candidates(), next_contact_date_extractor: contact("завтра в 15:00") });
  const { result, reports, calls } = await run(page);
  expect(result.crm_attributes_result.attributes).toEqual({ interest: ["Новостройки", "Ипотека"], funding_source: "ипотека одобрена", purchase_term: "2–3 месяца", next_contact_date: "2026-08-14T15:00:00+03:00" });
  expect(reports).toHaveLength(7);
  expect(calls).toHaveLength(5);
  for (const { report } of reports.slice(5)) expect(report).toMatchObject({ tokens: 0, cost: 0, actual_model: "code", resolved_prompt: null, contract_audit: { execution_type: "deterministic", contract_version: "v5" } });
  for (const { stage, report } of reports.slice(0, 5)) expect(report.contract_audit).toMatchObject({ response_schema_id: stage.responseContract, parser_schema_id: stage.responseContract });
  expect(result.__communication_metadata_audit).toMatchObject({ communication_created_at: "2026-08-13T10:00:00+03:00", is_actual_call_time: false });
  expect(result.call_datetime).toBeUndefined();
  expect(result.call_end_datetime).toBeUndefined();
  await expect(page.locator("[data-result-next-contact-date]")).toContainText("14 августа 15:00");
  await expect(page.locator("#applicationCallEndDatetime")).toHaveCount(0);
  const downloadEvent = page.waitForEvent("download");
  await page.locator("#dlReport").click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("pipeline_report.json");
  await download.saveAs(testInfo.outputPath("pipeline_report.json"));
  await page.locator('[data-application-attributes-result="true"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("attributes-result.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
  await expect(page.locator('[data-nextjs-dialog], .vite-error-overlay')).toHaveCount(0);
});

test("CRM применяет SET и Interest ADD/REMOVE к существующим атрибутам, а not_determined сохраняет результат", async ({ page }) => {
  await page.goto(projectUrl);
  const existing = { interest: ["Новостройки", "Ипотека"], funding_source: "ипотека в процессе", purchase_term: "3–6 месяцев", next_contact_date: "2026-08-14T10:00:00+03:00" };
  await page.evaluate(existing => (window as any).__applicationAttributesCommunicationMetadata = {
    communication_created_at: "2026-08-13T10:00:00+03:00", timezone: "Europe/Moscow", current_attributes: existing,
    next_contact_fallback_at: "2026-08-14T10:00:00+03:00",
  }, existing);
  const outputs = candidates();
  outputs.interest_extractor = { status: "determined", value: ["Строительство"], evidence: ["Хотим проконсультироваться по строительству"], declined_values: ["Новостройки"], decline_evidence: ["Новостройки больше не рассматриваем"] };
  outputs.funding_source_extractor = { status: "determined", value: "ипотека одобрена", evidence: "Ипотеку уже одобрили" };
  outputs.purchase_term_extractor = { status: "determined", value: "до 1 месяца", evidence: "Хотим купить в течение месяца" };
  outputs.next_contact_date_extractor = contact("сегодня в 18:30");
  await installProvider(page, outputs);
  const first = await run(page, "Клиент: Новостройки больше не рассматриваем, хотим проконсультироваться по строительству. Ипотеку уже одобрили. Хотим купить в течение месяца.\nАгент: Сегодня в 18:30 вам позвоню.\nКлиент: Хорошо.");
  expect(first.result.attributes_quality_gate.interest_operations).toEqual({ add: ["Строительство"], remove: ["Новостройки"], keep: false });
  expect(first.result.crm_attributes_result).toMatchObject({
    attributes: { interest: ["Ипотека", "Строительство"], funding_source: "ипотека одобрена", purchase_term: "до 1 месяца", next_contact_date: "2026-08-13T18:30:00+03:00" },
    update_actions: { interest: "SET", funding_source: "SET", purchase_term: "SET", next_contact_date: "SET" },
  });

  const updated = first.result.crm_attributes_result.attributes;
  await page.evaluate(updated => (window as any).__applicationAttributesCommunicationMetadata = {
    communication_created_at: "2026-08-13T11:00:00+03:00", timezone: "Europe/Moscow", current_attributes: updated,
    next_contact_fallback_at: "2026-08-14T11:00:00+03:00",
  }, updated);
  await installProvider(page, absent());
  const second = await run(page, "Клиент: Спасибо, пока новых данных нет.");
  expect(second.result.attributes_quality_gate.decisions).toEqual({ interest: "DO_NOT_UPDATE", funding_source: "DO_NOT_UPDATE", purchase_term: "DO_NOT_UPDATE", next_contact_date: "DO_NOT_UPDATE" });
  expect(second.result.crm_attributes_result.attributes).toEqual(updated);
  expect(second.result.crm_attributes_result.update_actions).toEqual({ interest: "SKIP", funding_source: "SKIP", purchase_term: "SKIP", next_contact_date: "SKIP" });
});

for (const attribute of ["interest", "funding_source", "purchase_term", "next_contact_date"]) {
  test(`явный отказ ${attribute} сохраняется; отсутствие информации не очищает другие поля`, async ({ page }) => {
    await page.goto(projectUrl);
    const values: Record<string, any> = absent(), key = attribute + "_extractor";
    values[key] = { ...values[key], status: "explicitly_declined", evidence: attribute === "interest" ? ["Не хочу отвечать"] : "Больше не звоните" };
    await installProvider(page, values);
    const { result, calls } = await run(page, "Клиент: Не хочу отвечать. Больше не звоните.");
    expect(result.crm_attributes_result.attribute_states[attribute]).toBe("explicitly_declined");
    expect(result.crm_attributes_result.update_actions[attribute]).toBe(attribute === "interest" ? "SKIP" : "SET_DECLINED");
    expect(calls).toHaveLength(5);
    await expect(page.locator('[data-application-attributes-result="true"]')).toContainText("Клиент явно отказался");
    for (const other of ["interest", "funding_source", "purchase_term", "next_contact_date"].filter(key => key !== attribute)) expect(result.crm_attributes_result.update_actions[other]).toBe("SKIP");
  });
}

test("интерес с частичным отказом не теряет положительное направление", async ({ page }) => {
  await page.goto(projectUrl);
  const values = candidates();
  values.interest_extractor = { status: "determined", value: ["Строительство"], evidence: ["Хотим построить дом"], declined_values: ["Ипотека"], decline_evidence: ["Ипотека не нужна"] };
  await installProvider(page, values);
  const { result } = await run(page, "Клиент: Хотим построить дом. Ипотека не нужна.");
  expect(result.crm_attributes_result.attributes.interest).toEqual(["Строительство"]);
  expect(result.crm_attributes_result.declined_interest_values).toEqual(["Ипотека"]);
  await expect(page.locator('[data-application-attributes-result="true"]')).toContainText("Отклонённые клиентом направления: Ипотека");
});

for (const fault of ["judge_missing", "judge_change_status", "judge_add_value", "judge_reject"]) {
  test(`ошибка ${fault} затрагивает только источник средств`, async ({ page }) => {
    await page.goto(projectUrl);
    await installProvider(page, candidates(), { funding_source: fault });
    const { result } = await run(page);
    expect(result.crm_attributes_result.update_actions.funding_source).toBe(fault === "judge_reject" ? "SKIP" : "ERROR");
    expect(result.crm_attributes_result.update_actions.interest).toBe("SET");
    expect(result.crm_attributes_result.update_actions.purchase_term).toBe("SET");
    expect(result.crm_attributes_result.pipeline_status).toBe("PARTIAL_READY");
  });
}
for (const attribute of ["interest", "funding_source", "purchase_term", "next_contact_date"]) {
  test(`ошибка провайдера ${attribute} не останавливает остальные этапы`, async ({ page }) => {
    await page.goto(projectUrl);
    await installProvider(page, { ...candidates(), next_contact_date_extractor: contact("завтра в 15:00") }, { [attribute + "_extractor"]: "network" });
    const { result } = await run(page);
    expect(result.crm_attributes_result.update_actions[attribute]).toBe("ERROR");
    for (const other of ["interest", "funding_source", "purchase_term", "next_contact_date"].filter(key => key !== attribute)) expect(result.crm_attributes_result.update_actions[other]).toBe("SET");
  });
}

test("неполный JSON повторяется; исправленный ответ доходит до CRM", async ({ page }) => {
  await page.goto(projectUrl);
  await installProvider(page, { ...candidates(), next_contact_date_extractor: contact("через 30 минут") }, { next_contact_date_extractor: "truncated_once" });
  const { result, calls } = await run(page);
  expect(calls.filter((call: any) => call.key === "next_contact_date_extractor")).toHaveLength(2);
  expect(result.crm_attributes_result.attributes.next_contact_date).toBe("2026-08-13T10:30:00+03:00");
});

test("время коммуникации приоритетно; старые call_datetime и duration не создают время звонка", async ({ page }) => {
  await page.goto(projectUrl);
  const metadata = await page.evaluate(() => applicationAttributesCallMetadata({ communication_created_at: "2026-08-14T09:00:00+03:00", call_datetime: "2001-01-01T01:00:00Z", duration_seconds: 600, timezone: "Europe/Moscow" }));
  expect(metadata).toMatchObject({ communication_created_at: "2026-08-14T09:00:00+03:00" });
  expect(metadata.call_end_datetime).toBeUndefined();
  expect(await page.evaluate(() => applicationAttributesCallMetadata({ call_datetime: "2026-08-14T09:00:00+03:00", duration_seconds: 600 }).communication_created_at)).toBeNull();
  await page.evaluate(() => (window as any).__applicationAttributesCommunicationMetadata = { communication_created_at: "2026-08-14T09:00:00+03:00" });
  await installProvider(page, { ...candidates(), next_contact_date_extractor: contact("через час") });
  const { result } = await run(page);
  expect(result.crm_attributes_result.attributes.next_contact_date).toBe("2026-08-14T10:00:00+03:00");
});

test("без communication_created_at остальные атрибуты проходят; текущее время не придумывается", async ({ page }) => {
  await page.goto(projectUrl);
  await page.locator("#applicationCommunicationCreatedAt").fill("");
  await installProvider(page, { ...candidates(), next_contact_date_extractor: contact("завтра в 15:00") });
  const { result, calls, reports } = await run(page);
  expect(calls.filter((call: any) => call.key === "next_contact_date_extractor")).toHaveLength(1);
  expect(reports[3].report).toMatchObject({ parseErr: null, retry_count: 0, status: "warn", contract_audit: { parse_status: "SUCCESS", schema_status: "VALID" } });
  expect(result.__communication_metadata_audit.communication_created_at).toBeNull();
  expect(result.crm_attributes_result.update_actions.next_contact_date).toBe("SKIP");
  expect(result.crm_attributes_result.pending_attributes).toEqual(["next_contact_date"]);
  expect(result.next_contact_date_extractor.detected).toBe(true);
  expect(result.pipeline_execution).toMatchObject({ pipeline_status: "PARTIAL_SUCCESS", business_pipeline_status: "PARTIAL_READY" });
  await expect(page.locator("[data-contact-resolution]")).toContainText("не хватает даты создания коммуникации");
  expect(result.crm_attributes_result.update_actions.interest).toBe("SET");
  expect(result.crm_attributes_result.update_actions.funding_source).toBe("SET");
  await expect(page.locator("#applicationCommunicationCreatedAt")).toHaveValue("");
});

test("готовый серверный fallback сохраняет значение и источник; отказ не создаёт контакт", async ({ page }) => {
  await page.goto(projectUrl);
  await page.evaluate(() => (window as any).__applicationAttributesCommunicationMetadata = { communication_created_at: "2026-08-13T10:00:00+03:00", next_contact_fallback_at: "2026-08-14T10:00:00+03:00" });
  await installProvider(page, absent());
  const { result } = await run(page, "Клиент: Добрый день.");
  expect(result.crm_attributes_result).toMatchObject({ attributes: { next_contact_date: "2026-08-14T10:00:00+03:00" }, attribute_states: { next_contact_date: "not_determined" }, sources: { next_contact_date: "fallback" }, update_actions: { next_contact_date: "KEEP_FALLBACK" } });
  await expect(page.locator("[data-result-next-contact-date]")).toContainText("fallback +24 ч");
});

test("temporal normalizer: относительные, абсолютные даты, диапазон, время и шум STT", async ({ page }) => {
  await page.goto(projectUrl);
  const samples = [
    ["завтра в 15:00", "2026-08-14T15:00:00+03:00"],
    ["послезавтра", null],
    ["в понедельник", null],
    ["через два дня", null],
    ["через час", "2026-08-13T11:00:00+03:00"],
    ["через 30–40 минут", null],
    ["через 30—4к", null],
    ["сегодня вечером", null],
    ["в 15:00", null],
    ["в 09:00", null],
    ["15 сентября 2026 в 13:40", "2026-09-15T13:40:00+03:00"],
    ["15.09.2026 в 13:40", "2026-09-15T13:40:00+03:00"],
    ["2026-09-15T13:40:00+03:00", "2026-09-15T13:40:00+03:00"],
  ];
  for (const [raw, expected] of samples) {
    const normalized = await page.evaluate(raw => applicationAttributesTemporalNormalize(raw!, { communication_created_at: "2026-08-13T10:00:00+03:00", timezone: "Europe/Moscow" }), raw);
    expect(normalized.normalized_datetime, raw).toBe(expected);
    expect(normalized.is_actual_call_time).toBe(false);
  }
  const absolute = await page.evaluate(() => applicationAttributesTemporalNormalize("15 сентября 2026 в 13:40", { timezone: "Europe/Moscow" }));
  expect(absolute.normalized_datetime).toBe("2026-09-15T13:40:00+03:00");
  const invalid = await page.evaluate(() => applicationAttributesTemporalNormalize("30.02.2026 в 13:40", { timezone: "Europe/Moscow" }));
  expect(invalid.normalized_datetime).toBeNull();
});

test("реальные транскрибации A/B/C с неточным временем сохраняют fallback без выдуманного часа", async ({ page }) => {
  await page.goto(projectUrl);
  for (const [id, transcript] of Object.entries(realCases)) {
    await installProvider(page, { ...candidates(), next_contact_date_extractor: contact(id === "caseC" ? "через 30—4к" : "завтра вечером", id === "caseC" ? "range" : "daypart") });
    const { result } = await run(page, transcript as string);
    expect(result.crm_attributes_result.update_actions.next_contact_date, id).toBe("SKIP");
    expect(result.crm_attributes_result.sources.next_contact_date).toBe("none");
    expect(result.crm_attributes_result.next_contact_policy).toBe("PRESERVE_SYSTEM_FALLBACK_24H");
  }
});

test("повторный запуск не использует значения и provenance прошлого разговора", async ({ page }) => {
  await page.goto(projectUrl);
  await installProvider(page, candidates());
  const first = await run(page);
  await installProvider(page, absent());
  const second = await run(page, "Клиент: Другой разговор без информации.");
  expect(second.result.__run_id).not.toBe(first.result.__run_id);
  expect(second.result.crm_attributes_result.attributes.interest).toBeNull();
  expect(second.result.crm_attributes_result.update_actions.interest).toBe("SKIP");
});

test("встроенный mock провайдер совместим с v2 и семью этапами", async ({ page }) => {
  await page.goto(projectUrl);
  await page.locator("#sampleBtn").click();
  await page.locator("#runBtn").click();
  await expect(page.locator('[data-application-attributes-result="true"]')).toBeVisible();
  const result = await page.evaluate(() => ctx.crm_attributes_result);
  expect(result.update_actions.interest).toBe("SET");
  expect(result.update_actions.funding_source).toBe("SET");
  expect(result.update_actions.purchase_term).toBe("SET");
  expect(result.technical_errors).toEqual([]);
});

test("UTC дата отображается в выбранном часовом поясе; точный час важнее периода дня", async ({ page }) => {
  await page.goto(projectUrl);
  const times = await page.evaluate(() => ["завтра в 11 утра", "в 7 вечера", "через неделю"].map(raw => applicationAttributesTemporalNormalize(raw, { communication_created_at: "2026-08-13T10:00:00+03:00", timezone: "Europe/Moscow" }).normalized_datetime));
  expect(times).toEqual(["2026-08-14T11:00:00+03:00", null, null]);
  await installProvider(page, { ...candidates(), next_contact_date_extractor: contact("2026-08-14T15:00:00Z") });
  await run(page);
  await expect(page.locator("[data-result-next-contact-date]")).toContainText("14 августа 18:00");
});

for (const reference of [true, false]) {
  test(`разговор из отчёта: за час до показа, метка создания ${reference ? "есть" : "отсутствует"}`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(projectUrl);
    await page.locator("#applicationCommunicationCreatedAt").fill(reference ? "2026-09-25T10:00" : "");
    await installProvider(page, { ...eventCase.extractors, next_contact_date_extractor: eventCase.semantic_result });
    const { result, calls, reports } = await run(page, eventCase.transcript);
    expect(calls).toHaveLength(5);
    for (const call of calls) expect(call.prompt.split(eventCase.transcript)).toHaveLength(2);
    expect(reports[3].report).toMatchObject({ retry_count: 0, parseErr: null, contract_audit: { schema_status: "VALID", response_schema_id: "application_next_contact_date_extractor_v4" } });
    expect(result.crm_attributes_result.technical_errors).toEqual([]);
    expect(result.crm_attributes_result.attributes.next_contact_date).toBe(reference ? "2026-09-26T14:00:00+03:00" : null);
    expect(result.crm_attributes_result.next_contact_resolution).toMatchObject({ status: reference ? "resolved" : "missing_reference", event_anchor: { offset_minutes: -60 } });
    expect(result.attributes_judge.judge_verdicts.next_contact_date).toBe("accepted");
    expect(result.__application_runtime).toMatchObject({ revision: 33, prompt_revision: 33, next_contact_schema: "application_next_contact_date_extractor_v4" });
    await page.locator("[data-contact-event-evidence]").evaluate((element: HTMLDetailsElement) => { element.open = true; });
    await expect(page.locator("[data-result-contact-event]")).toContainText(reference ? "26 сентября 15:00" : "завтра в 15:00");
    if (!reference) await expect(page.locator("[data-result-next-contact-date]")).toContainText("завтра в 14:00");
    if (!reference) {
      expect(result.crm_attributes_result.pending_attributes).toEqual(["next_contact_date"]);
      await expect(page.locator("[data-result-next-contact-date]")).toContainText("договорённость найдена");
      await expect(page.locator("[data-result-pipeline-status]")).toHaveText("Частичный успех");
      await expect(page.locator("[data-contact-resolution]")).toContainText("за час всё равно позвоню");
    }
    const downloadEvent = page.waitForEvent("download");
    await page.locator("#dlReport").click();
    await (await downloadEvent).saveAs(testInfo.outputPath("event-report.json"));
    await page.locator('[data-application-attributes-result="true"]').screenshot({ path: testInfo.outputPath("event-result.png") });
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
  });
}

test("перенос показа: учитывается новое время; повторный запуск не сохраняет старую дату", async ({ page }) => {
  await page.goto(projectUrl);
  for (const hour of [15, 17]) {
    const candidate = { ...eventCase.semantic_result, event_anchor: { ...eventCase.semantic_result.event_anchor, raw_time_expression: `завтра в ${hour}:00` } };
    await installProvider(page, { ...candidates(), next_contact_date_extractor: candidate });
    const { result } = await run(page, `Агент: Показ завтра в 15:00.\nКлиент: Давайте на ${hour}:00.\nАгент: Хорошо, на ${hour}:00. За час позвоню.`);
    expect(result.crm_attributes_result.attributes.next_contact_date).toBe(`2026-08-14T${hour - 1}:00:00+03:00`);
    expect(result.temporal_normalization_audit.event_datetime).toBe(`2026-08-14T${hour}:00:00+03:00`);
  }
});

test("неподдерживаемое время и событие без часа не вызывают повторов или выдуманной даты", async ({ page }) => {
  await page.goto(projectUrl);
  const values = [
    contact("когда закончится совещание"),
    contact("за час до показа завтра в 15:00"), // Missing explicit relation must not save 15:00.
    { ...eventCase.semantic_result, event_anchor: { ...eventCase.semantic_result.event_anchor, raw_time_expression: "завтра" } },
  ];
  for (const value of values) {
    await installProvider(page, { ...candidates(), next_contact_date_extractor: value });
    const { result, calls, reports } = await run(page);
    expect(calls.filter((c: any) => c.key === "next_contact_date_extractor")).toHaveLength(1);
    expect(reports[3].report).toMatchObject({ parseErr: null, retry_count: 0, status: "warn", contract_audit: { schema_status: "VALID" } });
    expect(result.crm_attributes_result.next_contact_resolution.status).toBe("unresolved");
    expect(result.crm_attributes_result.update_actions.next_contact_date).toBe("SKIP");
    expect(result.crm_attributes_result.attributes.next_contact_date).toBeNull();
    await expect(page.locator("[data-contact-resolution]")).toContainText("Не удалось рассчитать дату");
  }
});

for (const action of ["callback", "message"] as const) {
  test(`подтверждённый ${action} без времени проходит Extractor → Judge → Gate → CRM без retry`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(projectUrl);
    const evidence = action === "callback" ? "Я тогда свяжусь с ней и вам перезвоню." : "Я вам напишу после уточнения.";
    await installProvider(page, { ...candidates(), next_contact_date_extractor: contactWithoutTime(action, evidence) });
    const { result, reports, calls } = await run(page, `Агент: ${evidence}\nКлиент: Хорошо.`);
    expect(calls.filter((call: any) => call.key === "next_contact_date_extractor")).toHaveLength(1);
    expect(reports[3].report).toMatchObject({ retry_count: 0, parseErr: null,
      contract_audit: { schema_status: "VALID", response_schema_id: "application_next_contact_date_extractor_v4" } });
    expect(reports[3].report.semantic_result).toMatchObject(contactWithoutTime(action, evidence));
    expect(result.next_contact_date_extractor).toMatchObject({ status: "determined", detected: true,
      next_contact_at: null, precision: "none", raw_time_expression: null, normalization_status: "unresolved" });
    expect(result.attributes_judge).toMatchObject({ judge_verdicts: { next_contact_date: "accepted" },
      attribute_statuses: { next_contact_date: "ready" } });
    expect(result.attributes_quality_gate).toMatchObject({ pending_attributes: ["next_contact_date"], technical_errors: [],
      next_contact_resolution: { status: "unresolved", action, raw_time_expression: null } });
    expect(result.crm_attributes_result).toMatchObject({ attributes: { next_contact_date: null },
      update_actions: { next_contact_date: "SKIP" }, pending_attributes: ["next_contact_date"], technical_errors: [],
      next_contact_resolution: { action, evidence, raw_time_expression: null } });
    expect(result.crm_attributes_result.pipeline_status).toBe("PARTIAL_READY");
    await expect(page.locator("[data-result-next-contact-date]")).toBeVisible();
    await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("время неподтверждённого просмотра не становится временем обещанного callback", async ({ page }) => {
  await page.goto(projectUrl);
  await installProvider(page, { ...candidates(), next_contact_date_extractor: unknownTimeCallback.first_extractor_response });
  const { result, reports, calls } = await run(page, unknownTimeCallback.transcript);
  expect(calls.filter((call: any) => call.key === "next_contact_date_extractor")).toHaveLength(1);
  expect(reports[3].report).toMatchObject({ retry_count: 0, parseErr: null,
    semantic_result: unknownTimeCallback.first_extractor_response,
    contract_audit: { schema_status: "VALID" } });
  expect(result.next_contact_date_extractor).toMatchObject({ action: "callback", precision: "none",
    raw_time_expression: null, next_contact_at: null, normalization_status: "unresolved" });
  expect(result.attributes_judge).toMatchObject({ judge_verdicts: { next_contact_date: "accepted" },
    attribute_statuses: { next_contact_date: "ready" } });
  expect(result.attributes_quality_gate).toMatchObject({ decisions: { next_contact_date: "DO_NOT_UPDATE" },
    pending_attributes: ["next_contact_date"], technical_errors: [],
    next_contact_resolution: { status: "unresolved", action: "callback",
      raw_time_expression: null, evidence: unknownTimeCallback.first_extractor_response.evidence } });
  expect(result.crm_attributes_result).toMatchObject({ attributes: { next_contact_date: null },
    update_actions: { next_contact_date: "SKIP" }, pending_attributes: ["next_contact_date"],
    technical_errors: [], pipeline_status: "PARTIAL_READY" });
  expect(result.attributes_metrics).toMatchObject({
    quality_score: 100,
    semantic_risk: false,
    next_contact_quality: { correct_skip: true, reason: "DATE_NOT_DETERMINABLE_BY_CURRENT_RULES" },
  });
  expect(JSON.stringify(result.next_contact_date_extractor)).not.toContain("11:00");
});

test("последнее обещание агента исправляет ошибочного инициатора без выдуманной даты", async ({ page }) => {
  await page.goto(projectUrl);
  const transcript = [
    "Агент: Тогда перезвоню вам чуть-чуть попозже.",
    "Клиент: Хорошо.",
    "Агент: Сейчас перезвоню вам.",
    "Клиент: Хорошо.",
  ].join("\n");
  const extracted = {
    ...contactWithoutTime("callback", "Агент: «Сейчас перезвоню вам». Клиент: «Хорошо»"),
    actor: "client",
  };
  await installProvider(page, { ...candidates(), next_contact_date_extractor: extracted });
  const { result, calls } = await run(page, transcript);
  const judgeCall = calls.find((call: any) => call.key === "attributes_judge");
  const judgeInput = JSON.parse(judgeCall.prompt.match(/ПОДГОТОВЛЕННЫЕ ВХОДЫ EXTRACTOR:\s*\n([^\n]+)/)[1]);

  expect(judgeInput.next_contact_date.result.actor).toBe("agent");
  expect(result.attributes_judge.attributes.next_contact_date.actor).toBe("agent");
  expect(result.crm_attributes_result).toMatchObject({
    attributes: { next_contact_date: null },
    update_actions: { next_contact_date: "SKIP" },
  });
});

test("сохранённый ответ о звонке клиента на выходных проходит все 7 этапов с первой попытки", async ({ page }) => {
  await page.goto(projectUrl);
  await page.locator("#applicationCommunicationCreatedAt").fill(clientWeekendCallback.communication_created_at.slice(0, 19));
  await installProvider(page, {
    interest_extractor: clientWeekendCallback.interest_extractor,
    funding_source_extractor: { status: "not_determined", value: null, evidence: "", context: null },
    purchase_term_extractor: clientWeekendCallback.purchase_term_extractor,
    next_contact_date_extractor: clientWeekendCallback.first_extractor_response,
  });
  const { result, reports, calls } = await run(page, clientWeekendCallback.transcript);
  expect(calls.filter((call: any) => call.key === "next_contact_date_extractor")).toHaveLength(1);
  expect(calls.find((call: any) => call.key === "funding_source_extractor").prompt)
    .toContain('При status=not_determined: value=null, evidence="", context=null. Не объясняй причину в evidence.');
  expect(reports).toHaveLength(7);
  expect(reports.slice(0, 4).every((item: any) => item.report.parseErr === null)).toBe(true);
  expect(reports[3].report).toMatchObject({ retry_count: 0, parseErr: null,
    actor_normalization: { from: "none", to: "client", source: "evidence_turn" },
    semantic_result: { status: "determined", detected: true, action: "callback", actor: "client",
      precision: "range", raw_time_expression: "на выходных", next_contact_at: null },
    contract_audit: { schema_status: "VALID", validation_failures: [] } });
  expect(result.attributes_judge).toMatchObject({ judge_verdicts: { next_contact_date: "accepted" },
    attribute_statuses: { next_contact_date: "ready" } });
  expect(result.attributes_quality_gate).toMatchObject({ decisions: { next_contact_date: "DO_NOT_UPDATE" },
    pending_attributes: ["next_contact_date"], technical_errors: [],
    next_contact_resolution: { status: "unresolved", action: "callback", raw_time_expression: "на выходных" } });
  expect(result.crm_attributes_result).toMatchObject({ attributes: { next_contact_date: null },
    update_actions: { next_contact_date: "SKIP" }, pending_attributes: ["next_contact_date"], technical_errors: [] });
  expect(result.pipeline_execution).toMatchObject({ steps_total: 7, steps_executed: 7 });
});

test("два Interest с пятью цитатами и accepted not_determined не дают ложных ошибок", async ({ page }) => {
  await page.goto(projectUrl);
  const unrelatedEvent = { raw_time_expression: "встреча в следующий вторник в 12:00", offset_minutes: 0,
    evidence: "Агент: Встреча в следующий вторник в 12:00" };
  await installProvider(page, {
    ...absent(),
    interest_extractor: { status: "determined", value: ["Новостройки", "Ипотека"],
      evidence: ["Новостройка", "Новый дом", "Первичный рынок", "Ипотека", "Кредит на квартиру"],
      declined_values: [], decline_evidence: [] },
    funding_source_extractor: { status: "not_determined", value: null, evidence: "",
      context: { summary: "Источник не назван", evidence: ["Пока не решили"], limitation: "Недостаточно данных" } },
    purchase_term_extractor: { status: "not_determined", value: null, evidence: "",
      context: { summary: "Срок не назван", evidence: ["Пока не решили"], limitation: "Недостаточно данных" } },
    next_contact_date_extractor: { ...clientWeekendCallback.first_extractor_response, actor: "client", event_anchor: unrelatedEvent },
  }, { funding_source: "judge_accept_undetermined", purchase_term: "judge_accept_undetermined" });
  const transcript = "Клиент: Интересует новостройка и ипотека. Пока не решили источник денег и срок покупки. "
    + "На выходных я вам позвоню.\nАгент: Встреча в следующий вторник в 12:00.";
  const { result, reports, calls } = await run(page, transcript);
  expect(calls.filter((call: any) => call.key.endsWith("extractor"))).toHaveLength(4);
  expect(reports.slice(0, 4).every((entry: any) => entry.report.parseErr === null)).toBe(true);
  expect(reports[3].report).toMatchObject({ raw: expect.stringContaining("event_anchor"),
    anchor_normalization: { reason: "standalone_contact" }, semantic_result: { event_anchor: null } });
  expect(result.attributes_judge.judge_verdicts).toMatchObject({ funding_source: "not_determined", purchase_term: "not_determined" });
  expect(result.attributes_quality_gate.decisions).toMatchObject({ funding_source: "DO_NOT_UPDATE", purchase_term: "DO_NOT_UPDATE", next_contact_date: "DO_NOT_UPDATE" });
  expect(result.attributes_quality_gate.technical_errors).toEqual([]);
  expect(result.crm_attributes_result.technical_errors).toEqual([]);
  expect(result.crm_attributes_result.update_actions).toMatchObject({ funding_source: "SKIP", purchase_term: "SKIP", next_contact_date: "SKIP" });
  expect(result.crm_attributes_result.next_contact_resolution.event_anchor).toBeNull();
});

test("precision выходных проходит структуру без повторного семантического repair", async ({ page }) => {
  await page.goto(projectUrl);
  await installProvider(page, { ...candidates(), next_contact_date_extractor: clientWeekendCallback.second_extractor_response });
  const { reports, calls } = await run(page, clientWeekendCallback.transcript);
  const attempts = calls.filter((call: any) => call.key === "next_contact_date_extractor");
  expect(attempts).toHaveLength(1);
  expect(reports[3].report).toMatchObject({ retry_count: 0, parseErr: null,
    semantic_result: { actor: "client", precision: "daypart", raw_time_expression: "на выходных" },
    contract_audit: { validation_failures: [] } });
});

test("отчёт сохраняет причины первых отказов, даже если последний retry обрывается", async ({ page }) => {
  await page.goto(projectUrl);
  const invalid = { ...clientWeekendCallback.second_extractor_response, detected: false };
  await installProvider(page, { ...candidates(), next_contact_date_extractor: [
    invalid, invalid,
  ] }, { next_contact_date_extractor: "truncated_third" });
  const { reports, calls } = await run(page, clientWeekendCallback.transcript);
  expect(calls.filter((call: any) => call.key === "next_contact_date_extractor")).toHaveLength(3);
  expect(reports[3].report).toMatchObject({ retry_count: 2, parseErr: "TRUNCATED_JSON",
    contract_audit: { validation_failures: [
      { attempt: 0, reason: "next_contact_date_extractor: status/detected mismatch" },
      { attempt: 1, reason: "next_contact_date_extractor: status/detected mismatch" },
      { attempt: 2, reason: "TRUNCATED_JSON" },
    ] } });
});

test("незавершённый расчёт сохраняет fallback; последующий отказ отменяет его применение", async ({ page }) => {
  await page.goto(projectUrl);
  await page.locator("#applicationCommunicationCreatedAt").fill("");
  await page.evaluate(() => (window as any).__applicationAttributesCommunicationMetadata = { next_contact_fallback_at: "2026-08-14T10:00:00+03:00" });
  await installProvider(page, { ...eventCase.extractors, next_contact_date_extractor: eventCase.semantic_result });
  const pending = await run(page, eventCase.transcript);
  expect(pending.result.crm_attributes_result).toMatchObject({ sources: { next_contact_date: "fallback" }, update_actions: { next_contact_date: "KEEP_FALLBACK" }, pending_attributes: ["next_contact_date"] });
  await expect(page.locator("[data-contact-resolution]")).toContainText("не хватает даты");
  await installProvider(page, { ...candidates(), next_contact_date_extractor: { ...absent().next_contact_date_extractor, status: "explicitly_declined", evidence: "Больше не звоните" } });
  const refusal = await run(page, "Клиент: Больше не звоните.");
  expect(refusal.result.crm_attributes_result).toMatchObject({ next_contact_policy: "NO_CONTACT", attributes: { next_contact_date: null }, pending_attributes: [], update_actions: { next_contact_date: "SET_DECLINED" } });
  await expect(page.locator("[data-contact-resolution]")).toHaveCount(0);
});

test("абсолютное событие без creation time и смещение через полночь", async ({ page }) => {
  await page.goto(projectUrl);
  await page.locator("#applicationCommunicationCreatedAt").fill("");
  await installProvider(page, { ...candidates(), next_contact_date_extractor: { ...eventCase.semantic_result,
    event_anchor: { raw_time_expression: "28.09.2026 в 00:30", offset_minutes: -60, evidence: "28 сентября в 00:30, за час позвоню" } } });
  const { result } = await run(page);
  expect(result.crm_attributes_result.attributes.next_contact_date).toBe("2026-09-27T23:30:00+03:00");
});

test("миграция v27 → v28 сохраняет пользовательский промпт, настройки и резервную копию", async ({ page }) => {
  await page.goto(projectUrl);
  await page.evaluate(() => {
    const stage = pipeline.find(s => s.outKey === "next_contact_date_extractor")!;
    stage.prompt = "Моё специальное правило. {{transcript}}";
    stage.promptSource = "user_override"; stage.promptEdited = true; stage.promptVersion = 27;
    stage.responseContract = "application_next_contact_date_extractor_v2"; stage.maxTokens = 3456;
    savePipelineConfig();
  });
  await page.reload();
  for (let i = 0; i < 2; i++) {
    const stage = await page.evaluate(() => pipeline.find(s => s.outKey === "next_contact_date_extractor"));
    expect(stage.prompt).toBe("Моё специальное правило. {{transcript}}");
    expect(stage).toMatchObject({ promptVersion: 33, responseContract: "application_next_contact_date_extractor_v4", maxTokens: 3456 });
    await page.reload();
  }
  const backup = await page.evaluate(key => JSON.parse(localStorage.getItem(key + ".before-v28")!), configKey);
  expect(backup.stages.find((s: any) => s.outKey === "next_contact_date_extractor").prompt).toContain("Моё специальное правило");
});

test("устаревшая вкладка не запускает LLM и сохраняет текст при обновлении", async ({ page }) => {
  await page.goto(projectUrl);
  await installProvider(page, candidates());
  await page.route("**/ai-application-attributes-runtime.json", route => route.fulfill({ json: { revision: 34 } }));
  await page.locator("#transcript").fill("Клиент: Текст для сохранения при обновлении.");
  await page.locator("#applicationCommunicationCreatedAt").fill("2026-09-25T10:00");
  await page.locator("#runBtn").click();
  await expect(page.locator("#applicationRuntimeStatus")).toContainText("Открыта версия 33. Доступна версия 34");
  expect(await page.evaluate(() => (window as any).__testCalls)).toEqual([]);
  await page.unroute("**/ai-application-attributes-runtime.json");
  await page.locator("[data-runtime-reload]").click();
  await expect(page.locator("#transcript")).toHaveValue("Клиент: Текст для сохранения при обновлении.");
  await expect(page.locator("#applicationCommunicationCreatedAt")).toHaveValue("2026-09-25T10:00");
  await expect(page.locator("#applicationRuntimeStatus")).toContainText("Версия 33");
});

test("неудачная проверка версии не расходует токены и разрешает повтор после восстановления", async ({ page }) => {
  await page.goto(projectUrl);
  await installProvider(page, absent());
  await page.route("**/ai-application-attributes-runtime.json", route => route.fulfill({ status: 503, body: "Unavailable" }));
  await page.locator("#transcript").fill("Клиент: Добрый день.");
  await page.locator("#runBtn").click();
  await expect(page.locator("#applicationRuntimeStatus")).toContainText("Не удалось проверить версию");
  expect(await page.evaluate(() => (window as any).__testCalls)).toEqual([]);
  await page.unroute("**/ai-application-attributes-runtime.json");
  const { calls } = await run(page, "Клиент: Добрый день.");
  expect(calls).toHaveLength(5);
});

const fundingContext = { summary: "Рассматривает семейную ипотеку", evidence: ["Вот скажите, реально ли семейную ипотеку нам оформить?", "Нет, ещё не одобряли, нет."], limitation: "Подача заявки и одобрение не подтверждены" };
const purchaseContext = { summary: "Ипотечное одобрение — до 30 сентября", evidence: ['Агент: "Очень рекомендую сегодня или завтра. Потому что на одобрение объекта..."', 'Агент: "На всё это у нас фактически до 31, вернее, до 30 сентября, а сегодня двадцать пятое осталось."', 'Клиент: "Угу, угу, угу, поняла."'], limitation: "Дедлайн назвал агент; срок покупки клиент не подтвердил" };
const contextualCase = () => ({ ...eventCase.extractors, funding_source_extractor: { ...absent().funding_source_extractor, context: fundingContext }, purchase_term_extractor: { ...absent().purchase_term_extractor, context: purchaseContext }, next_contact_date_extractor: eventCase.semantic_result });

test("полезный контекст разговора и относительное расписание доходят до карточки и CRM JSON", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(projectUrl);
  await page.locator("#applicationCommunicationCreatedAt").fill("");
  await installProvider(page, contextualCase());
  const { result, calls, reports } = await run(page, eventCase.transcript);
  expect(calls).toHaveLength(5);
  for (const call of calls) expect(call.prompt.split(eventCase.transcript)).toHaveLength(2);
  expect(calls.slice(1, 3).map(call => call.schema)).toEqual(["application_funding_source_extractor_v3", "application_purchase_term_extractor_v3"]);
  expect(calls[4].schema).toBe("application_attributes_judge_v4");
  expect(reports.every(report => report.report.retry_count === undefined || report.report.retry_count === 0)).toBe(true);
  const crm = result.crm_attributes_result;
  expect(crm.attribute_context).toEqual({ funding_source: fundingContext, purchase_term: purchaseContext });
  expect(crm.attributes).toMatchObject({ funding_source: null, purchase_term: null, next_contact_date: null });
  expect(crm.next_contact_schedule).toMatchObject({ event: { label: "завтра в 15:00" }, contact: { label: "завтра в 14:00", calendar_date_known: false } });
  await expect(page.locator("[data-result-funding-source]")).toContainText("Не определено");
  await expect(page.locator('[data-attribute-context="funding_source"]')).toContainText("Рассматривает семейную ипотеку");
  await expect(page.locator("[data-result-purchase-term]")).toContainText("Не определено");
  await expect(page.locator('[data-attribute-context="purchase_term"]')).toContainText("Ипотечное одобрение — до 30 сентября");
  await expect(page.locator("[data-attribute-readiness]")).toContainText("1 из 4");
  await expect(page.locator('[data-attribute-context="purchase_term"]')).toContainText("срок покупки клиент не подтвердил");
  await page.locator("[data-contact-reference-action]").click();
  await expect(page.locator("#applicationCommunicationCreatedAt")).toBeFocused();
  const download = page.waitForEvent("download");
  await page.locator("#dlReport").click();
  await (await download).saveAs(testInfo.outputPath("context-report.json"));
  await page.locator('[data-application-attributes-result="true"]').screenshot({ path: testInfo.outputPath("context-result.png") });
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  // Current-run only: a later empty conversation must not inherit contextual facts.
  await installProvider(page, absent());
  const next = await run(page, "Клиент: Здравствуйте.");
  expect(next.result.crm_attributes_result.attribute_context).toEqual({ funding_source: null, purchase_term: null });
  await expect(page.locator("[data-attribute-context]")).toHaveCount(0);
});

test("Judge отклоняет неподтверждённый контекст независимо от остальных атрибутов", async ({ page }) => {
  await page.goto(projectUrl);
  await installProvider(page, contextualCase(), { funding_source: "context_reject" });
  const { result } = await run(page, eventCase.transcript);
  expect(result.crm_attributes_result.attribute_context.funding_source).toBeNull();
  expect(result.crm_attributes_result.attribute_context.purchase_term).toEqual(purchaseContext);
  expect(result.crm_attributes_result.update_actions.interest).toBe("SET");
  await expect(page.locator('[data-attribute-context="funding_source"]')).toHaveCount(0);
});

test("миграция сохраняет пользовательский промпт без автоматических инструкций", async ({ page }) => {
  await page.goto(projectUrl);
  await page.evaluate(() => {
    const stage = pipeline.find(s => s.outKey === "funding_source_extractor")!;
    stage.prompt = "Моё правило источника средств. {{transcript}}";
    stage.promptEdited = true; stage.promptSource = "user_override"; stage.promptVersion = 28;
    stage.responseContract = "application_funding_source_extractor_v2"; stage.maxTokens = 3456;
    savePipelineConfig();
  });
  for (let i = 0; i < 2; i++) {
    await page.reload();
    const stage = await page.evaluate(() => pipeline.find(s => s.outKey === "funding_source_extractor"));
    expect(stage).toMatchObject({ promptVersion: 33, responseContract: "application_funding_source_extractor_v3", maxTokens: 3456 });
    expect(stage.prompt).toBe("Моё правило источника средств. {{transcript}}");
  }
});

test("все шесть направлений интереса проходят до основной карточки и CRM без сокращений", async ({ page }) => {
  await page.goto(projectUrl);
  const interests = ["Новостройки", "Ипотека", "Инвестиции в регионах", "Безопасность сделок", "Юридическое сопровождение", "Строительство"];
  const transcript = interests.map(value => `Клиент: Меня интересует ${value}.`).join("\n");
  await installProvider(page, { ...absent(), interest_extractor: { status: "determined", value: interests, evidence: interests.map(value => `Меня интересует ${value}.`), declined_values: [], decline_evidence: [] } });
  const { result, calls } = await run(page, transcript);
  expect(calls[0].schema).toBe("application_interest_extractor_v3");
  expect(result.crm_attributes_result.attributes.interest).toEqual(interests);
  expect(result.crm_attributes_result.update_actions.interest).toBe("SET");
  for (const interest of interests) await expect(page.locator("[data-result-interest]")).toContainText(interest);
});

test("день без часа и открытая дата сохраняют системный fallback", async ({ page }) => {
  await page.goto(projectUrl);
  const temporal = await page.evaluate(() => ["завтра", "в пятницу", "после 20 августа", "после 20.08.2026", "после 20 августа 2026 в 15:00"].map(raw => applicationAttributesTemporalNormalize(raw, { communication_created_at: "2026-08-13T10:00:00+03:00", timezone: "Europe/Moscow" })));
  expect(temporal[0]).toMatchObject({ normalized_datetime: null, precision: "date", strategy: "time_required" });
  expect(temporal[1]).toMatchObject({ normalized_datetime: null, precision: "date", strategy: "time_required" });
  for (const item of temporal.slice(2)) expect(item).toMatchObject({ normalized_datetime: null, strategy: "open_date_boundary_requires_clarification" });
  await page.evaluate(() => { (window as any).__applicationAttributesCommunicationMetadata = { communication_created_at: "2026-08-13T10:00:00+03:00", timezone: "Europe/Moscow", next_contact_fallback_at: "2026-08-14T10:00:00+03:00" }; });
  await installProvider(page, { ...candidates(), next_contact_date_extractor: contact("после 20 августа", "date") });
  const { result } = await run(page, "Агент: Свяжемся после 20 августа.\nКлиент: Хорошо.");
  expect(result.crm_attributes_result).toMatchObject({ sources: { next_contact_date: "fallback" }, update_actions: { next_contact_date: "KEEP_FALLBACK" }, attributes: { next_contact_date: "2026-08-14T10:00:00+03:00" }, next_contact_policy: "PRESERVE_SYSTEM_FALLBACK_24H" });
  expect(result.next_contact_date_extractor.next_contact_at).toBeNull();
  expect(result.crm_attributes_result.next_contact_resolution.raw_time_expression).toBe("после 20 августа");
});

test("основная карточка содержит ровно четыре атрибута; детали не заменяют значения", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(projectUrl);
  await page.locator("#applicationCommunicationCreatedAt").fill("");
  await installProvider(page, contextualCase());
  const { result } = await run(page, eventCase.transcript);
  await expect(page.locator("[data-application-attribute-fields] > .fm")).toHaveCount(4);
  expect(Object.keys(result.crm_attributes_result.attributes)).toEqual(["interest", "funding_source", "purchase_term", "next_contact_date"]);
  await expect(page.locator("[data-result-contact-event]")).toBeHidden();
  await expect(page.locator("[data-result-quality-score]")).toBeHidden();
  await page.locator('[data-application-attributes-result="true"]').screenshot({ path: testInfo.outputPath("strict-four-attributes.png") });
  await page.locator("[data-contact-event-evidence] summary").click();
  await expect(page.locator("[data-result-contact-event]")).toHaveText("завтра в 15:00");
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("неточная дата не сохраняется как AI даже при одобрении Judge; все остальные поля сохраняются", async ({ page }) => {
  await page.goto(projectUrl);
  await page.evaluate(() => (window as any).__applicationAttributesCommunicationMetadata = { communication_created_at: "2026-08-13T10:00:00+03:00", next_contact_fallback_at: "2026-08-14T10:00:00+03:00" });
  for (const [raw, precision] of [["завтра", "date"], ["в пятницу", "date"], ["завтра вечером", "daypart"], ["через 30–40 минут", "range"], ["после 20 августа", "date"]]) {
    await installProvider(page, { ...candidates(), next_contact_date_extractor: contact(raw, precision) });
    const { result } = await run(page);
    expect(result.crm_attributes_result.update_actions).toEqual({ interest: "SET", funding_source: "SET", purchase_term: "SET", next_contact_date: "KEEP_FALLBACK" });
    expect(result.next_contact_date_extractor.next_contact_at).toBeNull();
    expect(result.crm_attributes_result.sources.next_contact_date).toBe("fallback");
  }
});

test("точные даты сохраняются, неоднозначные и прошедшие не создают ложную договорённость", async ({ page }) => {
  await page.goto(projectUrl);
  const cases: Array<[string, string | null]> = [
    ["через два дня в 15:00", "2026-08-15T15:00:00+03:00"],
    ["в пятницу в 16:30", "2026-08-14T16:30:00+03:00"],
    ["13 августа в 18:00", "2026-08-13T18:00:00+03:00"],
    ["15.09.2026", null], ["завтра примерно в 15:00", null],
    ["завтра с 15:00–16:00", null], ["завтра в 15:00 или в 17:00", null],
    ["2026-08-12T15:00:00+03:00", null], ["в 15:00", null],
  ];
  for (const [raw, expected] of cases) {
    const result = await page.evaluate(raw => applicationAttributesTemporalNormalize(raw, { communication_created_at: "2026-08-13T10:00:00+03:00", timezone: "Europe/Moscow" }), raw);
    expect(result.normalized_datetime, raw).toBe(expected);
  }
});

test("сохранённый пользовательский шаблон не получает общие инструкции", async ({ page }) => {
  await page.goto(projectUrl);
  await page.evaluate(() => {
    const stage = pipeline.find(s => s.outKey === "funding_source_extractor")!;
    stage.prompt = "Моё правило: добавь семейную ипотеку. {{transcript}} {{transcript}}";
    stage.promptVersion = 31; stage.promptEdited = true; stage.promptSource = "user_override";
    savePipelineConfig();
  });
  await page.reload();
  await installProvider(page, { ...candidates(), funding_source_extractor: { status: "determined", value: "семейная ипотека", evidence: "Хочу семейную ипотеку", context: null } });
  const { result, calls } = await run(page);
  const call = calls.find(call => call.key === "funding_source_extractor");
  expect(call.prompt).toBe("Моё правило: добавь семейную ипотеку. Клиент: Интересует новостройка. Нужна ипотечная консультация. Ипотека одобрена. Покупка через два месяца.\nАгент: Перезвоню завтра в 15:00. ");
  expect(result.crm_attributes_result.attributes.funding_source).toBeNull();
  expect(result.crm_attributes_result.update_actions.funding_source).toBe("ERROR");
  expect(result.crm_attributes_result.update_actions.interest).toBe("SET");
  expect(result.crm_attributes_result.update_actions.purchase_term).toBe("SET");
});

test("уточнение стандартного промпта обновляется без потери настроек модели", async ({ page }) => {
  await page.goto(projectUrl);
  await page.evaluate(() => {
    const stage = pipeline.find(s => s.outKey === "interest_extractor")!;
    stage.prompt = "Устаревший стандартный текст {{transcript}}";
    stage.promptEdited = false; stage.promptSource = "preset";
    stage.maxTokens = 3456;
    savePipelineConfig();
  });
  await page.reload();
  const stage = await page.evaluate(() => pipeline.find(s => s.outKey === "interest_extractor"));
  expect(stage.prompt).not.toContain("Устаревший стандартный текст");
  expect(stage.prompt).toContain("клиенту не нужно повторять вслух каждую характеристику объекта");
  expect(stage.prompt).toContain("Проверяй все шесть направлений независимо");
  expect(stage.prompt.match(/\{\{transcript\}\}/g)).toHaveLength(1);
  expect(stage.maxTokens).toBe(3456);
});


test("report 16: Judge исправляет показ сегодня в 18:30 и CRM сохраняет встречу", async ({ page }) => {
  await page.goto(projectUrl);
  await page.locator("#applicationCommunicationCreatedAt").fill("2026-09-28T07:56:45");
  const transcript = "Клиент: Сегодня можем посмотреть?\nАгент: В 18:30 могу быть на месте.\nКлиент: Давайте 18:30.\nАгент: Тогда буду вас ждать.";
  const extracted = { status: "determined", detected: true, next_contact_at: null, precision: "exact", action: "message", actor: "agent",
    raw_time_expression: "18:30", evidence: "В 18:30 могу быть на месте. Давайте 18:30. Тогда буду вас ждать.", confidence: .9, event_anchor: null };
  const corrected = { ...extracted, next_contact_at: "2026-09-28T18:30:00+03:00", action: "meeting", confidence: .95 };
  await installProvider(page, { ...absent(), next_contact_date_extractor: extracted, attributes_judge: {
    next_contact_date: { verdict: "corrected", status: "determined", reason: "Согласован показ сегодня в 18:30", corrected_value: corrected },
  } });
  const { result, calls } = await run(page, transcript);
  expect(calls.at(-1).schema).toBe("application_attributes_judge_v4");
  expect(result.next_contact_semantic_result).toMatchObject({ detected: true, action: "message", actor: "agent", raw_time_expression: "18:30", next_contact_at: null });
  expect(result.next_contact_time_context_normalization).toEqual({ raw_time_expression: "18:30", normalization_input: "Сегодня 18:30", source: "linked_meeting_fragment" });
  expect(result.next_contact_date_extractor).toMatchObject({ detected: true, action: "message", actor: "agent", raw_time_expression: "18:30", next_contact_at: "2026-09-28T18:30:00+03:00", normalization_status: "resolved" });
  expect(result.attributes_judge.judge_verdicts.next_contact_date).toBe("corrected");
  expect(result.attributes_judge.attributes.next_contact_date).toMatchObject({ detected: true, action: "meeting", actor: "agent", raw_time_expression: "18:30", next_contact_at: "2026-09-28T18:30:00+03:00" });
  expect(result.attributes_quality_gate.decisions.next_contact_date).toBe("AUTO_SAVE");
  expect(result.crm_attributes_result).toMatchObject({ attributes: { next_contact_date: "2026-09-28T18:30:00+03:00" }, update_actions: { next_contact_date: "SET" } });
});

test("Гренландия: встреча в среду в 16:00 проходит все этапы и экспорт, без домыслов о финансировании и покупке", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(projectUrl);
  await page.locator("#applicationCommunicationCreatedAt").fill("2026-09-27T11:13:58");
  await installProvider(page, { ...absent(), interest_extractor: candidates().interest_extractor, next_contact_date_extractor: grenlandia.semantic_result });
  const { result, calls, reports } = await run(page, grenlandia.transcript);
  expect(result.crm_attributes_result.attributes).toEqual(grenlandia.expected);
  expect(result.crm_attributes_result.next_contact_resolution).toMatchObject({ status: "resolved", action: "meeting", event_anchor: null });
  expect(result.crm_attributes_result.update_actions).toEqual({ interest: "SET", funding_source: "SKIP", purchase_term: "SKIP", next_contact_date: "SET" });
  expect(result.crm_attributes_result.technical_errors).toEqual([]);
  expect(reports[3].report.contract_audit.response_schema_id).toBe("application_next_contact_date_extractor_v4");
  for (const call of calls) expect(call.prompt.split(grenlandia.transcript)).toHaveLength(2);
  await expect(page.locator("[data-application-attribute-fields] > .fm")).toHaveCount(4);
  await expect(page.locator("[data-result-next-contact-date]")).toHaveText("30 сентября 16:00 · встреча");
  const downloadEvent = page.waitForEvent("download");
  await page.locator("#dlReport").click();
  const exported = testInfo.outputPath("grenlandia-report.json");
  await (await downloadEvent).saveAs(exported);
  const { readFileSync } = await import("node:fs");
  expect(JSON.parse(readFileSync(exported, "utf8")).result.crm_attributes_result.attributes).toEqual(grenlandia.expected);
  await page.locator('[data-application-attributes-result="true"]').screenshot({ path: testInfo.outputPath("grenlandia-result.png") });
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
});

test("последнее подтверждение Среда 4:00 сохраняет согласованные ранее 16:00", async ({ page }) => {
  await page.goto(projectUrl);
  await page.locator("#applicationCommunicationCreatedAt").fill("2026-09-28T11:13:58");
  await installProvider(page, { ...candidates(), next_contact_date_extractor: { ...grenlandia.semantic_result, action: "message", raw_time_expression: "Среда, 4:00" } });
  const { result } = await run(page, grenlandia.transcript);
  expect(result.next_contact_time_context_normalization).toEqual({
    raw_time_expression: "Среда, 4:00",
    normalization_input: "в среду в 16:00",
    source: "confirmed_dialogue_clock",
  });
  expect(result.temporal_normalization_audit).toMatchObject({ strategy: "confirmed_dialogue_clock", precision: "exact" });
  expect(result.next_contact_date_extractor).toMatchObject({ next_contact_at: "2026-09-30T16:00:00+03:00", precision: "exact" });
  expect(result.crm_attributes_result.attributes.next_contact_date).toBe("2026-09-30T16:00:00+03:00");
  expect(result.crm_attributes_result.update_actions.next_contact_date).toBe("SET");
});

test("период суток относится к самому часу, а не к слову дня из смещения даты", async ({ page }) => {
  await page.goto(projectUrl);
  for (const [raw, expected] of [
    ["в среду в 16:00", "2026-09-30T16:00:00+03:00"],
    ["в среду в 4:00", null], ["в среду в 4", null],
    ["в среду в 04:00", "2026-09-30T04:00:00+03:00"],
    ["в среду в 4 утра", "2026-09-30T04:00:00+03:00"],
    ["в среду в 4 дня", "2026-09-30T16:00:00+03:00"],
    ["через два дня в 4:00", null],
    ["через два дня в 04:00", "2026-09-29T04:00:00+03:00"],
    ["через два дня в 4 утра", "2026-09-29T04:00:00+03:00"],
    ["30.09.2026 в 4:00", null],
    ["30 сентября 2026 в 4:00 дня", "2026-09-30T16:00:00+03:00"],
  ] as const) {
    const value = await page.evaluate(raw => applicationAttributesTemporalNormalize(raw, { communication_created_at: "2026-09-27T11:13:58+03:00", timezone: "Europe/Moscow" }), raw);
    expect(value.normalized_datetime, raw).toBe(expected);
  }
});

test("Judge отклоняет сообщение с датой встречи, не блокируя другие атрибуты", async ({ page }) => {
  await page.goto(projectUrl);
  await installProvider(page, { ...candidates(), next_contact_date_extractor: { ...grenlandia.semantic_result, action: "message" } }, { next_contact_date: "judge_reject" });
  const { result } = await run(page, grenlandia.transcript);
  expect(result.crm_attributes_result.update_actions).toEqual({ interest: "SET", funding_source: "SET", purchase_term: "SET", next_contact_date: "SKIP" });
  expect(result.crm_attributes_result.attributes.next_contact_date).toBeNull();
  expect(result.crm_attributes_result.next_contact_policy).toBe("PRESERVE_SYSTEM_FALLBACK_24H");
  expect(result.attributes_metrics.semantic_risk).toBe(true);
  expect(result.attributes_metrics.next_contact_quality).toMatchObject({
    correct_skip: false,
    reason: "CONFIRMED_DATETIME_LOST_OR_CHANGED",
  });
  expect(result.attributes_metrics.quality_score).toBeLessThan(100);
  expect(result.attributes_metrics.overall_confidence).toBeLessThan(1);
});


for (const key of ["interest_extractor", "funding_source_extractor", "purchase_term_extractor", "next_contact_date_extractor", "attributes_judge"]) {
  test(`обрыв JSON ${key}: ограниченный повтор с большим лимитом сохраняет четыре атрибута`, async ({ page }) => {
    await page.goto(projectUrl);
    await installProvider(page, { ...candidates(), next_contact_date_extractor: contact("завтра в 15:00") }, { [key]: "truncated_once" });
    const { result, calls, reports } = await run(page);
    const attempts = calls.filter((call: any) => call.key === key);
    expect(attempts).toHaveLength(2);
    expect(attempts[1].maxTokens).toBeGreaterThan(attempts[0].maxTokens);
    expect(attempts[1].maxTokens).toBeGreaterThanOrEqual(6000);
    expect(attempts[1].maxTokens).toBeLessThanOrEqual(12000);
    expect(reports.find((item: any) => item.stage.outKey === key).report.application_output_token_budgets).toEqual(attempts.map((call: any) => call.maxTokens));
    expect(Object.values(result.crm_attributes_result.update_actions)).toEqual(["SET", "SET", "SET", "SET"]);
  });
}

test("повторный обрыв интереса не запускает бесконечный цикл и не блокирует остальные поля", async ({ page }) => {
  await page.goto(projectUrl);
  await installProvider(page, { ...candidates(), next_contact_date_extractor: contact("завтра в 15:00") }, { interest_extractor: "truncated_always" });
  const { result, calls } = await run(page);
  expect(calls.filter((call: any) => call.key === "interest_extractor")).toHaveLength(2);
  expect(result.crm_attributes_result.update_actions).toEqual({ interest: "ERROR", funding_source: "SET", purchase_term: "SET", next_contact_date: "SET" });
});
