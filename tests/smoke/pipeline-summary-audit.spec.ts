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
          business_priority: "important",
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
  const result = await page.evaluate(() => validateNeedExtractionRoot({
    attributes: {
      interest: [],
      funding_source: { value: "не определено", confidence: 1, evidence: "", source_fact_ids: [], verification_status: "extracted" },
      purchase_term: { value: "не определено", confidence: 1, evidence: "", source_fact_ids: [], verification_status: "extracted" },
    },
    requirements: [{
      id: "requirement_1",
      type: "rejected_option",
      category: "other",
      value: "38 м² — слишком мало",
      priority: "required",
      reason: "Меньшая площадь клиенту не подходит.",
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
        business_priority: "critical",
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

test("Need сохраняет валидный результат после deterministic provenance relink", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => validateNeedExtractionRoot({
    attributes: {
      interest: [],
      funding_source: { value: "не определено", confidence: 1, evidence: "", source_fact_ids: [], verification_status: "extracted" },
      purchase_term: { value: "не определено", confidence: 1, evidence: "", source_fact_ids: [], verification_status: "extracted" },
    },
    requirements: [{
      id: "requirement_1",
      type: "rooms",
      category: "property",
      value: "трёхкомнатная квартира",
      priority: "required",
      reason: "Это цель клиента.",
      confidence: 0.95,
      evidence: "Хочу купить трёхкомнатную квартиру для семьи.",
      source_fact_ids: ["fact_2"],
      verification_status: "extracted",
    }],
    need_meta: { interest_count: 0, requirements_count: 1, decision: "EXTRACTED" },
  }, {
    facts: {
      facts: [{
        id: "fact_1",
        type: "client_requirement",
        value: "трёхкомнатная квартира",
        speaker: "Клиент",
        evidence: "Хочу купить трёхкомнатную квартиру для семьи.",
        source_turn_ids: ["turn_1"],
        confidence: 0.95,
        business_priority: "critical",
      }, {
        id: "fact_2",
        type: "client_need",
        value: "продать свою однокомнатную квартиру",
        speaker: "Клиент",
        evidence: "Сначала нужно продать свою однокомнатную.",
        source_turn_ids: ["turn_1"],
        confidence: 0.95,
        business_priority: "critical",
      }],
      quotes: [],
    },
  }));
  expect(result.requirements[0].source_fact_ids).toEqual(["fact_1"]);
  expect(result.need_meta.transformations).toContainEqual(expect.objectContaining({
    type: "PROVENANCE_AUTO_LINKED",
    from: ["fact_2"],
    to: ["fact_1"],
  }));
});

test("Need не оставляет requirements пустым при прямых критериях клиента", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => validateNeedExtractionRoot({
    attributes: {
      interest: [],
      funding_source: { value: "не определено", confidence: 1, evidence: "", source_fact_ids: [], verification_status: "extracted" },
      purchase_term: { value: "не определено", confidence: 1, evidence: "", source_fact_ids: [], verification_status: "extracted" },
    },
    requirements: [],
    need_meta: { interest_count: 0, requirements_count: 0, decision: "NO_NEEDS" },
  }, {
    facts: {
      facts: [{
        id: "fact_yard", type: "client_requirement", value: "тихий двор", speaker: "Клиент",
        evidence: "Мне важен тихий двор.", source_turn_ids: ["turn_1"], confidence: 0.95, business_priority: "critical",
      }, {
        id: "fact_floor", type: "client_requirement", value: "этаж выше первого", speaker: "Клиент",
        evidence: "Мне важен этаж выше первого.", source_turn_ids: ["turn_1"], confidence: 0.95, business_priority: "critical",
      }],
      quotes: [],
    },
  }));
  expect(result.requirements).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "infrastructure", value: "тихий двор", priority: "required", source_fact_ids: ["fact_yard"] }),
    expect.objectContaining({ type: "floor_preference", value: "этаж выше первого", priority: "required", source_fact_ids: ["fact_floor"] }),
  ]));
  expect(result.need_meta).toMatchObject({ requirements_count: 2, decision: "EXTRACTED" });
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
        business_priority: "critical",
      }, {
        id: "fact_2",
        type: "agent_information",
        value: "квартира пустая, прописанных нет, без обременений",
        speaker: "Третье лицо",
        evidence: "Там сейчас никто не проживает. Аренда была. Квартира пустая, прописанных никого нет, без обременений.",
        source_turn_ids: ["turn_4"],
        confidence: 0.9,
        business_priority: "important",
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
        category: "property",
        value: "около 46 м²",
        priority: "preferred",
        reason: "Это идеальная площадь по словам клиента.",
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

test("Store детерминированно восстанавливает требование из client-fact", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => buildConversationStoreV1({
    __run_id: "run-recovery",
    __transcript_hash: "transcript-hash",
    __pipeline_configuration_hash: "pipeline-hash",
    __transcript: "Клиент: Мне не подходит объект без лифта.",
    facts: { facts: [{
      id: "fact_lift", type: "client_constraint", value: "объект без лифта не подходит",
      speaker: "Клиент", evidence: "Мне не подходит объект без лифта.",
      source_turn_ids: ["turn_1"], confidence: 0.99, business_priority: "critical",
    }], quotes: [] },
    needs: {
      attributes: {
        interest: [],
        funding_source: { value: "не определено", confidence: 1, evidence: "", source_fact_ids: [], verification_status: "extracted" },
        purchase_term: { value: "не определено", confidence: 1, evidence: "", source_fact_ids: [], verification_status: "extracted" },
      },
      requirements: [], need_meta: { interest_count: 0, requirements_count: 0, decision: "NO_NEEDS" },
    },
    outcome: { call_result: "Обсуждение продолжится после подбора.", agreements: [], primary_next_step: { agreement_ids: [], action: "", owner: "", recipient: "", deadline: "", channel: "", status: "not_defined", confidence: 0 } },
  }));
  expect(result.needs_recovery).toEqual({ used: true, recovered_requirements: 1, source: "facts" });
  expect(result.conversation.requirements).toContainEqual(expect.objectContaining({
    type: "other_requirement", category: "other", value: "Наличие лифта",
    priority: "required", source_fact_ids: ["fact_lift"],
  }));
  expect(result.store_meta.schema_version).toBe("conversation_store_v2");
});

