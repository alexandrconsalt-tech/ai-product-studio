import { expect, test } from "@playwright/test";

const moduleUrl = "/pipeline-lab-v3.html?productName=" +
  encodeURIComponent("Модуль транскрибации и AI-саммари звонков");

test("пользовательская legacy-конфигурация сохраняется без дублирования этапов", async ({ page }) => {
  await page.addInitScript(() => {
    const legacyKeys = [
      "validation", "facts", "needs", "outcome", "fact_judge", "need_judge",
      "outcome_judge", "conversation", "summary", "truth_check",
      "critical_facts_check", "context_check", "action_check",
      "presentation_check", "quality_gate", "publish_result",
    ];
    const stages = legacyKeys.map((outKey, index) => ({
      id: `legacy-${index}`,
      enabled: true,
      type: outKey.endsWith("judge") || outKey.endsWith("_check") ? "check" : "llm",
      codeFn: outKey === "validation" ? "validate"
        : outKey === "conversation" ? "conversationStore"
          : outKey === "quality_gate" ? "summaryQualityGate"
            : outKey === "publish_result" ? "crm"
              : undefined,
      outKey,
      name: outKey,
      prompt: "legacy prompt",
      userEdited: true,
    }));
    localStorage.setItem("pipelineLabV3.pipelineConfig", JSON.stringify({ version: 11, stages }));
  });

  await page.goto(moduleUrl);

  const stages = await page.evaluate(() => eval(
    "pipeline.map(({outKey,type,codeFn,prompt})=>({outKey,type,codeFn,prompt}))",
  ) as Array<{ outKey?: string; type?: string; codeFn?: string; prompt?: string }>);

  expect(stages.map((stage) => stage.outKey)).toEqual([
    "validation", "facts", "needs", "outcome", "fact_judge", "need_judge",
    "outcome_judge", "conversation", "summary", "truth_check",
    "critical_facts_check", "context_check", "action_check",
    "presentation_check", "quality_gate", "publish_result",
  ]);
  expect(stages.find((stage) => stage.outKey === "fact_judge")).toMatchObject({ type: "hybrid", codeFn: "factCheckCode", prompt: "legacy prompt" });
  expect(stages.some((stage) => stage.outKey === "fact_check")).toBe(false);
});

test("pipeline восстанавливает JSON Judge и не принимает неподтверждённые наличные", async ({ page }) => {
  await page.goto(moduleUrl);

  const result = await page.evaluate(() => {
    const api = globalThis as typeof globalThis & {
      parseJSON?: (text: string) => { missed_facts: Array<{ quote: string }> };
      cleanupNeedsV9?: (value: unknown) => unknown;
      mergeHybridCheck?: (
        codeResult: unknown,
        llmParsed: unknown,
        parseErr: null,
        options: { verifiedKey: string; rejectedKey: string; qualityKey: string },
      ) => { decision: string; rejected_outcome: Record<string, unknown> };
    };
    const parsed = api.parseJSON?.('{"missed_facts":[{"quote": \\"Да, и подскажите\\"}]}');
    const needs = {
      source_of_funds: {
        value: ["наличные"], confidence: 0.95, evidence: "Прямые.", verification_status: "pending",
      },
    };
    api.cleanupNeedsV9?.(needs);
    const merged = api.mergeHybridCheck?.(
      { criteria: [{ score: 100 }], fieldStatus: {}, hardFail: false, issues: [] },
      {
        verified_outcome: { call_result: { value: "назначен повторный звонок", verified: true } },
        rejected_outcome: { risks: { value: ["возможна конкуренция"], reason: "не подтверждено" } },
        outcome_check_quality: { score: 0.95, decision: "PASS" },
      },
      null,
      { verifiedKey: "verified_outcome", rejectedKey: "rejected_outcome", qualityKey: "outcome_check_quality" },
    );
    return { parsed, needs, merged };
  });

  expect(result.parsed?.missed_facts[0]?.quote).toBe("Да, и подскажите");
  expect(result.needs.source_of_funds).toEqual({
    value: ["не определено"], confidence: 1, evidence: null, verification_status: "not_applicable",
  });
  expect(result.merged?.decision).toBe("PASS_WITH_WARNINGS");
});

