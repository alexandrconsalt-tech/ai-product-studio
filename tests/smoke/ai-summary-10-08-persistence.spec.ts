import { expect, test } from "@playwright/test";

const projectId = "project_ai_summary_2026_08_10";
const configKey = `pipelineLabV3.pipelineConfig.${projectId}`;
const projectUrl = `/pipeline-lab-v3.html?projectId=${projectId}&productName=${encodeURIComponent("AI Summary 10.08")}`;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ key }) => {
    if (sessionStorage.getItem("ai-summary-10-08-test-initialized") === "true") return;
    localStorage.removeItem(key);
    localStorage.removeItem(`${key}.previous`);
    localStorage.removeItem(`${key}.invalid-backup`);
    sessionStorage.setItem("ai-summary-10-08-test-initialized", "true");
  }, { key: configKey });
});

test("recovery pipeline автосохраняет пользовательские правки и переживает reload", async ({ page }) => {
  await page.goto(projectUrl);
  await page.locator("#pipelineToggle").click();

  const stages = page.locator("#stages .stage");
  await expect(stages).toHaveCount(9);
  const stage = stages.first();
  await expect(stage).toContainText("Facts Extractor");
  await stage.locator("[data-toggle]").click();
  await expect(stage.locator("[data-provider]")).toHaveValue("ai-tunnel");
  await expect(stage.locator("[data-model]")).toHaveValue("gpt-5-mini");
  await expect(stage.locator("[data-temperature]")).toHaveValue("0");
  await expect(stage.locator("[data-max-tokens]")).toHaveValue("6000");

  await stage.locator("[data-name]").fill("Facts Extractor — сохранён");
  await stage.locator("[data-prompt]").pressSequentially("\nПользовательская контрольная строка.");
  await page.waitForTimeout(350);
  await expect(page.locator("#pipelineSaveState")).toHaveText("сохранено");

  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), configKey);
  expect(stored.createdAt).toBeTruthy();
  expect(stored.updatedAt).toBeTruthy();
  expect(stored.stages[0]).toMatchObject({
    name: "Facts Extractor — сохранён",
    promptEdited: true,
    settingsEdited: true,
    userEdited: true,
    promptSource: "user_override",
  });
  expect(stored.stages[0].prompt).toContain("Пользовательская контрольная строка.");
  expect(await page.evaluate((key) => Boolean(localStorage.getItem(`${key}.previous`)), configKey)).toBe(true);

  await page.reload();
  await page.locator("#pipelineToggle").click();
  await expect(page.locator("#stages .stage")).toHaveCount(9);
  await expect(page.locator("#stages .stage").first().locator("[data-name]")).toHaveValue("Facts Extractor — сохранён");
  await expect(page.locator("#stages .stage").first().locator("[data-prompt]")).toContainText("Пользовательская контрольная строка.");
});

test("add, duplicate, reorder, toggle и delete сохраняются без повторного recovery", async ({ page }) => {
  await page.goto(projectUrl);
  await page.locator("#pipelineToggle").click();
  await page.locator("#stages .stage").first().locator("[data-toggle]").click();
  await page.locator("#stages .stage").first().locator("[data-duplicate]").click();
  await expect(page.locator("#stages .stage")).toHaveCount(10);
  await page.locator("#stages .stage").nth(1).locator("[data-toggle]").click();
  await page.locator("#stages .stage").nth(1).locator("[data-up]").click();
  await page.locator("#stages .stage").first().locator("label.toggle").click();
  await expect(page.locator("#pipelineSaveState")).toHaveText("сохранено");
  await page.locator("#stages .stage").first().locator("[data-toggle]").click();
  await page.locator("#stages .stage").first().locator("[data-del]").click();
  await expect(page.locator("#stages .stage")).toHaveCount(9);

  await page.reload();
  await page.locator("#pipelineToggle").click();
  await expect(page.locator("#stages .stage")).toHaveCount(9);
  const keys = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).stages.map((item: { outKey: string }) => item.outKey), configKey);
  expect(new Set(keys).size).toBe(keys.length);
});

test("legacy budget 2500 мигрирует в 6000, а другое пользовательское значение сохраняется", async ({ page }) => {
  await page.goto(projectUrl);
  await page.evaluate((key) => {
    const stored = JSON.parse(localStorage.getItem(key)!);
    stored.stages[0].maxTokens = 2500;
    localStorage.setItem(key, JSON.stringify(stored));
  }, configKey);
  await page.reload();
  await page.locator("#pipelineToggle").click();
  await page.locator("#stages .stage").first().locator("[data-toggle]").click();
  await expect(page.locator("#stages .stage").first().locator("[data-max-tokens]")).toHaveValue("6000");
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).stages[0].maxTokens, configKey)).toBe(6000);

  await page.locator("#stages .stage").first().locator("[data-max-tokens]").fill("4321");
  await page.waitForTimeout(350);
  await page.reload();
  await page.locator("#pipelineToggle").click();
  await page.locator("#stages .stage").first().locator("[data-toggle]").click();
  await expect(page.locator("#stages .stage").first().locator("[data-max-tokens]")).toHaveValue("4321");
});

