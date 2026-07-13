import { expect, test } from "@playwright/test";
import regressionCases from "../fixtures/transcription-summary-regression-32-36.json";

const moduleUrl = "/pipeline-lab-v3.html?productName=" +
  encodeURIComponent("Модуль транскрибации и AI-саммари звонков");

test("regression 32–36 фиксирует исходные системные дефекты", () => {
  expect(regressionCases).toHaveLength(5);
  expect(regressionCases.every((item) => item.run_id === null)).toBe(true);
  expect(regressionCases.every((item) => item.generic_criteria > 0)).toBe(true);
  expect(regressionCases.every((item) => item.facts_score === 85 && item.needs_score === 85)).toBe(true);
  expect(regressionCases.some((item) => item.outcome_decision === "PASS" && item.verified_outcome_empty)).toBe(true);
});

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
    let truncatedError="";
    try{ api.parseJSON?.('{"facts":[{"category":"Клиент","value":"Анна"},{"category":"Объект","evidence":"Покровская, 6. Сек'); }catch(error){ truncatedError=(error as Error).message; }
    return { parsed, needs, merged, truncatedError };
  });

  expect(result.parsed?.missed_facts[0]?.quote).toBe("Да, и подскажите");
  expect(result.needs.source_of_funds).toEqual({
    value: ["не определено"], confidence: 1, evidence: null, verification_status: "not_applicable",
  });
  expect(result.merged?.decision).toBe("PASS_WITH_WARNINGS");
  expect(result.truncatedError).toBe("TRUNCATED_JSON");
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
  expect(result.gate.decision).toBe("SAVE_WITH_WARNING");
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
  expect(result.incomplete.missing_after_shortening).toEqual(expect.arrayContaining(["Финансовая ситуация клиента", "Мотивация клиента"]));
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

test("Presentation применяет единый максимум 800", async ({ page }) => {
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

test("контракты Judge не используют generic score и нормализуют failed-поля", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const code=moduleGenericCheck('facts',{facts:[{category:'goal',value:'купить',confidence:.97,evidence:'Хочу купить',speaker:'Клиент'}]});
    const fact=mergeHybridCheck(code,{verified_facts:[{category:'goal',value:'купить',confidence:.97,evidence:'Хочу купить'}],failed_facts:[{category:'budget',reason:'нет цитаты'}],scores:{accuracy:98,completeness:96,evidence_quality:99,speaker_attribution:100,overall:98},decision:'WARNING'},null,{verifiedKey:'verified_facts',rejectedKey:'rejected_facts',qualityKey:'fact_check_quality'});
    const broken=mergeHybridCheck(code,null,"Expected ',' or '}'",{verifiedKey:'verified_facts',rejectedKey:'rejected_facts',qualityKey:'fact_check_quality'});
    const emptyOutcome=mergeHybridCheck(code,{verified_outcome:{},scores:{overall:100},decision:'PASS'},null,{verifiedKey:'verified_outcome',rejectedKey:'rejected_outcome',qualityKey:'outcome_check_quality',sourceHasData:true});
    const meta=buildStageMeta({type:'llm',outKey:'facts'},{output:{facts:[{confidence:.97}]},status:'ok'});
    return {code,fact,broken,emptyOutcome,meta};
  })()`));

  expect(result.code.criteria.map((item: any) => item.name)).not.toContain("Generic module extraction");
  expect(result.fact.rejected_facts).toHaveLength(1);
  expect(result.fact.score).toBeGreaterThanOrEqual(95);
  expect(result.broken).toMatchObject({ status: "technical_error", score: null, decision: "ERROR", error_code: "JUDGE_RESULT_UNAVAILABLE" });
  expect(result.emptyOutcome).toMatchObject({ status: "technical_error", decision: "ERROR", error_code: "PASS_WITH_EMPTY_VERIFIED_OUTCOME" });
  expect(result.meta).toMatchObject({ score: null, confidence: 0.97 });
});

test("каждый шаг Pipeline Lab получает Оценку и Confidence в итоговом отчёте", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const reports=[
      {stage:{type:'code',outKey:'validation',codeFn:'validate',name:'Валидация'},report:{status:'ok',output:{score:.99,decision:'PASS'}}},
      {stage:{type:'llm',outKey:'facts',name:'Факты'},report:{status:'ok',output:{facts:[{confidence:.97}]}}},
      {stage:{type:'hybrid',outKey:'fact_judge',name:'Проверка фактов'},report:{status:'ok',output:{score:94,decision:'PASS',verified_facts:[{confidence:.96}]}}},
      {stage:{type:'code',outKey:'conversation',codeFn:'conversationStore',name:'Store'},report:{status:'ok',output:{quality:{store_score:.925},facts:[{confidence:.95}]}}},
      {stage:{type:'llm',outKey:'summary',name:'Summary'},report:{status:'ok',output:{summary:'Готово',semantic_coverage_preserved:true}}},
      {stage:{type:'check',outKey:'truth_check',name:'Truth'},report:{status:'ok',output:{score:91,decision:'PASS'}}},
      {stage:{type:'code',outKey:'quality_gate',name:'Gate'},report:{status:'warn',output:{summary_quality_score:84,decision:'REVIEW_REQUIRED'}}},
      {stage:{type:'code',outKey:'publish_result',name:'Publish'},report:{status:'warn',output:{saved:false,draft:true}}},
      {stage:{type:'llm',outKey:'failed_step',name:'Ошибка модели'},report:{status:'bad',error:'model unavailable',output:{status:'technical_error',decision:'ERROR'}}}
    ];
    reports.forEach(item=>{ item.report.meta=buildStageMeta(item.stage,item.report); });
    attachReviewerScores(reports);
    return reports.map(item=>({outKey:item.stage.outKey,score:item.report.meta.score,confidence:item.report.meta.confidence}));
  })()`));
  expect(result.every((item: any) => item.score != null && item.confidence != null)).toBe(true);
  expect(result.find((item: any) => item.outKey === "facts")).toMatchObject({ score: 94, confidence: 0.97 });
  expect(result.find((item: any) => item.outKey === "summary")).toMatchObject({ score: 84, confidence: 0.84 });
  expect(result.find((item: any) => item.outKey === "failed_step")).toMatchObject({ score: 0, confidence: 0 });
});

