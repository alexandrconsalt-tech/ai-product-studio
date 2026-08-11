import { expect, test } from "@playwright/test";

const projectId = "project_72f7b30d-0d09-49fd-81b7-82a8b8f88c4f";
const projectUrl = `/pipeline-lab-v3.html?projectId=${projectId}&productName=${encodeURIComponent("AI Атрибуты в Заявке")}`;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem("pipelineLabV3.pipelineConfig");
    localStorage.setItem("selectedLlmProvider", "mock");
  });
});

test("AI Атрибуты заявки выполняет 6 этапов с единым Attributes Judge", async ({ page }) => {
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
    steps_total: 6,
    steps_executed: 6,
    steps_successful: 6,
    stopped_at_stage: null,
    extractor_failures: [],
    judge_failures: [],
  });
  expect(result.interest.value).toEqual(["Новостройки"]);
  expect(result.funding.value).toBe("ипотека в процессе");
  expect(result.purchaseTerm.value).toBe("2–3 месяца");
  expect(result.attributesJudge.decisions).toEqual({ interest: "approve", funding_source: "approve", purchase_term: "approve" });
  expect(result.attributesJudge.attributes).toEqual({
    interest: ["Новостройки"],
    funding_source: "ипотека в процессе",
    purchase_term: "2–3 месяца",
  });
  expect(result.gate.gate_status).toBe("READY");
  expect(result.crm).toEqual({
    attributes: {
      interest: ["Новостройки"],
      funding_source: "ипотека в процессе",
      purchase_term: "2–3 месяца",
    },
    update_actions: { interest: "SET", funding_source: "SET", purchase_term: "SET" },
    pipeline_status: "READY",
    blocked_attributes: [],
    technical_errors: [],
  });
  expect(result.crmProvenance.run_id).toBeTruthy();
  expect(result.metrics).toMatchObject({
    overall_confidence: 1,
    confidence_status: "COMPLETE",
    attribute_confidence: { interest: 1, funding_source: 1, purchase_term: 1 },
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
  expect(result.stageKeys).toEqual(["interest_extractor", "funding_source_extractor", "purchase_term_extractor", "attributes_judge", "attributes_quality_gate", "crm_attributes_result"]);
  expect(result.llmCalls).toBe(4);
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
  await expect(finalResult.locator("[data-result-overall-confidence]")) .toHaveText("100%");
  await expect(finalResult.locator("[data-result-quality-score]")) .toHaveText("100%");
  await expect(finalResult).not.toContainText("Итоговое саммари");

  const finalStatus = page.locator('[data-application-attributes-status="true"]');
  await expect(finalStatus).toContainText("Quality Gate: READY");
  await expect(finalStatus).toContainText("CRM status: READY");
  await expect(finalStatus).toContainText("Этапов выполнено: 6");
  await expect(finalStatus).toContainText("Успешно пройдено: 6");
  await expect(finalStatus).toContainText("Pipeline status: SUCCESS");
  await expect(finalStatus).not.toContainText("Summary Quality Score");
  await expect(finalResult.locator("[data-attributes-metrics-details]")) .toContainText("Extractor correctness");
  await expect(finalStatus).not.toContainText("Решение:");
  await expect(finalStatus).not.toContainText("Карточка CRM");

  const judgeStage = page.locator("#stages .stage").nth(3);
  await expect(judgeStage).toContainText("Проверка атрибутов");
  await expect(judgeStage).toContainText("GPT-5 mini");
  for (const index of [4, 5]) {
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
        attributes: { interest: ["Новостройки"], funding_source: "не определено", purchase_term: "не определено" },
        update_actions: { interest: "SET", funding_source: "SET_UNDETERMINED", purchase_term: "SET_UNDETERMINED" },
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
    steps_total: 6,
    steps_executed: 6,
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
    decisions: { interest: "AUTO_SAVE", funding_source: "TECHNICAL_ERROR", purchase_term: "SAVE_UNDETERMINED" },
    values_for_save: { interest: ["Новостройки"], funding_source: null, purchase_term: "не определено" },
    blocked_attributes: [],
    technical_errors: ["funding_source"],
    gate_status: "PARTIAL_READY",
  });
  expect(result.crm).toEqual({
    attributes: { interest: ["Новостройки"], funding_source: null, purchase_term: "не определено" },
    update_actions: { interest: "SET", funding_source: "ERROR", purchase_term: "SET_UNDETERMINED" },
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
      __stage_provenance: {},
    };
    for (const key of ["interest_extractor", "funding_source_extractor", "purchase_term_extractor"]) baseCtx.__stage_provenance[key] = { run_id: "judge-run", transcript_hash: "judge-transcript", pipeline_configuration_hash: "judge-pipeline" };
    const valid: any = {
      attributes: { interest: ["Ипотека", "Новостройки"], funding_source: "ипотека одобрена", purchase_term: "не определено" },
      attribute_statuses: { interest: "ready", funding_source: "ready", purchase_term: "ready" },
      decisions: { interest: "correct", funding_source: "approve", purchase_term: "approve" },
      evidence: { interest: ["Нужна консультация", "Звоню по переуступке"], funding_source: "Ипотека одобрена", purchase_term: "" },
      reason_codes: { interest: ["direct_confirmation", "newbuild_from_context"], funding_source: ["mortgage_approved_confirmed"], purchase_term: ["no_confirmed_purchase_term"] },
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
        __stage_provenance: {},
      };
      for (const key of ["interest_extractor", "funding_source_extractor", "purchase_term_extractor"]) current.__stage_provenance[key] = { run_id: current.__run_id, transcript_hash: current.__transcript_hash, pipeline_configuration_hash: current.__pipeline_configuration_hash };
      const judge = { attributes, attribute_statuses: { interest: "ready", funding_source: "ready", purchase_term: "ready" }, decisions, evidence, reason_codes: reasonCodes };
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
      decisions: { interest: "SAVE_UNDETERMINED", funding_source: "SAVE_UNDETERMINED", purchase_term: "SAVE_UNDETERMINED" },
      values_for_save: { interest: [], funding_source: "не определено", purchase_term: "не определено" },
      blocked_attributes: [], technical_errors: [], gate_status: "READY",
    }),
    buildApplicationAttributesCrmResult({
      decisions: { interest: "AUTO_SAVE", funding_source: "TECHNICAL_ERROR", purchase_term: "AUTO_SAVE" },
      values_for_save: { interest: ["Новостройки"], funding_source: null, purchase_term: "2–3 месяца" },
      blocked_attributes: [], technical_errors: ["funding_source"], gate_status: "PARTIAL_READY",
    }),
    buildApplicationAttributesCrmResult({
      decisions: { interest: "DO_NOT_UPDATE", funding_source: "AUTO_SAVE", purchase_term: "AUTO_SAVE" },
      values_for_save: { interest: null, funding_source: "наличные / депозит", purchase_term: "до 1 месяца" },
      blocked_attributes: ["interest"], technical_errors: [], gate_status: "PARTIAL_READY",
    }),
  ]);

  expect(results[0]).toMatchObject({
    update_actions: { interest: "SET_UNDETERMINED", funding_source: "SET_UNDETERMINED", purchase_term: "SET_UNDETERMINED" },
    pipeline_status: "READY",
  });
  expect(results[1]).toMatchObject({
    attributes: { interest: ["Новостройки"], funding_source: null, purchase_term: "2–3 месяца" },
    update_actions: { interest: "SET", funding_source: "ERROR", purchase_term: "SET" },
    pipeline_status: "PARTIAL_READY",
  });
  expect(results[2]).toMatchObject({
    attributes: { interest: null, funding_source: "наличные / депозит", purchase_term: "до 1 месяца" },
    update_actions: { interest: "SKIP", funding_source: "SET", purchase_term: "SET" },
    pipeline_status: "PARTIAL_READY",
  });
});