test("Facts vNext передаёт transcript и принимает строгий Structured Output без legacy id", async ({ page }) => {
  await page.route("https://api.aitunnel.ru/v1/chat/completions", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.max_completion_tokens).toBe(6000);
    expect(body).not.toHaveProperty("max_tokens");
    expect(body.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { name: "ai_summary_10_08_facts_v1", strict: true },
    });
    expect(body.response_format.json_schema.schema.properties.facts.items.required).toEqual(["fact", "evidence"]);
    expect(body.response_format.json_schema.schema.properties.facts.items.properties).not.toHaveProperty("id");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ facts: [{ fact: "Клиент рассматривает ипотеку", evidence: "«Консультация по ипотеке нужна»" }], quotes: [] }) }, finish_reason: "stop" }],
        usage: { total_tokens: 321 },
      }),
    });
  });
  await page.addInitScript(() => localStorage.setItem("aiTunnelApiKey", "test-only-key"));
  await page.goto(projectUrl);

  const report = await page.evaluate(async () => {
    const transcript = "Оператор: Консультация по ипотеке нужна?\nКлиент: Да.";
    return runStage(pipeline[0], { __transcript: transcript, transcript });
  });

  expect(report.output).toEqual({ facts: [{ fact: "Клиент рассматривает ипотеку", evidence: "«Консультация по ипотеке нужна»" }], quotes: [] });
  expect(report).toMatchObject({
    status: "ok",
    legacy_parser_used: false,
    parser_fallback_used: false,
    text_fallback_used: false,
    prompt_audit: {
      transcript_present: true,
      transcript_injected: true,
      transcript_sent_to_model: true,
      resolved_prompt_contains_transcript: true,
    },
    contract_audit: {
      prompt_contract_id: "ai_summary_10_08_facts",
      response_schema_id: "ai_summary_10_08_facts_v1",
      parser_schema_id: "ai_summary_10_08_facts_v1",
      contract_version: "v1",
      structured_output_requested: true,
      structured_output_applied: true,
      all_contracts_match: true,
      parse_status: "SUCCESS",
      schema_status: "VALID",
      repair_attempted: false,
    },
    configured_max_tokens: 6000,
    requested_output_token_budget: 6000,
    effective_output_token_budget: 6000,
    output_token_parameter: "max_completion_tokens",
  });
});

test("Needs vNext использует собственный strict contract без legacy Attributes parser", async ({ page }) => {
  await page.route("https://api.aitunnel.ru/v1/chat/completions", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.max_completion_tokens).toBe(6000);
    expect(body.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { name: "ai_summary_10_08_needs_v1", strict: true },
    });
    expect(body.response_format.json_schema.schema).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["primary_need", "requirements", "preferences", "objections", "unresolved_questions"],
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              primary_need: "Подобрать квартиру для покупки",
              requirements: ["Две комнаты"],
              preferences: [],
              objections: [],
              unresolved_questions: ["Срок покупки"],
            }),
          },
          finish_reason: "stop",
        }],
        usage: { total_tokens: 222 },
      }),
    });
  });
  await page.addInitScript(() => localStorage.setItem("aiTunnelApiKey", "test-only-key"));
  await page.goto(projectUrl);

  const report = await page.evaluate(async () => {
    const transcript = "Клиент: Ищу двухкомнатную квартиру для покупки.";
    const stage = {
      ...pipeline[0],
      name: "Needs Extractor",
      outKey: "needs_extractor",
      prompt: "Проанализируй транскрибацию:\n{{transcript}}",
    };
    return runStage(stage, { __transcript: transcript, transcript });
  });

  expect(report.output).toEqual({
    primary_need: "Подобрать квартиру для покупки",
    requirements: ["Две комнаты"],
    preferences: [],
    objections: [],
    unresolved_questions: ["Срок покупки"],
  });
  expect(report).toMatchObject({
    status: "ok",
    legacy_parser_used: false,
    parser_fallback_used: false,
    text_fallback_used: false,
    prompt_audit: {
      transcript_present: true,
      transcript_injected: true,
      transcript_available: true,
      transcript_delivery: "prompt",
      transcript_sent_to_model: true,
      resolved_prompt_contains_transcript: true,
    },
    contract_audit: {
      prompt_contract_id: "ai_summary_10_08_needs",
      response_schema_id: "ai_summary_10_08_needs_v1",
      parser_schema_id: "ai_summary_10_08_needs_v1",
      contract_version: "v1",
      structured_output_requested: true,
      structured_output_applied: true,
      all_contracts_match: true,
      parse_status: "SUCCESS",
      schema_status: "VALID",
      repair_attempted: false,
    },
  });
});

test("Outcome использует agreement strict contract без legacy agreements и fallback", async ({ page }) => {
  await page.route("https://api.aitunnel.ru/v1/chat/completions", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { name: "ai_summary_10_08_outcome_v1", strict: true },
    });
    expect(body.response_format.json_schema.schema).toMatchObject({
      additionalProperties: false,
      required: ["call_result", "agreement", "next_step", "responsible_party", "deadline", "channel"],
    });
    expect(body.response_format.json_schema.schema.properties).not.toHaveProperty("agreements");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          call_result: "Согласовано продолжение общения в Telegram",
          agreement: "Агент напишет клиенту в Telegram в течение пяти минут",
          next_step: "Агент напишет клиенту в Telegram",
          responsible_party: "agent",
          deadline: "в течение пяти минут",
          channel: "Telegram",
        }) }, finish_reason: "stop" }],
        usage: { total_tokens: 180 },
      }),
    });
  });
  await page.addInitScript(() => localStorage.setItem("aiTunnelApiKey", "test-only-key"));
  await page.goto(projectUrl);

  const report = await page.evaluate(async () => {
    const transcript = "Клиент: Напишите в Telegram. Агент: Напишу в течение пяти минут.";
    const stage = { ...pipeline[0], name: "Outcome Extractor", outKey: "outcome_extractor", prompt: "{{transcript}}" };
    return runStage(stage, { __transcript: transcript, transcript });
  });

  expect(report.output).toMatchObject({ responsible_party: "agent", channel: "Telegram" });
  expect(report.output).toHaveProperty("agreement");
  expect(report.output).not.toHaveProperty("agreements");
  expect(report).toMatchObject({
    status: "ok",
    legacy_parser_used: false,
    parser_fallback_used: false,
    text_fallback_used: false,
    repair_fallback_used: false,
    contract_audit: {
      prompt_contract_id: "ai_summary_10_08_outcome",
      response_schema_id: "ai_summary_10_08_outcome_v1",
      parser_schema_id: "ai_summary_10_08_outcome_v1",
      contract_version: "v1",
      structured_output_requested: true,
      structured_output_applied: true,
      all_contracts_match: true,
      parse_status: "SUCCESS",
      schema_status: "VALID",
      repair_attempted: false,
    },
  });
});

