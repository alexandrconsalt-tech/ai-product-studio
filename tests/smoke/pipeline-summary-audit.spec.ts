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

test("Summary детерминированно сокращает небольшой перелимит без fallback", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const longText = "Подтверждённая информация из разговора без новых фактов. ".repeat(7);
    const repaired = moduleSummaryDeterministicRepair({
      conversation_result: longText,
      key_facts: [
        { label: "Параметры объекта", value: longText },
        { label: "Условия сделки", value: longText },
      ],
      quotes: [{ text: longText }],
      next_step: longText,
    });
    let valid = false;
    try {
      validateModuleSummaryOutput(repaired.value);
      valid = true;
    } catch {
      valid = false;
    }
    return {
      valid,
      visibleLength: moduleSummaryVisibleText(repaired.value).length,
      repairAttempted: repaired.repair_attempted,
      removedItems: repaired.removed_items,
      contractStatus: repaired.contract_status,
    };
  });
  expect(result).toMatchObject({
    valid: true,
    repairAttempted: true,
    contractStatus: "RECOVERED_WITH_WARNING",
  });
  expect(result.visibleLength).toBeLessThanOrEqual(1200);
  expect(result.removedItems).toContain("content_over_1200_shortened");
});

test("Need превращает отклонённые 38 м² в минимальную площадь", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => normalizeNeedExtractionSemantics({
    attributes: {
      interest: [],
      funding_source: { value: "не определено", confidence: 1, evidence: "", source_fact_ids: [], verification_status: "extracted" },
      purchase_term: { value: "не определено", confidence: 1, evidence: "", source_fact_ids: [], verification_status: "extracted" },
    },
    requirements: [{
      id: "requirement_1",
      type: "rejected_option",
      value: "38 м² — слишком мало",
      confidence: 0.99,
      evidence: "Я уже смотрела 38, для меня слишком мало.",
      source_fact_ids: ["fact_1"],
      verification_status: "extracted",
    }],
    need_meta: { interest_count: 0, requirements_count: 1, decision: "EXTRACTED" },
  }, {
    facts: {
      facts: [{
        id: "fact_1",
        type: "client_requirement",
        value: "38 м² слишком мало, идеально 46 м²",
        speaker: "Клиент",
        evidence: "Я уже смотрела 38, для меня слишком мало. Идеально 46.",
        source_turn_ids: ["turn_1"],
        confidence: 0.99,
      }],
      quotes: [],
    },
  }));
  expect(result.requirements).toEqual([
    expect.objectContaining({
      type: "minimum_area",
      value: "больше 38 м²",
      source_fact_ids: ["fact_1"],
    }),
  ]);
  expect(result.need_meta.transformations).toContainEqual(
    expect.objectContaining({ type: "REJECTED_AREA_TO_MINIMUM_AREA" }),
  );
});

test("Fact→Need восстанавливает пропущенные критерии Снежаны с provenance", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const transcript = [
      "Клиент: Я просто хотела посмотреть, понять, что из себя представляет такая квартира в Саварьево, где я хочу купить.",
      "Клиент: Я уже смотрела 38, для меня слишком мало.",
      "Клиент: Идеально 46. У меня у самой 45.",
      "Неизвестный спикер: Там сейчас никто не проживает. Аренда была. Квартира пустая, прописанных никого нет, без обременений.",
    ].join("\n");
    const policy = applyFactExtractionPolicies({
      facts: [{
        id: "fact_1",
        type: "client_requirement",
        value: "площадь около 46 м²",
        speaker: "Клиент",
        evidence: "Идеально 46. У меня у самой 45.",
        source_turn_ids: ["turn_3"],
        confidence: 0.9,
      }, {
        id: "fact_2",
        type: "agent_information",
        value: "квартира пустая, прописанных нет, без обременений",
        speaker: "Третье лицо",
        evidence: "Там сейчас никто не проживает. Аренда была. Квартира пустая, прописанных никого нет, без обременений.",
        source_turn_ids: ["turn_4"],
        confidence: 0.9,
      }],
      quotes: [],
    }, { __transcript: transcript });
    const needs = normalizeNeedExtractionSemantics({
      attributes: {
        interest: [],
        funding_source: { value: "не определено", confidence: 1, evidence: "", source_fact_ids: [], verification_status: "extracted" },
        purchase_term: { value: "не определено", confidence: 1, evidence: "", source_fact_ids: [], verification_status: "extracted" },
      },
      requirements: [{
        id: "requirement_1",
        type: "preferred_area",
        value: "около 46 м²",
        confidence: 0.9,
        evidence: "Идеально 46. У меня у самой 45.",
        source_fact_ids: ["fact_1"],
        verification_status: "extracted",
      }],
      need_meta: { interest_count: 0, requirements_count: 1, decision: "EXTRACTED" },
    }, { facts: policy.value });
    return { policy, needs };
  });
  expect(result.policy.audit.recovered_fact_count).toBe(3);
  expect(result.policy.value.facts).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "client_constraint", value: "больше 38 м²", speaker: "Клиент" }),
    expect.objectContaining({ type: "client_requirement", value: "Саварьево", speaker: "Клиент" }),
    expect.objectContaining({ type: "agent_information", value: "раньше сдавалась", speaker: "Третье лицо" }),
  ]));
  expect(result.needs.requirements).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "search_location", value: "Саварьево" }),
    expect.objectContaining({ type: "minimum_area", value: "больше 38 м²" }),
    expect.objectContaining({ type: "preferred_area", value: "около 46 м²" }),
  ]));
  for (const requirement of result.needs.requirements) {
    expect(requirement.source_fact_ids).not.toHaveLength(0);
  }
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
    const partialContext = CODE_FUNCS.summaryQualityGate({}, {
      truth_check: base(100),
      critical_completeness_check: base(100),
      agent_utility_check: base(100),
      action_check: base(100),
      presentation_check: base(100),
      conversation_store: { conversation: { partial: true, source_errors: ["outcome"] } },
    }).output;
    return { complete, partial, critical, partialContext };
  });
  expect(result.complete).toMatchObject({
    summary_quality_score: 95,
    quality_status: "PASS",
    evaluation_status: "complete",
    evaluated_criteria: 5,
    total_criteria: 5,
    blocking: false,
  });
  expect(result.partial).toMatchObject({
    summary_quality_score: 93.8,
    quality_status: "PASS",
    evaluation_status: "partial",
    evaluated_criteria: 4,
    blocking: false,
  });
  expect(result.critical).toMatchObject({
    summary_quality_score: 100,
    quality_status: "WARNING",
    blocking: false,
  });
  expect(result.critical.critical_issues).toHaveLength(1);
  expect(result.partialContext).toMatchObject({
    evaluation_status: "complete_on_partial_context",
    pipeline_context_complete: false,
    extractor_errors: ["outcome"],
  });
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
    decision: "SAVED_WITH_WARNING",
    summary_saved: true,
    attributes_included_in_payload: true,
    attributes_saved_to_crm_fields: false,
    attributes_saved: false,
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