test("deterministic metrics сохраняют семантику reports 8/9/10 и технических состояний", async ({ page }) => {
  await page.goto(projectUrl);
  const results = await page.evaluate(() => {
    const keys = ["interest_extractor", "funding_source_extractor", "purchase_term_extractor", "attributes_judge", "attributes_quality_gate", "crm_attributes_result"];
    const build = (judge: any, pipelineStatus = "SUCCESS") => {
      const current: any = {
        __run_id: "metrics-run",
        __transcript_hash: "metrics-transcript",
        __pipeline_configuration_hash: "metrics-pipeline",
        attributes_judge: judge,
        __stage_provenance: Object.fromEntries(keys.map((key) => [key, {
          run_id: "metrics-run",
          transcript_hash: "metrics-transcript",
          pipeline_configuration_hash: "metrics-pipeline",
        }])),
      };
      current.attributes_quality_gate = buildApplicationAttributesQualityGate(current.attributes_judge);
      current.crm_attributes_result = buildApplicationAttributesCrmResult(current.attributes_quality_gate);
      current.pipeline_execution = { pipeline_status: pipelineStatus, steps_total: 6, steps_executed: 6, steps_successful: pipelineStatus === "SUCCESS" ? 6 : 5 };
      return { judge, gate: current.attributes_quality_gate, crm: current.crm_attributes_result, metrics: buildApplicationAttributesMetrics(current) };
    };
    const combined = (interest: any, funding: any, purchase: any) => ({
      attributes: { interest: interest.value, funding_source: funding.value, purchase_term: purchase.value },
      attribute_statuses: { interest: interest.status ?? "ready", funding_source: funding.status ?? "ready", purchase_term: purchase.status ?? "ready" },
      decisions: { interest: interest.decision, funding_source: funding.decision, purchase_term: purchase.decision },
      evidence: { interest: interest.evidence, funding_source: funding.evidence, purchase_term: purchase.evidence },
      reason_codes: { interest: interest.codes, funding_source: funding.codes, purchase_term: purchase.codes },
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
      allTechnical: build(combined(technical(true), technical(), technical()), "FAILED"),
    };
  });

  expect(results.report8.metrics).toMatchObject({ overall_confidence: 1, quality_score: 100, confidence_status: "COMPLETE" });
  expect(results.report9.metrics).toMatchObject({ overall_confidence: 0.95, attribute_confidence: { interest: 0.85 }, quality_score: 100 });
  expect(results.report10.metrics).toMatchObject({ overall_confidence: 0.9778, attribute_confidence: { interest: 0.9333 }, quality_score: 100 });
  expect(results.report10.crm.attributes).toEqual({ interest: ["Новостройки", "Ипотека", "Безопасность сделок"], funding_source: "наличные / депозит", purchase_term: "не определено" });
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
    steps_total: 6,
    steps_executed: 6,
    steps_successful: 6,
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
