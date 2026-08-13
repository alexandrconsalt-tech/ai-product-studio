import { expect, test } from "@playwright/test";

const projectId = "project_72f7b30d-0d09-49fd-81b7-82a8b8f88c4f";
const projectUrl = `/pipeline-lab-v3.html?projectId=${projectId}&productName=${encodeURIComponent("AI Атрибуты в Заявке")}`;
const callMetadataStorageKey = `pipelineLabV3.applicationCallMetadata.${projectId}`;
const currentProductionTranscript = `Оператор:
— Здравствуйте.
Клиент:
— Алло, Шелгунов.
Оператор:
— А, здравствуйте. А-а, по квартире Шелгунова, 10, э-э, подскажите, возможен просмотр сегодня?
Оператор:
— Минутотку.
Оператор:
— Двухкомнатная, пятый этаж, 46,1 кв. м, за 9 2090. Всё верно. Квартиру показывает Валерий, наш агент. Я вас с ней соединю, согласуете просмотр. Вас как представить?
Клиент:
— Николай.
Оператор:
— Николай, очень приятно. Смотрите, для себя или вы агента для клиента подбираете?
Клиент:
— Для себя.
Оператор:
— И ваш номер телефона для связи 89-69 заканчивается. Всё верно?
Клиент:
— Всё верно.
Оператор:
— Николай, подскажите, пожалуйста, рассматриваете ли вы новостройки?
Клиент:
— Ну а где? Рядом тут, как говорится, в той стороне будет дорого, а где-то далеко, вроде Новосаратовски или Янино, нам неудобно.
Оператор:
— Поняла вас, консультация по ипотеке нужна будет?
Клиент:
— Нет, пока не нужно.
Оператор:
— Хорошо, оставайтесь на линии.
Клиент:
— Консультация нам по ипотеке же пока не нужна. Новостройки хотел мне предложить.
Агент:
— Николай, добрый день.
Клиент:
— Здравствуйте.
Агент:
— Да, это Валерия Пуша Логунова, слушаю вас.
Клиент:
— Ага. Валерия, подскажите, пожалуйста, возможен сегодня просмотр?
Агент:
— Нет, сегодня не мо-не можем показать, потому что у нас собственник за городом. В субботу-воскресенье, скорее всего, начинаем показывать. Там у нас уже человек три набралось. Вот, могу в субботу-воскресенье вас записать предварительно, если удобно. Ну, либо потом там понедельник-вторник, вечерком можно.
Клиент:
— В субботу в какое время?
Агент:
— Либо утром, э-э, часиков в 10—10:30, либо вечером, в 7:0-вос:0ь вечера.
Агент:
— Так ещё раз, утром либо вечером по времени.
Клиент:
— Утром.
Агент:
— Утром до 10:30, ну, 10:30 самое позднее, а вечером, э-э, начиная с 7:00.
Клиент:
— 10:30.
Агент:
— На 10:30. Хорошо.
Агент:
— Николай, вы подскажите мне ещё, как вы планировали покупать недвижимость? С ипотекой, может быть, сертификаты какие-то будут?
Клиент:
— Просто наличные деньги с ипотекой.
Агент:
— Ага. А вы одобряли уже в каком-то банке?
Клиент:
— Нет?
Клиент:
— Угу. Да-да, уже одобряли.
Агент:
— Давайте тогда сделаем как по сделке, вот по данной квартире. Насколько быстро клиенты готовы? Или там...
Агент:
— Ну, смотрите, у нас два собственника, у нас нет никаких обременений в плане подготовки к сделке. Взамен мы можем купить и одновременно, а можем не покупать, то есть мы не привязаны к покупке. Поэтому, ну, сделаем быстро, если вам быстро нужно.
Агент:
— А как быстро они съедут в проц, ну, вот в процессе сделки? Тоже есть где жить, э-э, ну, это уже договоримся, как съедут. Ну, то есть есть где жить, имеется в виду в плане, что можно будет быстро, оперативно оттуда переехать.
Клиент:
— Угу.
Агент:
— Подскажите ваш прямой номер для связи, чтобы... Запишите.
Клиент:
— Да, запишите: 8903 Дальше? Д9 2 с7мь. 9 9 09.
Клиент:
— Агу. Всё. Угу. Маленько.
Агент:
— Всё, я вам в пятницу накануне наберу, позвоню, им, чтобы точно всем-увсех всё получилось.
Клиент:
— Угу. Всё хорошо. Угу, угу.
Агент:
— Всё, Николай, до связи.
Клиент:
— До пятницы, до завтра.
Агент:
— До свидания. Всего доброго.`;
const nextContactDateSchema = {
  type: "object",
  additionalProperties: false,
  required: ["detected", "next_contact_at", "precision", "action", "actor", "raw_time_expression", "evidence", "confidence"],
  properties: {
    detected: { type: "boolean" },
    next_contact_at: { type: ["string", "null"] },
    precision: { type: "string", enum: ["exact", "range", "daypart", "date", "none"] },
    action: { type: "string", enum: ["callback", "message", "send_information", "confirm", "other", "none"] },
    actor: { type: "string", enum: ["agent", "none"] },
    raw_time_expression: { type: ["string", "null"] },
    evidence: { type: ["string", "null"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ metadataStorageKey }) => {
    localStorage.removeItem("pipelineLabV3.pipelineConfig");
    localStorage.setItem("selectedLlmProvider", "mock");
    localStorage.setItem(metadataStorageKey, JSON.stringify({
      call_datetime: "2026-08-13T14:20:10",
      call_end_datetime: "2026-08-13T14:24:37",
      timezone: "Europe/Moscow",
    }));
  }, { metadataStorageKey: callMetadataStorageKey });
});

test("миграция добавляет новый шаг в сохранённый pipeline без сброса настроек и истории", async ({ page }) => {
  const configKey = `pipelineLabV3.pipelineConfig.${projectId}`;
  const historyKey = "ai-product-studio.playground-test-runs.v1";
  const history = JSON.stringify({ state: { runsByProjectId: { [projectId]: [{ id: "existing-run", report: { preserved: true } }] } }, version: 0 });
  await page.addInitScript(({ scopedConfigKey, runHistoryKey, runHistory }) => {
    const stage = (outKey: string, name: string, type = "llm") => ({ enabled: true, type, name, model: "gpt-5-mini", outKey, prompt: `custom:${outKey} {{transcript}}`, provider: "ai-tunnel", temperature: 0, maxTokens: 2000 });
    localStorage.setItem(scopedConfigKey, JSON.stringify({
      version: 14,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-02T00:00:00.000Z",
      deletedStageOutKeys: [],
      stages: [
        stage("interest_extractor", "Определение интереса клиента"),
        stage("funding_source_extractor", "Определение источника средств"),
        stage("purchase_term_extractor", "Определение срока покупки"),
        stage("attributes_judge", "Проверка атрибутов", "check"),
        stage("attributes_quality_gate", "Quality Gate атрибутов", "code"),
        stage("crm_attributes_result", "Формирование результата для CRM", "code"),
      ],
    }));
    localStorage.setItem(runHistoryKey, runHistory);
  }, { scopedConfigKey: configKey, runHistoryKey: historyKey, runHistory: history });

  await page.goto(projectUrl);

  const migrated = await page.evaluate(({ scopedConfigKey, runHistoryKey }) => ({
    config: JSON.parse(localStorage.getItem(scopedConfigKey) || "null"),
    previous: JSON.parse(localStorage.getItem(`${scopedConfigKey}.previous`) || "null"),
    history: localStorage.getItem(runHistoryKey),
  }), { scopedConfigKey: configKey, runHistoryKey: historyKey });

  expect(migrated.config.restoredFrom).toBe("ai-application-attributes-temporal-runtime-v24");
  expect(migrated.config.stages.map((stage: { outKey: string }) => stage.outKey)).toEqual([
    "interest_extractor",
    "funding_source_extractor",
    "purchase_term_extractor",
    "next_contact_date_extractor",
    "attributes_judge",
    "attributes_quality_gate",
    "crm_attributes_result",
  ]);
  expect(migrated.config.stages[0].prompt).toBe("custom:interest_extractor {{transcript}}");
  expect(migrated.previous.stages).toHaveLength(6);
  expect(migrated.history).toBe(history);
});

test("миграция отделяет ошибочно сохранённую schema от Prompt только у нового этапа", async ({ page }) => {
  const configKey = `pipelineLabV3.pipelineConfig.${projectId}`;
  const otherPrompt = "Сохранённый Prompt существующего этапа {{transcript}}";
  await page.addInitScript(({ scopedConfigKey, corruptedPrompt, preservedPrompt }) => {
    const stage = (outKey: string, name: string, type = "llm", prompt = `custom:${outKey} {{transcript}}`) => ({ enabled: true, type, name, model: "gpt-5-mini", outKey, prompt, provider: "ai-tunnel", temperature: 0, maxTokens: 2000 });
    localStorage.setItem(scopedConfigKey, JSON.stringify({
      version: 14,
      deletedStageOutKeys: [],
      stages: [
        stage("interest_extractor", "Определение интереса клиента", "llm", preservedPrompt),
        stage("funding_source_extractor", "Определение источника средств"),
        stage("purchase_term_extractor", "Определение срока покупки"),
        { ...stage("next_contact_date_extractor", "Определение даты следующего контакта", "llm", corruptedPrompt), promptSource: "user_override", promptEdited: true },
        stage("attributes_judge", "Проверка атрибутов", "check"),
        stage("attributes_quality_gate", "Quality Gate атрибутов", "code"),
        stage("crm_attributes_result", "Формирование результата для CRM", "code"),
      ],
    }));
  }, { scopedConfigKey: configKey, corruptedPrompt: JSON.stringify(nextContactDateSchema, null, 2), preservedPrompt: otherPrompt });

  await page.goto(projectUrl);

  const migrated = await page.evaluate((scopedConfigKey) => {
    const config = JSON.parse(localStorage.getItem(scopedConfigKey) || "null");
    return {
      config,
      previous: JSON.parse(localStorage.getItem(`${scopedConfigKey}.previous`) || "null"),
      runtime: pipeline.map((stage) => ({ outKey: stage.outKey, prompt: stage.prompt, responseContract: stage.responseContract, promptSource: stage.promptSource })),
    };
  }, configKey);
  const nextStage = migrated.config.stages.find((stage: { outKey: string }) => stage.outKey === "next_contact_date_extractor");
  const interestStage = migrated.config.stages.find((stage: { outKey: string }) => stage.outKey === "interest_extractor");

  expect(migrated.config.restoredFrom).toBe("ai-application-attributes-temporal-runtime-v24");
  expect(nextStage.responseContract).toBe("application_next_contact_date_extractor_v1");
  expect(nextStage.prompt).toContain("{{transcript}}");
  expect(nextStage.prompt).not.toBe(JSON.stringify(nextContactDateSchema, null, 2));
  expect(nextStage.promptSource).toBe("system_default");
  expect(interestStage.prompt).toBe(otherPrompt);
  expect(migrated.previous.stages.find((stage: { outKey: string }) => stage.outKey === "next_contact_date_extractor").prompt).toBe(JSON.stringify(nextContactDateSchema, null, 2));
  expect(migrated.runtime.find((stage: { outKey: string }) => stage.outKey === "next_contact_date_extractor")).toMatchObject({
    prompt: nextStage.prompt,
    responseContract: "application_next_contact_date_extractor_v1",
  });
});