test("Conversation Judge получает только current-run upstream и strict structured output", async ({ page }) => {
  const expectedJudge = {
    verified_facts: [{ fact: "Покупка для собственного проживания", evidence: "«для себя»" }],
    verified_quotes: ["«для себя»"],
    verified_needs: { primary_need: "Купить квартиру для проживания", requirements: [], preferences: [], objections: [], unresolved_questions: ["Условия финансирования"] },
    verified_outcome: { call_result: "Согласовано дальнейшее действие: агент напишет клиенту", agreement: "Агент напишет клиенту", next_step: "Агент напишет клиенту", responsible_party: "agent", deadline: "в течение пяти минут", channel: "Telegram" },
    decisions: { facts: "correct", needs: "correct", outcome: "approve" },
    issues: ["Удалён CRM-мусор"],
  };
  await page.route("https://api.aitunnel.ru/v1/chat/completions", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.response_format).toMatchObject({ type: "json_schema", json_schema: { name: "ai_summary_10_08_conversation_judge_v1", strict: true } });
    expect(body.response_format.json_schema.schema).toMatchObject({
      additionalProperties: false,
      required: ["verified_facts", "verified_quotes", "verified_needs", "verified_outcome", "decisions", "issues"],
    });
    const resolvedPrompt = body.messages[0].content as string;
    expect(resolvedPrompt).toContain("CURRENT TRANSCRIPT");
    expect(resolvedPrompt).toContain("Текущий факт");
    expect(resolvedPrompt).toContain("Текущая потребность");
    expect(resolvedPrompt).toContain("Telegram");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(expectedJudge) }, finish_reason: "stop" }], usage: { total_tokens: 410 } }) });
  });
  await page.addInitScript(() => localStorage.setItem("aiTunnelApiKey", "test-only-key"));
  await page.goto(projectUrl);

  const report = await page.evaluate(async () => {
    const current = { run_id: "run-current", transcript_hash: "transcript-current", pipeline_configuration_hash: "pipeline-current" };
    const ctx = {
      __transcript: "CURRENT TRANSCRIPT\nАгент:\n— Я напишу вам в Telegram в течение пяти минут.\nКлиент:\n— Да, хорошо.",
      __run_id: current.run_id,
      __transcript_hash: current.transcript_hash,
      __pipeline_configuration_hash: current.pipeline_configuration_hash,
      facts_extractor: { facts: [{ fact: "Текущий факт", evidence: "цитата" }], quotes: [] },
      needs_extractor: { primary_need: "Текущая потребность", requirements: [], preferences: [], objections: [], unresolved_questions: [] },
      outcome_extractor: { call_result: "Согласовано дальнейшее действие: агент напишет клиенту", agreement: "Агент напишет клиенту", next_step: "Агент напишет клиенту", responsible_party: "agent", deadline: "в течение пяти минут", channel: "Telegram" },
      __stage_provenance: Object.fromEntries(["facts_extractor", "needs_extractor", "outcome_extractor"].map((key) => [key, current])),
    };
    const stage = { ...pipeline[0], type: "check", name: "Conversation Judge", outKey: "conversation_judge", prompt: "{{transcript}}\n{{ctx.facts_extractor}}\n{{ctx.needs_extractor}}\n{{ctx.outcome_extractor}}" };
    return runStage(stage, ctx);
  });

  expect(report.output).toEqual(expectedJudge);
  expect(report).toMatchObject({
    status: "ok",
    legacy_parser_used: false,
    parser_fallback_used: false,
    text_fallback_used: false,
    repair_fallback_used: false,
    provenance_validation: { valid: true, expected: { run_id: "run-current", transcript_hash: "transcript-current", pipeline_configuration_hash: "pipeline-current" } },
    contract_audit: {
      prompt_contract_id: "ai_summary_10_08_conversation_judge",
      response_schema_id: "ai_summary_10_08_conversation_judge_v1",
      parser_schema_id: "ai_summary_10_08_conversation_judge_v1",
      contract_version: "v1",
      structured_output_requested: true,
      structured_output_applied: true,
      all_contracts_match: true,
      parse_status: "SUCCESS",
      schema_status: "VALID",
      repair_attempted: false,
    },
  });
});