test("legacy-оценки корректно пересчитывают Store и Summary Quality Gate", async ({ page }) => {
  await page.goto(moduleUrl);

  const result = await page.evaluate(() => eval(`(() => {
    const validation = analyzeTranscriptQuality('Клиент: Угу.\\nАгент: Хорошо.\\nКлиент: Ну да.\\nАгент: Договорились, перезвоню.');
    const longClientTurn = [{role:'Клиент', text:'Я хочу купить объект для коммерции и подробно обсудить договор, документы и условия сделки, потому что это важно для моего бизнеса и дальнейшего решения по покупке', raw:'Клиент: ...'}];
    const store = CODE_FUNCS.conversationStore({}, {
      validation:{score:.66},
      fact_judge:{verified_facts:[{value:'купить',confidence:.95,evidence:'хочу купить'}],scores:{overall:94},decision:'PASS'},
      need_judge:{verified_needs:[{value:'офис',confidence:.95,evidence:'нужен офис'}],scores:{overall:91},decision:'WARNING'},
      outcome_judge:{scores:{overall:88},decision:'WARNING'},
      outcome:{next_step:{value:'агент перезвонит',confidence:.95,evidence:'перезвоню'}}
    }).output;
    const gate = CODE_FUNCS.summaryQualityGate({}, {
      summary:{summary:'Клиент планирует покупку для бизнеса.\\nСтатус: реальный интерес.\\nСледующий шаг: агент перезвонит.'},
      conversation:{facts:{client_name:{value:'Ирина'},address:{value:'Андропова, 10'},floor:{value:4},area:{value:'26,1'},price:{value:'15 799'},phone:{value:'4270'}},needs:{},outcome:{}},
      truth_check:{score:95,status:'pass',has_hallucinations:false,has_fact_distortions:false,has_role_confusion:false,critical_errors:[],explanation:'Факты верны.'},
      critical_facts_check:{score:50,status:'fail',missed_critical_facts:[
        {fact_type:'адрес',fact:'Андропова, 10'}, {fact_type:'этаж',fact:'4 этаж'},
        {fact_type:'площадь',fact:'26,1 кв. м'}, {fact_type:'цена',fact:'15 799'},
        {fact_type:'телефон',fact:'4270'}, {fact_type:'имя клиента',fact:'Ирина'}
      ],explanation:'Не указаны поля карточки.'},
      context_check:{score:95,status:'pass',context_clarity:95,business_usefulness:95,can_continue_without_recording:true,missing_for_next_agent:[],explanation:'Контекст достаточен.'},
      action_check:{score:95,status:'pass',action_errors:[],is_next_step_reflected:true,explanation:'Шаг отражён.'},
      presentation_check:{score:100,status:'pass',forbidden_card_duplicates:[],pii_found:[],forbidden_phrases:[],readability_issues:[],style_issues:[],has_status_or_action_line:true,explanation:'Формат верен.'}
    }).output;
    return {validation, roleConfusion:detectRoleConfusion(longClientTurn), store, gate};
  })()`));

  expect(result.validation.damagedTurns).toHaveLength(0);
  expect(result.roleConfusion.has).toBe(false);
  expect(result.store.quality.store_score).toBeCloseTo(0.859, 3);
  expect(result.store.quality.decision).toBe("PASS_WITH_WARNINGS");
  expect(result.gate.card_context_facts).toHaveLength(6);
  expect(result.gate.critical_errors).toEqual([]);
  expect(result.gate.summary_quality_score).toBeGreaterThanOrEqual(90);
  expect(result.gate.decision).toBe("AUTO_SAVE");
});