test("миграция удаляет schema-префикс и дословно сохраняет пользовательский Prompt", async ({ page }) => {
  const configKey = `pipelineLabV3.pipelineConfig.${projectId}`;
  const userPrompt = [
    "Ты — AI-экстрактор атрибута заявки «Дата следующего контакта».",
    "Пользовательское правило: учитывай только обещание агента.",
    "Транскрипция: {{transcript}}",
  ].join("\n\n");
  const corruptedPrompt = `${JSON.stringify(nextContactDateSchema, null, 2)}\n\n${userPrompt}`;
  await page.addInitScript(({ scopedConfigKey, damagedPrompt }) => {
    const stage = (outKey: string, name: string, type = "llm", prompt = `custom:${outKey} {{transcript}}`) => ({ enabled: true, type, name, model: "gpt-5-mini", outKey, prompt, provider: "ai-tunnel", temperature: 0, maxTokens: 2000 });
    localStorage.setItem(scopedConfigKey, JSON.stringify({
      version: 20,
      deletedStageOutKeys: [],
      stages: [
        stage("interest_extractor", "Определение интереса клиента"),
        stage("funding_source_extractor", "Определение источника средств"),
        stage("purchase_term_extractor", "Определение срока покупки"),
        { ...stage("next_contact_date_extractor", "Определение даты следующего контакта", "llm", damagedPrompt), responseContract: "application_next_contact_date_extractor_v1", promptSource: "user_override", promptEdited: true },
        stage("attributes_judge", "Проверка атрибутов", "check"),
        stage("attributes_quality_gate", "Quality Gate атрибутов", "code"),
        stage("crm_attributes_result", "Формирование результата для CRM", "code"),
      ],
    }));
  }, { scopedConfigKey: configKey, damagedPrompt: corruptedPrompt });

  await page.goto(projectUrl);
  const restored = await page.evaluate((scopedConfigKey) => {
    const config = JSON.parse(localStorage.getItem(scopedConfigKey) || "null");
    return config.stages.find((stage: { outKey: string }) => stage.outKey === "next_contact_date_extractor");
  }, configKey);

  expect(restored.prompt).toBe(userPrompt);
  expect(restored.promptSource).toBe("user_override");
  expect(restored.promptEdited).toBe(true);
  expect(restored.responseContract).toBe("application_next_contact_date_extractor_v1");
});

test("Prompt даты следующего контакта сохраняется через switch, reload и pipeline run отдельно от Response Schema", async ({ page }) => {
  const customPrompt = [
    "NEXT_CONTACT_DATE_TEST_PROMPT",
    "Определи дату следующего контакта только из транскрипции.",
    "Транскрипция:",
    "{{transcript}}",
    "Верни JSON по настроенному response contract.",
  ].join("\n\n");
  const transcript = [
    "Клиент: Я по объявлению звоню, новостройка в центре интересует.",
    "Клиент: У меня ипотека сейчас в процессе одобрения, Сбербанк.",
    "Клиент: Хотелось бы в ближайшие два-три месяца определиться.",
    "Агент: Перезвоню пятнадцатого в 14:00.",
  ].join("\n");
  await page.goto(projectUrl);
  await page.locator("#pipelineToggle").click();
  let stages = page.locator("#stages .stage");
  const nextStage = stages.nth(3);
  await nextStage.locator("[data-toggle]").click();
  const originalOtherStages = await page.evaluate(() => pipeline.filter((stage) => stage.outKey !== "next_contact_date_extractor").map((stage) => ({ outKey: stage.outKey, prompt: stage.prompt, responseContract: stage.responseContract, model: stage.model })));
  await nextStage.locator("[data-prompt]").fill(customPrompt);
  await nextStage.locator("[data-save]").click();

  await stages.nth(2).locator("[data-toggle]").click();
  await nextStage.locator("[data-toggle]").click();
  await nextStage.locator("[data-toggle]").click();
  await expect(nextStage.locator("[data-prompt]")).toHaveValue(customPrompt);

  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#pipelineToggle").click();
  stages = page.locator("#stages .stage");
  await stages.nth(3).locator("[data-toggle]").click();
  await expect(stages.nth(3).locator("[data-prompt]")).toHaveValue(customPrompt);

  const result = await page.evaluate(async ({ sourceTranscript, expectedPrompt }) => {
    (document.getElementById("transcript") as HTMLTextAreaElement).value = sourceTranscript;
    const stage = pipeline.find((item) => item.outKey === "next_contact_date_extractor");
    const promptBeforeRun = stage.prompt;
    await runPipeline();
    const promptAfterRun = stage.prompt;
    const runtimeReport = await runStage(stage, {
      __transcript: sourceTranscript,
      call_datetime: "2026-08-13T14:20:10+03:00",
      call_end_datetime: "2026-08-13T14:24:37+03:00",
      timezone: "Europe/Moscow",
    });
    const stored = JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY) || "null");
    return {
      promptBeforeRun,
      promptAfterRun,
      editorPrompt: (document.querySelectorAll("#stages .stage")[3].querySelector("[data-prompt]") as HTMLTextAreaElement).value,
      storedStage: stored.stages.find((item: { outKey: string }) => item.outKey === "next_contact_date_extractor"),
      runtimeStage: { prompt: stage.prompt, responseContract: stage.responseContract },
      runtimeReport,
      otherStages: pipeline.filter((item) => item.outKey !== "next_contact_date_extractor").map((item) => ({ outKey: item.outKey, prompt: item.prompt, responseContract: item.responseContract, model: item.model })),
      expectedPrompt,
    };
  }, { sourceTranscript: transcript, expectedPrompt: customPrompt });

  expect(result.promptBeforeRun).toBe(customPrompt);
  expect(result.promptAfterRun).toBe(customPrompt);
  expect(result.editorPrompt).toBe(customPrompt);
  expect(result.storedStage).toMatchObject({ prompt: customPrompt, responseContract: "application_next_contact_date_extractor_v1", promptSource: "user_override" });
  expect(result.runtimeStage).toEqual({ prompt: customPrompt, responseContract: "application_next_contact_date_extractor_v1" });
  expect(result.otherStages).toEqual(originalOtherStages);
  expect(result.runtimeReport).toMatchObject({
    output: {
      detected: true,
      next_contact_at: "2026-08-15T14:00:00+03:00",
      precision: "exact",
      action: "callback",
      actor: "agent",
      confidence: 0.98,
    },
    prompt_audit: {
      transcript_present: true,
      transcript_injected: true,
      transcript_available: true,
      transcript_sent_to_model: true,
      resolved_prompt_contains_transcript: true,
    },
    contract_audit: {
      prompt_contract_id: "application_next_contact_date_extractor_v1",
      structured_output_requested: true,
      structured_output_applied: true,
      response_schema_id: "application_next_contact_date_extractor_v1",
      parser_schema_id: "application_next_contact_date_extractor_v1",
      parse_status: "SUCCESS",
      schema_status: "VALID",
    },
  });
  expect(result.runtimeReport.resolved_prompt).toContain(transcript);
  expect(result.runtimeReport.resolved_prompt).not.toContain("{{transcript}}");
  expect(result.runtimeReport.resolved_prompt).not.toBe(JSON.stringify(nextContactDateSchema, null, 2));
});

test("Golden A–G: дата следующего контакта проходит Extractor → Judge → Gate → CRM → metrics", async ({ page }) => {
  await page.goto(projectUrl);
  const cases = [
    { id: "A", transcript: "Клиент: Тогда, если сможете показать в четверг, завтра перезвоните мне, да, вечером?\nАгент: Да, конечно.", detected: true, next: "2026-08-14T18:00:00+03:00", precision: "daypart", action: "SET" },
    { id: "B", transcript: "Агент: Всё, я вам в пятницу накануне наберу, позвоню, чтобы точно у всех всё получилось.\nКлиент: До пятницы, до завтра.", detected: true, next: "2026-08-14T10:00:00+03:00", precision: "date", action: "SET" },
    { id: "C", transcript: "Агент: Давайте уточню, перезвоню.\nКлиент: Хорошо.", detected: false, next: null, precision: "none", action: "SKIP" },
    { id: "D", transcript: "Клиент: Я вам завтра сам позвоню.\nАгент: Хорошо.", detected: false, next: null, precision: "none", action: "SKIP" },
    { id: "E", transcript: "Клиент: В субботу в 10:30.\nАгент: Хорошо, записал.", detected: false, next: null, precision: "none", action: "SKIP" },
    { id: "F", transcript: "Агент: Через 30 минут вам перезвоню.\nКлиент: Хорошо.", detected: true, next: "2026-08-13T14:54:37+03:00", precision: "exact", action: "SET" },
    { id: "G", transcript: "Агент: Завтра ближе к вечеру позвоню.\nКлиент: Договорились.", detected: true, next: "2026-08-14T17:00:00+03:00", precision: "daypart", action: "SET" },
  ];

  for (const golden of cases) {
    const result = await page.evaluate(async ({ transcript }) => {
      (document.getElementById("transcript") as HTMLTextAreaElement).value = transcript;
      await runPipeline();
      const stage = pipeline.find((item) => item.outKey === "next_contact_date_extractor");
      const report = await runStage(stage, ctx);
      report.context_audit = stageContextAudit(stage, ctx);
      return {
        extractor: ctx.next_contact_date_extractor,
        judge: ctx.attributes_judge,
        gate: ctx.attributes_quality_gate,
        crm: ctx.crm_attributes_result,
        metrics: ctx.attributes_metrics,
        report,
      };
    }, { transcript: golden.transcript });

    expect(result.extractor.detected, golden.id).toBe(golden.detected);
    expect(result.extractor.next_contact_at, golden.id).toBe(golden.next);
    expect(result.extractor.precision, golden.id).toBe(golden.precision);
    expect(result.judge.attribute_statuses.next_contact_date, golden.id).toBe("ready");
    expect(result.gate.decisions.next_contact_date, golden.id).toBe(golden.action === "SET" ? "AUTO_SAVE" : "DO_NOT_UPDATE");
    expect(result.crm.update_actions.next_contact_date, golden.id).toBe(golden.action);
    expect(result.crm.attributes.next_contact_date, golden.id).toBe(golden.next);
    expect(result.metrics.quality_score, golden.id).toBe(100);
    expect(result.metrics.calculation.next_contact_date.crm_action, golden.id).toBe(golden.action);
    expect(result.report.context_audit.required_context_keys, golden.id).toEqual(golden.id === "F" ? ["transcript", "call_datetime", "timezone", "call_end_datetime"] : ["transcript", "call_datetime", "timezone"]);
    expect(result.report.context_audit.resolved_context_keys, golden.id).toMatchObject(golden.id === "F" ? { transcript: true, call_datetime: true, call_end_datetime: true, timezone: true } : { transcript: true, call_datetime: true, timezone: true });
    expect(result.report.resolved_prompt, golden.id).toContain("2026-08-13T14:20:10+03:00");
    expect(result.report.resolved_prompt, golden.id).toContain("2026-08-13T14:24:37+03:00");
    expect(result.report.resolved_prompt, golden.id).toContain("Europe/Moscow");
    expect(result.report.contract_audit, golden.id).toMatchObject({ structured_output_requested: true, structured_output_applied: true, response_schema_id: "application_next_contact_date_extractor_v1", parser_schema_id: "application_next_contact_date_extractor_v1", schema_status: "VALID", parse_status: "SUCCESS" });
  }
});