test("Conversation Judge блокируется до вызова модели при stale upstream provenance", async ({ page }) => {
  let requests = 0;
  await page.route("https://api.aitunnel.ru/v1/chat/completions", async (route) => { requests += 1; await route.abort(); });
  await page.addInitScript(() => localStorage.setItem("aiTunnelApiKey", "test-only-key"));
  await page.goto(projectUrl);

  const report = await page.evaluate(async () => {
    const stage = { ...pipeline[0], type: "check", name: "Conversation Judge", outKey: "conversation_judge", prompt: "{{transcript}} {{ctx.facts_extractor}} {{ctx.needs_extractor}} {{ctx.outcome_extractor}}" };
    const ctx = {
      __transcript: "CURRENT TRANSCRIPT", __run_id: "current", __transcript_hash: "current-transcript", __pipeline_configuration_hash: "current-pipeline",
      facts_extractor: {}, needs_extractor: {}, outcome_extractor: {},
      __stage_provenance: {
        facts_extractor: { run_id: "stale", transcript_hash: "current-transcript", pipeline_configuration_hash: "current-pipeline" },
        needs_extractor: { run_id: "current", transcript_hash: "current-transcript", pipeline_configuration_hash: "current-pipeline" },
        outcome_extractor: { run_id: "current", transcript_hash: "current-transcript", pipeline_configuration_hash: "current-pipeline" },
      },
    };
    return runStage(stage, ctx);
  });

  expect(requests).toBe(0);
  expect(report).toMatchObject({
    status: "bad",
    tokens: 0,
    repair_fallback_used: false,
    provenance_validation: { valid: false },
    output: { status: "technical_error", decision: "technical_error", error_code: "CURRENT_RUN_PROVENANCE_VALIDATION_FAILED" },
    contract_audit: { parse_status: "NOT_ATTEMPTED", schema_status: "INVALID_INPUT", repair_attempted: false },
  });
});

test("Summary Generator использует versioned Structured Output только из current-run clean store", async ({ page }) => {
  const expectedSummary = {
    conversation_result: "Клиент уточняет условия покупки и финансирования.",
    key_facts: ["Первоначальный взнос — около 1,4 млн ₽, примерно 20%"],
    quotes: ["«Рассрочку тоже рассматриваю»"],
    next_step: "Агент напишет клиенту в Telegram в течение пяти минут.",
  };
  await page.route("https://api.aitunnel.ru/v1/chat/completions", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.response_format).toMatchObject({ type: "json_schema", json_schema: { name: "ai_summary_10_08_summary_v1", strict: true } });
    expect(body.response_format.json_schema.schema).toMatchObject({
      additionalProperties: false,
      required: ["conversation_result", "key_facts", "quotes", "next_step"],
      properties: { key_facts: { maxItems: 5 }, quotes: { maxItems: 2 } },
    });
    const resolvedPrompt = body.messages[0].content as string;
    expect(resolvedPrompt).toContain("CURRENT CLEAN STORE MARKER");
    expect(resolvedPrompt).not.toContain("FORBIDDEN TRANSCRIPT MARKER");
    expect(resolvedPrompt).not.toContain("FORBIDDEN EXTRACTOR MARKER");
    expect(resolvedPrompt).not.toContain("FORBIDDEN JUDGE MARKER");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(expectedSummary) }, finish_reason: "stop" }], usage: { total_tokens: 250 } }) });
  });
  await page.addInitScript(() => localStorage.setItem("aiTunnelApiKey", "test-only-key"));
  await page.goto(projectUrl);

  const result = await page.evaluate(async () => {
    const current = { run_id: "summary-run", transcript_hash: "summary-transcript", pipeline_configuration_hash: "summary-pipeline" };
    const ctx = {
      __transcript: "FORBIDDEN TRANSCRIPT MARKER",
      __run_id: current.run_id,
      __transcript_hash: current.transcript_hash,
      __pipeline_configuration_hash: current.pipeline_configuration_hash,
      facts_extractor: { marker: "FORBIDDEN EXTRACTOR MARKER" },
      conversation_judge: { marker: "FORBIDDEN JUDGE MARKER" },
      clean_conversation_store: {
        facts: [{ fact: "CURRENT CLEAN STORE MARKER", evidence: "Подтверждено" }], quotes: [],
        needs: { primary_need: "Уточнить условия", requirements: [], preferences: [], objections: [], unresolved_questions: [] },
        outcome: { call_result: "Продолжение", agreement: "Написать", next_step: "Написать", responsible_party: "agent", deadline: "пять минут", channel: "Telegram" },
        cleaning: { removed_items: [], deduplicated_items: [], normalizations: [], warnings: [] },
        source_decisions: { facts: "approve", needs: "approve", outcome: "approve" }, status: "READY",
      },
      __stage_provenance: { clean_conversation_store: current },
    };
    const stage = pipeline.find((item: { outKey: string }) => item.outKey === "summary_generator");
    return { report: await runStage(stage, ctx), audit: stageContextAudit(stage, ctx) };
  });

  expect(result.report.output).toEqual(expectedSummary);
  expect(result.report).toMatchObject({
    status: "ok",
    legacy_parser_used: false, parser_fallback_used: false, text_fallback_used: false, repair_fallback_used: false, model_fallback: false,
    provenance_validation: { valid: true, sources: { clean_conversation_store: { current_run: true } } },
    contract_audit: {
      prompt_contract_id: "ai_summary_10_08_summary", response_schema_id: "ai_summary_10_08_summary_v1", parser_schema_id: "ai_summary_10_08_summary_v1",
      contract_version: "v1", structured_output_requested: true, structured_output_applied: true, all_contracts_match: true,
      parse_status: "SUCCESS", schema_status: "VALID", repair_attempted: false,
    },
  });
  expect(result.audit).toMatchObject({ required_context_keys: ["clean_conversation_store"], current_run_provenance_valid: true, resolved_context_keys: { clean_conversation_store: true } });
});

