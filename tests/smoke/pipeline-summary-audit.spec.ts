import { expect, test } from "@playwright/test";

const moduleUrl = "/pipeline-lab-v3.html?projectId=project_transcription_summary_module&productName=" +
  encodeURIComponent("Модуль транскрибации и AI-саммари звонков");

const activeStageKeys = [
  "validation",
  "facts",
  "needs",
  "outcome",
  "conversation_store",
  "summary",
  "truth_check",
  "critical_completeness_check",
  "agent_utility_check",
  "action_check",
  "presentation_check",
  "summary_quality_gate",
  "crm",
];

test("экран Pipeline Lab передаёт выбранный продукт во встроенный стенд", async ({ page }) => {
  await page.goto("/?view=pipeline-lab-v3");
  const frame = page.locator('iframe[title="Pipeline Lab v3"]');
  await expect(frame).toHaveAttribute("src", /[?&]productId=project_transcription_summary_module/);
  await expect(frame).toHaveAttribute("src", /productName=/);
});

test("активный pipeline содержит ровно 13 этапов без промежуточных Judge", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const current = defaultPipeline().map((stage) => stage.outKey);
    const legacy = defaultPipeline();
    legacy.splice(2, 0,
      { name: "legacy fact", outKey: "fact_judge", type: "hybrid" },
      { name: "legacy need", outKey: "need_judge", type: "hybrid" },
      { name: "legacy outcome", outKey: "outcome_judge", type: "hybrid" },
    );
    return {
      current,
      migrated: migratePipelineConfig(legacy, []).map((stage) => stage.outKey),
    };
  });
  expect(result.current).toEqual(activeStageKeys);
  expect(result.migrated).toEqual(activeStageKeys);
});

test("Conversation Store собирается из сырых Extractor и продолжает работу частично", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const ctx = {
      __run_id: "run-store",
      __transcript_hash: "transcript-hash",
      __pipeline_configuration_hash: "pipeline-hash",
      __transcript: "Клиент: По поводу денег, у меня деньги на счету.",
      facts: {
        facts: [{
          id: "fact-1",
          type: "client_finance",
          value: "наличные / депозит",
          speaker: "Клиент",
          evidence: "По поводу денег, у меня деньги на счету.",
          source_turn_ids: ["turn-1"],
          confidence: 0.99,
        }],
        quotes: [],
      },
      needs: {
        status: "technical_error",
      },
      outcome: {
        call_results: [],
        agreements: [],
        primary_next_step: {
          agreement_ids: [],
          action: "",
          owner: "",
          recipient: "",
          deadline: "",
          channel: "",
          status: "not_defined",
          confidence: 0,
        },
      },
    };
    return buildConversationStoreV1(ctx);
  });
  expect(result.conversation.facts).toEqual([
    expect.objectContaining({ id: "fact-1", type: "client_finance" }),
  ]);
  expect(result.conversation.attributes).toEqual({
    interest: [],
    funding_source: "наличные / депозит",
    purchase_term: "не определено",
  });
  expect(result.conversation.partial).toBe(true);
  expect(result.conversation.source_errors).toEqual(["needs"]);
  expect(result.store_meta.status).toBe("READY_WITH_WARNINGS");
});

test("Summary принимает только четыре пользовательских поля", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const valid = validateModuleSummaryOutput({
      conversation_result: "Клиент уточнил условия покупки.",
      key_facts: [{ label: "Оплата", value: "наличные" }],
      quotes: [{ text: "Покупаю за наличные." }],
      next_step: "Агент отправит материалы.",
    });
    let extraFieldRejected = false;
    try {
      validateModuleSummaryOutput({ ...valid, status: "GENERATED" });
    } catch {
      extraFieldRejected = true;
    }
    return { valid, extraFieldRejected };
  });
  expect(Object.keys(result.valid)).toEqual([
    "conversation_result",
    "key_facts",
    "quotes",
    "next_step",
  ]);
  expect(result.extraFieldRejected).toBe(true);
});

test("Quality Gate усредняет только доступные оценки и не блокирует pipeline", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const base = (score, status = "pass", issues = []) => ({ score, status, issues });
    const complete = CODE_FUNCS.summaryQualityGate({}, {
      truth_check: base(100),
      critical_completeness_check: base(100),
      agent_utility_check: base(75, "warning"),
      action_check: base(100),
      presentation_check: base(100),
    }).output;
    const partial = CODE_FUNCS.summaryQualityGate({}, {
      truth_check: { status: "technical_error", score: null },
      critical_completeness_check: base(100),
      agent_utility_check: base(75, "warning"),
      action_check: base(100),
      presentation_check: base(100),
    }).output;
    const critical = CODE_FUNCS.summaryQualityGate({}, {
      truth_check: base(100, "pass", [{ severity: "critical", message: "Критическая ошибка." }]),
      critical_completeness_check: base(100),
      agent_utility_check: base(100),
      action_check: base(100),
      presentation_check: base(100),
    }).output;
    return { complete, partial, critical };
  });
  expect(result.complete).toMatchObject({
    summary_quality_score: 95,
    quality_status: "EXCELLENT",
    evaluation_status: "complete",
    evaluated_criteria: 5,
    total_criteria: 5,
    blocking: false,
  });
  expect(result.partial).toMatchObject({
    summary_quality_score: 93.8,
    quality_status: "GOOD",
    evaluation_status: "partial",
    evaluated_criteria: 4,
    blocking: false,
  });
  expect(result.critical).toMatchObject({
    summary_quality_score: 100,
    quality_status: "NEEDS_ATTENTION",
    blocking: false,
  });
  expect(result.critical.critical_issues).toHaveLength(1);
});

test("CRM сохраняет валидный Summary даже без результата Gate", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const summary = {
      conversation_result: "Клиент Александр запросил расчёт расходов.",
      key_facts: [{ label: "Запрос", value: "разбивка расходов и НДС" }],
      quotes: [{ text: "Пришлите точную разбивку расходов." }],
      next_step: "Агент отправит расчёт сегодня.",
    };
    return moduleCrmV1({
      __run_id: "run-alexandra",
      summary,
      conversation_store: {
        conversation: {
          attributes: {
            interest: ["Новостройки"],
            funding_source: "наличные / депозит",
            purchase_term: "не определено",
          },
        },
      },
    });
  });
  expect(result).toMatchObject({
    status: "SAVED",
    decision: "SAVED_WITH_PARTIAL_EVALUATION",
    summary_saved: true,
    attributes_saved: true,
    quality_saved: true,
    payload: {
      summary: {
        conversation_result: "Клиент Александр запросил расчёт расходов.",
      },
      customer_needs: {
        interest: ["Новостройки"],
        funding_source: "наличные / депозит",
        purchase_term: "не определено",
      },
      quality: { score: null, status: "NOT_EVALUATED" },
    },
  });
});