test("Summary планируется только из canonical Store и удаляет дубли", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const store = {
      conversation: {
        facts: [
          { id: "goal", type: "client_goal", value: "купить квартиру для родителей", speaker: "Клиент", evidence: "Родители покупают квартиру.", source_turn_ids: ["turn_1"], confidence: 1, business_priority: "critical" },
          { id: "route", type: "client_context", value: "доедет на метро", speaker: "Клиент", evidence: "Я доеду на метро.", source_turn_ids: ["turn_2"], confidence: 1, business_priority: "secondary" },
        ],
        quotes: [], attributes: { interest: [], funding_source: "наличные / депозит", purchase_term: "не определено" },
        requirements: [
          { id: "requirement_1", type: "other_requirement", category: "other", value: "Наличие лифта", priority: "required", reason: "Без лифта объект не подходит.", confidence: 1, evidence: "Без лифта не подходит.", source_fact_ids: ["goal"], verification_status: "extracted" },
          { id: "requirement_2", type: "floor_preference", category: "property", value: "этаж выше первого", priority: "preferred", reason: "Клиент обозначил предпочтение.", confidence: 1, evidence: "Важен этаж выше первого.", source_fact_ids: ["goal"], verification_status: "extracted" },
        ],
        call_result: "Агент подберёт вариант.", agreements: [], primary_next_step: { action: "Агент подберёт вариант", owner: "агент", deadline: "", channel: "", status: "confirmed", agreement_ids: [] },
      }, quality: {}, store_meta: { status: "READY" },
    };
    const safe = moduleSummaryStoreView(store), plan = moduleSummaryPreparedContext(safe);
    const policy = moduleSummaryApplyStorePolicy({
      conversation_result: "Клиент хочет купить квартиру для родителей. Клиенту нужен дом с лифтом. Агент подберёт вариант.",
      key_facts: [{ label: "Требование", value: "Дом с лифтом" }, { label: "Адрес", value: "улица Тестовая, 1" }],
      quotes: [{ text: "Без лифта не подходит —" }], next_step: "Агент подберёт вариант.  \",\"error\":\"\"}",
    }, safe);
    const longPolicy = moduleSummaryApplyStorePolicy({
      conversation_result: "Клиент пока не готов к просмотру.", key_facts: [], quotes: [],
      next_step: "Агент будет ждать решения клиента; клиент сам вернётся, когда сравнит предложения и примет решение об идее просмотра или контакте с агентом между собой при необходимости дальше обсуждать варианты и сроки при его инициативе.",
    }, { ...safe, conversation: { ...safe.conversation, facts: [...safe.conversation.facts, { id: "timing", type: "client_timing", value: "пока не решил, готов ли к просмотру", speaker: "Клиент", evidence: "Пока не решил, готов ли к просмотру.", source_turn_ids: ["turn_3"], confidence: 1, business_priority: "important" }], primary_next_step: { action: "клиент вернётся с решением", owner: "Клиент", deadline: "", channel: "", status: "confirmed" } } });
    return { safe, plan, policy, longPolicy };
  });
  expect(result.safe).not.toHaveProperty("business_context");
  expect(result.safe.conversation.facts.map((item) => item.id)).toEqual(["goal"]);
  expect(result.plan).toMatchObject({ main_goal: "купить квартиру для родителей", primary_need: "Наличие лифта" });
  expect(result.policy.value.key_facts).toEqual([
    { label: "Требование", value: "Дом с лифтом" },
    { label: "Этаж", value: "этаж выше первого" },
  ]);
  expect(result.policy.value.conversation_result).not.toContain("нужен дом с лифтом");
  expect(result.policy.value.quotes).toEqual([]);
  expect(result.policy.value.next_step).toBe("Агент подберёт вариант.");
  expect(result.policy.changes).toEqual(expect.arrayContaining(["semantic_duplicate_moved_to_key_fact", "card_fact_removed", "unfinished_quote_removed", "next_step_json_residue_removed"]));
  expect(result.longPolicy.value.conversation_result).toContain("пока не решил, готов ли к просмотру");
  expect(result.longPolicy.value.next_step).toBe("Клиент вернётся с решением.");
  expect(result.longPolicy.changes).toEqual(expect.arrayContaining(["viewing_readiness_corrected", "next_step_shortened_from_store"]));
});