test("Summary Generator не вызывает LLM при stale clean store provenance", async ({ page }) => {
  let requests = 0;
  await page.route("https://api.aitunnel.ru/v1/chat/completions", async (route) => { requests += 1; await route.abort(); });
  await page.addInitScript(() => localStorage.setItem("aiTunnelApiKey", "test-only-key"));
  await page.goto(projectUrl);
  const report = await page.evaluate(async () => {
    const stage = pipeline.find((item: { outKey: string }) => item.outKey === "summary_generator");
    return runStage(stage, {
      __run_id: "current", __transcript_hash: "current-transcript", __pipeline_configuration_hash: "current-pipeline",
      clean_conversation_store: { status: "READY" },
      __stage_provenance: { clean_conversation_store: { run_id: "stale", transcript_hash: "current-transcript", pipeline_configuration_hash: "current-pipeline" } },
    });
  });
  expect(requests).toBe(0);
  expect(report).toMatchObject({ status: "bad", tokens: 0, provenance_validation: { valid: false }, output: { status: "technical_error", error_code: "CURRENT_RUN_PROVENANCE_VALIDATION_FAILED" }, contract_audit: { parse_status: "NOT_ATTEMPTED", schema_status: "INVALID_INPUT", repair_attempted: false } });
});

test("сохранённый Needs stage переживает reload и не заменяется recovery preset", async ({ page }) => {
  await page.goto(projectUrl);
  await page.locator("#pipelineToggle").click();

  const needsStage = page.locator("#stages .stage").nth(1);
  await needsStage.locator("[data-toggle]").click();
  await needsStage.locator("[data-name]").fill("Needs Extractor");
  await needsStage.locator("[data-outkey]").fill("needs_extractor");
  await needsStage.locator("[data-prompt]").fill("Сохранённый Needs prompt {{transcript}}");
  await page.waitForTimeout(350);
  await expect(page.locator("#pipelineSaveState")).toHaveText("сохранено");

  await page.reload();
  await page.locator("#pipelineToggle").click();
  await expect(page.locator("#stages .stage")).toHaveCount(9);
  const restoredNeeds = page.locator("#stages .stage").nth(1);
  await restoredNeeds.locator("[data-toggle]").click();
  await expect(restoredNeeds.locator("[data-name]")).toHaveValue("Needs Extractor");
  await expect(restoredNeeds.locator("[data-outkey]")).toHaveValue("needs_extractor");
  await expect(restoredNeeds.locator("[data-prompt]")).toHaveValue("Сохранённый Needs prompt {{transcript}}");
});

test("Store Cleaner v4 отображается пятым code-stage, не показывает LLM settings и переживает reload", async ({ page }) => {
  await page.goto(projectUrl);
  await page.locator("#pipelineToggle").click();
  const stages = page.locator("#stages .stage");
  await expect(stages).toHaveCount(9);
  await expect(stages.locator(".st-name")).toHaveText(["Facts Extractor", "Needs Extractor", "Outcome Extractor", "Conversation Judge", "Store Cleaner", "Summary Generato", "Summary Judge", "Summary Quality Gate", "CRM Result"]);
  const cleaner = stages.nth(4);
  await expect(cleaner.locator(".st-type")).toHaveText("Код");
  await cleaner.locator("[data-toggle]").click();
  await expect(cleaner.locator("[data-deterministic-stage-details]")).toContainText("Deterministic Contract / code");
  await expect(cleaner.locator("[data-deterministic-stage-details]")).toContainText("conversation_judge · current run");
  await expect(cleaner.locator("[data-provider]")).toHaveCount(0);
  await expect(cleaner.locator("[data-model]")).toHaveCount(0);
  await expect(cleaner.locator("[data-temperature]")).toHaveCount(0);
  await expect(cleaner.locator("[data-max-tokens]")).toHaveCount(0);

  await page.reload();
  await page.locator("#pipelineToggle").click();
  await expect(page.locator("#stages .stage")).toHaveCount(9);
  await expect(page.locator("#stages .stage").nth(4).locator(".st-name")).toHaveText("Store Cleaner");
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).stages[4].stageVersion, configKey)).toBe("v4");
});

test("Summary Quality Gate и CRM Result — deterministic CODE stages с нулевой LLM telemetry", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.goto(projectUrl);
  await page.locator("#pipelineToggle").click();
  const stages = page.locator("#stages .stage");
  await expect(stages).toHaveCount(9);
  await expect(stages.nth(7).locator(".st-name")).toHaveText("Summary Quality Gate");
  await expect(stages.nth(7).locator(".st-type")).toHaveText("Код");
  await expect(stages.nth(8).locator(".st-name")).toHaveText("CRM Result");
  await expect(stages.nth(8).locator(".st-type")).toHaveText("Код");

  const before = await page.evaluate((key) => JSON.stringify(JSON.parse(localStorage.getItem(key)!).stages.slice(0, 7)), configKey);
  const reports = await page.evaluate(async () => {
    const current = { __run_id: "run-1", __transcript_hash: "transcript-1", __pipeline_configuration_hash: "pipeline-1" };
    const provenance = { run_id: "run-1", transcript_hash: "transcript-1", pipeline_configuration_hash: "pipeline-1", execution_status: "SUCCESS", parse_status: "SUCCESS", schema_status: "VALID", structured_output_requested: true, structured_output_applied: true };
    const context: any = {
      ...current,
      summary_judge: { scores: { faithfulness: 100, completeness: 100, usefulness: 100, agreements_next_step: 100, format: 75 }, quality_score: 95, confidence: 0.95, decision: "pass", issues: [] },
      summary_generator: { conversation_result: "Результат", key_facts: ["Факт"], quotes: [], next_step: "" },
      __stage_provenance: { summary_judge: { ...provenance }, summary_generator: { ...provenance } },
    };
    const gateStage = pipeline.find((stage: any) => stage.outKey === "summary_quality_gate");
    const crmStage = pipeline.find((stage: any) => stage.outKey === "crm_summary_result");
    const gate = await runStage(gateStage, context);
    context.summary_quality_gate = gate.output;
    context.__stage_provenance.summary_quality_gate = { ...provenance };
    const crm = await runStage(crmStage, context);
    return { gate, crm };
  });
  expect(reports.gate).toMatchObject({ output: { gate_status: "PASS" }, stage_type: "code", llm_call: false, tokens: 0, cost: 0, provider: null, model: null, current_run_provenance_valid: true, input_schema_valid: true, output_schema_valid: true });
  expect(reports.crm).toMatchObject({ output: { crm_action: "SAVE", pipeline_status: "READY" }, stage_type: "code", llm_call: false, tokens: 0, cost: 0, provider: null, model: null, current_run_provenance_valid: true, input_schema_valid: true, output_schema_valid: true });

  await page.reload();
  await page.locator("#pipelineToggle").click();
  await expect(page.locator("#stages .stage")).toHaveCount(9);
  const after = await page.evaluate((key) => JSON.stringify(JSON.parse(localStorage.getItem(key)!).stages.slice(0, 7)), configKey);
  expect(after).toBe(before);
  expect(consoleErrors).toEqual([]);
});