test("семантическое сокращение сохраняет финансы и передаёт обязательные факты в retry", async ({ page }) => {
  await page.goto(moduleUrl);

  const result = await page.evaluate(() => eval(`(() => {
    const transcript='Клиент: Хочу купить помещение для бизнеса.\\nАгент: В ипотеку или за наличку?\\nКлиент: У нас есть основная сумма, и мы чуть-чуть добираемся.\\nАгент: Добираете чуть-чуть. Завтра перезвоню в 14:00.';
    const ctxValue={
      __transcript:transcript,
      transcript,
      conversation:{facts:{intent:{value:'купить'}},needs:{finance:{value:'У нас есть основная сумма, и мы чуть-чуть добираемся'}},outcome:{next_step:{value:'перезвонить завтра в 14:00'}}},
      needs:{needs:[{category:'финансы',value:'У нас есть основная сумма, и мы чуть-чуть добираемся'}]},
      outcome:{next_step:{value:'перезвонить завтра в 14:00'}},
      quality_gate:{summary_required_facts:[{fact_type:'финансирование',fact:'Есть основная сумма, недостающую сумму клиент добирает'}]}
    };
    const filler='Клиент рассматривает подходящий объект для бизнеса и уточняет условия сделки. '.repeat(12);
    const original=filler+'Финансовая ситуация: «У нас есть основная сумма, и мы чуть-чуть добираемся».\\nСледующий шаг: агент перезвонит завтра в 14:00.';
    const shortened=semanticShortenSummary(original,ctxValue,700,1200);
    const incomplete=semanticShortenSummary('Клиент хочет купить помещение.\\nСледующий шаг: агент перезвонит завтра в 14:00.',ctxValue,700,1200);
    const summaryPrompt=ensureModuleTranscriptPrompt({outKey:'summary',type:'llm',name:'Генерация саммари'},'Старый пользовательский промпт',ctxValue).prompt;
    const factPrompt=ensureModuleTranscriptPrompt({outKey:'fact_judge',type:'check',name:'Проверка фактов'},'• при малейшем сомнении снижать оценку;',ctxValue).prompt;
    const crm=CODE_FUNCS.crm({}, {...ctxValue,summary:{summary:'Неполное summary',semantic_coverage_preserved:false},quality_gate:{decision:'AUTO_SAVE',summary_quality_score:95}}).output;
    return {shortened,incomplete,summaryPrompt,factPrompt,crm};
  })()`));

  expect(result.shortened.summary).toContain("основная сумма");
  expect(result.shortened.summary).toContain("добираемся");
  expect(result.shortened.semantic_coverage_preserved).toBe(true);
  expect(result.shortened.missing_after_shortening).toEqual([]);
  expect(result.incomplete.semantic_coverage_preserved).toBe(false);
  expect(result.incomplete.missing_after_shortening).toEqual([]);
  expect(result.summaryPrompt).toContain("ОБЯЗАТЕЛЬНЫЕ ФАКТЫ ПОСЛЕ ПРОВЕРКИ КАЧЕСТВА");
  expect(result.summaryPrompt).toContain("Есть основная сумма");
  expect(result.factPrompt).not.toContain("при малейшем сомнении снижать оценку");
  expect(result.factPrompt).toContain("ОБЯЗАТЕЛЬНОЕ ПРАВИЛО КОНТЕКСТНОЙ ПРОВЕРКИ");
  expect(result.crm.saved).toBe(false);
});