test("Completeness не создаёт отсутствующие requirement и open question", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => buildCriticalSummaryItems({
    conversation_store: { conversation: {
      facts: [{ id: "goal", type: "client_goal", value: "посмотреть конкретную квартиру", speaker: "Клиент", evidence: "Хочу посмотреть эту квартиру.", source_turn_ids: ["turn_1"], confidence: 1, business_priority: "critical" }],
      requirements: [], attributes: { interest: [], funding_source: "не определено", purchase_term: "не определено" },
      call_result: "Клиент готов к просмотру.", primary_next_step: { action: "Согласовать время просмотра", owner: "агент", status: "confirmed" },
    } },
  }));
  expect(result.map((item) => item.category)).toEqual(["client_goal", "primary_need", "call_result", "next_step"]);
  expect(result.find((item) => item.category === "primary_need")?.expected).toBe("Посмотреть конкретный объект");
  expect(result.some((item) => item.category === "open_question")).toBe(false);
  expect(result.some((item) => item.category === "required_criteria")).toBe(false);
});

test("Format и pre-save diagnostics фиксируют только реальные дефекты", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const summary = { conversation_result: "Клиент ищет квартиру с лифтом.", key_facts: [{ label: "Требование", value: "Клиент ищет квартиру с лифтом" }], quotes: [{ text: "Без лифта не подходит —" }], next_step: "Агент пришлёт подборку." };
    const issues = presentationCodeIssues(summary);
    const diagnostics = buildSummaryDiagnostics({ summary, conversation_store: { conversation: {
      facts: [{ id: "need", type: "client_need", value: "квартира с лифтом", speaker: "Клиент", evidence: "Без лифта не подходит.", source_turn_ids: ["turn_1"], confidence: 1, business_priority: "critical" }],
      requirements: [], quotes: [], attributes: {}, call_result: "Поиск продолжен.", agreements: [], primary_next_step: { action: "Агент пришлёт подборку", owner: "агент", status: "confirmed" },
    } } });
    return { issues, diagnostics };
  });
  expect(result.issues.map((item) => item.type)).toEqual(expect.arrayContaining(["semantic_repetition", "unfinished_quote"]));
  expect(result.diagnostics).toMatchObject({ primary_need_present: true, semantic_repetition_count: 1, unfinished_quote_count: 1, crm_duplication_count: 0 });
});