test("production regression 38 сохраняет наличные, предварительный outcome и семантику Store", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const transcript='Оператор:\\n— И последний вопрос: ваш номер 75 99—94 заканчивается?\\nКлиент:\\n— Да-да-да.\\nКлиент:\\n— Покупали за наличку. А мы тоже хотим за наличку.\\nКлиент:\\n— Хорошо, как я завтра могу увидеть эту квартиру?\\nАгент:\\n— Через неделю, в воскресенье, можно будет согласовать.\\nАгент:\\n— Хорошо, давайте я вам в пятницу наберу.';
    const outcome={call_result:{value:'просмотр предварительно согласован',confidence:.95,evidence:'можно будет на воскресенье согласовать'},next_step:{value:'агент перезвонит клиенту в пятницу для согласования времени просмотра',owner:'Агент',deadline:'пятница',confidence:.95,evidence:'в пятницу наберу'},agreements:[{value:'агент перезвонит клиенту в пятницу',confidence:.95,evidence:'в пятницу наберу'}]};
    const code=moduleGenericCheck('outcome',outcome);
    const judged=mergeHybridCheck(code,{verified_items:[],failed_items:[{category:'call_result',reason:'Просмотр не назначен окончательно, требуется подтверждение.'},{category:'next_step',reason:'Нет окончательной договоренности о просмотре.'}],scores:{overall:30},decision:'FAIL'},null,{verifiedKey:'verified_outcome',rejectedKey:'rejected_outcome',qualityKey:'outcome_check_quality',sourceHasData:true,sourceData:outcome});
    const judgedPass=mergeHybridCheck(code,{verified_items:[{category:'call_result'},{category:'next_step'}],failed_items:[],scores:{overall:100},decision:'PASS'},null,{verifiedKey:'verified_outcome',rejectedKey:'rejected_outcome',qualityKey:'outcome_check_quality',sourceHasData:true,sourceData:outcome});
    const facts=[{category:'Объект',type:'площадь',value:'58,6 кв.м',speaker:'Оператор',evidence:'58,6. Правильно?',confidence:.97},{category:'Потребности',type:'источник средств',value:'наличные',speaker:'Клиент',evidence:'А мы тоже хотим за наличку.',confidence:.97}];
    const needs=[{category:'источник средств',type:'явное требование',value:'наличные',speaker:'Клиент',evidence:'А мы тоже хотим за наличку.',confidence:.96},{category:'просмотр',type:'явное требование',value:'завтра',speaker:'Клиент',evidence:'как я завтра могу увидеть',confidence:.96}];
    const store=CODE_FUNCS.conversationStore({}, {__transcript:transcript,validation:{score:.96},fact_judge:{verified_facts:facts,scores:{overall:90},decision:'PASS'},need_judge:{verified_needs:needs,crm_validation:{interested_in:'PASS',source_of_funds:'PASS',purchase_timeline:'PASS'},scores:{overall:90},decision:'PASS'},needs:{needs,crm_needs:{interested_in:[],source_of_funds:'не определено',purchase_timeline:'не определено'}},outcome_judge:judged,outcome}).output;
    const validation=analyzeTranscriptQuality(transcript);
    const longSummary=('Клиент хочет организовать просмотр квартиры и планирует расчёт наличными. '.repeat(7))+'\\nКлючевые факты: источник средств — наличные; собственник приедет через неделю в воскресенье.\\nДоговорённости / следующий шаг: агент позвонит в пятницу и согласует время показа.';
    const shortened=semanticShortenSummary(longSummary,{__transcript:transcript,conversation:store,outcome},800,800);
    const truth=normalizeModuleSummaryJudge({outKey:'truth_check'},{score:0,status:'fail',decision:'FAIL',has_fact_distortions:true,critical_errors:[{type:'fact distortion',problem:'Клиент не уточняет, что это именно завтра',evidence_from_transcript:'как я завтра могу увидеть эту квартиру?'}]},{__transcript:transcript});
    const critical=normalizeModuleSummaryJudge({outKey:'critical_facts_check'},{score:70,status:'fail',decision:'FAIL',missed_critical_facts:[{fact_type:'timeline',fact:'Срок сделки не определен.'},{fact_type:'objections',fact:'Клиент спрашивает о предыдущих документах.'}]},{__transcript:transcript});
    return {judged,judgedPass,store,validation,shortened,truth,critical};
  })()`));
  expect(result.validation.issues.some((item: any) => item.type === "unknown_speaker")).toBe(false);
  expect(result.validation.issues.some((item: any) => item.type.startsWith("stt_noise"))).toBe(false);
  expect(result.judged.verified_outcome.call_result.value).toContain("предварительно согласован");
  expect(result.judgedPass).toMatchObject({ decision: "PASS", verified_outcome: { call_result: { value: "просмотр предварительно согласован" } } });
  expect(result.store.facts).toEqual(expect.arrayContaining([expect.objectContaining({ category: "Объект", type: "площадь", verification_status: "verified", source: "fact_judge" })]));
  expect(result.store.needs).toEqual(expect.arrayContaining([expect.objectContaining({ category: "источник средств", value: "наличные", verification_status: "verified", source: "need_judge" })]));
  expect(result.store.crm_needs).toMatchObject({ interested_in: [], source_of_funds: "наличные / депозит", purchase_timeline: "не определено" });
  expect(result.store.outcome.next_step.value).toContain("пятницу");
  expect(result.shortened.final_length).toBeLessThanOrEqual(800);
  expect(result.shortened.summary).toContain("Договорённости / следующий шаг:");
  expect(result.shortened.missing_after_shortening).toEqual([]);
  expect(result.truth).toMatchObject({ score: 90, status: "pass", decision: "PASS", has_fact_distortions: false, critical_errors: [] });
  expect(result.critical).toMatchObject({ score: 90, status: "pass", decision: "PASS", missed_critical_facts: [] });
});

test("production regression 42 фильтрует object facts и согласует Judge/Publish", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const transcript='Клиент: Меня зовут Анна. Мне надо быстро, поэтому у меня наличка. Можете что-нибудь подобрать.\\nОператор: Покровская, 6, площадь 21 кв. м, первый этаж, цена 5 980 000.\\nАгент: В Нахабино Ясная будет доступна в августе.';
    const needs={crm_needs:{interested_in:[],source_of_funds:'наличные / депозит',purchase_timeline:'не определено'},needs:[
      {category:'адрес',value:'Покровская, 6',speaker:'Оператор',evidence:'Покровская, 6'},
      {category:'площадь',value:'21 кв. м',speaker:'Оператор',evidence:'21 кв. м'},
      {category:'бюджет',value:'5 980 000 руб. (цена объекта)',speaker:'Оператор',evidence:'5 980 000'},
      {category:'дополнительные пожелания',value:'рассмотреть другие предложения',speaker:'Клиент',evidence:'можете что-нибудь подобрать'},
      {category:'источник средств',value:'наличные',speaker:'Клиент',evidence:'у меня наличка'}
    ]};
    cleanupNeedsV9(needs);
    const action=normalizeModuleSummaryJudge({outKey:'action_check'},{score:90,status:'warning',decision:'WARNING',is_result_reflected:true,is_agreement_reflected:true,is_next_step_reflected:true,action_errors:[],explanation:''},{__transcript:transcript});
    const context=normalizeModuleSummaryJudge({outKey:'context_check'},{score:70,status:'warning',decision:'WARNING',missing_for_next_agent:['Не указаны конкретные сомнения клиента.','Не указано, какие дополнительные варианты клиент хочет рассмотреть.']},{__transcript:transcript});
    const cs={facts:[{category:'Клиент',type:'имя',value:'Анна',confidence:.97,verified:true}],needs:[{category:'источник средств',value:'наличные',confidence:.97,verified:true}],crm_needs:needs.crm_needs,outcome:{call_result:{value:'просмотр предварительно согласован',verified:true},next_step:{value:'агент согласует время',verified:true}}};
    const published=CODE_FUNCS.crm({}, {__transcript:transcript,conversation:cs,summary:{summary:'Клиент покупает за наличные.\\nДоговорённости / следующий шаг: агент согласует время.',semantic_coverage_preserved:true},quality_gate:{decision:'REVIEW_REQUIRED',summary_quality_score:80,key_problems:['Нужна проверка'],warnings:['Предупреждение']}}).output;
    return {needs,action,context,published};
  })()`));
  expect(result.needs.needs.map((item: any) => item.category)).toEqual(["дополнительные пожелания", "источник средств"]);
  expect(result.action).toMatchObject({ score: 100, status: "pass", decision: "PASS" });
  expect(result.context).toMatchObject({ status: "pass", decision: "PASS", missing_for_next_agent: [] });
  expect(result.published).toMatchObject({ draft: true, saved: false, card: { client_name: "Анна" } });
  expect(result.published.review_reasons).toEqual(expect.arrayContaining(["Нужна проверка", "Предупреждение"]));
});

test("Format Judge и Quality Gate используют канонический контракт", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const format=CODE_FUNCS.presentationCheck({}, {summary:{summary:'Клиент уточнила цену.\\nДоговорённости / следующий шаг: агент перезвонит.'}}).output;
    const base={score:96,status:'pass',explanation:'ok'};
    const gate=CODE_FUNCS.summaryQualityGate({}, {
      summary:{summary:'Клиент уточнила цену.\\nДоговорённости / следующий шаг: агент перезвонит.'},
      conversation:{facts:{},needs:{},outcome:{}},
      truth_check:{...base,has_hallucinations:false,has_fact_distortions:false,has_role_confusion:false,critical_errors:[]},
      critical_facts_check:{...base,missed_critical_facts:[]},
      context_utility_check:{...base,context_clarity:96,business_usefulness:96,can_continue_without_recording:true,missing_for_next_agent:[]},
      action_check:{...base,is_next_step_reflected:true,action_errors:[]},
      presentation_check:format
    }).output;
    return {format,gate};
  })()`));
  expect(result.format.has_status_or_action_line).toBe(true);
  expect(result.gate.decision).toBe("AUTO_SAVE");
  expect(result.gate.summary_quality_score).toBeGreaterThanOrEqual(95);
});