test("Conversation Judge получает role-consistency appendix без изменения settings и остальных LLM prompts", async ({ page }) => {
  await page.goto(projectUrl);
  const before = await page.evaluate((key) => {
    const stored = JSON.parse(localStorage.getItem(key)!);
    const immutable = stored.stages.map((stage: Record<string, unknown>) => ({
      outKey: stage.outKey, provider: stage.provider, model: stage.model, temperature: stage.temperature, maxTokens: stage.maxTokens, contractId: stage.contractId, schemaId: stage.schemaId,
    }));
    const otherPrompts = [0, 1, 2, 5].map((index) => stored.stages[index].prompt);
    stored.stages[3].prompt = "LEGACY USER JUDGE PROMPT\n{{transcript}}\n{{ctx.facts_extractor}}\n{{ctx.needs_extractor}}\n{{ctx.outcome_extractor}}";
    localStorage.setItem(key, JSON.stringify(stored));
    return { immutable, otherPrompts };
  }, configKey);
  await page.reload();
  const after = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).stages, configKey);
  expect(after[3].prompt).toContain("LEGACY USER JUDGE PROMPT");
  expect(after[3].prompt).toContain("AI_SUMMARY_JUDGE_ROLE_CONSISTENCY_V2");
  expect(after[3].prompt).toContain("AI_SUMMARY_JUDGE_SELLER_SCOPE_V3");
  expect(after[3].prompt).toContain("AI_SUMMARY_JUDGE_OUTCOME_EVIDENCE_V4");
  expect(after[3].prompt).toContain("ROLE_INCONSISTENCY:");
  expect(after.map((stage: Record<string, unknown>) => ({ outKey: stage.outKey, provider: stage.provider, model: stage.model, temperature: stage.temperature, maxTokens: stage.maxTokens, contractId: stage.contractId, schemaId: stage.schemaId }))).toEqual(before.immutable);
  expect([0, 1, 2, 5].map((index) => after[index].prompt)).toEqual(before.otherPrompts);
});

test("Summary Judge усиливает только agreements_next_step и сохраняет порядок и пользовательские настройки", async ({ page }) => {
  await page.goto(projectUrl);
  const before = await page.evaluate((key) => {
    const stored = JSON.parse(localStorage.getItem(key)!);
    const stage = {
      enabled: true, type: "llm", name: "Summary Judge", outKey: "summary_judge",
      prompt: "CUSTOM SUMMARY JUDGE\n{{ctx.clean_conversation_store}}\n{{ctx.summary_generator}}",
      provider: "ai-tunnel", model: "gpt-5-mini", temperature: 0, maxTokens: 4321,
      userEdited: true, promptEdited: true, settingsEdited: true, promptSource: "user_override",
    };
    stored.stages[6] = stage;
    localStorage.setItem(key, JSON.stringify(stored));
    return { prompts: stored.stages.slice(0, 6).map((item: { prompt?: string }) => item.prompt), settings: { provider: stage.provider, model: stage.model, temperature: stage.temperature, maxTokens: stage.maxTokens } };
  }, configKey);

  await page.reload();
  await page.locator("#pipelineToggle").click();
  const stages = page.locator("#stages .stage");
  await expect(stages).toHaveCount(9);
  await expect(stages.locator(".st-name")).toHaveText(["Facts Extractor", "Needs Extractor", "Outcome Extractor", "Conversation Judge", "Store Cleaner", "Summary Generato", "Summary Judge", "Summary Quality Gate", "CRM Result"]);
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).stages, configKey);
  expect(stored[6].prompt).toContain("CUSTOM SUMMARY JUDGE");
  expect(stored[6].prompt).toContain("AI_SUMMARY_SUMMARY_JUDGE_EVIDENCE_V2");
  expect({ provider: stored[6].provider, model: stored[6].model, temperature: stored[6].temperature, maxTokens: stored[6].maxTokens }).toEqual(before.settings);
  expect(stored.slice(0, 3).map((item: { prompt?: string }) => item.prompt)).toEqual(before.prompts.slice(0, 3));
  expect(stored[4].prompt).toBe(before.prompts[4]);
  expect(stored[5].prompt).toBe(before.prompts[5]);
});