test("детерминированная дедупликация очищает проблемный Summary и сохраняет audit до/после", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const ctx = { conversation_store: { conversation: {
      attributes: { interest: [], funding_source: "наличные / депозит", purchase_term: "не определено" },
      primary_next_step: { action: "провести просмотр", owner: "Агент", deadline: "завтра в 19:30", status: "confirmed" },
    } } };
    const summary = {
      conversation_result: "Клиент покупает квартиру для собственного проживания на Медикова, 26, корп. 1. Просмотр согласован на завтра в 19:30. Клиент оплатит полностью наличными.",
      key_facts: [
        { label: "Цель", value: "Покупка для себя" },
        { label: "Финансирование", value: "Наличные" },
        { label: "Показ", value: "Завтра в 19:30" },
      ],
      quotes: [{ text: "Себе рассматриваю." }],
      next_step: "Агент проведёт просмотр квартиры на Медикова, 26, корп. 1 завтра в 19:30.",
    };
    return deduplicateFinalSummary(ctx, summary);
  });
  expect(result.before.semantic_repetition_count).toBeGreaterThanOrEqual(2);
  expect(result.before.crm_duplication_count).toBeGreaterThanOrEqual(1);
  expect(result.before.address_duplication_count).toBeGreaterThanOrEqual(2);
  expect(result.before.next_step_duplicate_count).toBeGreaterThanOrEqual(1);
  expect(result.before.useless_quote_count).toBe(1);
  expect(result.value.key_facts).toEqual([]);
  expect(result.value.quotes).toEqual([]);
  expect(JSON.stringify(result.value)).not.toContain("Медикова");
  expect(result.value.next_step).toContain("19:30");
  expect(result.value.conversation_result).not.toContain("19:30");
  expect(result.after).toMatchObject({
    semantic_repetition_count: 0,
    crm_duplication_count: 0,
    address_duplication_count: 0,
    next_step_duplicate_count: 0,
    useless_quote_count: 0,
    deduplication_applied: true,
  });
  expect(result.removed_items.length).toBeGreaterThanOrEqual(5);
});

test("дедупликация удаляет организационный шум и повреждённую STT-фразу без домысла", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => deduplicateFinalSummary({ conversation_store: { conversation: { attributes: {}, primary_next_step: { status: "not_defined" } } } }, {
    conversation_result: "Клиент сравнивает варианты.",
    key_facts: [
      { label: "Причина переноса", value: "Показ перенесён из-за другой замковой двери." },
      { label: "Очередь", value: "Клиент будет третьим по счёту на просмотре." },
    ],
    quotes: [],
    next_step: "Следующий шаг не согласован.",
  }));
  expect(result.before.unclear_phrase_count).toBeGreaterThanOrEqual(1);
  expect(result.before.organizational_noise_count).toBeGreaterThanOrEqual(2);
  expect(result.value.key_facts).toEqual([]);
  expect(JSON.stringify(result.value)).not.toContain("замков");
});