test("решение RETRY действительно повторно запускает Summary и проверки", async ({ page }) => {
  await page.goto(moduleUrl);

  const result = await page.evaluate(() => eval(`(async () => {
    localStorage.setItem('pipelineLabV3.openaiApiKey','test-key');
    ctx={quality_gate:{decision:'RETRY',summary_required_facts:[{fact:'финансовая ситуация'}]}};
    const active=[
      {outKey:'summary',type:'llm',name:'Summary'},
      {outKey:'truth_check',type:'check',name:'Truth'},
      {outKey:'quality_gate',type:'code',codeFn:'summaryQualityGate',name:'Gate'},
      {outKey:'publish_result',type:'code',codeFn:'crm',name:'CRM'}
    ];
    const reports=active.map(stage=>({stage,report:{output:{},status:'warn',meta:{score:50}}}));
    const calls=[];
    const originalRunStage=runStage;
    runStage=async stage=>{
      calls.push(stage.outKey);
      if(stage.outKey==='summary') return {output:{summary:'Финансовая ситуация отражена.',semantic_coverage_preserved:true},status:'ok',tokens:10,cost:.01,meta:{score:null}};
      if(stage.outKey==='quality_gate') return {output:{decision:'AUTO_SAVE',summary_required_facts:[]},status:'ok',meta:{score:95}};
      if(stage.outKey==='publish_result') return {output:{saved:true},status:'ok',meta:{score:100}};
      return {output:{score:95,status:'pass'},status:'ok',tokens:5,cost:.005,meta:{score:95}};
    };
    const retry=await retrySummaryQualityFlow(active,reports);
    runStage=originalRunStage;
    return {retry,calls,summary:ctx.summary,gate:ctx.quality_gate,publish:ctx.publish_result,reports:reports.map(item=>({key:item.stage.outKey,retry:item.report.retry_attempt}))};
  })()`));

  expect(result.retry.attempted).toBe(true);
  expect(result.calls).toEqual(["summary", "truth_check", "quality_gate", "publish_result"]);
  expect(result.summary.summary).toContain("Финансовая ситуация");
  expect(result.gate.decision).toBe("AUTO_SAVE");
  expect(result.publish.saved).toBe(true);
  expect(result.reports.every((report: { retry?: number }) => report.retry === 1)).toBe(true);
});

test("Store сохраняет исходные факты, CRM needs и корректную итоговую карточку", async ({ page }) => {
  await page.goto(moduleUrl);

  const result = await page.evaluate(() => eval(`(() => {
    const original={category:'client_name',type:'client_name',value:'Анна',confidence:.96,speaker:'Клиент',evidence:'Меня зовут Анна'};
    const store=CODE_FUNCS.conversationStore({}, {
      __transcript:'Клиент: Меня зовут Анна. Ирина. Рассматриваю вторичный рынок. У нас есть основная сумма, и мы чуть-чуть добираемся.',
      validation:{score:1},
      facts:{},
      fact_judge:{
        verified_facts:[
          {original_fact:original,value:'PASS',verification_result:'PASS'},
          {fact:{category:'budget',type:'budget',value:'15 млн',confidence:.95,evidence:'до 15 млн'},verification_result:'PASS'},
          {original_fact:{category:'phone',value:'79990000000'},verification_result:'FAIL'},
          {value:'PASS',verification_result:'PASS'},
          null
        ],
        failed_facts:[{original_fact:{category:'phone',value:'79990000000'},verification_result:'FAIL'}],
        scores:{overall:95},decision:'PASS'
      },
      needs:{crm_needs:{interested_in:['Вторичная недвижимость'],source_of_funds:'не определено',purchase_timeline:'не определено',call_result:'ожидается подтверждение просмотра'}},
      need_judge:{verified_needs:[{value:'вторичный рынок',confidence:.95,verified:true}],crm_validation:{interested_in:'PASS',source_of_funds:'PASS',purchase_timeline:'PASS',call_result:'PASS'},scores:{overall:95},decision:'PASS'},
      outcome:{call_result:{value:'ожидается подтверждение просмотра'},next_step:{value:'подтвердить просмотр'}},
      outcome_judge:{verified_outcome:{call_result:{value:'ожидается подтверждение просмотра',confidence:.95,verified:true},next_step:{value:'подтвердить просмотр',confidence:.95,verified:true}},scores:{overall:95},decision:'PASS'}
    }).output;
    const crm=CODE_FUNCS.crm({}, {__transcript:'Рассматриваю вторичный рынок.',conversation:store,summary:{summary:'Клиент рассматривает вторичный рынок. Следующий шаг: подтвердить просмотр.',semantic_coverage_preserved:true},quality_gate:{decision:'AUTO_SAVE',summary_quality_score:96}}).output;
    const malformed=[
      verifiedFactField({original_fact:original,value:'PASS'}),
      verifiedFactField({fact:original,verification_result:'PASS'}),
      verifiedFactField({original_fact:original,verification_result:'FAIL'}),
      verifiedFactField({value:'PASS'}),
      verifiedFactField({original_fact:{category:'x'},verification_result:'PASS'})
    ];
    return {store,crm,malformed};
  })()`));

  expect(result.malformed[0]?.value).toBe("Анна");
  expect(result.malformed[1]?.value).toBe("Анна");
  expect(result.malformed.slice(2)).toEqual([null, null, null]);
  expect(Object.values(result.store.facts).some((fact: any) => fact.value === "PASS")).toBe(false);
  expect(result.store.debug.rejected_facts).toHaveLength(1);
  expect(result.store.crm_needs.interested_in).toEqual(["Вторичная недвижимость"]);
  expect(result.store.funding).toMatchObject({ source: "не определено", verified: true, status: "частично сформирован" });
  expect(result.crm.card).toMatchObject({
    client_name: "Анна",
    budget: "15 млн",
    source_of_funds: "не определено",
    funding_details: "У клиента есть основная сумма, недостающую часть добирают",
    interested_in: ["Вторичная недвижимость"],
    purchase_timeline: "не определено",
    call_result: "ожидается подтверждение просмотра",
  });
});