test("manual mode автоматически создаёт call_datetime вместо REQUIRED_CALL_CONTEXT_MISSING", async ({ page }) => {
  await page.addInitScript((metadataStorageKey) => localStorage.removeItem(metadataStorageKey), callMetadataStorageKey);
  await page.goto(projectUrl);
  const result = await page.evaluate(async () => {
    (document.getElementById("transcript") as HTMLTextAreaElement).value = "Агент: Завтра вам перезвоню.\nКлиент: Хорошо.";
    await runPipeline();
    return { audit: ctx.__call_metadata_audit, extractor: ctx.next_contact_date_extractor, judge: ctx.attributes_judge, gate: ctx.attributes_quality_gate, crm: ctx.crm_attributes_result, metrics: ctx.attributes_metrics };
  });
  expect(result.audit).toMatchObject({ mode: "manual", call_datetime_source: "pipeline_lab_manual_default", timezone: "Europe/Moscow" });
  expect(result.audit.call_datetime).not.toBeNull();
  expect(result.extractor).not.toMatchObject({ error_code: "REQUIRED_CALL_CONTEXT_MISSING" });
  expect(result.judge.attribute_statuses.next_contact_date).toBe("ready");
  expect(result.gate.decisions.next_contact_date).toBe("DO_NOT_UPDATE");
  expect(result.crm.update_actions.next_contact_date).toBe("SKIP");
  expect(result.metrics.quality_score).toBeGreaterThan(0);
});