test("Format Judge и Quality Gate применяют raw/effective caps и fallback hard gate", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const badDiagnostics = {
      semantic_repetition_count: 4, semantic_repetitions: [], crm_duplication_count: 0, crm_duplications: [],
      address_duplication_count: 1, next_step_present: true, next_step_duplicate_count: 0,
      useless_quote_count: 0, unfinished_quote_count: 0, unclear_phrase_count: 0,
      organizational_noise_count: 0, deduplication_applied: true, removed_items: [],
    };
    const ctx = {
      summary: { conversation_result: "Итог.", key_facts: [], quotes: [], next_step: "Агент позвонит." },
      summary_diagnostics: badDiagnostics,
      __summary_fallback_used: true,
      __summary_fallback_source: "grounding_warning",
      conversation_store: { conversation: { partial: false, source_errors: [], attributes: {}, primary_next_step: { action: "позвонить", status: "confirmed" } } },
    };
    const format = normalizeModuleGenericJudgeResult(MODULE_GENERIC_JUDGE_DEFINITIONS.presentation_check, {
      score: 95, status: "pass", issues: [], explanation: "Ошибок нет.",
    }, ctx);
    const base = { score: 95, status: "pass", issues: [], explanation: "OK" };
    const gate = CODE_FUNCS.summaryQualityGate({}, { ...ctx,
      truth_check: base, critical_completeness_check: base, agent_utility_check: base,
      action_check: base, presentation_check: { ...base, score: 95 },
    }).output;
    return { format, gate };
  });
  expect(result.format).toMatchObject({ raw_score: 95, score: 50, status: "warning" });
  expect(result.format.score_cap_reason).toEqual(expect.arrayContaining(["semantic_repetition_count=4", "address_duplication_count=1"]));
  expect(result.gate.decision).toBe("REVIEW_REQUIRED");
  expect(result.gate.crm_status).toBe("MANUAL_REVIEW");
  expect(result.gate.fallback_used).toBe(true);
  expect(result.gate.criteria.format).toMatchObject({ raw_judge_score: 95, effective_judge_score: 50 });
});

test("чистое Summary не получает cap и допускает AUTO_SAVE", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const ctx = { summary: { conversation_result: "Клиенту нужен тихий двор.", key_facts: [], quotes: [], next_step: "Клиент вернётся с решением." }, conversation_store: { conversation: { partial: false, source_errors: [], attributes: {}, primary_next_step: { action: "вернуться с решением", status: "confirmed" } } } };
    ctx.summary_diagnostics = analyzeSummaryDiagnostics(ctx, ctx.summary, { deduplication_applied: true, removed_items: [] });
    const base = { score: 95, status: "pass", issues: [], explanation: "OK" };
    return { diagnostics: ctx.summary_diagnostics, gate: CODE_FUNCS.summaryQualityGate({}, { ...ctx, truth_check: base, critical_completeness_check: base, agent_utility_check: base, action_check: base, presentation_check: base }).output };
  });
  expect(result.diagnostics).toMatchObject({ semantic_repetition_count: 0, crm_duplication_count: 0, address_duplication_count: 0 });
  expect(result.gate.decision).toBe("AUTO_SAVE");
  expect(result.gate.criteria.format).toMatchObject({ raw_judge_score: 95, effective_judge_score: 95, score_cap_reason: [] });
});