test("Conversation Judge v5 стабилизирует business outcome и Summary Judge применяет evidence severity", async ({ page }) => {
  await page.goto(projectUrl);
  const result = await page.evaluate(() => {
    const guard = (window as typeof window & { __AI_SUMMARY_10_08_CONVERSATION_JUDGE_V5__: any }).__AI_SUMMARY_10_08_CONVERSATION_JUDGE_V5__;
    const transcript = "Агент:\n— Я могу завтра вам перезвонить.\nНеизвестный спикер:\n— Дава... не слышно.";
    const empty = { call_result: "Просмотр не назначен", agreement: "", next_step: "", responsible_party: "", deadline: "", channel: "" };
    const proposed = { call_result: "Просмотр не назначен", agreement: "Агент перезвонит", next_step: "Агент перезвонит", responsible_party: "agent", deadline: "завтра", channel: "телефон" };
    const judge = { verified_facts: [], verified_quotes: [], verified_needs: { primary_need: "", requirements: [], preferences: [], objections: [], unresolved_questions: [] }, verified_outcome: proposed, decisions: { facts: "approve", needs: "approve", outcome: "correct" }, issues: [] };
    const outcomes = Array.from({ length: 5 }, () => guard.validateConversationJudge(judge, { transcript, outcomeExtractor: empty }).output.verified_outcome);
    const summaryJudge = guard.applySummaryJudgeEvidence(
      { scores: { faithfulness: 100, completeness: 100, usefulness: 100, agreements_next_step: 100, format: 100 }, quality_score: 100, confidence: 0.95, decision: "pass", issues: [] },
      { transcript, outcomeExtractor: empty, cleanOutcome: proposed, summary: { conversation_result: "Согласован звонок.", key_facts: [], quotes: [], next_step: "Агент перезвонит завтра по телефону." } },
    ).output;
    const channelTranscript = "Агент:\n— Я отправлю фотографии в Telegram или MAX.\nКлиент:\n— Отлично, буду ждать.";
    const channelOutcome = { call_result: "Согласована отправка фотографий", agreement: "Агент отправит фотографии", next_step: "Агент отправит фотографии", responsible_party: "agent", deadline: "", channel: "" };
    const channelSummaryJudge = guard.applySummaryJudgeEvidence(
      { scores: { faithfulness: 100, completeness: 100, usefulness: 100, agreements_next_step: 100, format: 100 }, quality_score: 100, confidence: 0.95, decision: "pass", issues: [] },
      { transcript: channelTranscript, outcomeExtractor: { ...channelOutcome, channel: "Telegram" }, cleanOutcome: channelOutcome, summary: { conversation_result: "Агент отправит фотографии.", key_facts: [], quotes: [], next_step: "Агент отправит фотографии в Telegram." } },
    ).output;
    return { outcomes, summaryJudge, channelSummaryJudge };
  });

  expect(new Set(result.outcomes.map((item: unknown) => JSON.stringify(item))).size).toBe(1);
  expect(result.outcomes[0]).toMatchObject({ agreement: "", next_step: "", responsible_party: "", deadline: "", channel: "" });
  expect(result.summaryJudge.scores.agreements_next_step).toBeLessThanOrEqual(25);
  expect(result.summaryJudge.decision).toBe("fail");
  expect(result.summaryJudge.issues.join(" ")).toContain("UNSUPPORTED_AGREEMENT");
  expect(result.channelSummaryJudge.scores.agreements_next_step).toBe(75);
  expect(result.channelSummaryJudge.decision).toBe("warning");
  expect(result.channelSummaryJudge.issues.join(" ")).toContain("UNSUPPORTED_CHANNEL");
});

test("Summary Generator contract routing сохраняется после reload и мигрирует legacy stage без замены prompt/settings", async ({ page }) => {
  await page.goto(projectUrl);
  const before = await page.evaluate((key) => {
    const stored = JSON.parse(localStorage.getItem(key)!);
    const summary = stored.stages.find((stage: { outKey: string }) => stage.outKey === "summary_generator");
    const snapshot = { prompt: summary.prompt, provider: summary.provider, model: summary.model, temperature: summary.temperature, maxTokens: summary.maxTokens };
    delete summary.contractId; delete summary.contractVersion; delete summary.schemaId;
    localStorage.setItem(key, JSON.stringify(stored));
    return snapshot;
  }, configKey);
  await page.reload();
  const after = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).stages.find((stage: { outKey: string }) => stage.outKey === "summary_generator"), configKey);
  expect(after).toMatchObject({ ...before, contractId: "ai_summary_10_08_summary", contractVersion: "v1", schemaId: "ai_summary_10_08_summary_v1" });
});

test("миграция четырёх пользовательских stages восстанавливает актуальные stages 5–9, сохраняя prompts/settings", async ({ page }) => {
  await page.goto(projectUrl);
  const before = await page.evaluate((key) => {
    const stored = JSON.parse(localStorage.getItem(key)!);
    stored.stages[0].prompt += "\nUSER CONFIG MUST STAY";
    stored.stages[0].temperature = 0.37;
    stored.stages = stored.stages.slice(0, 4);
    stored.updatedAt = "2099-01-01T00:00:00.000Z";
    localStorage.setItem(key, JSON.stringify(stored));
    return stored.stages;
  }, configKey);

  await page.reload();
  const after = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).stages, configKey);
  expect(after).toHaveLength(9);
  expect(after.slice(0, 4)).toEqual(before);
  expect(after[4]).toMatchObject({ name: "Store Cleaner", type: "code", outKey: "clean_conversation_store", codeFn: "aiSummaryStoreCleaner" });
  expect(after[5]).toMatchObject({ outKey: "summary_generator", contractId: "ai_summary_10_08_summary", schemaId: "ai_summary_10_08_summary_v1" });
  expect(after[6]).toMatchObject({ name: "Summary Judge", type: "llm", outKey: "summary_judge" });
  expect(after[7]).toMatchObject({ name: "Summary Quality Gate", type: "code", outKey: "summary_quality_gate", codeFn: "aiSummaryQualityGate" });
  expect(after[8]).toMatchObject({ name: "CRM Result", type: "code", outKey: "crm_summary_result", codeFn: "aiSummaryCrmResult" });
});