test("реальный UI path передаёт metadata и проводит оба production-кейса до CRM и результата", async ({ page }, testInfo) => {
  await page.goto(projectUrl);
  await expect(page.locator("#applicationCallMetadataPanel")).toBeVisible();

  const runFromUi = async ({ transcript, start, end }: { transcript: string; start: string; end?: string }) => {
    await page.locator("#applicationCallDatetime").fill(start);
    await page.locator("#applicationCallEndDatetime").fill(end || "");
    await page.locator("#applicationCallTimezone").selectOption("Europe/Moscow");
    await page.locator("#transcript").fill(transcript);
    await page.locator("#runBtn").click();
    await expect(page.locator("#runBtn")).toBeEnabled({ timeout: 30_000 });
    await expect(page.locator('[data-application-attributes-result="true"]')).toBeVisible();
    await page.evaluate(() => {
      (window as Window & { __downloadedApplicationAttributesReport?: string }).__downloadedApplicationAttributesReport = undefined;
      dl = (blob: Blob) => {
        void blob.text().then((text) => {
          (window as Window & { __downloadedApplicationAttributesReport?: string }).__downloadedApplicationAttributesReport = text;
        });
      };
    });
    await page.locator("#dlReport").click();
    await page.waitForFunction(() => Boolean((window as Window & { __downloadedApplicationAttributesReport?: string }).__downloadedApplicationAttributesReport));
    return page.evaluate(() => JSON.parse((window as Window & { __downloadedApplicationAttributesReport?: string }).__downloadedApplicationAttributesReport!));
  };

  const case1 = await runFromUi({
    start: "2026-08-13T10:00",
    end: "2026-08-13T10:05",
    transcript: [
      "Агент: Мне нужно будет там, я минут через 30 вам пару вопросиков там напишу.",
      "Клиент: Хорошо.",
      "Агент: Всё, хорошо, тогда вам напишу. Минут через 30–40.",
    ].join("\n"),
  });
  const case1Stage = case1.stageReports.find((item: { stage: { outKey: string } }) => item.stage.outKey === "next_contact_date_extractor").report;
  expect(case1.result.__call_metadata_audit).toEqual({
    call_datetime: "2026-08-13T10:00:00+03:00",
    call_end_datetime: "2026-08-13T10:05:00+03:00",
    timezone: "Europe/Moscow",
    source: "pipeline_lab_input",
    call_datetime_source: "pipeline_lab_input",
    call_end_datetime_source: "pipeline_lab_input",
    timezone_source: "pipeline_lab_input",
    mode: "manual",
  });
  expect(case1Stage).toMatchObject({
    output: { detected: true, next_contact_at: "2026-08-13T10:40:00+03:00", precision: "range", actor: "agent", action: "message", raw_time_expression: "через 30–40 минут", confidence: 0.95 },
    tokens: expect.any(Number),
    contract_audit: { structured_output_requested: true, structured_output_applied: true, parse_status: "SUCCESS", schema_status: "VALID" },
    context_audit: { resolved_context_keys: { transcript: true, call_datetime: true, timezone: true, call_end_datetime: true } },
  });
  expect(case1Stage.tokens).toBeGreaterThan(0);
  expect(case1Stage.raw).not.toBeNull();
  expect(case1.result.attributes_judge.attribute_statuses.next_contact_date).toBe("ready");
  expect(case1.result.attributes_quality_gate.decisions.next_contact_date).toBe("AUTO_SAVE");
  expect(case1.result.crm_attributes_result).toMatchObject({ attributes: { next_contact_date: "2026-08-13T10:40:00+03:00" }, update_actions: { next_contact_date: "SET" } });
  await expect(page.locator("[data-result-next-contact-date]")).toHaveText("13.08.2026");
  await testInfo.attach("pipeline-report-case-1.json", { body: Buffer.from(JSON.stringify(case1, null, 2)), contentType: "application/json" });

  const case2 = await runFromUi({
    start: "2026-08-13T10:00",
    transcript: [
      "Агент: Могу вам сегодня вечером точно сказать, перезвонить или написать?",
      "Клиент: Да, можете, да, конечно.",
      "Агент: Я вам сразу же даю отмашку — да-да или нет. Хорошо, сможете позвонить сегодня вечером?",
      "Клиент: Да, конечно. Всё, буду ждать звонка.",
    ].join("\n"),
  });
  const case2Stage = case2.stageReports.find((item: { stage: { outKey: string } }) => item.stage.outKey === "next_contact_date_extractor").report;
  expect(case2.result.__call_metadata_audit).toMatchObject({ call_datetime: "2026-08-13T10:00:00+03:00", call_end_datetime: null, timezone: "Europe/Moscow", source: "pipeline_lab_input", timezone_source: "pipeline_lab_input" });
  expect(case2Stage).toMatchObject({
    output: { detected: true, next_contact_at: "2026-08-13T18:00:00+03:00", actor: "agent", action: "callback", raw_time_expression: "сегодня вечером", precision: "daypart", confidence: 0.96 },
    contract_audit: { structured_output_requested: true, structured_output_applied: true, parse_status: "SUCCESS", schema_status: "VALID" },
    context_audit: { required_context_keys: ["transcript", "call_datetime", "timezone"], resolved_context_keys: { transcript: true, call_datetime: true, timezone: true } },
  });
  expect(case2Stage.tokens).toBeGreaterThan(0);
  expect(case2Stage.raw).not.toBeNull();
  expect(case2.result.attributes_quality_gate.decisions.next_contact_date).toBe("AUTO_SAVE");
  expect(case2.result.crm_attributes_result).toMatchObject({ attributes: { next_contact_date: "2026-08-13T18:00:00+03:00" }, update_actions: { next_contact_date: "SET" } });
  await expect(page.locator("[data-result-next-contact-date]")).toHaveText("13.08.2026");
  await testInfo.attach("pipeline-report-case-2.json", { body: Buffer.from(JSON.stringify(case2, null, 2)), contentType: "application/json" });
  await testInfo.attach("application-attributes-ui.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
});

test("metadata коммуникации приоритетнее ручных полей, а call_end вычисляется из duration", async ({ page }) => {
  await page.goto(projectUrl);
  await page.locator("#applicationCallDatetime").fill("2026-08-12T09:00");
  await page.locator("#applicationCallEndDatetime").fill("2026-08-12T09:01");
  const transcript = "Агент: Через 30 минут вам перезвоню.\nКлиент: Хорошо.";
  await page.locator("#transcript").fill(transcript);
  await page.evaluate((sourceTranscript) => {
    (window as Window & { __nexaraSttMetadata?: unknown; __nexaraSttMetadataTranscript?: string }).__nexaraSttMetadata = {
      provider: "Nexara",
      raw: { started_at: "2026-08-13T10:00:00+03:00", duration_seconds: 300, timezone: "Europe/Moscow" },
    };
    (window as Window & { __nexaraSttMetadataTranscript?: string }).__nexaraSttMetadataTranscript = sourceTranscript;
  }, transcript);
  await page.locator("#runBtn").click();
  await expect(page.locator("#runBtn")).toBeEnabled({ timeout: 30_000 });

  const result = await page.evaluate(() => ({ audit: ctx.__call_metadata_audit, nextContact: ctx.next_contact_date_extractor }));
  expect(result.audit).toEqual({
    call_datetime: "2026-08-13T10:00:00+03:00",
    call_end_datetime: "2026-08-13T07:05:00.000Z",
    timezone: "Europe/Moscow",
    source: "communication_metadata",
    call_datetime_source: "communication_metadata",
    call_end_datetime_source: "calculated_from_duration",
    timezone_source: "communication_metadata",
    mode: "communication",
  });
  expect(result.nextContact).toMatchObject({ detected: true, next_contact_at: "2026-08-13T10:35:00+03:00", action: "callback", actor: "agent" });
});

test("browser E2E CASE A–J: UI → resolver → normalizer → Judge → Gate → CRM → report", async ({ page }) => {
  await page.goto(projectUrl);
  await page.evaluate(() => {
    const original = callModelWithTransientRetry;
    (window as Window & { __applicationModelCalls?: number }).__applicationModelCalls = 0;
    callModelWithTransientRetry = async (...args: Parameters<typeof original>) => {
      (window as Window & { __applicationModelCalls?: number }).__applicationModelCalls!++;
      return original(...args);
    };
  });

  const run = async ({ transcript, start = "2026-08-13T10:00", end = "", communication }: { transcript: string; start?: string; end?: string; communication?: Record<string, unknown> }) => {
    await page.evaluate(({ sourceTranscript, metadata }) => {
      (window as Window & { __nexaraSttMetadata?: unknown; __nexaraSttMetadataTranscript?: string }).__nexaraSttMetadata = metadata || undefined;
      (window as Window & { __nexaraSttMetadataTranscript?: string }).__nexaraSttMetadataTranscript = metadata ? sourceTranscript : undefined;
    }, { sourceTranscript: transcript, metadata: communication || null });
    await page.locator("#transcript").fill(transcript);
    await page.locator("#applicationCallDatetime").fill(start);
    await page.locator("#applicationCallEndDatetime").fill(end);
    await page.locator("#applicationCallTimezone").selectOption("Europe/Moscow");
    await page.locator("#runBtn").click();
    await expect(page.locator("#runBtn")).toBeEnabled({ timeout: 30_000 });
    await expect(page.locator('[data-application-attributes-result="true"]')).toBeVisible();
    return page.evaluate(() => ({
      audit: ctx.__call_metadata_audit,
      temporal: ctx.temporal_normalization_audit,
      extractor: ctx.next_contact_date_extractor,
      judge: ctx.attributes_judge,
      gate: ctx.attributes_quality_gate,
      crm: ctx.crm_attributes_result,
      ui: document.querySelector("[data-result-next-contact-date]")?.textContent,
      calls: (window as Window & { __applicationModelCalls?: number }).__applicationModelCalls,
    }));
  };

  const cases = [
    { id: "A", transcript: "Агент: Я вам в пятницу позвоню.\nКлиент: Хорошо, до пятницы.", expected: "2026-08-14T10:00:00+03:00", precision: "date", action: "SET" },
    { id: "B", transcript: "Агент: Завтра вечером вам позвоню.\nКлиент: Хорошо, буду ждать.", expected: "2026-08-14T18:00:00+03:00", precision: "daypart", action: "SET" },
    { id: "C", transcript: "Агент: Через 30 минут вам перезвоню.\nКлиент: Хорошо.", end: "2026-08-13T10:05", expected: "2026-08-13T10:35:00+03:00", precision: "exact", action: "SET" },
    { id: "D", transcript: "Агент: Мне нужно будет там, я минут через 30 вам пару вопросиков там напишу.\nКлиент: Хорошо.\nАгент: Всё, тогда напишу минут через 30–40.", end: "2026-08-13T10:05", expected: "2026-08-13T10:40:00+03:00", precision: "range", action: "SET" },
    { id: "E", transcript: "Клиент: Я завтра вам сам позвоню.\nАгент: Хорошо.", expected: null, precision: "none", action: "SKIP" },
    { id: "F", transcript: "Клиент: Показ в субботу в 10:30.\nАгент: Хорошо, записал.", expected: null, precision: "none", action: "SKIP" },
    { id: "G", transcript: "Агент: Как-нибудь созвонимся.\nКлиент: Хорошо.", expected: null, precision: "none", action: "SKIP" },
  ];
  for (const item of cases) {
    const result = await run(item);
    expect(result.extractor.next_contact_at, item.id).toBe(item.expected);
    expect(result.extractor.precision, item.id).toBe(item.precision);
    expect(result.judge.attribute_statuses.next_contact_date, item.id).toBe("ready");
    expect(result.gate.decisions.next_contact_date, item.id).toBe(item.action === "SET" ? "AUTO_SAVE" : "DO_NOT_UPDATE");
    expect(result.crm.update_actions.next_contact_date, item.id).toBe(item.action);
  }

  const caseH = await run({ transcript: "Агент: Завтра вечером вам позвоню.\nКлиент: Хорошо.", start: "" });
  expect(caseH.audit).toMatchObject({ mode: "manual", call_datetime_source: "pipeline_lab_manual_default", timezone: "Europe/Moscow" });
  expect(caseH.audit.call_datetime).not.toBeNull();
  expect(caseH.extractor).not.toMatchObject({ error_code: "REQUIRED_CALL_CONTEXT_MISSING" });

  const caseI = await run({
    transcript: "Агент: Завтра вечером вам позвоню.\nКлиент: Хорошо.",
    start: "2026-08-01T09:00",
    communication: { provider: "Nexara", raw: { started_at: "2026-08-20T12:00:00+03:00", timezone: "Europe/Moscow" } },
  });
  expect(caseI.audit).toMatchObject({ mode: "communication", call_datetime: "2026-08-20T12:00:00+03:00", call_datetime_source: "communication_metadata" });
  expect(caseI.extractor.next_contact_at).toBe("2026-08-21T18:00:00+03:00");

  const callsBeforeJ = caseI.calls;
  const transcriptJ = "Агент: Завтра вечером вам позвоню.\nКлиент: Хорошо.";
  await page.evaluate((sourceTranscript) => {
    (window as Window & { __nexaraSttMetadata?: unknown; __nexaraSttMetadataTranscript?: string }).__nexaraSttMetadata = { provider: "Nexara", raw: { timezone: "Europe/Moscow" } };
    (window as Window & { __nexaraSttMetadataTranscript?: string }).__nexaraSttMetadataTranscript = sourceTranscript;
  }, transcriptJ);
  await page.locator("#transcript").fill(transcriptJ);
  await page.locator("#runBtn").click();
  await expect(page.locator("#applicationCallMetadataStatus")).toContainText("Не удалось получить дату исходной коммуникации");
  const caseJ = await page.evaluate(() => ({ calls: (window as Window & { __applicationModelCalls?: number }).__applicationModelCalls, audit: ctx.__call_metadata_audit }));
  expect(caseJ.calls).toBe(callsBeforeJ);
  expect(caseJ.audit).toMatchObject({ mode: "communication", call_datetime: null, call_datetime_source: null });
});

test("текущий полный production case нормализуется на ближайшую пятницу и сохраняется в report", async ({ page }, testInfo) => {
  await page.goto(projectUrl);
  await page.locator("#transcript").fill(currentProductionTranscript);
  await page.locator("#applicationCallDatetime").fill("2026-08-13T10:00");
  await page.locator("#applicationCallEndDatetime").fill("");
  await page.locator("#applicationCallTimezone").selectOption("Europe/Moscow");
  await page.locator("#runBtn").click();
  await expect(page.locator("#runBtn")).toBeEnabled({ timeout: 30_000 });
  await expect(page.locator("[data-result-next-contact-date]")).toHaveText("14.08.2026");

  const result = await page.evaluate(() => ({
    audit: ctx.__call_metadata_audit,
    temporal: ctx.temporal_normalization_audit,
    extractor: ctx.next_contact_date_extractor,
    judge: ctx.attributes_judge,
    gate: ctx.attributes_quality_gate,
    crm: ctx.crm_attributes_result,
    stage: document.querySelectorAll("#reports .report").length,
  }));
  expect(result.audit).toEqual({
    call_datetime: "2026-08-13T10:00:00+03:00",
    call_end_datetime: null,
    timezone: "Europe/Moscow",
    mode: "manual",
    source: "pipeline_lab_input",
    call_datetime_source: "pipeline_lab_input",
    call_end_datetime_source: null,
    timezone_source: "pipeline_lab_input",
  });
  expect(result.temporal).toEqual({
    raw_time_expression: "в пятницу",
    reference_datetime: "2026-08-13T10:00:00+03:00",
    call_end_datetime: null,
    timezone: "Europe/Moscow",
    strategy: "nearest_future_weekday",
    normalized_datetime: "2026-08-14T10:00:00+03:00",
    precision: "date",
  });
  expect(result.extractor).toMatchObject({ detected: true, actor: "agent", action: "confirm", raw_time_expression: "в пятницу", next_contact_at: "2026-08-14T10:00:00+03:00", precision: "date", confidence: 0.95 });
  expect(result.judge).toMatchObject({ attribute_statuses: { next_contact_date: "ready" }, decisions: { next_contact_date: "approve" }, attributes: { interest: [], funding_source: "ипотека одобрена", purchase_term: "не определено", next_contact_date: { next_contact_at: "2026-08-14T10:00:00+03:00" } } });
  expect(result.gate).toMatchObject({ decisions: { next_contact_date: "AUTO_SAVE" }, gate_status: "READY" });
  expect(result.crm).toMatchObject({ attributes: { interest: [], funding_source: "ипотека одобрена", purchase_term: "не определено", next_contact_date: "2026-08-14T10:00:00+03:00" }, update_actions: { next_contact_date: "SET" }, pipeline_status: "READY" });
  await page.evaluate(() => {
    (window as Window & { __downloadedApplicationAttributesReport?: string }).__downloadedApplicationAttributesReport = undefined;
    dl = (blob: Blob) => { void blob.text().then((text) => { (window as Window & { __downloadedApplicationAttributesReport?: string }).__downloadedApplicationAttributesReport = text; }); };
  });
  await page.locator("#dlReport").click();
  await page.waitForFunction(() => Boolean((window as Window & { __downloadedApplicationAttributesReport?: string }).__downloadedApplicationAttributesReport));
  const report = await page.evaluate(() => (window as Window & { __downloadedApplicationAttributesReport?: string }).__downloadedApplicationAttributesReport!);
  await testInfo.attach("current-production-pipeline-report.json", { body: Buffer.from(report), contentType: "application/json" });
  await testInfo.attach("current-production-result.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
});

test("AI Атрибуты заявки выполняет 7 этапов с отдельным LLM Agent даты следующего контакта", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.goto(projectUrl);

  const result = await page.evaluate(async () => {
    const transcript = [
      "Клиент: Я по объявлению звоню, новостройка в центре интересует.",
      "Клиент: У меня ипотека сейчас в процессе одобрения, Сбербанк.",
      "Клиент: Хотелось бы в ближайшие два-три месяца определиться.",
      "Агент: Встретимся в пятницу, пятнадцатого, в 14:00.",
    ].join("\n");
    (document.getElementById("transcript") as HTMLTextAreaElement).value = transcript;
    await runPipeline();
    const interestRuntimeReport = await runStage(
      pipeline.find((stage) => stage.outKey === "interest_extractor"),
      { __transcript: transcript },
    );
    const judgeStage = pipeline.find((stage) => stage.outKey === "attributes_judge");
    const resolvedJudgePrompt = applicationAttributesJudgeResolvedPrompt(judgeStage, ctx);
    const judgeRuntimeReport = await runStage(judgeStage, ctx);
    const gateRuntimeReport = await runApplicationAttributesDeterministicStage(
      pipeline.find((stage) => stage.outKey === "attributes_quality_gate"),
      ctx,
      performance.now(),
    );
    const crmRuntimeReport = await runApplicationAttributesCrmStage(
      pipeline.find((stage) => stage.outKey === "crm_attributes_result"),
      ctx,
      performance.now(),
    );
    return {
      execution: ctx.pipeline_execution,
      interest: ctx.interest_extractor,
      funding: ctx.funding_source_extractor,
      purchaseTerm: ctx.purchase_term_extractor,
      nextContactDate: ctx.next_contact_date_extractor,
      nextContactDateVariable: tmpl("{{ctx.next_contact_date_extractor}}", ctx),
      attributesJudge: ctx.attributes_judge,
      gate: ctx.attributes_quality_gate,
      crm: ctx.crm_attributes_result,
      metrics: ctx.attributes_metrics,
      crmProvenance: ctx.__stage_provenance.crm_attributes_result,
      interestRuntimeReport,
      judgeRuntimeReport,
      resolvedJudgePrompt,
      gateRuntimeReport,
      crmRuntimeReport,
      interestSchema: APPLICATION_ATTRIBUTE_EXTRACTOR_SCHEMAS.interest_extractor,
      judgeSchema: APPLICATION_ATTRIBUTES_JUDGE_SCHEMA,
      stageKeys: pipeline.map((stage) => stage.outKey),
      llmCalls: pipeline.filter((stage) => ["llm", "check"].includes(stage.type) && !isApplicationAttributesDeterministicStage(stage)).length,
      legacyOutputs: ["interest_judge", "funding_source_judge", "purchase_term_judge", "attributes_merger"].filter((key) => Object.prototype.hasOwnProperty.call(ctx, key)),
      viewport: { clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
    };
  });

  expect(result.execution).toMatchObject({
    pipeline_status: "SUCCESS",
    steps_total: 7,
    steps_executed: 7,
    steps_successful: 7,
    stopped_at_stage: null,
    extractor_failures: [],
    judge_failures: [],
  });
  expect(result.interest.value).toEqual(["Новостройки"]);
  expect(result.funding.value).toBe("ипотека в процессе");
  expect(result.purchaseTerm.value).toBe("2–3 месяца");
  expect(result.nextContactDate).toMatchObject({ detected: true, precision: "exact", action: "callback", actor: "agent", confidence: 0.98 });
  expect(result.nextContactDateVariable).toContain('"detected": true');
  expect(result.attributesJudge.decisions).toEqual({ interest: "approve", funding_source: "approve", purchase_term: "approve", next_contact_date: "approve" });
  expect(result.attributesJudge.attributes).toEqual({
    interest: ["Новостройки"],
    funding_source: "ипотека в процессе",
    purchase_term: "2–3 месяца",
    next_contact_date: {
      detected: true,
      next_contact_at: "2026-08-15T14:00:00+03:00",
      precision: "exact",
      action: "callback",
      actor: "agent",
      raw_time_expression: "пятнадцатого в 14:00",
      confidence: 0.98,
    },
  });
  expect(result.gate.gate_status).toBe("READY");
  expect(result.crm).toEqual({
    attributes: {
      interest: ["Новостройки"],
      funding_source: "ипотека в процессе",
      purchase_term: "2–3 месяца",
      next_contact_date: "2026-08-15T14:00:00+03:00",
    },
    update_actions: { interest: "SET", funding_source: "SET", purchase_term: "SET", next_contact_date: "SET" },
    pipeline_status: "READY",
    blocked_attributes: [],
    technical_errors: [],
  });
  expect(result.crmProvenance.run_id).toBeTruthy();
  expect(result.metrics).toMatchObject({
    overall_confidence: 0.995,
    confidence_status: "COMPLETE",
    attribute_confidence: { interest: 1, funding_source: 1, purchase_term: 1, next_contact_date: 0.98 },
    quality_score: 100,
    quality_criteria: {
      extractor_correctness: 100,
      evidence_quality: 100,
      judge_consistency: 100,
      pipeline_integrity: 100,
      crm_readiness: 100,
    },
    calculation: { execution_type: "deterministic", tokens: 0, cost: 0, provenance_valid: true },
  });
  expect(result.interestSchema.properties.value).toMatchObject({ type: "array", items: { type: "string" } });
  expect(result.interestSchema.properties.value).not.toHaveProperty("uniqueItems");
  expect(result.stageKeys).toEqual(["interest_extractor", "funding_source_extractor", "purchase_term_extractor", "next_contact_date_extractor", "attributes_judge", "attributes_quality_gate", "crm_attributes_result"]);
  expect(result.llmCalls).toBe(5);
  expect(result.legacyOutputs).toEqual([]);
  expect(result.viewport.scrollWidth).toBe(result.viewport.clientWidth);
  expect(result.judgeSchema).toMatchObject({ type: "object", additionalProperties: false, required: ["attributes", "attribute_statuses", "decisions", "evidence", "reason_codes"] });
  expect(result.interestRuntimeReport).toMatchObject({
    prompt_audit: {
      transcript_present: true,
      transcript_injected: true,
      transcript_available: true,
      transcript_delivery: "prompt",
      transcript_sent_to_model: true,
      resolved_prompt_contains_transcript: true,
    },
    contract_audit: {
      structured_output_requested: true,
      structured_output_applied: true,
      warnings: [],
    },
  });
  expect(result.judgeRuntimeReport).toMatchObject({
    prompt_audit: { transcript_present: true, transcript_injected: true, transcript_sent_to_model: true },
    contract_audit: {
      prompt_contract_id: "application_attributes_judge_v1",
      response_schema_id: "application_attributes_judge_v1",
      parser_schema_id: "application_attributes_judge_v1",
      structured_output_requested: true,
      structured_output_applied: true,
      parse_status: "SUCCESS",
      schema_status: "VALID",
      warnings: [],
    },
  });
  expect(result.resolvedJudgePrompt).toContain('"interest":{"status":"ready","immutable":false,"source":"interest_extractor"');
  expect(result.resolvedJudgePrompt).toContain('"funding_source":{"status":"ready","immutable":false,"source":"funding_source_extractor"');
  expect(result.resolvedJudgePrompt).toContain('"purchase_term":{"status":"ready","immutable":false,"source":"purchase_term_extractor"');
  expect(result.resolvedJudgePrompt).not.toContain("{{attributes_judge_input}}");
  for (const report of [result.gateRuntimeReport, result.crmRuntimeReport]) {
    expect(report).toMatchObject({
      provider: "Deterministic Contract",
      actual_model: "code",
      tokens: 0,
      cost: 0,
      resolved_prompt: null,
      prompt_audit: { prompt_used: false, transcript_delivery: "not_sent", transcript_sent_to_model: false, prompt_chars: 0 },
      contract_audit: { execution_type: "deterministic", prompt_used: false },
    });
  }
  expect(result.crmRuntimeReport).toMatchObject({
    provider: "Deterministic Contract",
    actual_model: "code",
    tokens: 0,
    resolved_prompt: null,
    prompt_audit: { prompt_used: false, resolved_prompt_contains_gate: false, prompt_chars: 0 },
    contract_audit: {
      contract_id: "crm_attributes_result",
      contract_version: "v1",
      source_out_key: "attributes_quality_gate",
      source_current_run: true,
      execution_type: "deterministic",
      prompt_used: false,
    },
  });
  const finalResult = page.locator('[data-application-attributes-result="true"]');
  await expect(finalResult).toContainText("Результат обработки атрибутов");
  await expect(finalResult.locator("[data-result-interest]")) .toHaveText("Новостройки");
  await expect(finalResult.locator("[data-result-funding-source]")) .toHaveText("ипотека в процессе");
  await expect(finalResult.locator("[data-result-purchase-term]")) .toHaveText("2–3 месяца");
  await expect(finalResult.locator("[data-result-next-contact-date]")) .toHaveText("15.08.2026, 14:00");
  await expect(finalResult.locator("[data-result-overall-confidence]")) .toHaveText("100%");
  await expect(finalResult.locator("[data-result-quality-score]")) .toHaveText("100%");
  await expect(finalResult).not.toContainText("Итоговое саммари");

  const finalStatus = page.locator('[data-application-attributes-status="true"]');
  await expect(finalStatus).toContainText("Quality Gate: READY");
  await expect(finalStatus).toContainText("CRM status: READY");
  await expect(finalStatus).toContainText("Этапов выполнено: 7");
  await expect(finalStatus).toContainText("Успешно пройдено: 7");
  await expect(finalStatus).toContainText("Pipeline status: SUCCESS");
  await expect(finalStatus).not.toContainText("Summary Quality Score");
  await expect(finalResult.locator("[data-attributes-metrics-details]")) .toContainText("Extractor correctness");
  await expect(finalStatus).not.toContainText("Решение:");
  await expect(finalStatus).not.toContainText("Карточка CRM");

  const nextContactDateStage = page.locator("#stages .stage").nth(3);
  await expect(nextContactDateStage).toContainText("Определение даты следующего контакта");
  await expect(nextContactDateStage).toContainText("LLM-агент");
  await nextContactDateStage.locator("[data-toggle]").evaluate((element: HTMLElement) => element.click());
  await expect(nextContactDateStage).toHaveClass(/open/);
  await expect(nextContactDateStage.locator("[data-prompt]")).toContainText("{{transcript}}");
  await expect(nextContactDateStage.locator("[data-model]")).toHaveValue("gpt-5-mini");
  await expect(nextContactDateStage.locator("[data-outkey]")).toHaveValue("next_contact_date_extractor");
  await expect(page.locator(".report").nth(3)).toContainText('"detected": true');

  const judgeStage = page.locator("#stages .stage").nth(4);
  await expect(judgeStage).toContainText("Проверка атрибутов");
  await expect(judgeStage).toContainText("GPT-5 mini");
  for (const index of [5, 6]) {
    const deterministicReport = page.locator(".report").nth(index);
    await expect(deterministicReport.locator(".rm")).toContainText("Детерминированный этап · Deterministic Contract · code");
    const deterministicStage = page.locator("#stages .stage").nth(index);
    await expect(deterministicStage.locator("[data-deterministic-stage-type]")) .toHaveValue("Детерминированный этап");
    await expect(deterministicStage.locator("[data-deterministic-stage-details]")) .toContainText("Actual execution Deterministic Contract / code");
    await expect(deterministicStage.locator("[data-deterministic-stage-details]")) .toContainText("Prompt runtime не используется");
  }
  expect(consoleErrors).toEqual([]);
});

test("renderer показывает финальный contract последнего реального отчёта без Summary-полей", async ({ page }) => {
  await page.goto(projectUrl);
  await page.evaluate(() => {
    ctx = {
      crm_attributes_result: {
        attributes: { interest: ["Новостройки"], funding_source: "не определено", purchase_term: "не определено", next_contact_date: "2026-08-14T15:00:00+03:00" },
        update_actions: { interest: "SET", funding_source: "SET_UNDETERMINED", purchase_term: "SET_UNDETERMINED", next_contact_date: "SET" },
        pipeline_status: "READY",
        blocked_attributes: [],
        technical_errors: [],
      },
      attributes_quality_gate: { gate_status: "READY" },
      attributes_metrics: {
        overall_confidence: 0.98,
        confidence_status: "COMPLETE",
        attribute_confidence: { interest: 0.95, funding_source: 1, purchase_term: 1 },
        interest_value_confidence: { "Новостройки": 0.95 },
        quality_score: 100,
        quality_criteria: { extractor_correctness: 100, evidence_quality: 100, judge_consistency: 100, pipeline_integrity: 100, crm_readiness: 100 },
      },
      next_contact_date_extractor: {
        detected: true,
        next_contact_at: "2026-08-14T15:00:00+03:00",
        precision: "exact",
      },
      attributes_judge: { attributes: { next_contact_date: { precision: "exact" } } },
      pipeline_execution: {
        pipeline_status: "SUCCESS",
        steps_total: 6,
        steps_executed: 6,
        steps_successful: 6,
        stopped_at_stage: null,
        extractor_failures: [],
        judge_failures: [],
      },
    };
    const reports = document.getElementById("reports")!;
    reports.innerHTML = "";
    renderFinal(0, 0, []);
  });

  const finalResult = page.locator('[data-application-attributes-result="true"]');
  await expect(finalResult).toContainText("Интересует: Новостройки");
  await expect(finalResult).toContainText("Источник средств: не определено");
  await expect(finalResult).toContainText("Срок покупки: не определено");
  await expect(finalResult).toContainText("Дата следующего контакта: 14.08.2026, 15:00");
  await expect(finalResult).toContainText("Уверенность: 98%");
  await expect(finalResult).toContainText("Оценка качества: 100%");
  await expect(finalResult.locator("[data-attributes-metrics-details]")) .toContainText("Уверенность · Интересует 95%");

  const finalStatus = page.locator('[data-application-attributes-status="true"]');
  await expect(finalStatus).toContainText("Quality Gate: READY");
  await expect(finalStatus).toContainText("CRM status: READY");
  await expect(finalStatus).toContainText("Этапов выполнено: 6");
  await expect(finalStatus).toContainText("Успешно пройдено: 6");
  await expect(finalStatus).toContainText("Pipeline status: SUCCESS");
  await expect(page.getByText("Итоговое саммари", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Summary Quality Score/)).toHaveCount(0);
  await expect(page.getByText(/Карточка CRM/)).toHaveCount(0);
});

test("renderer даты следующего контакта отображает дату без выдуманного времени, null и результат повторного запуска", async ({ page }) => {
  await page.goto(projectUrl);

  const renderNextContactDate = async (nextContactDate: { detected: boolean; next_contact_at: string | null; precision: string }) => {
    await page.evaluate((value) => {
      ctx = {
        crm_attributes_result: {
          attributes: { interest: ["Новостройки"], funding_source: "не определено", purchase_term: "не определено", next_contact_date: value.detected ? value.next_contact_at : null },
          update_actions: { interest: "SET", funding_source: "SET_UNDETERMINED", purchase_term: "SET_UNDETERMINED", next_contact_date: value.detected && value.next_contact_at ? "SET" : "SKIP" },
          pipeline_status: "READY",
        },
        attributes_quality_gate: { gate_status: "READY" },
        attributes_metrics: { overall_confidence: 0.95, quality_score: 100 },
        pipeline_execution: { pipeline_status: "SUCCESS", steps_executed: 7, steps_successful: 7 },
        next_contact_date_extractor: value,
        attributes_judge: { attributes: { next_contact_date: value } },
      };
      document.getElementById("reports")!.innerHTML = "";
      renderFinal(0, 0, []);
    }, nextContactDate);
    return page.locator("[data-result-next-contact-date]").textContent();
  };

  await expect(renderNextContactDate({ detected: true, next_contact_at: "2026-08-14", precision: "date" })).resolves.toBe("14.08.2026");
  await expect(renderNextContactDate({ detected: true, next_contact_at: "2026-08-14T00:00:00+03:00", precision: "date" })).resolves.toBe("14.08.2026");
  await expect(renderNextContactDate({ detected: false, next_contact_at: "2026-08-14T15:00:00+03:00", precision: "exact" })).resolves.toBe("не определено");
  await expect(renderNextContactDate({ detected: true, next_contact_at: null, precision: "none" })).resolves.toBe("не определено");
  await expect(renderNextContactDate({ detected: true, next_contact_at: "2026-02-30", precision: "date" })).resolves.toBe("не определено");
  await expect(renderNextContactDate({ detected: true, next_contact_at: "2026-08-15T16:30:00+03:00", precision: "exact" })).resolves.toBe("15.08.2026, 16:30");

  await page.evaluate(() => {
    (window as Window & { __downloadedPipelineReport?: string }).__downloadedPipelineReport = undefined;
    dl = (blob: Blob) => {
      void blob.text().then((text) => {
        (window as Window & { __downloadedPipelineReport?: string }).__downloadedPipelineReport = text;
      });
    };
    document.getElementById("dlReport")!.click();
  });
  await page.waitForFunction(() => Boolean((window as Window & { __downloadedPipelineReport?: string }).__downloadedPipelineReport));
  const downloadedReport = await page.evaluate(() => JSON.parse((window as Window & { __downloadedPipelineReport?: string }).__downloadedPipelineReport!));
  expect(downloadedReport.result.next_contact_date_extractor).toMatchObject({
    detected: true,
    next_contact_at: "2026-08-15T16:30:00+03:00",
    precision: "exact",
  });
});

test("fault injection не превращает technical Funding Extractor в не определено", async ({ page }) => {
  await page.goto(projectUrl);
  const result = await page.evaluate(async () => {
    (document.getElementById("transcript") as HTMLTextAreaElement).value = [
      "[FAULT_FUNDING_EXTRACTOR]",
      "Оператор: Новостройки рассматриваете?",
      "Клиент: Да, также нужна консультация по ипотеке.",
      "Клиент: Источник финансирования пока не выбрал.",
    ].join("\n");
    await runPipeline();
    return {
      execution: ctx.pipeline_execution,
      fundingExtractor: ctx.funding_source_extractor,
      attributesJudge: ctx.attributes_judge,
      gate: ctx.attributes_quality_gate,
      crm: ctx.crm_attributes_result,
      metrics: ctx.attributes_metrics,
      legacySummaryGatePresent: Object.prototype.hasOwnProperty.call(ctx, "__latest_summary_quality_gate"),
      provenance: {
        extractor: ctx.__stage_provenance.funding_source_extractor,
        judge: ctx.__stage_provenance.attributes_judge,
        gate: ctx.__stage_provenance.attributes_quality_gate,
        crm: ctx.__stage_provenance.crm_attributes_result,
      },
    };
  });

  expect(result.execution).toMatchObject({
    pipeline_status: "FAILED",
    steps_total: 7,
    steps_executed: 7,
    extractor_failures: ["funding_source_extractor"],
  });
  expect(result.fundingExtractor).toMatchObject({ status: "technical_error", error_code: "TRUNCATED_JSON" });
  expect(result.attributesJudge).toMatchObject({
    attributes: { interest: ["Новостройки"], funding_source: null, purchase_term: "не определено" },
    attribute_statuses: { interest: "ready", funding_source: "technical_error", purchase_term: "ready" },
    decisions: { interest: "approve", funding_source: "technical_error", purchase_term: "approve" },
    evidence: { funding_source: "" },
    reason_codes: { funding_source: ["technical_input_error"] },
  });
  expect(result.gate).toEqual({
    decisions: { interest: "AUTO_SAVE", funding_source: "TECHNICAL_ERROR", purchase_term: "SAVE_UNDETERMINED", next_contact_date: "DO_NOT_UPDATE" },
    values_for_save: { interest: ["Новостройки"], funding_source: null, purchase_term: "не определено", next_contact_date: null },
    blocked_attributes: [],
    technical_errors: ["funding_source"],
    gate_status: "PARTIAL_READY",
  });
  expect(result.crm).toEqual({
    attributes: { interest: ["Новостройки"], funding_source: null, purchase_term: "не определено", next_contact_date: null },
    update_actions: { interest: "SET", funding_source: "ERROR", purchase_term: "SET_UNDETERMINED", next_contact_date: "SKIP" },
    pipeline_status: "PARTIAL_READY",
    blocked_attributes: [],
    technical_errors: ["funding_source"],
  });
  expect(result.metrics).toMatchObject({
    overall_confidence: 1,
    confidence_status: "PARTIAL",
    attribute_confidence: { interest: 1, funding_source: null, purchase_term: 1 },
    quality_score: 25,
    quality_criteria: {
      extractor_correctness: 0,
      evidence_quality: 0,
      judge_consistency: 0,
      pipeline_integrity: 50,
      crm_readiness: 75,
    },
  });
  expect(result.legacySummaryGatePresent).toBe(false);
  for (const provenance of Object.values(result.provenance)) {
    expect(provenance.run_id).toBeTruthy();
    expect(provenance.transcript_hash).toBeTruthy();
    expect(provenance.pipeline_configuration_hash).toBeTruthy();
  }
});

test("Funding Extractor выдерживает 20 длинных controlled runs без truncation", async ({ page }) => {
  await page.goto(projectUrl);
  const result = await page.evaluate(async () => {
    const stage = pipeline.find((item) => item.outKey === "funding_source_extractor");
    const longTranscript = Array.from(
      { length: 220 },
      (_, index) => `Клиент: Реплика ${index + 1}. Обсуждаем объект, документы и условия. Источник средств пока не определён.`,
    ).join("\n");
    const runs = [];
    for (let index = 0; index < 20; index += 1) {
      const report = await runStage(stage, { __transcript: longTranscript });
      runs.push({
        status: report.status,
        parseErr: report.parseErr,
        finishReason: report.finish_reason,
        outputTokenBudget: report.output_token_budget,
        parseStatus: report.contract_audit.parse_status,
        schemaStatus: report.contract_audit.schema_status,
        structuredOutputRequested: report.contract_audit.structured_output_requested,
      });
    }
    return { transcriptLength: longTranscript.length, stageMaxTokens: stage.maxTokens, runs };
  });

  expect(result.transcriptLength).toBeGreaterThan(15_000);
  expect(result.stageMaxTokens).toBe(2000);
  expect(result.runs).toHaveLength(20);
  expect(result.runs.filter((run) => run.parseErr === "TRUNCATED_JSON")).toHaveLength(0);
  expect(result.runs.every((run) => run.status === "ok")).toBe(true);
  expect(result.runs.every((run) => run.parseStatus === "SUCCESS" && run.schemaStatus === "VALID")).toBe(true);
  expect(result.runs.every((run) => run.outputTokenBudget === 2000 && run.structuredOutputRequested)).toBe(true);
});

test("fault injection каждого Extractor изолирует только соответствующий атрибут", async ({ page }) => {
  await page.goto(projectUrl);
  const results = await page.evaluate(async () => {
    const judgeStage = pipeline.find((stage) => stage.outKey === "attributes_judge");
    const sourceByAttribute: any = { interest: "interest_extractor", funding_source: "funding_source_extractor", purchase_term: "purchase_term_extractor" };
    const cases: any = {};
    for (const brokenAttribute of Object.keys(sourceByAttribute)) {
      const current: any = {
        __run_id: `fault-${brokenAttribute}`,
        __transcript: "Клиент интересуется новостройкой, ипотека в процессе, покупка через два-три месяца.",
        __transcript_hash: "fault-transcript",
        __pipeline_configuration_hash: "fault-pipeline",
        interest_extractor: { value: ["Новостройки"], evidence: ["Новостройка интересует"] },
        funding_source_extractor: { value: "ипотека в процессе", evidence: "Ипотека в процессе" },
        purchase_term_extractor: { value: "2–3 месяца", evidence: "Через два-три месяца" },
        __stage_provenance: {},
      };
      const brokenKey = sourceByAttribute[brokenAttribute];
      current[brokenKey] = { status: "technical_error", error_code: "FAULT_INJECTION" };
      for (const key of Object.values(sourceByAttribute) as string[]) current.__stage_provenance[key] = { run_id: current.__run_id, transcript_hash: current.__transcript_hash, pipeline_configuration_hash: current.__pipeline_configuration_hash };
      const report = await runStage(judgeStage, current);
      current.attributes_judge = report.output;
      current.__stage_provenance.attributes_judge = { run_id: current.__run_id, transcript_hash: current.__transcript_hash, pipeline_configuration_hash: current.__pipeline_configuration_hash };
      const gate = buildApplicationAttributesQualityGate(current.attributes_judge);
      const crm = buildApplicationAttributesCrmResult(gate);
      cases[brokenAttribute] = { report, judge: current.attributes_judge, gate, crm };
    }
    return cases;
  });

  for (const attribute of ["interest", "funding_source", "purchase_term"] as const) {
    const current = results[attribute];
    expect(current.judge.attribute_statuses[attribute]).toBe("technical_error");
    expect(current.judge.decisions[attribute]).toBe("technical_error");
    expect(current.judge.attributes[attribute]).toBeNull();
    expect(current.judge.reason_codes[attribute]).toEqual(["technical_input_error"]);
    expect(current.gate.decisions[attribute]).toBe("TECHNICAL_ERROR");
    expect(current.gate.gate_status).toBe("PARTIAL_READY");
    expect(current.crm.attributes[attribute]).toBeNull();
    expect(current.crm.update_actions[attribute]).toBe("ERROR");
    expect(current.report.contract_audit).toMatchObject({ structured_output_requested: true, structured_output_applied: true, parse_status: "SUCCESS", schema_status: "VALID" });
    for (const other of (["interest", "funding_source", "purchase_term"] as const).filter((key) => key !== attribute)) {
      expect(current.judge.attribute_statuses[other]).toBe("ready");
      expect(["AUTO_SAVE", "SAVE_UNDETERMINED"]).toContain(current.gate.decisions[other]);
      expect(["SET", "SET_UNDETERMINED"]).toContain(current.crm.update_actions[other]);
    }
  }
});

test("Attributes Judge валидирует единый contract, decisions и immutable technical error", async ({ page }) => {
  await page.goto(projectUrl);
  const result = await page.evaluate(() => {
    const baseCtx: any = {
      __run_id: "judge-run", __transcript_hash: "judge-transcript", __pipeline_configuration_hash: "judge-pipeline",
      interest_extractor: { value: ["Ипотека"], evidence: ["Клиент: «Нужна консультация»"] },
      funding_source_extractor: { value: "ипотека одобрена", evidence: "Ипотека одобрена" },
      purchase_term_extractor: { value: "не определено", evidence: "" },
      next_contact_date_extractor: { detected: false, next_contact_at: null, precision: "none", action: "none", actor: "none", raw_time_expression: null, evidence: null, confidence: 1 },
      __stage_provenance: {},
    };
    for (const key of ["interest_extractor", "funding_source_extractor", "purchase_term_extractor", "next_contact_date_extractor"]) baseCtx.__stage_provenance[key] = { run_id: "judge-run", transcript_hash: "judge-transcript", pipeline_configuration_hash: "judge-pipeline" };
    const valid: any = {
      attributes: { interest: ["Ипотека", "Новостройки"], funding_source: "ипотека одобрена", purchase_term: "не определено", next_contact_date: null },
      attribute_statuses: { interest: "ready", funding_source: "ready", purchase_term: "ready", next_contact_date: "ready" },
      decisions: { interest: "correct", funding_source: "approve", purchase_term: "approve", next_contact_date: "approve" },
      evidence: { interest: ["Нужна консультация", "Звоню по переуступке"], funding_source: "Ипотека одобрена", purchase_term: "", next_contact_date: "" },
      reason_codes: { interest: ["direct_confirmation", "newbuild_from_context"], funding_source: ["mortgage_approved_confirmed"], purchase_term: ["no_confirmed_purchase_term"], next_contact_date: ["next_contact_not_confirmed"] },
    };
    const validate = (value: unknown, current = baseCtx) => {
      try { validateApplicationAttributesCombinedJudge(value, current); return null; }
      catch (error) { return error instanceof Error ? error.message : String(error); }
    };
    const wrongDecision = structuredClone(valid); wrongDecision.decisions.interest = "approve";
    const wrongEvidence = structuredClone(valid); wrongEvidence.evidence.interest = ["Нужна консультация"];
    const technicalCtx = structuredClone(baseCtx); technicalCtx.funding_source_extractor = { status: "technical_error", error_code: "TRUNCATED_JSON" };
    const repairedTechnical = enforceApplicationAttributesCombinedTechnicalErrors(structuredClone(valid), technicalCtx);
    return { valid: validate(valid), wrongDecision: validate(wrongDecision), wrongEvidence: validate(wrongEvidence), technical: validate(repairedTechnical, technicalCtx), repairedTechnical, schema: APPLICATION_ATTRIBUTES_JUDGE_SCHEMA };
  });

  expect(result.valid).toBeNull();
  expect(result.wrongDecision).toContain("expected correct");
  expect(result.wrongEvidence).toBe("ATTRIBUTES_JUDGE_INTEREST_EVIDENCE_CARDINALITY_MISMATCH");
  expect(result.technical).toBeNull();
  expect(result.repairedTechnical).toMatchObject({ attributes: { funding_source: null }, attribute_statuses: { funding_source: "technical_error" }, decisions: { funding_source: "technical_error" }, evidence: { funding_source: "" }, reason_codes: { funding_source: ["technical_input_error"] } });
  expect(result.schema).toMatchObject({ type: "object", additionalProperties: false });
});

test("Attributes Judge semantic contract покрывает cases A–F без межатрибутного выравнивания", async ({ page }) => {
  await page.goto(projectUrl);
  const results = await page.evaluate(() => {
    const make = (interestExtractor: any, fundingExtractor: any, purchaseExtractor: any, attributes: any, decisions: any, evidence: any, reasonCodes: any) => {
      const current: any = {
        __run_id: "semantic-run", __transcript_hash: "semantic-transcript", __pipeline_configuration_hash: "semantic-pipeline",
        interest_extractor: interestExtractor, funding_source_extractor: fundingExtractor, purchase_term_extractor: purchaseExtractor,
        next_contact_date_extractor: { detected: false, next_contact_at: null, precision: "none", action: "none", actor: "none", raw_time_expression: null, evidence: null, confidence: 1 },
        __stage_provenance: {},
      };
      for (const key of ["interest_extractor", "funding_source_extractor", "purchase_term_extractor", "next_contact_date_extractor"]) current.__stage_provenance[key] = { run_id: current.__run_id, transcript_hash: current.__transcript_hash, pipeline_configuration_hash: current.__pipeline_configuration_hash };
      const judge = {
        attributes: { ...attributes, next_contact_date: null },
        attribute_statuses: { interest: "ready", funding_source: "ready", purchase_term: "ready", next_contact_date: "ready" },
        decisions: { ...decisions, next_contact_date: "approve" },
        evidence: { ...evidence, next_contact_date: "" },
        reason_codes: { ...reasonCodes, next_contact_date: ["next_contact_not_confirmed"] },
      };
      validateApplicationAttributesCombinedJudge(judge, current);
      return { judge, gate: buildApplicationAttributesQualityGate(judge) };
    };
    const unknownFunding = { value: "не определено", evidence: "" };
    const unknownPurchase = { value: "не определено", evidence: "" };
    const defaults = { funding_source: "не определено", purchase_term: "не определено" };
    const defaultEvidence = { funding_source: "", purchase_term: "" };
    const defaultCodes = { funding_source: ["no_confirmed_funding_source"], purchase_term: ["no_confirmed_purchase_term"] };
    return {
      A: make({ value: ["Новостройки"], evidence: ["ЖК"] }, unknownFunding, unknownPurchase, { interest: [], ...defaults }, { interest: "reject", funding_source: "approve", purchase_term: "approve" }, { interest: [], ...defaultEvidence }, { interest: ["explicit_rejection"], ...defaultCodes }),
      B: make({ value: ["Новостройки"], evidence: ["Переуступка"] }, unknownFunding, unknownPurchase, { interest: ["Новостройки"], ...defaults }, { interest: "approve", funding_source: "approve", purchase_term: "approve" }, { interest: ["Звоню по переуступке, когда сдаётся корпус?"], ...defaultEvidence }, { interest: ["newbuild_from_context"], ...defaultCodes }),
      C: make({ value: ["Ипотека"], evidence: ["Возможно"] }, unknownFunding, unknownPurchase, { interest: ["Ипотека"], ...defaults }, { interest: "approve", funding_source: "approve", purchase_term: "approve" }, { interest: ["Оператор: нужна консультация? Клиент: возможно"], ...defaultEvidence }, { interest: ["soft_confirmation"], ...defaultCodes }),
      D: make({ value: [], evidence: [] }, { value: "ипотека одобрена", evidence: "Ипотека уже одобрена" }, unknownPurchase, { interest: [], funding_source: "ипотека одобрена", purchase_term: "не определено" }, { interest: "approve", funding_source: "approve", purchase_term: "approve" }, { interest: [], funding_source: "Ипотека уже одобрена", purchase_term: "" }, { interest: ["mortgage_only_as_funding"], funding_source: ["mortgage_approved_confirmed"], purchase_term: ["no_confirmed_purchase_term"] }),
      E: make({ value: [], evidence: [] }, { value: "продажа своей квартиры", evidence: "Через две недели продаём" }, { value: "до 1 месяца", evidence: "Сразу покупаем другую" }, { interest: [], funding_source: "продажа своей квартиры", purchase_term: "до 1 месяца" }, { interest: "approve", funding_source: "approve", purchase_term: "approve" }, { interest: [], funding_source: "Через две недели продаём квартиру", purchase_term: "После продажи сразу покупаем другую" }, { interest: ["no_confirmed_interest"], funding_source: ["property_sale_dependency"], purchase_term: ["derived_from_linked_event"] }),
      F: make({ value: [], evidence: [] }, unknownFunding, unknownPurchase, { interest: [], ...defaults }, { interest: "approve", funding_source: "approve", purchase_term: "approve" }, { interest: [], ...defaultEvidence }, { interest: ["no_confirmed_interest"], funding_source: ["no_confirmed_funding_source"], purchase_term: ["viewing_is_not_purchase"] }),
    };
  });

  expect(results.A.judge.attributes.interest).toEqual([]);
  expect(results.B.judge.reason_codes.interest).toEqual(["newbuild_from_context"]);
  expect(results.C.judge.reason_codes.interest).toEqual(["soft_confirmation"]);
  expect(results.D.judge.attributes).toMatchObject({ interest: [], funding_source: "ипотека одобрена" });
  expect(results.E.judge.attributes).toMatchObject({ funding_source: "продажа своей квартиры", purchase_term: "до 1 месяца" });
  expect(results.F.judge.attributes.purchase_term).toBe("не определено");
  expect(Object.values(results).every((item: any) => item.gate.gate_status === "READY")).toBe(true);
});

test("финальный renderer различает множественный interest, пустой массив и null", async ({ page }) => {
  await page.goto(projectUrl);
  const values = await page.evaluate(() => ({
    multiple: formatApplicationAttributeValue(["Новостройки", "Ипотека"]),
    empty: formatApplicationAttributeValue([]),
    unchangedInterest: formatApplicationAttributeValue(null),
    unchangedFunding: formatApplicationAttributeValue(null),
    unchangedPurchaseTerm: formatApplicationAttributeValue(null),
  }));

  expect(values).toEqual({
    multiple: "Новостройки, Ипотека",
    empty: "не определено",
    unchangedInterest: "не изменять",
    unchangedFunding: "не изменять",
    unchangedPurchaseTerm: "не изменять",
  });
});

test("CRM-result независимо обрабатывает undetermined, technical error и invalid input", async ({ page }) => {
  await page.goto(projectUrl);
  const results = await page.evaluate(() => [
    buildApplicationAttributesCrmResult({
      decisions: { interest: "SAVE_UNDETERMINED", funding_source: "SAVE_UNDETERMINED", purchase_term: "SAVE_UNDETERMINED", next_contact_date: "DO_NOT_UPDATE" },
      values_for_save: { interest: [], funding_source: "не определено", purchase_term: "не определено", next_contact_date: null },
      blocked_attributes: [], technical_errors: [], gate_status: "READY",
    }),
    buildApplicationAttributesCrmResult({
      decisions: { interest: "AUTO_SAVE", funding_source: "TECHNICAL_ERROR", purchase_term: "AUTO_SAVE", next_contact_date: "DO_NOT_UPDATE" },
      values_for_save: { interest: ["Новостройки"], funding_source: null, purchase_term: "2–3 месяца", next_contact_date: null },
      blocked_attributes: [], technical_errors: ["funding_source"], gate_status: "PARTIAL_READY",
    }),
    buildApplicationAttributesCrmResult({
      decisions: { interest: "DO_NOT_UPDATE", funding_source: "AUTO_SAVE", purchase_term: "AUTO_SAVE", next_contact_date: "DO_NOT_UPDATE" },
      values_for_save: { interest: null, funding_source: "наличные / депозит", purchase_term: "до 1 месяца", next_contact_date: null },
      blocked_attributes: ["interest"], technical_errors: [], gate_status: "PARTIAL_READY",
    }),
  ]);

  expect(results[0]).toMatchObject({
    update_actions: { interest: "SET_UNDETERMINED", funding_source: "SET_UNDETERMINED", purchase_term: "SET_UNDETERMINED", next_contact_date: "SKIP" },
    pipeline_status: "READY",
  });
  expect(results[1]).toMatchObject({
    attributes: { interest: ["Новостройки"], funding_source: null, purchase_term: "2–3 месяца", next_contact_date: null },
    update_actions: { interest: "SET", funding_source: "ERROR", purchase_term: "SET", next_contact_date: "SKIP" },
    pipeline_status: "PARTIAL_READY",
  });
  expect(results[2]).toMatchObject({
    attributes: { interest: null, funding_source: "наличные / депозит", purchase_term: "до 1 месяца", next_contact_date: null },
    update_actions: { interest: "SKIP", funding_source: "SET", purchase_term: "SET", next_contact_date: "SKIP" },
    pipeline_status: "PARTIAL_READY",
  });
});

test("deterministic metrics сохраняют семантику reports 8/9/10 и технических состояний", async ({ page }) => {
  await page.goto(projectUrl);
  const results = await page.evaluate(() => {
    const keys = ["interest_extractor", "funding_source_extractor", "purchase_term_extractor", "next_contact_date_extractor", "attributes_judge", "attributes_quality_gate", "crm_attributes_result"];
    const build = (judge: any, pipelineStatus = "SUCCESS") => {
      const current: any = {
        __run_id: "metrics-run",
        __transcript_hash: "metrics-transcript",
        __pipeline_configuration_hash: "metrics-pipeline",
        attributes_judge: judge,
        next_contact_date_extractor: judge.attribute_statuses.next_contact_date === "technical_error"
          ? { status: "technical_error", error_code: "TEST_TECHNICAL_ERROR" }
          : { detected: false, next_contact_at: null, precision: "none", action: "none", actor: "none", raw_time_expression: null, evidence: null, confidence: 1 },
        __stage_provenance: Object.fromEntries(keys.map((key) => [key, {
          run_id: "metrics-run",
          transcript_hash: "metrics-transcript",
          pipeline_configuration_hash: "metrics-pipeline",
        }])),
      };
      current.attributes_quality_gate = buildApplicationAttributesQualityGate(current.attributes_judge);
      current.crm_attributes_result = buildApplicationAttributesCrmResult(current.attributes_quality_gate);
      current.pipeline_execution = { pipeline_status: pipelineStatus, steps_total: 7, steps_executed: 7, steps_successful: pipelineStatus === "SUCCESS" ? 7 : 6 };
      return { judge, gate: current.attributes_quality_gate, crm: current.crm_attributes_result, metrics: buildApplicationAttributesMetrics(current) };
    };
    const nextUndetermined = { value: null, decision: "approve", evidence: "", codes: ["next_contact_not_confirmed"] };
    const combined = (interest: any, funding: any, purchase: any, next: any = nextUndetermined) => ({
      attributes: { interest: interest.value, funding_source: funding.value, purchase_term: purchase.value, next_contact_date: next.value },
      attribute_statuses: { interest: interest.status ?? "ready", funding_source: funding.status ?? "ready", purchase_term: purchase.status ?? "ready", next_contact_date: next.status ?? "ready" },
      decisions: { interest: interest.decision, funding_source: funding.decision, purchase_term: purchase.decision, next_contact_date: next.decision },
      evidence: { interest: interest.evidence, funding_source: funding.evidence, purchase_term: purchase.evidence, next_contact_date: next.evidence },
      reason_codes: { interest: interest.codes, funding_source: funding.codes, purchase_term: purchase.codes, next_contact_date: next.codes },
    });
    const undetermined = (reason: string) => ({ value: "не определено", decision: "approve", evidence: "", codes: [reason] });
    const technical = (interest = false) => ({ value: null, status: "technical_error", decision: "technical_error", evidence: interest ? [] : "", codes: ["technical_input_error"] });
    return {
      report8: build(combined(
        { value: ["Ипотека"], decision: "approve", evidence: ["Клиент: «Да, нужна консультация по ипотеке»"], codes: ["direct_confirmation"] },
        undetermined("no_confirmed_funding_source"),
        undetermined("no_confirmed_purchase_term"),
      )),
      report9: build(combined(
        { value: ["Ипотека"], decision: "approve", evidence: ["Клиент: «Возможно, но пока не уверены»"], codes: ["soft_confirmation"] },
        { value: "ипотека в процессе", decision: "approve", evidence: "Часть возьмём в ипотеку.", codes: ["mortgage_in_process_confirmed"] },
        undetermined("no_confirmed_purchase_term"),
      )),
      report10: build(combined(
        { value: ["Новостройки", "Ипотека", "Безопасность сделок"], decision: "approve", evidence: ["Это переуступка.", "Возможно, лучше через ипотеку.", "Безопасность мне важна."], codes: ["newbuild_from_context", "soft_confirmation", "direct_confirmation"] },
        { value: "наличные / депозит", decision: "approve", evidence: "Наличные.", codes: ["cash_or_deposit_confirmed"] },
        undetermined("no_confirmed_purchase_term"),
      )),
      allUndetermined: build(combined(
        { value: [], decision: "approve", evidence: [], codes: ["no_confirmed_interest"] },
        undetermined("no_confirmed_funding_source"),
        undetermined("no_confirmed_purchase_term"),
      )),
      corrected: build(combined(
        { value: ["Ипотека"], decision: "correct", evidence: ["Нужна ипотечная консультация."], codes: ["direct_confirmation"] },
        undetermined("no_confirmed_funding_source"),
        undetermined("no_confirmed_purchase_term"),
      )),
      allTechnical: build(combined(technical(true), technical(), technical(), technical()), "FAILED"),
    };
  });

  expect(results.report8.metrics).toMatchObject({ overall_confidence: 1, quality_score: 100, confidence_status: "COMPLETE" });
  expect(results.report9.metrics).toMatchObject({ overall_confidence: 0.9625, attribute_confidence: { interest: 0.85 }, quality_score: 100 });
  expect(results.report10.metrics).toMatchObject({ overall_confidence: 0.9833, attribute_confidence: { interest: 0.9333 }, quality_score: 100 });
  expect(results.report10.crm.attributes).toEqual({ interest: ["Новостройки", "Ипотека", "Безопасность сделок"], funding_source: "наличные / депозит", purchase_term: "не определено", next_contact_date: null });
  expect(results.allUndetermined.metrics).toMatchObject({ overall_confidence: 1, quality_score: 100 });
  expect(results.corrected.metrics).toMatchObject({ attribute_confidence: { interest: 0.9 }, quality_score: 95, quality_criteria: { extractor_correctness: 75 } });
  expect(results.allTechnical.gate.gate_status).toBe("BLOCKED");
  expect(results.allTechnical.metrics).toMatchObject({ overall_confidence: null, confidence_status: "UNAVAILABLE", quality_score: 0 });
});

test("custom orchestration считает только enabled stages и блокирует stale context", async ({ page }) => {
  await page.goto(projectUrl);
  const result = await page.evaluate(() => {
    const active = pipeline.filter((stage) => stage.enabled);
    const reports = active.map((stage) => ({ stage, report: { status: "ok", execution_status: "SUCCESS" } }));
    const execution = buildPipelineExecutionSummary(active, reports, -1);
    const currentCtx = {
      __run_id: "run-current",
      __transcript_hash: "transcript-current",
      __pipeline_configuration_hash: "pipeline-current",
      attributes_quality_gate: { gate_status: "READY" },
      __stage_provenance: {
        attributes_quality_gate: {
          run_id: "run-current",
          transcript_hash: "transcript-current",
          pipeline_configuration_hash: "pipeline-current",
        },
      },
    };
    const staleCtx = {
      ...currentCtx,
      __stage_provenance: {
        attributes_quality_gate: {
          ...currentCtx.__stage_provenance.attributes_quality_gate,
          transcript_hash: "transcript-previous",
        },
      },
    };
    return {
      execution,
      current: tmpl("{{ctx.attributes_quality_gate}}", currentCtx),
      stale: tmpl("{{ctx.attributes_quality_gate}}", staleCtx),
      judgeRuntime: pipeline.find((stage) => stage.outKey === "attributes_judge"),
      gateRuntime: pipeline.find((stage) => stage.outKey === "attributes_quality_gate"),
      crmRuntime: pipeline.find((stage) => stage.outKey === "crm_attributes_result"),
    };
  });

  expect(result.execution).toMatchObject({
    pipeline_status: "SUCCESS",
    steps_total: 7,
    steps_executed: 7,
    steps_successful: 7,
    extractor_failures: [],
    judge_failures: [],
  });
  expect(result.current).toContain('"gate_status": "READY"');
  expect(result.stale).toBe("");
  expect(result.judgeRuntime).toMatchObject({ type: "check", runtimeType: "llm_judge", actualExecutor: "model", contractId: "application_attributes_judge", contractVersion: "v1" });
  expect(result.gateRuntime).toMatchObject({ runtimeType: "deterministic", actualExecutor: "code", sourceOutKey: "attributes_judge", contractId: "application_attributes_quality_gate", contractVersion: "v1" });
  expect(result.crmRuntime).toMatchObject({
    runtimeType: "deterministic",
    actualExecutor: "code",
    sourceOutKey: "attributes_quality_gate",
    contractId: "crm_attributes_result",
    contractVersion: "v1",
  });
});