test("generic Judges удаляют ложный open question и считают Format по реальным issues", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const ctx = {
      summary: { conversation_result: "Клиент хочет посмотреть квартиру. Агент вечером сообщит время просмотра.", key_facts: [{ label: "Условие", value: "Дом с лифтом" }], quotes: [], next_step: "Агент вечером сообщит время просмотра." },
      conversation_store: { conversation: {
        facts: [{ id: "goal", type: "client_goal", value: "посмотреть квартиру", speaker: "Клиент", evidence: "Хочу посмотреть квартиру.", source_turn_ids: ["turn_1"], confidence: 1, business_priority: "critical" }],
        requirements: [], attributes: {}, call_result: "Агент вечером сообщит время просмотра.", agreements: [], primary_next_step: { action: "сообщить время просмотра", owner: "агент", status: "confirmed" },
      } },
    };
    const completeness = normalizeModuleGenericJudgeResult(MODULE_GENERIC_JUDGE_DEFINITIONS.critical_completeness_check, {
      score: 85, status: "warning", issues: [{ severity: "medium", message: "Не указан открытый вопрос: какое время просмотра остаётся неизвестным." }], explanation: "Не хватает open question.",
    }, ctx);
    const format = normalizeModuleGenericJudgeResult(MODULE_GENERIC_JUDGE_DEFINITIONS.presentation_check, {
      score: 90, status: "pass", issues: [{ severity: "low", message: "Произвольное замечание модели." }], explanation: "Произвольное замечание модели.",
    }, ctx);
    ctx.conversation_store.conversation.primary_next_step = { action: "клиент вернётся с решением", owner: "Клиент", deadline: "", channel: "", status: "confirmed" };
    ctx.summary.next_step = "Клиент вернётся с решением после сравнения предложений.";
    const action = normalizeModuleGenericJudgeResult(MODULE_GENERIC_JUDGE_DEFINITIONS.action_check, {
      score: 80, status: "warning", issues: [
        { severity: "medium", message: "Не указан согласованный срок следующего шага." },
        { severity: "medium", message: "Не указан канал, когда/как клиент даст ответ." },
      ], explanation: "Action и owner подтверждены, но отсутствуют срок и канал.",
    }, ctx);
    ctx.conversation_store.conversation.facts.push({ id: "timing", type: "client_timing", value: "конкретных сроков пока нет", speaker: "Клиент", evidence: "Конкретных сроков пока нет.", source_turn_ids: ["turn_3"], confidence: 1, business_priority: "important" });
    const usefulness = normalizeModuleGenericJudgeResult(MODULE_GENERIC_JUDGE_DEFINITIONS.agent_utility_check, {
      score: 90, status: "pass", issues: [{ severity: "low", message: "Не указан срок решения клиента." }], explanation: "Работу можно продолжить, но нет срока.",
    }, ctx);
    return { completeness, format, action, usefulness };
  });
  expect(result.completeness).toMatchObject({ score: 100, status: "pass", issues: [] });
  expect(result.format).toMatchObject({ score: 75, status: "warning" });
  expect(result.format.issues.length).toBeGreaterThanOrEqual(1);
  expect(result.action).toMatchObject({ score: 100, status: "pass", issues: [] });
  expect(result.usefulness).toMatchObject({ score: 100, status: "pass", issues: [] });
});

test("Quality Gate требует полные оценки и учитывает partial context", async ({ page }) => {
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
    blocking: true,
    decision: "REVIEW_REQUIRED",
  });
  expect(result.partial).toMatchObject({
    summary_quality_score: null,
    quality_status: "NOT_EVALUATED",
    evaluation_status: "partial",
    evaluated_criteria: 4,
    blocking: true,
    decision: "TECHNICAL_ERROR",
  });
  expect(result.critical).toMatchObject({
    summary_quality_score: 100,
    quality_status: "WARNING",
    blocking: true,
    decision: "REVIEW_REQUIRED",
  });
  expect(result.critical.critical_issues).toHaveLength(1);
  expect(result.partialContext).toMatchObject({
    evaluation_status: "complete_on_partial_context",
    pipeline_context_complete: false,
    extractor_errors: ["outcome"],
  });
});

test("CRM не сохраняет Summary без результата Gate", async ({ page }) => {
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
    status: "TECHNICAL_ERROR",
    decision: "TECHNICAL_ERROR",
    summary_saved: false,
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