test("Store Cleaner v4 выполняет CRM/role cleanup, priority cap, financial invariant и current-run provenance", async ({ page }) => {
  await page.goto(projectUrl);
  const report = await page.evaluate(async () => {
    const current = { run_id: "run-55", transcript_hash: "transcript-55", pipeline_configuration_hash: "pipeline-55" };
    const ctx = {
      __run_id: current.run_id,
      __transcript_hash: current.transcript_hash,
      __pipeline_configuration_hash: current.pipeline_configuration_hash,
      conversation_judge: {
        verified_facts: [
          { fact: "Клиента интересует объект по адресу: Россия, Санкт-Петербург, улица Печатника Григорьева, 16/3", evidence: "Адрес" },
          { fact: "Клиент рассматривает студию", evidence: "Студия" },
          { fact: "Клиент приобретает квартиру для себя, для жизни", evidence: "Для жизни" },
          { fact: "Клиент попросил информацию по наличию квартир и ценам", evidence: "Наличие и цены" },
          { fact: "Клиент подтвердил, что нужна консультация по ипотеке", evidence: "Да" },
          { fact: "Клиент рассматривает рассрочку в зависимости от условий", evidence: "Рассрочка" },
          { fact: "Клиент продиктовал цену, транскрипция повреждена: значение неоднозначно и не нормализовано", evidence: "7 м00000" },
          { fact: "Клиент располагает первоначальным взносом примерно 1 400 000 ₽ (около 20%)", evidence: "Миллион четыреста" },
          { fact: "Клиент не обращался к застройщику", evidence: "Не обращался" },
          { fact: "Клиент предпочитает Telegram", evidence: "Telegram" },
          { fact: "Клиент смотрит конкретную квартиру", evidence: "Эту квартиру" },
          { fact: "Клиент задаёт вопрос о юридическом статусе", evidence: "Жилой дом?" },
          { fact: "Клиент обновил фотографии объявления сегодня", evidence: "Я сегодня фотографировал объект" },
        ],
        verified_quotes: ["Первая цитата", "Вторая цитата", "Третья цитата"],
        verified_needs: { primary_need: "Получить условия покупки", requirements: [], preferences: [], objections: [], unresolved_questions: [] },
        verified_outcome: { call_result: "Согласовано, что агент свяжется с клиентом в Telegram", agreement: "Агент напишет клиенту в Telegram в течение 5 минут (клиент подтвердил)", next_step: "Агент напишет клиенту в Telegram", responsible_party: "agent", deadline: "в течение 5 минут", channel: "Telegram" },
        decisions: { facts: "approve", needs: "correct", outcome: "approve" },
        issues: ["ROLE_INCONSISTENCY: клиент обновил фотографии объявления и фотографировал объект"],
      },
      __stage_provenance: { conversation_judge: current },
    };
    return runStage(pipeline.find((stage: { outKey: string }) => stage.outKey === "clean_conversation_store"), ctx);
  });

  expect(report).toMatchObject({
    status: "ok", tokens: 0, cost: 0, provider: null, model: null, actual_model: null, llm_call: "none",
    provenance_validation: { valid: true, source: "conversation_judge" },
    contract_audit: { contract_id: "ai_summary_10_08_clean_conversation_store", response_schema_id: "ai_summary_10_08_clean_conversation_store_v1", parser_schema_id: "ai_summary_10_08_clean_conversation_store_v1", schema_status: "VALID", repair_attempted: false },
    output: { status: "READY", source_decisions: { facts: "approve", needs: "correct", outcome: "approve" } },
  });
  expect(report.output.facts).toHaveLength(7);
  expect(report.output.quotes).toHaveLength(2);
  expect(report.output.cleaning.removed_items).toContain("fact[0]: CRM_OBJECT_ADDRESS");
  expect(report.output.cleaning.removed_items).toContain("fact[6]: STT_META_NOISE");
  expect(report.output.cleaning.removed_items).toContain("fact[12]: ROLE_INCONSISTENCY");
  expect(report.output.cleaning.normalizations).toContain("facts: priority cap 10 → 7");
  expect(report.output.facts.some((item: { fact: string }) => item.fact.includes("первоначальным взносом"))).toBe(true);
  expect(report.output.outcome).toMatchObject({ responsible_party: "agent", deadline: "в течение 5 минут", channel: "Telegram" });
});

test("произвольный custom LLM stage передаёт свой Max Tokens без подмены", async ({ page }) => {
  await page.route("https://api.aitunnel.ru/v1/chat/completions", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.max_completion_tokens).toBe(4321);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ result: "ok" }) }, finish_reason: "stop" }],
        usage: { total_tokens: 42 },
      }),
    });
  });
  await page.addInitScript(() => localStorage.setItem("aiTunnelApiKey", "test-only-key"));
  await page.goto(projectUrl);

  const report = await page.evaluate(async () => {
    const stage = { ...pipeline[0], name: "Custom LLM Stage", outKey: "custom_llm_stage", prompt: "Транскрибация: {{transcript}}\nВерни JSON: {\"result\":\"ok\"}", maxTokens: 4321 };
    return runStage(stage, { __transcript: "Клиент: Тест", transcript: "Клиент: Тест" });
  });

  expect(report).toMatchObject({
    status: "ok",
    configured_max_tokens: 4321,
    requested_output_token_budget: 4321,
    effective_output_token_budget: 4321,
    output_token_parameter: "max_completion_tokens",
    prompt_audit: {
      transcript_present: true,
      transcript_injected: true,
      transcript_available: true,
      transcript_delivery: "prompt",
      transcript_sent_to_model: true,
      resolved_prompt_contains_transcript: true,
    },
  });
});