test("Presentation применяет цель 700 и жёсткий максимум 800", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => ({
    target:CODE_FUNCS.presentationCheck({}, {summary:{summary:'А'.repeat(720)+'\\nСледующий шаг: звонок'}}).output,
    maximum:CODE_FUNCS.presentationCheck({}, {summary:{summary:'А'.repeat(810)+'\\nСледующий шаг: звонок'}}).output
  }))()`));
  expect(result.target.status).toBe("warning");
  expect(result.target.is_too_long).toBe(false);
  expect(result.maximum.status).toBe("fail");
  expect(result.maximum.is_too_long).toBe(true);
});

test("ошибки ключа и квоты останавливают pipeline без повторов", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(async () => {
    localStorage.setItem('pipelineLabV3.anthropicApiKey','bad-anthropic');
    localStorage.setItem('pipelineLabV3.openaiApiKey','no-quota');
    const originalAnthropic=callAnthropic;
    const originalOpenAI=callOpenAI;
    callAnthropic=async()=>{throw new Error('Anthropic API 401: invalid x-api-key')};
    callOpenAI=async()=>{throw new Error('OpenAI API 429: quota exceeded')};
    let message='';
    try{await callModel('prompt','gpt-5-mini')}catch(error){message=error.message}
    ctx={quality_gate:{decision:'RETRY'}};
    const retry=await retrySummaryQualityFlow([{outKey:'summary'}],[{stage:{outKey:'facts'},report:{error:message}}]);
    callAnthropic=originalAnthropic;
    callOpenAI=originalOpenAI;
    return {message,terminal:isTerminalProviderError(message),retry};
  })()`));
  expect(result.message).toContain("OpenAI API 429");
  expect(result.message).toContain("Anthropic API 401");
  expect(result.terminal).toBe(true);
  expect(result.retry).toMatchObject({ attempted: false, reason: "PROVIDER_UNAVAILABLE" });
});

test("непроверенное финансирование не получает verified=true", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => CODE_FUNCS.conversationStore({}, {
    __transcript:'У нас есть основная сумма, и мы чуть-чуть добираемся.',
    validation:{score:.94},
    fact_judge:{decision:'FAIL'},
    need_judge:{decision:'FAIL'},
    outcome_judge:{decision:'FAIL'}
  }).output)()`));
  expect(result.funding).toMatchObject({
    source: "не определено",
    details: "У клиента есть основная сумма, недостающую часть добирают",
    verified: false,
  });
});
