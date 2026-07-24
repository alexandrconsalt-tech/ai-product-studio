import { expect, test } from "@playwright/test";
import regressionCases from "../fixtures/transcription-summary-regression-32-36.json";
import pipelineReportRegression from "../fixtures/pipeline-report-2026-07-24T062250.414.regression.json";

const moduleUrl = "/pipeline-lab-v3.html?projectId=project_transcription_summary_module&productName=" +
  encodeURIComponent("Модуль транскрибации и AI-саммари звонков");
const summaryNewUrl = "/pipeline-lab-v3.html?projectId=project_summary_new&productName=" +
  encodeURIComponent("Summary NEW");

test("экран Pipeline Lab передаёт выбранный продукт во встроенный стенд", async ({ page }) => {
  await page.goto("/?view=pipeline-lab-v3");
  const frame = page.locator('iframe[title="Pipeline Lab v3"]');
  await expect(frame).toHaveAttribute("src", /[?&]productId=project_transcription_summary_module/);
  await expect(frame).toHaveAttribute("src", /productName=/);
});

const qualityGateFixture = `
  const qgKeys=['truth_check','critical_completeness_check','agent_utility_check','action_check','presentation_check'];
  function qgContext(){
    const run='qg-run',transcript='qg-transcript',pipelineHash='qg-pipeline',storeHash='qg-store';
    const summary={status:'GENERATED',conversation_result:'Клиент выбирает участок.',key_facts:[],quotes:[],next_step:'Агент отправит материалы.',error:''};
    const verified=(value,confidence=.98)=>({value,confidence,evidence:value==='не определено'?'':'Клиент: '+value,source_fact_ids:value==='не определено'?[]:['fact_1'],source:'need_check',verification_status:'verified'});
    const conversation_store={conversation:{attributes:{interest:[verified('Строительство')],funding_source:verified('наличные / депозит'),purchase_term:verified('не определено')}},quality:{decision:'READY'},provenance:{run_id:run,transcript_hash:transcript,pipeline_configuration_hash:pipelineHash},store_meta:{status:'READY',conversation_store_hash:storeHash}};
    const truth_check={status:'pass',score:100,explanation:'ok',critical_errors:[],warnings:[],has_hallucinations:false,has_money_or_number_errors:false,has_pii:false};
    const critical_completeness_check={status:'pass',score:100,explanation:'ok',missing_items:[],warnings:[]};
    const agent_utility_check={status:'pass',score:100,explanation:'ok',problems:[],missing_for_next_agent:[],can_continue_without_recording:true};
    const action_check={status:'pass',score:100,explanation:'ok',errors:[],warnings:[],next_step_verified:true};
    const presentation_check={status:'pass',score:100,explanation:'ok',errors:[],warnings:[],checks:{required_fields_present:true,conversation_result_valid:true,key_facts_valid:true,quotes_valid:true,next_step_valid:true,character_limit_valid:true,no_excessive_repetition:true,easy_to_scan:true},metrics:{total_characters:80}};
    const ctx={summary,conversation_store,truth_check,critical_completeness_check,agent_utility_check,action_check,presentation_check,need_check:{rejected_attributes:[]},fact_check:{score:1},outcome_check:{score:2},__run_id:run,__transcript_hash:transcript,__pipeline_configuration_hash:pipelineHash,__stage_provenance:{}};
    ['summary',...qgKeys].forEach((key,index)=>ctx.__stage_provenance[key]={run_id:run,transcript_hash:transcript,pipeline_configuration_hash:pipelineHash,conversation_store_hash:storeHash,stage_execution_id:run+':'+String(index+1).padStart(2,'0')+':stage'});
    return ctx;
  }
  function qgWarning(ctx,key,score){
    const value=ctx[key];value.status='warning';value.score=score;
    if(key==='truth_check'||key==='critical_completeness_check') value.warnings=[{type:'minor_warning',message:'Некритичное предупреждение.'}];
    else if(key==='agent_utility_check') value.problems=[{type:'unclear_wording',problem:'Некритичная неясность.'}];
    else value.warnings=[{type:'minor_warning',problem:'Некритичное предупреждение.'}];
  }
  function qgFail(ctx,key,score=80){
    const value=ctx[key];value.status='fail';value.score=score;
    if(key==='truth_check') value.critical_errors=[{type:'fact_distortion',field:'conversation_result',problem:'Критическая ошибка.'}];
    else if(key==='critical_completeness_check') value.missing_items=[{type:'critical_context',reason:'Критический пропуск.'}];
    else if(key==='agent_utility_check') value.problems=[{type:'difficult_to_scan',problem:'Нельзя продолжить работу.'}];
    else if(key==='action_check') value.errors=[{type:'wrong_action',field:'next_step',problem:'Неверное действие.'}];
    else value.errors=[{type:'difficult_to_scan',field:'conversation_result',problem:'Структура нарушена.'}];
  }
`;

const crmFixture = `
  ${qualityGateFixture}
  function crmUpdateStoreHash(ctx){
    ctx.conversation_store.store_meta.schema_version='conversation_store_v1';
    const hash=crmComputedStoreHash(ctx.conversation_store);
    ctx.conversation_store.store_meta.conversation_store_hash=hash;
    ['summary',...qgKeys].forEach(key=>{if(ctx.__stage_provenance[key])ctx.__stage_provenance[key].conversation_store_hash=hash});
    return ctx;
  }
  function crmRefreshGate(ctx){
    ctx.summary_quality_gate=moduleSummaryQualityGateV1(ctx);
    ctx.__stage_provenance.summary.output_hash=stableHash(ctx.summary);
    ctx.__stage_provenance.summary_quality_gate={run_id:ctx.__run_id,transcript_hash:ctx.__transcript_hash,pipeline_configuration_hash:ctx.__pipeline_configuration_hash,stage_execution_id:ctx.__run_id+':16:summary_quality_gate',output_hash:stableHash(ctx.summary_quality_gate)};
    return ctx;
  }
  function crmContext(recordId='crm-record-1'){
    const ctx=qgContext();
    ctx.crm_record_id=recordId;
    ctx.__call_id='call-1';
    ctx.__pipeline_version='pipeline-v1';
    ctx.__summary_prompt_version='prompt-v1';
    ctx.__summary_model_id='summary-model';
    ctx.__crm_now='2026-07-21T10:00:00.000Z';
    ctx.__crm_current_record={revision:2,summary:{conversation_result:'Предыдущее summary.',key_facts:[],quotes:[],next_step:'Старый шаг.'},summary_version:'summary_v0',summary_history:[],attributes:{interest:['Новостройки'],funding_source:'ипотека в процессе',purchase_term:'3–6 месяцев'},attribute_sources:{}};
    crmUpdateStoreHash(ctx);
    return crmRefreshGate(ctx);
  }
  function crmResignGate(ctx){
    ctx.summary_quality_gate.metadata.quality_gate_hash=crmExpectedQualityGateHash(ctx,ctx.summary_quality_gate);
    ctx.__stage_provenance.summary.output_hash=stableHash(ctx.summary);
    ctx.__stage_provenance.summary_quality_gate.output_hash=stableHash(ctx.summary_quality_gate);
    return ctx;
  }
`;

test("Summary NEW подставляет транскрибацию и принимает строгий JSON", async ({ page }) => {
  await page.goto(summaryNewUrl);

  const result = await page.evaluate(() => eval(`(async () => {
    const transcript='Оператор: Добрый день.\\nКлиент: Хочу посмотреть квартиру.';
    const stage={type:'llm',outKey:'summary',name:'Генератор Summary',model:'gpt-5-mini',prompt:'Сформируй результат для {{TRANSCRIPT}}'};
    const valid={summary:'Клиент хочет посмотреть квартиру.',key_facts:['Максимальный бюджет — 5,5 млн ₽.'],quotes:['Это уже максимальный бюджет — 5,5 миллиона.'],next_steps:['Просмотр предварительно согласован на завтра в 20:00; агент подтвердит время звонком.']};
    const original=callModelWithTransientRetry;
    let calls=0,request=null;
    callModelWithTransientRetry=async (prompt,model,provider,temperature,maxTokens,responseFormat)=>{
      calls++;
      request={prompt,responseFormat};
      return {text:JSON.stringify(valid),tokens:20,actualModel:model,actualProvider:'test'};
    };
    const report=await runStage(stage,{__transcript:transcript});
    callModelWithTransientRetry=original;
    attachReviewerScores([
      {stage,report},
      {stage:{type:'code',outKey:'quality_gate',name:'Summary Quality Gate'},report:{status:'bad',output:{summary_quality_score:35},meta:{status:'fail',score:35,confidence:.35,criteria:[]}}}
    ]);
    return {calls,request,report,html:renderSummaryNewResult(report.output),cardHtml:renderReport(stage,report,1).outerHTML};
  })()`));

  expect(result.calls).toBe(1);
  expect(result.request.prompt).toContain("Оператор: Добрый день.");
  expect(result.request.prompt).toContain("Клиент: Хочу посмотреть квартиру.");
  expect(result.request.prompt).toContain("<transcript>");
  expect(result.request.prompt).toContain("Верни только JSON без Markdown и комментариев.");
  expect(result.request.responseFormat).toMatchObject({ type: "json_schema", json_schema: { strict: true } });
  expect(result.report.prompt_audit).toMatchObject({
    transcript_present: true,
    transcript_injected: true,
    transcript_chars: 56,
    resolved_prompt_contains_transcript: true,
  });
  expect(result.report.parseErr).toBeNull();
  expect(result.report.output).toMatchObject({ execution_status: "SUCCESS", status: "success", score: null, confidence: null });
  expect(result.report.meta).toMatchObject({
    execution_status: "SUCCESS",
    status: "success",
    score: null,
    confidence: null,
    explanation: "Саммари успешно сгенерировано и прошло проверку JSON-схемы.",
  });
  expect(result.report.meta.criteria).toEqual([
    { name: "Транскрибация передана", status: "pass", score: null },
    { name: "Ответ модели получен", status: "pass", score: null },
    { name: "JSON корректен", status: "pass", score: null },
    { name: "Схема соблюдена", status: "pass", score: null },
  ]);
  expect(result.report.output.next_steps).toHaveLength(1);
  expect(result.html).toContain("Ключевые факты");
  expect(result.html).toContain("Важные цитаты");
  expect(result.html).toContain("Договорённости / следующий шаг");
  expect(result.html).not.toContain("Источник средств: не определено");
  expect(result.cardHtml).toContain("Статус выполнения");
  expect(result.cardHtml).toContain("успешно");
  expect(result.cardHtml).toContain("JSON");
  expect(result.cardHtml).toContain("корректный");
  expect(result.cardHtml).toContain("Fallback");
  expect(result.cardHtml).toContain("Выполнено");
  expect(result.cardHtml).not.toContain("Оценка</div>");
  expect(result.cardHtml).not.toContain("Confidence</div>");
  expect(result.cardHtml).not.toContain("35%");
});

test("Summary NEW не вызывает модель без транскрибации", async ({ page }) => {
  await page.goto(summaryNewUrl);
  const result = await page.evaluate(() => eval(`(async () => {
    const stage={type:'llm',outKey:'summary',name:'Генератор Summary',model:'gpt-5-mini',prompt:'Транскрибация: {{TRANSCRIPT}}'};
    const original=callModelWithTransientRetry;
    let calls=0;
    callModelWithTransientRetry=async()=>{calls++;throw new Error('model must not be called')};
    const report=await runStage(stage,{__transcript:'   '});
    callModelWithTransientRetry=original;
    return {calls,report};
  })()`));

  expect(result.calls).toBe(0);
  expect(result.report.output).toMatchObject({
    execution_status: "TECHNICAL_ERROR",
    status: "error",
    error_code: "TRANSCRIPT_MISSING",
    technical_reason: ["transcript_missing"],
    decision: "TECHNICAL_ERROR",
    score: null,
    confidence: null,
    saved: false,
  });
  expect(result.report.meta).toMatchObject({ execution_status: "TECHNICAL_ERROR", status: "error", score: null, confidence: null });
  expect(result.report.prompt_audit).toMatchObject({ transcript_present: false, transcript_injected: false });
});

test("Summary NEW принимает только объект, JSON-строку или внешнюю Markdown-обёртку", async ({ page }) => {
  await page.goto(summaryNewUrl);
  const result = await page.evaluate(() => eval(`(async () => {
    const valid={summary:'Клиент хочет посмотреть квартиру.',key_facts:[],quotes:[],next_steps:['Агент перезвонит клиенту.']};
    const parse=value=>{try{return {ok:true,value:parseSummaryNewResponse(value)}}catch(error){return {ok:false,error:error.message}}};
    return {
      object:parse(valid),
      string:parse(JSON.stringify(valid)),
      fence:parse('\`\`\`json\\n'+JSON.stringify(valid)+'\\n\`\`\`'),
      plain:parse('Пожалуйста, пришлите транскрибацию.'),
      embedded:parse('Ответ: '+JSON.stringify(valid)),
      extra:parse({...valid,unknown:true})
    };
  })()`));

  expect(result.object.ok).toBe(true);
  expect(result.string.ok).toBe(true);
  expect(result.fence.ok).toBe(true);
  expect(result.plain).toEqual({ ok: false, error: "SUMMARY_JSON_INVALID" });
  expect(result.embedded).toEqual({ ok: false, error: "SUMMARY_JSON_INVALID" });
  expect(result.extra).toEqual({ ok: false, error: "SUMMARY_SCHEMA_INVALID" });
});

test("обычный текст модели становится технической ошибкой Summary NEW", async ({ page }) => {
  await page.goto(summaryNewUrl);
  const result = await page.evaluate(() => eval(`(async () => {
    const stage={type:'llm',outKey:'summary',name:'Генератор Summary',model:'gpt-5-mini',prompt:'{{__transcript}}'};
    const original=callModelWithTransientRetry;
    callModelWithTransientRetry=async()=>({text:'Пожалуйста, пришлите транскрибацию.',tokens:5,actualModel:'gpt-5-mini',actualProvider:'test'});
    const report=await runStage(stage,{result:{__transcript:'Клиент: Хочу посмотреть квартиру.'}});
    callModelWithTransientRetry=original;
    return report;
  })()`));

  expect(result.output).toMatchObject({
    execution_status: "TECHNICAL_ERROR",
    status: "error",
    error_code: "SUMMARY_JSON_INVALID",
    technical_reason: ["json_invalid"],
    decision: "TECHNICAL_ERROR",
    score: null,
    confidence: null,
  });
  expect(result.meta).toMatchObject({ execution_status: "TECHNICAL_ERROR", status: "error", score: null, confidence: null });
  expect(result.raw).toBe("Пожалуйста, пришлите транскрибацию.");
  expect(result.output.summary).toBeUndefined();
});

test("Summary NEW отклоняет результат без обязательного next_steps", async ({ page }) => {
  await page.goto(summaryNewUrl);
  const result = await page.evaluate(() => eval(`(async () => {
    const stage={type:'llm',outKey:'summary',name:'Генератор Summary',model:'gpt-5-mini',prompt:'{{TRANSCRIPT}}'};
    const original=callModelWithTransientRetry;
    callModelWithTransientRetry=async()=>({text:JSON.stringify({summary:'Готово.',key_facts:[],quotes:[]}),tokens:5,actualModel:'gpt-5-mini',actualProvider:'test'});
    const report=await runStage(stage,{__transcript:'Клиент: Нужна консультация.'});
    callModelWithTransientRetry=original;
    return report;
  })()`));

  expect(result.output).toMatchObject({
    execution_status: "TECHNICAL_ERROR",
    status: "error",
    error_code: "SCHEMA_VALIDATION_FAILED",
    technical_reason: ["schema_validation_failed"],
    score: null,
    confidence: null,
  });
  expect(result.meta).toMatchObject({ execution_status: "TECHNICAL_ERROR", status: "error", score: null, confidence: null });
});

test("Summary NEW отклоняет больше трёх key_facts", async ({ page }) => {
  await page.goto(summaryNewUrl);
  const result = await page.evaluate(() => eval(`(async () => {
    const stage={type:'llm',outKey:'summary',name:'Генератор Summary',model:'gpt-5-mini',prompt:'{{TRANSCRIPT}}'};
    const original=callModelWithTransientRetry;
    const invalid={summary:'Готово.',key_facts:['1','2','3','4'],quotes:[],next_steps:['Перезвонить.']};
    callModelWithTransientRetry=async()=>({text:JSON.stringify(invalid),tokens:5,actualModel:'gpt-5-mini',actualProvider:'test'});
    const report=await runStage(stage,{__transcript:'Клиент: Нужна консультация.'});
    callModelWithTransientRetry=original;
    return report;
  })()`));

  expect(result.output).toMatchObject({
    execution_status: "TECHNICAL_ERROR",
    status: "error",
    error_code: "SCHEMA_VALIDATION_FAILED",
    technical_reason: ["schema_validation_failed"],
  });
  expect(result.meta.score).toBeNull();
  expect(result.meta.confidence).toBeNull();
});

test("адаптер Summary NEW не меняет шаблонизатор и парсер другого проекта", async ({ page }) => {
  await page.goto("/pipeline-lab-v3.html?projectId=project_demo_pipeline_lab_v3&productName=Другой%20проект");
  const result = await page.evaluate(() => ({
    prompt: eval("tmpl('{{TRANSCRIPT}}|{{transcript}}',{__transcript:'legacy transcript'})"),
    parsed: eval("parseJSON('Ответ: {\\\"legacy\\\":true}')"),
    isSummaryNew: eval("IS_SUMMARY_NEW_PROJECT"),
  }));
  expect(result).toEqual({ prompt: "|legacy transcript", parsed: { legacy: true }, isSummaryNew: false });
});

test("regression 32–36 фиксирует исходные системные дефекты", () => {
  expect(regressionCases).toHaveLength(5);
  expect(regressionCases.every((item) => item.run_id === null)).toBe(true);
  expect(regressionCases.every((item) => item.generic_criteria > 0)).toBe(true);
  expect(regressionCases.every((item) => item.facts_score === 85 && item.needs_score === 85)).toBe(true);
  expect(regressionCases.some((item) => item.outcome_decision === "PASS" && item.verified_outcome_empty)).toBe(true);
});

test("legacy-конфигурация модуля принудительно получает актуальные контракты без дублей", async ({ page }) => {
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
    "pipeline.map(({outKey,type,codeFn,prompt,contractVersion})=>({outKey,type,codeFn,prompt,contractVersion}))",
  ) as Array<{ outKey?: string; type?: string; codeFn?: string; prompt?: string; contractVersion?: string }>);

  expect(stages.map((stage) => stage.outKey)).toEqual([
    "validation", "facts", "fact_check", "needs", "need_check", "outcome",
    "outcome_check", "conversation_store", "summary", "truth_check",
    "critical_completeness_check", "agent_utility_check", "action_check",
    "presentation_check", "summary_quality_gate", "crm",
  ]);
  expect(stages.find((stage) => stage.outKey === "fact_check")).toMatchObject({ type: "hybrid", codeFn: "factCheckCode", contractVersion: "transcription_summary_v1" });
  expect(stages.find((stage) => stage.outKey === "fact_check")?.prompt).toContain("LLM Fact Judge");
  expect(stages.find((stage) => stage.outKey === "presentation_check")).toMatchObject({ type: "check", codeFn: undefined });
  expect(stages.every((stage) => stage.prompt !== "legacy prompt" || stage.outKey === "validation")).toBe(true);

  const currentContractStages = await page.evaluate(() => eval(`(() => {
    const stages=defaultPipeline();
    stages.filter(stage=>['fact_check','need_check','outcome_check'].includes(stage.outKey)).forEach(stage=>{
      stage.contractVersion=TRANSCRIPTION_SUMMARY_CONTRACT_VERSION;
      stage.type='check';
      stage.codeFn='gate';
      stage.provider='ai-tunnel';
      stage.model='gpt-5-mini';
      stage.userEdited=true;
    });
    return migratePipelineConfig(stages,[])
      .filter(stage=>['fact_check','need_check','outcome_check'].includes(stage.outKey))
      .map(({outKey,type,codeFn,provider,model})=>({outKey,type,codeFn,provider,model}));
  })()`));
  expect(currentContractStages).toEqual([
    { outKey: "fact_check", type: "hybrid", codeFn: "factCheckCode", provider: "ai-tunnel", model: "gpt-5-mini" },
    { outKey: "need_check", type: "hybrid", codeFn: "needCheckCode", provider: "ai-tunnel", model: "gpt-5-mini" },
    { outKey: "outcome_check", type: "hybrid", codeFn: "outcomeCheckCode", provider: "ai-tunnel", model: "gpt-5-mini" },
  ]);
});

test("all system AI stages migrate from mock to AI Tunnel for this product", async ({ page }) => {
  await page.goto(moduleUrl);
  const providers = await page.evaluate(() => eval(`(() => {
    const keys=['facts','fact_check','needs','need_check','outcome','outcome_check','summary','truth_check','critical_completeness_check','agent_utility_check','action_check','presentation_check'];
    const source=defaultPipeline().map(stage=>keys.includes(stage.outKey)
      ? {...stage,provider:'mock',userEdited:false}
      : stage);
    return migratePipelineConfig(source,[])
      .filter(stage=>keys.includes(stage.outKey))
      .map(stage=>[stage.outKey,stage.provider]);
  })()`));

  expect(Object.fromEntries(providers)).toEqual({
    facts: "ai-tunnel",
    fact_check: "ai-tunnel",
    needs: "ai-tunnel",
    need_check: "ai-tunnel",
    outcome: "ai-tunnel",
    outcome_check: "ai-tunnel",
    summary: "ai-tunnel",
    truth_check: "ai-tunnel",
    critical_completeness_check: "ai-tunnel",
    agent_utility_check: "ai-tunnel",
    action_check: "ai-tunnel",
    presentation_check: "ai-tunnel",
  });
});

test("production legacy Judge model migrates only for untouched stages of this product", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const keys=['facts','fact_check','needs','need_check','outcome','outcome_check','summary','truth_check','critical_completeness_check','agent_utility_check','action_check','presentation_check'];
    const makePipeline=userEdited=>defaultPipeline().map(stage=>keys.includes(stage.outKey)
      ? {...stage,model:'claude-sonnet-4-6',userEdited}
      : stage);
    const system=migratePipelineConfig(makePipeline(false),[])
      .filter(stage=>keys.includes(stage.outKey))
      .map(stage=>stage.model);
    const customFactCheck=migratePipelineConfig(makePipeline(true),[])
      .find(stage=>stage.outKey==='fact_check').model;
    return {system,customFactCheck};
  })()`));

  expect(result.system).toEqual(Array(12).fill("gpt-5-mini"));
  expect(result.customFactCheck).toBe("claude-sonnet-4-6");
});

test("production report 95 refreshes misclassified system prompts but preserves runtime settings", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const legacy={
      facts:[3,'Ты — Fact Extraction Agent.'],fact_check:[4,'Ты — Fact Verification Agent.'],
      needs:[5,'Ты — Need Extraction Agent.'],need_check:[4,'Ты — Need Verification Agent.'],
      outcome:[4,'Ты — Outcome Agent.'],outcome_check:[3,'Ты — Outcome Verification Agent.'],
      summary:[3,'Ты — Summary Agent CRM агентства недвижимости.'],truth_check:[3,'Ты — Summary Faithfulness Agent.'],
      critical_completeness_check:[3,'Ты — Summary Completeness Agent.'],agent_utility_check:[3,'Ты — Summary Usefulness Agent.'],
      action_check:[3,'Ты — Summary Agreement Agent.'],presentation_check:[3,'Ты — Summary Format Agent.']
    };
    const defaults=defaultPipeline();
    const expected=Object.fromEntries(defaults.filter(stage=>legacy[stage.outKey]).map(stage=>[stage.outKey,{version:stage.promptVersion,prompt:stage.prompt}]));
    const source=defaults.filter(stage=>stage.outKey!=='stt').map(stage=>legacy[stage.outKey]
      ? {...stage,promptVersion:legacy[stage.outKey][0],prompt:legacy[stage.outKey][1]+'\\n\\nСистемный legacy prompt.',promptSource:'user_override',userEdited:true,model:'gpt-5-mini',provider:'ai-tunnel',temperature:.7,maxTokens:10000,contractVersion:TRANSCRIPTION_SUMMARY_CONTRACT_VERSION}
      : stage);
    const migrated=migratePipelineConfig(source,[]);
    const actual=Object.fromEntries(migrated.filter(stage=>legacy[stage.outKey]).map(stage=>[stage.outKey,{version:stage.promptVersion,prompt:stage.prompt,promptSource:stage.promptSource,promptEdited:stage.promptEdited,settingsEdited:stage.settingsEdited,model:stage.model,provider:stage.provider,temperature:stage.temperature,maxTokens:stage.maxTokens}]));
    const customSource=defaults.map(stage=>stage.outKey==='needs'
      ? {...stage,promptVersion:5,prompt:'МОЙ НАСТОЯЩИЙ CUSTOM PROMPT',promptSource:'user_override',userEdited:true,contractVersion:TRANSCRIPTION_SUMMARY_CONTRACT_VERSION}
      : stage);
    const custom=migratePipelineConfig(customSource,[]).find(stage=>stage.outKey==='needs');
    return {expected,actual,custom:{prompt:custom.prompt,promptVersion:custom.promptVersion,promptSource:custom.promptSource}};
  })()`));

  for (const [outKey, expected] of Object.entries(result.expected) as Array<[string, any]>) {
    expect(result.actual[outKey]).toMatchObject({
      version: expected.version,
      prompt: expected.prompt,
      promptSource: "migrated_legacy",
      promptEdited: false,
      settingsEdited: true,
      model: "gpt-5-mini",
      provider: "ai-tunnel",
      temperature: 0.7,
      maxTokens: outKey === "fact_check" ? 12000 : 10000,
    });
  }
  expect(result.custom).toEqual({ prompt: "МОЙ НАСТОЯЩИЙ CUSTOM PROMPT", promptVersion: 5, promptSource: "user_override" });
});

test("production report 98 migrates exact legacy system prompt hashes but preserves custom prompt", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const def=defaultPipeline().find(item=>item.outKey==='critical_completeness_check');
    const originalHash=stableHash;
    stableHash=value=>value==='SYSTEM REPORT 98 PROMPT'?'b48d82f9':originalHash(value);
    const legacy={outKey:'critical_completeness_check',prompt:'SYSTEM REPORT 98 PROMPT',promptVersion:4,promptSource:'user_override',userEdited:true,provider:'ai-tunnel',model:'gpt-5-mini',temperature:0,maxTokens:3000,contractVersion:TRANSCRIPTION_SUMMARY_CONTRACT_VERSION};
    const custom={...legacy,prompt:'МОЙ CUSTOM PROMPT'};
    const migrated=migratePipelineConfig([legacy]).find(item=>item.outKey==='critical_completeness_check');
    const preserved=migratePipelineConfig([custom]).find(item=>item.outKey==='critical_completeness_check');
    stableHash=originalHash;
    return {migrated:{prompt:migrated.prompt,promptVersion:migrated.promptVersion,promptSource:migrated.promptSource,maxTokens:migrated.maxTokens},preserved:{prompt:preserved.prompt,promptVersion:preserved.promptVersion,promptSource:preserved.promptSource},def:{prompt:def.prompt,promptVersion:def.promptVersion}};
  })()`));
  expect(result.migrated).toEqual({ prompt: result.def.prompt, promptVersion: result.def.promptVersion, promptSource: "migrated_legacy", maxTokens: 8000 });
  expect(result.preserved).toEqual({ prompt: "МОЙ CUSTOM PROMPT", promptVersion: 4, promptSource: "user_override" });
});

test("системный Summary получает достаточный output budget без изменения userEdited", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const makePipeline=userEdited=>defaultPipeline().map(stage=>stage.outKey==='summary'
      ? {...stage,maxTokens:2500,userEdited}
      : stage);
    const system=migratePipelineConfig(makePipeline(false),[]).find(stage=>stage.outKey==='summary');
    const custom=migratePipelineConfig(makePipeline(true),[]).find(stage=>stage.outKey==='summary');
    return {system:system.maxTokens,custom:custom.maxTokens};
  })()`));
  expect(result).toEqual({ system: 8000, custom: 2500 });
});

test("Fact Check reserves enough output for verdicts and requires concise reasons", async ({ page }) => {
  await page.goto(moduleUrl);
  const stage = await page.evaluate(() => eval(`(() => {
    const saved={...defaultPipeline().find(item=>item.outKey==='fact_check'),promptVersion:7,maxTokens:4000,userEdited:true,settingsEdited:true,promptEdited:false};
    const migrated=migratePipelineConfig([saved],[])[0];
    const input={facts:[{id:'fact_1',category:'client_constraint'}],quotes:[]};
    let invalidCategory='';
    try{validateFactJudgeOutput({items:[{id:'fact_1',verdict:'needs_correction',reason:'неверная категория',confidence:.9,corrections:{category:'hard_constraint'}}],overall_confidence:.9,warnings:[]},input)}catch(error){invalidCategory=error.message}
    return {promptVersion:migrated.promptVersion,maxTokens:migrated.maxTokens,prompt:migrated.prompt,invalidCategory,runtime:runStage.toString(),schemaCategory:FACT_VERDICT_ONLY_JSON_SCHEMA.properties.items.items.properties.corrections.properties.category};
  })()`));

  expect(stage).toMatchObject({ promptVersion: 9, maxTokens: 12000 });
  expect(stage.prompt).toContain("reason — не более 6 слов");
  expect(stage.prompt).toContain("hard_constraint, main_objection и budget_max не являются допустимыми category");
  expect(stage.invalidCategory).toContain('unknown fact category');
  expect(stage.runtime).toContain('Math.max(Number(stage.maxTokens)||0,12000)');
  expect(stage.runtime).toContain("parseErr==='TRUNCATED_JSON'");
  expect(stage.schemaCategory.enum).toContain("client_constraint");
  expect(stage.schemaCategory.enum).not.toContain("hard_constraint");
});

test("все verdict-only Judge получают безопасный output budget даже из старых snapshots", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const keys=['fact_check','need_check','outcome_check'];
    const saved=defaultPipeline().filter(stage=>keys.includes(stage.outKey)).map(stage=>({...stage,maxTokens:stage.outKey==='fact_check'?4000:3000,userEdited:true,settingsEdited:true,promptEdited:false}));
    const migrated=migratePipelineConfig(saved,[]);
    return {budgets:Object.fromEntries(migrated.filter(stage=>keys.includes(stage.outKey)).map(stage=>[stage.outKey,stage.maxTokens])),runtime:runStage.toString()};
  })()`));

  expect(result.budgets).toEqual({ fact_check: 12000, need_check: 8000, outcome_check: 8000 });
  expect(result.runtime).toContain("Math.max(Number(stage.maxTokens)||0,8000)");
});

test("summary Judges reserve output for reasoning responses", async ({ page }) => {
  await page.goto(moduleUrl);
  const stages = await page.evaluate(() => eval(`(() => {
    const keys=['truth_check','critical_completeness_check','agent_utility_check','action_check','presentation_check'];
    const saved=defaultPipeline().filter(stage=>keys.includes(stage.outKey)).map(stage=>({...stage,maxTokens:2500}));
    return migratePipelineConfig(saved,[]).filter(stage=>keys.includes(stage.outKey)).map(stage=>({outKey:stage.outKey,maxTokens:stage.maxTokens,provider:stage.provider}));
  })()`));

  expect(stages).toEqual([
    { outKey: "truth_check", maxTokens: 8000, provider: "ai-tunnel" },
    { outKey: "critical_completeness_check", maxTokens: 8000, provider: "ai-tunnel" },
    { outKey: "agent_utility_check", maxTokens: 8000, provider: "ai-tunnel" },
    { outKey: "action_check", maxTokens: 8000, provider: "ai-tunnel" },
    { outKey: "presentation_check", maxTokens: 8000, provider: "ai-tunnel" },
  ]);
});

test("регрессия звонка по участку отклоняет Telegram, телефон и вопрос вместо имени", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const fact=(id,category,name,value,evidence,speaker='Клиент')=>({id,category,name,value,normalized_value:value,speaker,evidence,confidence:.99,verification_status:'pending'});
    const input={facts:[
      fact('f_name','client','Имя клиента','Николай','Как вас зовут?'),
      fact('f_phone','contact','Номер телефона','35 33','Номер заканчивается на 35 33?'),
      fact('f_telegram','other','Канал связи','Telegram','Да, давайте в Макс лучше.'),
      fact('f_max','other','Предпочтительный канал','MAX','Да, давайте в Макс лучше.')
    ],quotes:[],extraction_meta:{fact_count:4,quote_count:0,decision:'EXTRACTED'}};
    const verdict={verified_facts:input.facts.map(item=>({id:item.id,verified:true,reason:'Judge подтвердил'})),rejected_facts:[],verified_quotes:[],rejected_quotes:[],missing_critical_facts:[],fact_check_quality:{facts_checked:999,facts_verified:999,facts_rejected:0,quotes_checked:0,quotes_verified:0,quotes_rejected:0,critical_facts_missing:0,precision_score:1,critical_recall_score:1,quote_score:1,overall_score:1,decision:'PASS'},criteria:[]};
    const output=mergeFactCheck({hardFail:false,criteria:[]},verdict,null,input);
    const html=renderModuleSummaryResult({conversation_result:'Клиент Николай ищет участок.',key_facts:[{label:'Бюджет',value:'до 5 500 000 ₽'}],quotes:[],next_step:'Агент отправит видео и подборку в MAX.'});
    return {output,html};
  })()`));

  expect(result.output.verified_facts.map((item: any) => item.id)).toEqual(["f_max"]);
  expect(result.output.rejected_facts).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: "f_name", verified: false, verification_status: "rejected", error_type: "question_as_fact" }),
    expect.objectContaining({ id: "f_phone", verified: false, verification_status: "rejected", error_type: "pii_phone" }),
    expect.objectContaining({ id: "f_telegram", verified: false, verification_status: "rejected", error_type: "evidence_mismatch" }),
  ]));
  expect(JSON.stringify(result.output.verified_facts)).not.toContain("Telegram");
  expect(JSON.stringify(result.output.verified_facts)).not.toContain("35 33");
  expect(result.html).toContain("Клиент Николай");
  expect(result.html).toContain("MAX");
  expect(result.html).not.toContain("[object Object]");
});

test("verdict-only Fact Judge не может подтвердить факт о номере для связи", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const input={facts:[{id:'fact_phone_confirmation',category:'communication_context',name:'подтверждение номера для связи',value:true,normalized_value:true,speaker:'Клиент',evidence:'Совершенно верно.',confidence:.9,verification_status:'pending'}],quotes:[{id:'quote_phone_confirmation',text:'Совершенно верно.',speaker:'Клиент',supports_fact_ids:['fact_phone_confirmation'],confidence:.9,verification_status:'pending'}],extraction_meta:{fact_count:1,quote_count:1,decision:'EXTRACTED'}};
    const judge=validateFactJudgeOutput({items:[{id:'fact_phone_confirmation',verdict:'verified',reason:'подтверждено',confidence:.9,corrections:{}},{id:'quote_phone_confirmation',verdict:'verified',reason:'дословно',confidence:.9,corrections:{}}],overall_confidence:.9,warnings:[]},input);
    return mergeFactCheck({hardFail:false,criteria:[]},judge,null,input,{});
  })()`));
  expect(result.verified_facts).toEqual([]);
  expect(result.rejected_facts).toEqual(expect.arrayContaining([expect.objectContaining({ id: "fact_phone_confirmation", error_type: "pii_phone" })]));
  expect(result.verified_quotes).toEqual([]);
  expect(result.rejected_quotes).toEqual(expect.arrayContaining([expect.objectContaining({ id: "quote_phone_confirmation", error_type: "quote_supports_rejected_fact" })]));
});

test("verdict-only Fact Judge отклоняет correction с null value", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const input={facts:[{id:'fact_criteria',category:'search_criteria',name:'предпочтительное назначение участка',value:'ИЖС',normalized_value:'ИЖС',speaker:'Клиент',evidence:'Да, да, конечно, я понял.',confidence:.9,verification_status:'pending'}],quotes:[{id:'quote_criteria',text:'Да, да, конечно, я понял.',speaker:'Клиент',supports_fact_ids:['fact_criteria'],confidence:.9,verification_status:'pending'}],extraction_meta:{fact_count:1,quote_count:1,decision:'EXTRACTED'}};
    const judge=validateFactJudgeOutput({items:[{id:'fact_criteria',verdict:'needs_correction',reason:'нет явного упоминания ИЖС клиентом',confidence:.4,corrections:{value:null,normalized_value:null}},{id:'quote_criteria',verdict:'verified',reason:'дословно',confidence:.9,corrections:{}}],overall_confidence:.8,warnings:[]},input);
    return mergeFactCheck({hardFail:false,criteria:[]},judge,null,input,{});
  })()`));
  expect(result.verified_facts).toEqual([]);
  expect(result.rejected_facts).toEqual(expect.arrayContaining([expect.objectContaining({ id: "fact_criteria", error_type: "unsupported_interpretation" })]));
  expect(result.verified_quotes).toEqual([]);
  expect(result.rejected_quotes).toEqual(expect.arrayContaining([expect.objectContaining({ id: "quote_criteria", error_type: "quote_supports_rejected_fact" })]));
});

test("неподтверждённая ипотека переводит Gate в REVIEW_REQUIRED и блокирует CRM", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate((fixture) => eval(`(() => {
    ${fixture}
    const ctx=crmContext('plot-call');
    ctx.conversation_store.conversation.attributes.funding_source={value:'ипотека в процессе',confidence:.99,evidence:'',source_fact_ids:[],source:'need_check',verification_status:'verified'};
    crmUpdateStoreHash(ctx);
    ctx.summary_quality_gate=moduleSummaryQualityGateV1(ctx);
    ctx.__stage_provenance.summary.output_hash=stableHash(ctx.summary);
    ctx.__stage_provenance.summary_quality_gate={run_id:ctx.__run_id,transcript_hash:ctx.__transcript_hash,pipeline_configuration_hash:ctx.__pipeline_configuration_hash,stage_execution_id:ctx.__run_id+':16:summary_quality_gate',output_hash:stableHash(ctx.summary_quality_gate)};
    let apiCalls=0;ctx.__crm_adapter={write(){apiCalls++;return {id:'must-not-save'}},queueReview(){return {id:'plot-call',request_id:'review'}}};
    const crm=moduleCrmV1(ctx);
    return {gate:ctx.summary_quality_gate,crm,apiCalls};
  })()`), crmFixture);

  expect(result.gate).toMatchObject({ decision: "REVIEW_REQUIRED", can_save_to_crm: false, requires_manual_review: true });
  expect(result.gate.hard_stops).toEqual(expect.arrayContaining([expect.objectContaining({ code: "UNCONFIRMED_CRM_ATTRIBUTE", field: "conversation.attributes.funding_source" })]));
  expect(result.crm).toMatchObject({ status: "SKIPPED", decision: "REVIEW_REQUIRED", summary_write: { attempted: false, saved: false } });
  expect(result.apiCalls).toBe(0);
});

test("Summary синхронизирует пустой primary_next_step с обязательной формулировкой", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const stage=defaultPipeline().find(item=>item.outKey==='summary');
    const value={status:'GENERATED',conversation_result:'Клиент интересуется участком.',key_facts:[],quotes:[],next_step:'Агент отправит видео.',error:''};
    const store={conversation:{primary_next_step:{action:'',owner:'',deadline:'не определено',channel:'',status:'not_defined',agreement_ids:[]}}};
    const repaired=moduleSummaryApplyStorePolicy(value,store);
    return {stage:{promptVersion:stage.promptVersion,prompt:stage.prompt},repaired,errors:moduleSummaryGrounding(repaired.value,store)};
  })()`));

  expect(result.stage.promptVersion).toBe(7);
  expect(result.stage.prompt).toContain('next_step должен быть ровно "Следующий шаг не согласован."');
  expect(result.repaired).toMatchObject({ count: 1, value: { next_step: "Следующий шаг не согласован." } });
  expect(result.errors).toEqual(expect.not.arrayContaining([expect.objectContaining({ path: "next_step" })]));
});

test("Summary не принимает цену объекта под меткой бюджета", async ({ page }) => {
  await page.goto(moduleUrl);
  const errors = await page.evaluate(() => eval(`(() => {
    const summary={status:'GENERATED',conversation_result:'Клиент интересуется участком.',key_facts:[{label:'Бюджет',value:'4 650 000'}],quotes:[],next_step:'Следующий шаг не согласован.',error:''};
    const store={conversation:{facts:[{id:'f1',category:'object_information',name:'цена в объявлении',value:'Четыре 650',normalized_value:4650000,evidence:'Четыре 650.'}],requirements:[],attributes:{},quotes:[],agreements:[],primary_next_step:{status:'not_defined',agreement_ids:[]}}};
    return moduleSummaryGrounding(summary,store);
  })()`));
  expect(errors).toEqual(expect.arrayContaining([expect.objectContaining({ path: "key_facts[0]", message: "Цена объекта не является бюджетом клиента." })]));
});

test("этап №12 использует новый контракт полноты и заданную модель", async ({ page }) => {
  await page.goto(moduleUrl);
  const stage = await page.evaluate(() => eval(`(() => {
    const item=pipeline.find(stage=>stage.outKey==='critical_completeness_check');
    return item&&{name:item.name,type:item.type,outKey:item.outKey,provider:item.provider,model:item.model,temperature:item.temperature,maxTokens:item.maxTokens,promptVersion:item.promptVersion,prompt:item.prompt};
  })()`));
  expect(stage).toMatchObject({
    name: "Проверка полноты критически важной информации",
    type: "check",
    outKey: "critical_completeness_check",
    provider: "ai-tunnel",
    model: "gpt-5-mini",
    temperature: 0,
    maxTokens: 8000,
    promptVersion: 10,
  });
  expect(stage.prompt).toContain("EXPECTED_CRITICAL_ITEMS");
  expect(stage.prompt).toContain("не придумывай category, totals, score, status или decision");
  expect(stage.prompt).toContain('"overall_confidence":0.98');
  expect(stage.prompt).toContain('"warnings":[]');
});

test("код полноты сам пересчитывает весовой score, status и не штрафует semantic-дубли", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const summary={status:'GENERATED',conversation_result:'Клиент ищет квартиру для дочери, бюджет до 12 млн; важно не выше пятого этажа.',key_facts:[{label:'Возражение',value:'Сомневается из-за шума во дворе'}],quotes:[],next_step:'Следующий шаг не согласован.',error:''};
    const conversation={
      facts:[
        {id:'f1',category:'intent',name:'client_goal',value:'Квартира для дочери',evidence:'Ищет квартиру для дочери'},
        {id:'f2',category:'budget',name:'budget_max',value:12000000,evidence:'Бюджет до 12 млн'},
        {id:'f3',category:'objection',name:'main_objection',value:'Шум во дворе',evidence:'Сомневается из-за шума во дворе'}
      ],
      requirements:[{id:'r1',type:'hard_constraint',value:'Не выше пятого этажа',evidence:'Важно не выше пятого этажа'}],
      attributes:{funding_source:{value:'не определено'},purchase_term:{value:'не определено'}},call_results:[]
    };
    const ctx={summary,conversation_store:{conversation}};
    const item=(id,category,expected,field,fragment,evidence)=>({id,category,expected,present:true,summary_field:field,summary_fragment:fragment,evidence});
    const judge={status:'fail',score:1,critical_items_total:99,critical_items_present:0,critical_items_missing:99,critical_items:[
      item('goal','client_goal','Квартира для дочери','conversation_result','ищет квартиру для дочери','Ищет квартиру для дочери'),
      item('budget','budget','Бюджет до 12 млн','conversation_result','бюджет до 12 млн','Бюджет до 12 млн'),
      item('constraint','hard_constraint','Не выше пятого этажа','conversation_result','важно не выше пятого этажа','Важно не выше пятого этажа'),
      item('objection','main_objection','Шум во дворе','key_facts','Сомневается из-за шума во дворе','Сомневается из-за шума во дворе'),
      item('budget-copy','budget','Бюджет до 12 млн','conversation_result','бюджет до 12 млн','Бюджет до 12 млн')
    ],missing_items:[],warnings:[],explanation:'Все критические элементы отражены.'};
    validateCriticalCompletenessJudgeOutput(judge,ctx);
    const output=criticalCompletenessRecalculate(judge,ctx);
    const gate=CODE_FUNCS.summaryQualityGate({}, {summary,critical_completeness_check:output,truth_check:{status:'pass',score:100,critical_errors:[]},context_utility_check:{status:'pass',score:100,can_continue_without_recording:true,context_clarity:100,business_usefulness:100,missing_for_next_agent:[]},action_check:{status:'pass',score:100,action_errors:[]},presentation_check:{status:'pass',score:100,forbidden_card_duplicates:[],pii_found:[],forbidden_phrases:[],readability_issues:[],style_issues:[]}}).output;
    return {output,gateCritical:gate.judges.critical_facts_check};
  })()`));
  expect(result.output).toMatchObject({ status: "pass", score: 100, critical_items_total: 4, critical_items_present: 4, critical_items_missing: 0 });
  expect(result.gateCritical).toMatchObject({ status: "pass", score: 100, critical_items_total: 4 });
});

test("пропуски цели, возражения, причины отказа и score ниже 85 дают fail", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const run=category=>{
      const evidence=category==='client_goal'?'Клиент хочет купить квартиру':category==='main_objection'?'Клиента смущает шум':'Клиент отказался из-за высокой комиссии';
      const fact={id:'f',category:category==='client_goal'?'intent':category==='main_objection'?'objection':'result',name:category,value:evidence,evidence};
      const ctx={summary:{status:'GENERATED',conversation_result:'Звонок состоялся.',key_facts:[],quotes:[],next_step:'Шаг не согласован.',error:''},conversation_store:{conversation:{facts:[fact],requirements:[],attributes:{},call_results:category==='refusal_reason'?['отказ']:[]}}};
      const judge={status:'pass',score:100,critical_items_total:0,critical_items_present:0,critical_items_missing:0,critical_items:[{id:'x',category,expected:evidence,present:false,summary_field:'',summary_fragment:'',evidence}],missing_items:[{id:'x',type:category,category,expected:evidence,importance:'critical',reason:'Нужно для продолжения работы',evidence}],warnings:[],explanation:'Элемент пропущен.'};
      validateCriticalCompletenessJudgeOutput(judge,ctx);return criticalCompletenessRecalculate(judge,ctx);
    };
    const budgetCtx={summary:{status:'GENERATED',conversation_result:'Цель клиента отражена.',key_facts:[],quotes:[],next_step:'Шаг не согласован.',error:''},conversation_store:{conversation:{facts:[{id:'g',category:'intent',name:'client_goal',value:'Цель клиента',evidence:'Цель клиента отражена'},{id:'b',category:'budget',name:'budget',value:'10 млн',evidence:'Бюджет 10 млн'}],requirements:[],attributes:{},call_results:[]}}};
    const budgetJudge={status:'pass',score:100,critical_items_total:2,critical_items_present:2,critical_items_missing:0,critical_items:[{id:'g',category:'client_goal',expected:'Цель клиента',present:true,summary_field:'conversation_result',summary_fragment:'Цель клиента отражена',evidence:'Цель клиента отражена'},{id:'b',category:'budget',expected:'Бюджет 10 млн',present:false,summary_field:'',summary_fragment:'',evidence:'Бюджет 10 млн'}],missing_items:[{id:'b',type:'budget',category:'budget',expected:'Бюджет 10 млн',importance:'critical',reason:'Важен для подбора',evidence:'Бюджет 10 млн'}],warnings:[],explanation:'Бюджет пропущен.'};
    validateCriticalCompletenessJudgeOutput(budgetJudge,budgetCtx);
    return {goal:run('client_goal'),objection:run('main_objection'),refusal:run('refusal_reason'),budget:criticalCompletenessRecalculate(budgetJudge,budgetCtx)};
  })()`));
  expect(result.goal.status).toBe("fail");
  expect(result.objection.status).toBe("fail");
  expect(result.refusal.status).toBe("fail");
  expect(result.budget).toMatchObject({ status: "fail", score: 50 });
});

test("semantic guards не принимают цену объекта, дату показа, адрес и evidence вне Store", async ({ page }) => {
  await page.goto(moduleUrl);
  const errors = await page.evaluate(() => eval(`(() => {
    const summary={status:'GENERATED',conversation_result:'Цена 10 млн, показ завтра, адрес Ленина 1.',key_facts:[],quotes:[],next_step:'Шаг не согласован.',error:''};
    const conversation={facts:[{evidence:'Цена объекта 10 млн'},{evidence:'Показ завтра'},{evidence:'Объект находится на Ленина 1'}],requirements:[],attributes:{},call_results:[],quotes:[{text:'Скрытая цитата'}]};
    const ctx={summary,conversation_store:{conversation}};
    const check=item=>{try{validateCriticalCompletenessItem(item,'critical_items[0]',ctx);return ''}catch(error){return error.message}};
    const base={id:'x',expected:'x',present:true,summary_field:'conversation_result',summary_fragment:'Цена 10 млн'};
    return {
      price:check({...base,category:'budget',expected:'Цена объекта 10 млн',evidence:'Цена объекта 10 млн'}),
      viewing:check({...base,category:'purchase_term',expected:'Показ завтра',summary_fragment:'показ завтра',evidence:'Показ завтра'}),
      address:check({...base,category:'required_criteria',expected:'Ленина 1',summary_fragment:'адрес Ленина 1',evidence:'Объект находится на Ленина 1'}),
      quote:check({...base,category:'critical_context',expected:'Скрытая цитата',evidence:'Скрытая цитата'}),
      fragment:check({...base,category:'critical_context',expected:'Цена объекта 10 млн',summary_fragment:'несуществующий фрагмент',evidence:'Цена объекта 10 млн'})
    };
  })()`));
  expect(errors.price).toContain("object price cannot be budget");
  expect(errors.viewing).toContain("viewing date cannot be purchase term");
  expect(errors.address).toContain("object location cannot be search requirement");
  expect(errors.quote).toContain("evidence is absent from allowed Conversation Store sources");
  expect(errors.fragment).toContain("fragment is absent from declared summary field");
});

test("неизвестные funding/term и пустой Store не создают обязательных критических элементов", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const ctx={summary:{status:'MANUAL_REVIEW',conversation_result:'Звонок состоялся.',key_facts:[],quotes:[],next_step:'Шаг не согласован.',error:''},conversation_store:{conversation:{facts:[],requirements:[],attributes:{funding_source:{value:'не определено'},purchase_term:{value:'не определено'}},call_results:[]}}};
    const judge={status:'fail',score:0,critical_items_total:9,critical_items_present:0,critical_items_missing:9,critical_items:[],missing_items:[],warnings:[],explanation:'Критических элементов нет.'};
    validateCriticalCompletenessJudgeOutput(judge,ctx);return {required:[...criticalCompletenessRequiredCategories(ctx)],output:criticalCompletenessRecalculate(judge,ctx)};
  })()`));
  expect(result.required).toEqual([]);
  expect(result.output).toMatchObject({ status: "pass", score: 100, critical_items_total: 0, critical_items_missing: 0 });
});

test("production report 2026-07-23 восстанавливает явное возражение и не считает ожидание материалов целью клиента", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const transcript='Клиент:\\n— Ну, конечно, вот этот побор, конечно, 9600, мне прямо не это.\\nАгент:\\n— Я отправлю видео.';
    const extracted={facts:[{id:'fact_1',category:'client_intent',name:'ожидание видеообзора',value:'ожидает видеообзор',normalized_value:'ожидает видеообзор',speaker:'Клиент',evidence:'Я жду от вас видео.',confidence:.9,verification_status:'pending'}],quotes:[],extraction_meta:{fact_count:1,quote_count:0,decision:'EXTRACTED'}};
    const policy=applyFactExtractionPolicies(extracted,{__transcript:transcript});
    const required=[...criticalCompletenessRequiredCategories({conversation_store:{conversation:{facts:policy.value.facts,requirements:[],attributes:{},call_results:[]}}})];
    return {policy,required};
  })()`));
  expect(result.policy.warnings).toContain("CLIENT_OBJECTION_POLICY_ADDED");
  expect(result.policy.value.facts).toContainEqual(expect.objectContaining({
    category: "client_objection",
    name: "главное возражение",
    evidence: "Ну, конечно, вот этот побор, конечно, 9600, мне прямо не это.",
    verification_status: "pending"
  }));
  expect(result.policy.value.quotes).toContainEqual(expect.objectContaining({
    text: "Ну, конечно, вот этот побор, конечно, 9600, мне прямо не это.",
    speaker: "Клиент"
  }));
  expect(result.required).toContain("main_objection");
  expect(result.required).not.toContain("client_goal");
});

test("production report 2026-07-24 сохраняет подтверждённое ИЖС как требование, а не interest", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const transcript=[
      'Агент:',
      '— Ну, до пяти с половиной, ну, если это ИЖС, да?',
      'Клиент:',
      '— Да, да, конечно, я понял.'
    ].join('\\n');
    const extracted={facts:[],quotes:[],extraction_meta:{fact_count:0,quote_count:0,decision:'NO_FACTS'}};
    const policy=applyFactExtractionPolicies(extracted,{__transcript:transcript});
    const contextual=policy.value.facts.find(item=>item.category==='search_criteria'&&item.normalized_value==='ИЖС');
    const verified={...contextual,verification_status:'verified',verified:true,source:'fact_check'};
    const empty={value:'не определено',confidence:1,evidence:'',source_fact_ids:[],verification_status:'pending'};
    const needs=normalizeNeedExtractionSemantics({attributes:{interest:[],funding_source:empty,purchase_term:empty},requirements:[],need_meta:{interest_count:0,requirements_count:0,decision:'NO_NEEDS'}},{facts:policy.value,fact_check:{verified_facts:[verified]}});
    const recovered=conversationStoreRecoveredRequirements([verified],[]);
    const required=[...criticalCompletenessRequiredCategories({conversation_store:{conversation:{facts:[verified],requirements:needs.requirements,attributes:{},call_results:[]}}})];
    return {policy,contextual,needs,recovered,required};
  })()`));

  expect(result.policy.warnings).toContain("CONTEXTUAL_IZHS_CRITERION_ADDED");
  expect(result.contextual).toMatchObject({
    category: "search_criteria",
    name: "назначение участка",
    value: "ИЖС",
    normalized_value: "ИЖС",
    speaker: "Клиент",
    evidence: "— Да, да, конечно, я понял.",
    verification_status: "pending",
  });
  expect(result.needs.attributes.interest).toEqual([]);
  expect(result.needs.requirements).toContainEqual(expect.objectContaining({
    type: "property_type",
    value: "ИЖС",
    source_fact_ids: [result.contextual.id],
  }));
  expect(result.recovered).toContainEqual(expect.objectContaining({ type: "property_type", value: "ИЖС" }));
  expect(result.required).toContain("required_criteria");
});

test("pipeline report 2026-07-24T062250 проходит deterministic regression без скрытых recovery", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate((fixture) => {
    const seed={facts:[
      {id:'fact_1',category:'client_intent',name:'цель обращения',value:'поиск участка',normalized_value:'поиск участка',speaker:'Клиент',evidence:'Слушайте, по поводу участка звоню вам.',confidence:.95,verification_status:'pending'},
      {id:'fact_2',category:'search_location',name:'область поиска',value:'Деревня Мистолово',normalized_value:'Деревня Мистолово',speaker:'Клиент',evidence:'Деревня Мистолово.',confidence:.95,verification_status:'pending'},
      {id:'fact_3',category:'client_constraint',name:'минимальная площадь участка',value:'6 соток',normalized_value:6,speaker:'Клиент',evidence:'Ну, минимум шесть соток мне надо.',confidence:.95,verification_status:'pending'},
      {id:'fact_4',category:'communication_channel',name:'канал',value:'MAX',normalized_value:'MAX',speaker:'Клиент',evidence:'Да, давайте в Макс лучше.',confidence:.95,verification_status:'pending'},
      {id:'fact_5',category:'agent_commitment',name:'отправить видеообзор',value:'отправить видеообзор',normalized_value:'отправить видеообзор',speaker:'Агент',evidence:'Я могу скинуть вам подробный видеообзор.',confidence:.95,verification_status:'pending'},
      {id:'fact_6',category:'agent_commitment',name:'отправить подборку',value:'отправить ссылку на подбор',normalized_value:'отправить ссылку на подбор',speaker:'Агент',evidence:'Скину видео и сейчас посмотрю, что у нас есть, скину ссылку на подбор.',confidence:.95,verification_status:'pending'}
    ],quotes:[],extraction_meta:{fact_count:6,quote_count:0,decision:'EXTRACTED'}};
    const policy=applyFactExtractionPolicies(seed,{__transcript:fixture.transcript});
    const verifiedFacts=policy.value.facts.map((fact) => ({...fact,verified:true,verification_status:'verified'}));
    const recovered=conversationStoreRecoveredRequirements(verifiedFacts,[]).map((item) => ({...item,verified:true}));
    const deduplicated=deduplicateSearchLocationRequirements(recovered);
    const repaired=moduleSummaryDeterministicRepair(structuredClone(fixture.failing_summary_raw));
    const summary=validateModuleSummaryOutput(repaired.value);
    const alternativeQuestion={category:'client_question',name:'другие варианты',value:'А больше ничего нет у вас в этой локации?',evidence:'А больше ничего нет у вас в этой локации?'};
    const questionStatus=conversationStoreQuestionStatus(alternativeQuestion,{__transcript:fixture.transcript,outcome_check:{verified_agreements:[{action:'проверить дополнительные варианты и отправить подборку'}],verified_primary_next_step:{action:'отправить подборку альтернативных участков'}}});
    return {policy,deduplicated,repaired,summary,questionStatus};
  }, pipelineReportRegression);

  expect(result.policy.audit).toMatchObject({
    model_output_fact_count: 6,
    final_fact_count: expect.any(Number),
    recovered_fact_count: expect.any(Number),
    model_output_quote_count: 0,
    final_quote_count: expect.any(Number),
    recovered_quote_count: expect.any(Number),
  });
  expect(result.policy.audit.recovered_fact_count).toBeGreaterThanOrEqual(5);
  expect(result.policy.warnings).toEqual(expect.arrayContaining([
    "CLIENT_OBJECTION_POLICY_ADDED",
    "SEARCH_LOCATION_RANGE_POLICY_ADDED",
    "CONTEXTUAL_IZHS_CRITERION_ADDED",
    "CLIENT_BUDGET_POLICY_ADDED",
    "AGENT_INSPECTION_COMMITMENT_ADDED",
  ]));
  expect(result.deduplicated.requirements).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "property_type", value: "ИЖС" }),
    expect.objectContaining({ type: "minimum_land_area", normalized_value: 6 }),
    expect.objectContaining({ type: "price_limit", normalized_value: 5500000 }),
    expect.objectContaining({ type: "search_location", value: ["Мистолово", "Капитолово", "Лаврики"] }),
  ]));
  expect(result.deduplicated.requirements.filter((item: any) => item.type === "search_location")).toHaveLength(1);
  expect(result.repaired).toMatchObject({ repair_attempted: true, contract_status: "RECOVERED_WITH_WARNING", removed_items: ["key_facts[1]"] });
  expect(result.summary.key_facts).toEqual([{ label: "Районы поиска", value: "Мистолово, Капитолово, Лаврики" }]);
  expect(result.questionStatus).toBe("converted_to_action");
});

test("отчёт 2026-07-24T075545 восстанавливает бюджет и не пропускает плохое рабочее summary", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const empty={value:'не определено',confidence:1,evidence:'',source_fact_ids:[],verification_status:'pending'};
    const finance={id:'fact_11',category:'client_finance',name:'ценовой предел клиента',value:5500000,normalized_value:5500000,speaker:'Клиент',evidence:'у меня просто цена до пяти с половиной, вот так.',verification_status:'verified'};
    const question={id:'fact_16',category:'client_question',name:'вопрос про цену и сотку',value:'А до пяти, а сотка сколько получится?',speaker:'Клиент',evidence:'А до пяти, а сотка сколько получится?',verification_status:'verified',question_status:'answered'};
    const locationA={id:'fact_2',category:'search_location',name:'область поиска',value:'Мистолово',normalized_value:'Мистолово',speaker:'Клиент',evidence:'Деревня Мистолово.',verification_status:'verified'};
    const locationB={id:'fact_19',category:'search_location',name:'районы поиска',value:['Мистолово','Капитолово','Лаврики'],normalized_value:['Мистолово','Капитолово','Лаврики'],speaker:'Клиент',evidence:'Мистолово, Капитолово, Лаврики.',verification_status:'verified'};
    const needs=normalizeNeedExtractionSemantics({attributes:{interest:[],funding_source:empty,purchase_term:empty},requirements:[
      {id:'bad-price',type:'price_limit',value:question.value,normalized_value:question.value,source_fact_ids:['fact_16'],evidence:question.evidence,confidence:.9,verification_status:'pending'},
      {id:'loc-a',type:'search_location',value:'Мистолово',normalized_value:'Мистолово',source_fact_ids:['fact_2'],evidence:locationA.evidence,confidence:.9,verification_status:'pending'},
      {id:'loc-b',type:'search_location',value:['Мистолово','Капитолово','Лаврики'],normalized_value:['Мистолово','Капитолово','Лаврики'],source_fact_ids:['fact_19'],evidence:locationB.evidence,confidence:.9,verification_status:'pending'}
    ],need_meta:{interest_count:0,requirements_count:3,decision:'NEEDS_FOUND'}},{fact_check:{verified_facts:[finance,question,locationA,locationB]}});
    const objection={id:'fact_18',category:'client_objection',name:'главное возражение',value:'Ну, конечно, вот этот побор, конечно, 9600, мне прямо не это.',normalized_value:'Ну, конечно, вот этот побор, конечно, 9600, мне прямо не это.',speaker:'Клиент',evidence:'Ну, конечно, вот этот побор, конечно, 9600, мне прямо не это.',verification_status:'verified'};
    const store={conversation:{facts:[finance,question,locationA,locationB,objection,{id:'fact_5',category:'client_identity',name:'имя клиента',value:'Николай',evidence:'Николай.'}],quotes:[
      {id:'q-budget',text:finance.evidence,speaker:'Клиент',supports_fact_ids:['fact_11']},
      {id:'q-objection',text:objection.evidence,speaker:'Клиент',supports_fact_ids:['fact_18']},
      {id:'q-name',text:'Николай.',speaker:'Клиент',supports_fact_ids:['fact_5']}
    ],requirements:needs.requirements,attributes:{},call_results:[],agreements:[{id:'a1',action:'отправить видеообзор и подборку альтернативных участков',owner:'агент',recipient:'клиент',deadline:'после звонка',channel:'MAX',status:'confirmed',evidence:'Скину видео и ссылку на подбор.'}],primary_next_step:{action:'отправить видеообзор и подборку альтернативных участков',owner:'агент',deadline:'после звонка',channel:'MAX',status:'confirmed',agreement_ids:['a1']}}};
    const safe=moduleSummaryStoreView(store);
    const draft={status:'GENERATED',conversation_result:'Клиент ищет участок.',key_facts:[{label:'Клиент',value:'Николай, частное лицо'},{label:'Главное возражение',value:'Ну, конечно, вот этот побор, конечно, 9600, мне прямо не это.'}],quotes:[objection.evidence],next_step:'Агент отправит видеообзор и подборку альтернативных участков в MAX.',error:''};
    const repaired=moduleSummaryApplyStorePolicy(draft,safe,'');
    const badSummary={status:'GENERATED',conversation_result:'Клиент ищет участок.',key_facts:[{label:'Клиент',value:'Николай, частное лицо'},{label:'Главное возражение',value:'Побор 9 600 ₽ («мне прямо не это»)'}],quotes:['мне прямо не это'],next_step:'Агент: отправить видеообзор и подборку альтернативных участков.',error:''};
    const utilityJudge={status:'pass',score:100,can_continue_without_recording:true,context_clarity:100,actionability:100,scanability:100,recording_independence:100,missing_for_next_agent:[],useful_summary_elements:[],problems:[],explanation:'ok'};
    const utility=agentUtilityRecalculate(utilityJudge,{summary:badSummary,conversation_store:store});
    const presentation=presentationCheckRecalculate({status:'pass',score:100,structure_score:100,brevity_score:100,readability_score:100,repetition_score:100,limits_score:100,checks:{},metrics:{},errors:[],warnings:[],explanation:'ok'},{summary:badSummary},presentationCodeIssues(badSummary));
    return {needs,safe,repaired,utility,presentation};
  })()`));

  expect(result.needs.requirements.filter((item: any) => item.type === "price_limit")).toEqual([
    expect.objectContaining({ normalized_value: 5500000, source_fact_ids: ["fact_11"] }),
  ]);
  expect(result.needs.requirements.filter((item: any) => item.type === "search_location")).toHaveLength(1);
  expect(result.safe.conversation.facts).not.toContainEqual(expect.objectContaining({ category: "client_identity" }));
  expect(result.safe.conversation.quotes).not.toContainEqual(expect.objectContaining({ text: "Николай." }));
  expect(result.repaired.value.key_facts).toEqual(expect.arrayContaining([
    { label: "Бюджет", value: "до 5 500 000 ₽" },
    { label: "Главное возражение", value: "ежемесячный взнос 9 600 ₽" },
  ]));
  expect(result.repaired.value.key_facts).not.toContainEqual(expect.objectContaining({ label: "Клиент" }));
  expect(result.repaired.value.conversation_result).toContain("Агент после звонка отправит клиенту в MAX");
  expect(result.utility).toMatchObject({ status: "fail", can_continue_without_recording: false });
  expect(result.utility.problems.map((item: any) => item.type)).toEqual(expect.arrayContaining(["crm_data_without_working_context", "fragmented_information", "ambiguous_wording"]));
  expect(result.presentation).toMatchObject({ status: "fail" });
  expect(result.presentation.errors.map((item: any) => item.type)).toContain("mixed_meanings_in_key_fact");
});

test("first-pass scoring не превращает пять corrections из восьми в 100", async ({ page }) => {
  await page.goto(moduleUrl);
  const quality = await page.evaluate(() => reconciliationQuality({
    corrected: Array.from({ length: 5 }, (_, index) => ({ id: "corrected_" + index })),
    rejected: [],
  }, 8, 8, 0));

  expect(quality).toMatchObject({
    semantic_accuracy_score: 1,
    first_pass_accuracy_score: 0.375,
    reconciliation_success_score: 1,
    final_output_validity_score: 1,
    correction_ratio: 0.625,
    decision: "PASS_WITH_CORRECTIONS",
    score: 38,
  });
  expect(quality.score).toBeLessThan(100);
});

test("PASS_WITH_CORRECTIONS остаётся предупреждением даже при низкой first-pass оценке", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const rep={status:'warn',output:{decision:'PASS_WITH_CORRECTIONS',score:33,criteria:[]},ms:1,tokens:0,cost:0};
    return {
      meta:buildStageMeta({outKey:'need_check',codeFn:'needCheckCode'},rep),
      runtimeStatus:statusFromDecision('PASS_WITH_CORRECTIONS'),
      badge:badgeText(statusFromDecision('PASS_WITH_CORRECTIONS'))
    };
  });

  expect(result.meta).toMatchObject({status:"warning",score:33});
  expect(result.runtimeStatus).toBe("warn");
  expect(result.badge).toBe("Внимание");
});

test("fault injection каждого из 16 этапов останавливает pipeline и помечает downstream NOT_RUN", async ({ page }) => {
  await page.goto(moduleUrl);
  const cases = await page.evaluate(() => {
    const stages=defaultPipeline().filter((stage) => stage.outKey !== 'stt');
    return stages.map((failedStage,index)=>{
      const reports=stages.map((stage,reportIndex)=>({
        stage,
        report:reportIndex<index?{status:'ok'}:reportIndex===index?{status:'bad',output:{status:'technical_error',error_code:'FAULT_INJECTION'}}:{status:'not_run',execution_status:'NOT_RUN'}
      }));
      return buildPipelineExecutionSummary(stages,reports,index);
    });
  });

  expect(cases).toHaveLength(16);
  cases.forEach((execution: any, index: number) => {
    expect(execution).toMatchObject({
      pipeline_status: "TECHNICAL_ERROR",
      steps_total: 16,
      steps_executed: index + 1,
      steps_successful: index,
    });
    expect(execution.stages[index].status).toBe("FAILED");
    expect(execution.stages.slice(index + 1).every((stage: any) => stage.status === "NOT_RUN")).toBe(true);
    expect(execution.stages.at(-1).status).toBe(index === 15 ? "FAILED" : "NOT_RUN");
  });
});

test("текущий звонок по участку покрывает цель, бюджет, ИЖС, площадь, локации и сомнение", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const summary={status:'GENERATED',conversation_result:'Клиент ищет участок под ИЖС от 6 соток в Московском или Фрунзенском районе с бюджетом до 5,5 млн ₽.',key_facts:[{label:'Сомнение',value:'Клиента смущает взнос 9 600 ₽.'}],quotes:[],next_step:'Следующий шаг не согласован.',error:''};
    const conversation={facts:[{category:'intent',name:'client_goal',evidence:'Ищет участок под ИЖС'},{category:'budget',name:'budget_max',evidence:'Бюджет до 5,5 млн ₽'},{category:'objection',name:'main_objection',evidence:'Смущает взнос 9 600 ₽'}],requirements:[{type:'land_use',evidence:'Участок под ИЖС'},{type:'minimum_area',evidence:'От 6 соток'},{type:'search_location',evidence:'Московский или Фрунзенский район'}],attributes:{},call_results:[]};
    const ctx={summary,conversation_store:{conversation}};
    const item=(id,category,expected,field,fragment,evidence)=>({id,category,expected,present:true,summary_field:field,summary_fragment:fragment,evidence});
    const judge={status:'fail',score:0,critical_items_total:0,critical_items_present:0,critical_items_missing:0,critical_items:[
      item('goal','client_goal','Участок под ИЖС','conversation_result','ищет участок под ИЖС','Ищет участок под ИЖС'),
      item('budget','budget','До 5,5 млн ₽','conversation_result','бюджетом до 5,5 млн ₽','Бюджет до 5,5 млн ₽'),
      item('criteria-1','required_criteria','ИЖС','conversation_result','под ИЖС','Участок под ИЖС'),
      item('criteria-2','required_criteria','От 6 соток','conversation_result','от 6 соток','От 6 соток'),
      item('criteria-3','required_criteria','Московский или Фрунзенский район','conversation_result','Московском или Фрунзенском районе','Московский или Фрунзенский район'),
      item('objection','main_objection','Взнос 9 600 ₽ вызывает сомнение','key_facts','смущает взнос 9 600 ₽','Смущает взнос 9 600 ₽')
    ],missing_items:[],warnings:[],explanation:'Все существенные сведения отражены.'};
    validateCriticalCompletenessJudgeOutput(judge,ctx);return criticalCompletenessRecalculate(judge,ctx);
  })()`));
  expect(result).toMatchObject({ status: "pass", score: 100, critical_items_total: 6, critical_items_present: 6, critical_items_missing: 0 });
});

test("этап полноты блокируется по dependency и делает один repair retry для invalid Judge JSON", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(async () => {
    const stage={type:'check',outKey:'critical_completeness_check',name:'Проверка полноты критически важной информации',provider:'ai-tunnel',model:'deepseek-v3.2-exp',temperature:0,maxTokens:3000,prompt:MODULE_CRITICAL_COMPLETENESS_PROMPT};
    const original=callModelWithTransientRetry;let dependencyCalls=0;
    callModelWithTransientRetry=async()=>{dependencyCalls++;throw new Error('must not call')};
    const blocked=await runStage(stage,{summary:null,conversation_store:null,__transcript:'Клиент: тест'});
    const run='run-1',transcriptHash='tr-1',pipelineHash='pipe-1',storeHash='store-1';
    const summary={status:'GENERATED',conversation_result:'Цель клиента — купить квартиру.',key_facts:[],quotes:[],next_step:'Шаг не согласован.',error:''};
    const conversation={facts:[{id:'f1',category:'client_intent',name:'client_goal',value:'Купить квартиру',evidence:'Клиент хочет купить квартиру',verification_status:'verified'}],requirements:[],attributes:{},call_results:[]};
    const ctx={summary,conversation_store:{status:'READY',conversation,provenance:{run_id:run,transcript_hash:transcriptHash,pipeline_configuration_hash:pipelineHash},store_meta:{conversation_store_hash:storeHash}},__run_id:run,__transcript_hash:transcriptHash,__pipeline_configuration_hash:pipelineHash,__summary_provenance:{run_id:run,transcript_hash:transcriptHash,pipeline_configuration_hash:pipelineHash,conversation_store_hash:storeHash},__transcript:'Клиент: Клиент хочет купить квартиру'};
    const valid={items:[{id:'critical-client-goal',present:true,summary_field:'conversation_result',summary_fragment:'купить квартиру',confidence:.98}],overall_confidence:.98,warnings:[]};
    let retryCalls=0;callModelWithTransientRetry=async()=>{retryCalls++;return {text:retryCalls===1?'{broken':JSON.stringify(valid),tokens:5,actualModel:'deepseek-v3.2-exp',actualProvider:'ai-tunnel'}};
    const repaired=await runStage(stage,ctx);
    const orphan={...valid,items:[]};
    callModelWithTransientRetry=async()=>({text:JSON.stringify(orphan),tokens:5,actualModel:'deepseek-v3.2-exp',actualProvider:'ai-tunnel'});
    const referenceRepaired=await runStage(stage,ctx);
    const outOfScopeRepair=repairCriticalCompletenessReferences({critical_items:[
      {id:'channel',category:'critical_context',expected:'Канал связи MAX',present:true,summary_field:'next_step',summary_fragment:'MAX',evidence:'Да, давайте в Макс лучше.'},
      {id:'seller',category:'critical_context',expected:'Тип продавца — физлицо',present:false,summary_field:'',summary_fragment:'',evidence:'Физлицо.'}
    ],missing_items:[{id:'seller',type:'seller_type',category:'critical_context',expected:'Тип продавца — физлицо',importance:'critical',reason:'Данные карточки',evidence:'Физлицо.'}]});
    const serializedRepair=repairCriticalCompletenessReferences({critical_items:[{id:'budget',category:'budget',expected:'До 5 500 000',present:true,summary_field:'key_facts',summary_fragment:'{\"label\":\"Бюджет\",\"value\":\"5 500 000\"}',evidence:'до пяти с половиной'}],missing_items:[{id:'question',type:'critical_question',category:'critical_question',expected:'Кто продаёт?',importance:'critical',reason:'Информация о продавце влияет на сделку',evidence:'А кто продаёт?'}]});
    const objectPriceRepair=repairCriticalCompletenessReferences({critical_items:[{id:'object-price',category:'budget',expected:'Цена в объявлении/бюджет: 4 650 000',present:true,summary_field:'key_facts',summary_fragment:'4 650 000',evidence:'Четыре 650.'}],missing_items:[]});
    const paraphrasedMissingRepair=repairCriticalCompletenessReferences({critical_items:[{id:'goal',category:'client_goal',expected:'назначение покупки (для себя / для сдачи и т.п.)',present:false,summary_field:'',summary_fragment:'',evidence:'Для себя. Жить.'}],missing_items:[{id:'goal',type:'client_goal',category:'client_goal',expected:'назначение покупки для себя (жить)',importance:'critical',reason:'Нужно понять цель покупки.',evidence:'Для себя. Жить.'}]});
    callModelWithTransientRetry=original;
    return {dependencyCalls,blocked,retryCalls,repaired,referenceRepaired,outOfScopeRepair,serializedRepair,objectPriceRepair,paraphrasedMissingRepair};
  })()`));
  expect(result.dependencyCalls).toBe(0);
  expect(result.blocked.output).toMatchObject({ status: "error", score: 0 });
  expect(result.retryCalls).toBe(2);
  expect(result.repaired).toMatchObject({ retry_count: 1, parseErr: null });
  expect(result.repaired.output).toMatchObject({ status: "pass", score: 100, critical_items_total: 1, critical_items_present: 1 });
  expect(result.repaired.prompt_audit).toMatchObject({ transcript_present: true, transcript_injected: true });
  expect(result.referenceRepaired).toMatchObject({ retry_count: 1, output: { status: "error", score: null, critical_items_total: 1 } });
  expect(result.outOfScopeRepair).toMatchObject({ count: 3, value: { critical_items: [], missing_items: [] } });
  expect(result.serializedRepair).toMatchObject({ count: 2, value: { critical_items: [{ summary_fragment: "5 500 000" }], missing_items: [] } });
  expect(result.objectPriceRepair).toMatchObject({ count: 1, value: { critical_items: [], missing_items: [] } });
  expect(result.paraphrasedMissingRepair).toMatchObject({ count: 1, value: { missing_items: [{ expected: "назначение покупки (для себя / для сдачи и т.п.)" }] } });
});

test("этап №13 использует новый контракт полезности и заданную модель", async ({ page }) => {
  await page.goto(moduleUrl);
  const stage = await page.evaluate(() => eval(`(() => {
    const item=pipeline.find(stage=>stage.outKey==='agent_utility_check');
    return item&&{name:item.name,type:item.type,outKey:item.outKey,provider:item.provider,model:item.model,temperature:item.temperature,maxTokens:item.maxTokens,prompt:item.prompt};
  })()`));
  expect(stage).toMatchObject({ name: "Проверка полезности для агента", type: "check", outKey: "agent_utility_check", provider: "ai-tunnel", model: "gpt-5-mini", temperature: 0, maxTokens: 8000 });
  expect(stage.prompt).toContain("actionability");
  expect(stage.prompt).toContain("за 5–10 секунд");
});

test("Utility parser отбрасывает составной summary_fragment без technical error", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const summary={status:'GENERATED',conversation_result:'Клиент ищет участок.',key_facts:[{label:'Бюджет',value:'5 500 000'},{label:'Площадь',value:'6 соток'}],quotes:[],next_step:'Агент отправит подборку.',error:''};
    const ctx={summary,critical_completeness_check:{missing_items:[]}};
    const judge={status:'pass',score:100,can_continue_without_recording:true,context_clarity:100,actionability:100,scanability:100,recording_independence:100,missing_for_next_agent:[],useful_summary_elements:[{type:'client_situation',description:'Ограничения понятны.',summary_fragment:'Максимальная цена 5 500 000, ... Минимальная площадь 6 соток'}],problems:[],explanation:'Полезно.'};
    const validated=validateAgentUtilityJudgeOutput(judge,ctx);return {validated,output:agentUtilityRecalculate(validated,ctx),version:defaultPipeline().find(item=>item.outKey==='agent_utility_check').promptVersion};
  })()`));
  expect(result.validated.useful_summary_elements).toEqual([]);
  expect(result.output).toMatchObject({ status: "pass", score: 100 });
  expect(result.version).toBe(6);
});

test("идеальное и эталонное summary по участку получают 100/pass без требований данных карточки", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const summary={status:'GENERATED',conversation_result:'Клиент ищет участок под ИЖС от 6 соток в Московском или Фрунзенском районе с бюджетом до 5,5 млн ₽; его смущает взнос 9 600 ₽.',key_facts:[],quotes:[],next_step:'Агент подготовит подходящую подборку участков и отправит клиенту.',error:''};
    const ctx={summary,conversation_store:{conversation:{facts:[],requirements:[],attributes:{funding_source:{value:'не определено'},purchase_term:{value:'не определено'}},call_results:[]}}};
    const judge={status:'fail',score:1,can_continue_without_recording:false,context_clarity:100,actionability:100,scanability:100,recording_independence:100,missing_for_next_agent:[],useful_summary_elements:[{type:'client_goal',description:'Понятна цель и критерии.',summary_fragment:'ищет участок под ИЖС от 6 соток'},{type:'next_step',description:'Есть конкретное действие агента.',summary_fragment:'Агент подготовит подходящую подборку участков'}],problems:[],explanation:'Полезно.'};
    const validated=validateAgentUtilityJudgeOutput(judge,ctx),output=agentUtilityRecalculate(validated,ctx);
    return {output,html:renderAgentUtilityPanel(output)};
  })()`));
  expect(result.output).toMatchObject({ status: "pass", score: 100, can_continue_without_recording: true, context_clarity: 100, actionability: 100, scanability: 100, recording_independence: 100 });
  expect(result.output.missing_for_next_agent).toEqual([]);
  expect(result.html).toContain("Полезные элементы");
  expect(result.html).not.toContain("имя клиента");
  expect(result.html).not.toContain("адрес");
  expect(result.html).not.toContain("цена объекта");
});

test("неясные цель, результат, следующий шаг и необходимость записи дают fail", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const summary={status:'GENERATED',conversation_result:'Обсудили ситуацию клиента.',key_facts:[],quotes:[],next_step:'Будем на связи.',error:''};
    const ctx={summary,conversation_store:{conversation:{facts:[],requirements:[],attributes:{},call_results:[]}}};
    const base={status:'pass',score:100,can_continue_without_recording:true,context_clarity:100,actionability:100,scanability:100,recording_independence:100,missing_for_next_agent:[],useful_summary_elements:[],explanation:'Judge пытается подменить результат.'};
    const run=(type,fragment,field='conversation_result')=>agentUtilityRecalculate(validateAgentUtilityJudgeOutput({...base,problems:[{type,field,summary_fragment:fragment,problem:'Основной рабочий контекст неясен.'}]},ctx),ctx);
    const vague=agentUtilityRecalculate(validateAgentUtilityJudgeOutput({...base,problems:[]},ctx),ctx);
    return {goal:run('unclear_client_goal','Обсудили ситуацию клиента.'),result:run('unclear_result','Обсудили ситуацию клиента.'),next:run('unclear_next_step','Будем на связи.','next_step'),recording:run('recording_required','Обсудили ситуацию клиента.'),vague};
  })()`));
  for (const key of ["goal", "result", "next", "recording"]) expect(result[key]).toMatchObject({ status: "fail", can_continue_without_recording: false });
  expect(result.vague).toMatchObject({ status: "fail", actionability: 60, can_continue_without_recording: false });
  expect(result.vague.problems).toContainEqual(expect.objectContaining({ type: "unclear_next_step" }));
});

test("компоненты определяют warning/fail, а Judge не может подменить score, status и can_continue", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const summary={status:'MANUAL_REVIEW',conversation_result:'Клиент ищет участок для строительства дома.',key_facts:[],quotes:['Бюджет до пяти миллионов.'],next_step:'Агент отправит подборку участков.',error:''};
    const ctx={summary,conversation_store:{conversation:{facts:[],requirements:[],attributes:{},call_results:[]}}};
    const make=(scores,problems=[])=>agentUtilityRecalculate(validateAgentUtilityJudgeOutput({status:'pass',score:100,can_continue_without_recording:true,...scores,missing_for_next_agent:[],useful_summary_elements:[],problems,explanation:'Подмена.'},ctx),ctx);
    return {
      warning:make({context_clarity:92,actionability:96,scanability:90,recording_independence:94}),
      fragmented:make({context_clarity:82,actionability:90,scanability:70,recording_independence:90},[{type:'fragmented_information',field:'conversation_result',summary_fragment:'Клиент ищет участок',problem:'Факты перечислены без связного контекста.'}]),
      overloaded:make({context_clarity:90,actionability:88,scanability:55,recording_independence:88},[{type:'excessive_detail',field:'conversation_result',summary_fragment:'Клиент ищет участок',problem:'Текст перегружен деталями.'},{type:'difficult_to_scan',field:'conversation_result',summary_fragment:'Клиент ищет участок',problem:'Нельзя быстро прочитать.'}]),
      cardOnly:make({context_clarity:60,actionability:40,scanability:90,recording_independence:55},[{type:'crm_data_without_working_context',field:'conversation_result',summary_fragment:'Клиент ищет участок',problem:'Нет нового рабочего контекста.'}])
    };
  })()`));
  expect(result.warning).toMatchObject({ status: "warning", score: 93, can_continue_without_recording: true });
  expect(result.fragmented.status).toBe("fail");
  expect(result.overloaded.status).toBe("fail");
  expect(result.cardOnly.status).toBe("fail");
});

test("второстепенная деталь даёт warning, а out-of-scope проверки и duplicate critical missing удаляются", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const summary={status:'GENERATED',conversation_result:'Клиент ищет участок для строительства дома.',key_facts:[],quotes:['Бюджет до пяти миллионов.'],next_step:'Агент отправит подборку участков.',error:''};
    const ctx={summary,critical_completeness_check:{missing_items:[{expected:'Точный бюджет клиента'}]},conversation_store:{conversation:{facts:[],requirements:[],attributes:{funding_source:{value:'не определено'},purchase_term:{value:'не определено'}},call_results:[]}}};
    const judge={status:'fail',score:0,can_continue_without_recording:false,context_clarity:92,actionability:96,scanability:92,recording_independence:90,missing_for_next_agent:[{type:'working_context',description:'Точный бюджет клиента'},{type:'funding_source',description:'Источник финансирования не обсуждался'},{type:'purchase_term',description:'Срок покупки не обсуждался'},{type:'working_context',description:'Второстепенную деталь можно уточнить по записи'}],useful_summary_elements:[{type:'goal',description:'Цель ясна.',summary_fragment:'ищет участок для строительства дома'},{type:'action',description:'Шаг ясен.',summary_fragment:'Агент отправит подборку участков'}],problems:[{type:'money_or_number_error',field:'quotes',summary_fragment:'Бюджет до пяти миллионов.',problem:'Не проверять сумму.'},{type:'quote_distortion',field:'quotes',summary_fragment:'Бюджет до пяти миллионов.',problem:'Не проверять дословность.'},{type:'ambiguous_wording',field:'conversation_result',summary_fragment:'Клиент ищет участок',problem:'Есть небольшая неясность.'}],explanation:'Есть второстепенная деталь.'};
    const validated=validateAgentUtilityJudgeOutput(judge,ctx);return {validated,output:agentUtilityRecalculate(validated,ctx)};
  })()`));
  expect(result.validated.problems.map((item: any) => item.type)).toEqual(["ambiguous_wording"]);
  expect(result.validated.missing_for_next_agent).toEqual([{ type: "working_context", description: "Второстепенную деталь можно уточнить по записи" }]);
  expect(result.output).toMatchObject({ status: "warning", can_continue_without_recording: true });
});

test("utility schema отклоняет отсутствующий fragment, CRM-card missing и component score вне диапазона", async ({ page }) => {
  await page.goto(moduleUrl);
  const errors = await page.evaluate(() => eval(`(() => {
    const summary={status:'GENERATED',conversation_result:'Клиент ищет участок.',key_facts:[],quotes:[],next_step:'Агент отправит подборку.',error:''};
    const ctx={summary,conversation_store:{conversation:{facts:[],requirements:[],attributes:{},call_results:[]}}};
    const base={status:'pass',score:100,can_continue_without_recording:true,context_clarity:100,actionability:100,scanability:100,recording_independence:100,missing_for_next_agent:[],useful_summary_elements:[],problems:[],explanation:'Всё понятно.'};
    const check=value=>{try{validateAgentUtilityJudgeOutput(value,ctx);return ''}catch(error){return error.message}};
    return {
      fragment:check({...base,useful_summary_elements:[{type:'goal',description:'Цель.',summary_fragment:'несуществующий фрагмент'}]}),
      phone:check({...base,missing_for_next_agent:[{type:'working_context',description:'Не указан телефон клиента'}]}),
      address:check({...base,missing_for_next_agent:[{type:'working_context',description:'Не указан адрес объекта'}]}),
      score:check({...base,scanability:101})
    };
  })()`));
  expect(errors.fragment).toContain("fragment is absent from summary");
  expect(errors.phone).toContain("CRM card data cannot be required");
  expect(errors.address).toContain("CRM card data cannot be required");
  expect(errors.score).toContain("expected number from 0 to 100");
});

test("этап полезности блокируется по dependency и сохраняет один repair retry", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(async () => {
    const stage={type:'check',outKey:'agent_utility_check',name:'Проверка полезности для агента',provider:'ai-tunnel',model:'deepseek-v3.2-exp',temperature:0,maxTokens:2500,prompt:MODULE_AGENT_UTILITY_PROMPT};
    const original=callModelWithTransientRetry;let blockedCalls=0;callModelWithTransientRetry=async()=>{blockedCalls++;throw new Error('must not call')};
    const blocked=await runStage(stage,{summary:{status:'GENERATED',conversation_result:'',key_facts:[],quotes:[],next_step:'',error:''},conversation_store:null,__transcript:'Клиент: тест'});
    const run='u-run',transcriptHash='u-tr',pipelineHash='u-pipe',storeHash='u-store';
    const summary={status:'GENERATED',conversation_result:'Клиент ищет участок.',key_facts:[],quotes:[],next_step:'Агент отправит подборку.',error:''};
    const ctx={summary,conversation_store:{status:'READY_WITH_WARNINGS',conversation:{facts:[],requirements:[],attributes:{},call_results:[]},provenance:{run_id:run,transcript_hash:transcriptHash,pipeline_configuration_hash:pipelineHash},store_meta:{conversation_store_hash:storeHash}},__run_id:run,__transcript_hash:transcriptHash,__pipeline_configuration_hash:pipelineHash,__summary_provenance:{run_id:run,transcript_hash:transcriptHash,pipeline_configuration_hash:pipelineHash,conversation_store_hash:storeHash},__transcript:'Клиент: Ищу участок. Агент: Отправлю подборку.'};
    const valid={status:'fail',score:1,can_continue_without_recording:false,context_clarity:100,actionability:100,scanability:100,recording_independence:100,missing_for_next_agent:[],useful_summary_elements:[{type:'goal',description:'Цель ясна.',summary_fragment:'Клиент ищет участок.'}],problems:[],explanation:'Полезно.'};
    let retryCalls=0;callModelWithTransientRetry=async()=>{retryCalls++;return {text:retryCalls===1?'{broken':JSON.stringify(valid),tokens:5,actualModel:'deepseek-v3.2-exp',actualProvider:'ai-tunnel'}};
    const repaired=await runStage(stage,ctx);callModelWithTransientRetry=original;return {blockedCalls,blocked,retryCalls,repaired};
  })()`));
  expect(result.blockedCalls).toBe(0);
  expect(result.blocked.output).toMatchObject({ status: "error", can_continue_without_recording: false });
  expect(result.retryCalls).toBe(2);
  expect(result.repaired).toMatchObject({ retry_count: 1, parseErr: null });
  expect(result.repaired.output).toMatchObject({ status: "pass", score: 100, can_continue_without_recording: true });
  expect(result.repaired.prompt_audit).toMatchObject({ transcript_present: true, transcript_injected: true });
});

test("этап №14 использует новый action contract и заданную модель", async ({ page }) => {
  await page.goto(moduleUrl);
  const stage = await page.evaluate(() => eval(`(() => {const item=pipeline.find(stage=>stage.outKey==='action_check');return item&&{name:item.name,type:item.type,outKey:item.outKey,provider:item.provider,model:item.model,temperature:item.temperature,maxTokens:item.maxTokens,prompt:item.prompt};})()`));
  expect(stage).toMatchObject({ name: "Проверка договорённостей и следующего шага", type: "check", outKey: "action_check", provider: "ai-tunnel", model: "gpt-5-mini", temperature: 0, maxTokens: 8000 });
  expect(stage.prompt).toContain("checked_components");
  expect(stage.prompt).toContain("proposal_as_agreement");
});

test("выбранный тип этапа проверки договорённостей сохраняется после перезагрузки", async ({ page }) => {
  await page.goto(moduleUrl);
  const actionStage = () => page.locator(".stage").filter({ hasText: "Проверка договорённостей и следующего шага" }).first();
  const openPipeline = () => page.locator("#pipelineToggle").click();

  await openPipeline();
  await actionStage().locator("[data-toggle]").click();
  await actionStage().locator("[data-type]").selectOption("code");
  await actionStage().locator("[data-toggle]").click();
  await actionStage().locator("[data-save]").click();
  await page.reload();
  await openPipeline();
  expect(await actionStage().locator("[data-type]").inputValue()).toBe("code");

  await actionStage().locator("[data-toggle]").click();
  await actionStage().locator("[data-type]").selectOption("check");
  await actionStage().locator("[data-toggle]").click();
  await actionStage().locator("[data-save]").click();
  await page.reload();
  await openPipeline();

  await expect(actionStage().locator(".st-type")).toHaveText("Проверщик");
  expect(await actionStage().locator("[data-type]").inputValue()).toBe("check");
  const savedStage = await page.evaluate(() => eval(`(() => {const item=pipeline.find(stage=>stage.outKey==='action_check');return item&&{type:item.type,typeEdited:item.typeEdited,codeFn:item.codeFn};})()`));
  expect(savedStage).toEqual({ type: "check", typeEdited: true });
});

test("пользовательские prompt и настройки модели сохраняются после reload и обновления конфигурации", async ({ page }) => {
  await page.goto(moduleUrl);
  const summaryStage = () => page.locator(".stage").filter({ hasText: "Генерация саммари" }).first();
  const openPipeline = () => page.locator("#pipelineToggle").click();
  const customPrompt = "ПОЛЬЗОВАТЕЛЬСКИЙ PROMPT: сохранять дословно после обновлений {{ctx.conversation_store}}";

  await openPipeline();
  await summaryStage().locator("[data-toggle]").click();
  await summaryStage().locator("[data-prompt]").fill(customPrompt);
  await summaryStage().locator("[data-provider]").selectOption("mock");
  await summaryStage().locator("[data-model]").selectOption("deepseek-v3.2-exp");
  await summaryStage().locator("[data-temperature]").fill("0.7");
  await summaryStage().locator("[data-max-tokens]").fill("3456");
  await summaryStage().locator("[data-save]").click();

  const saved = await page.evaluate(() => {
    const raw = localStorage.getItem("pipelineLabV3.pipelineConfig");
    const stage = raw && JSON.parse(raw).stages.find((item: any) => item.outKey === "summary");
    return stage && { prompt: stage.prompt, provider: stage.provider, model: stage.model, temperature: stage.temperature, maxTokens: stage.maxTokens, userEdited: stage.userEdited, contractVersion: stage.contractVersion };
  });
  expect(saved).toEqual({ prompt: customPrompt, provider: "mock", model: "deepseek-v3.2-exp", temperature: 0.7, maxTokens: 3456, userEdited: true, contractVersion: "transcription_summary_v1" });

  await page.reload();
  await openPipeline();
  await summaryStage().locator("[data-toggle]").click();
  await expect(summaryStage().locator("[data-prompt]")).toHaveValue(customPrompt);
  await expect(summaryStage().locator("[data-provider]")).toHaveValue("mock");
  await expect(summaryStage().locator("[data-model]")).toHaveValue("deepseek-v3.2-exp");
  await expect(summaryStage().locator("[data-temperature]")).toHaveValue("0.7");
  await expect(summaryStage().locator("[data-max-tokens]")).toHaveValue("3456");

  await page.evaluate(() => {
    const key = "pipelineLabV3.pipelineConfig";
    const envelope = JSON.parse(localStorage.getItem(key)!);
    envelope.version = 1;
    const stage = envelope.stages.find((item: any) => item.outKey === "summary");
    stage.promptVersion = 0;
    localStorage.setItem(key, JSON.stringify(envelope));
  });
  await page.reload();
  await openPipeline();
  await summaryStage().locator("[data-toggle]").click();
  await expect(summaryStage().locator("[data-prompt]")).toHaveValue(customPrompt);
  await expect(summaryStage().locator("[data-provider]")).toHaveValue("mock");
  await expect(summaryStage().locator("[data-model]")).toHaveValue("deepseek-v3.2-exp");
  await expect(summaryStage().locator("[data-temperature]")).toHaveValue("0.7");
  await expect(summaryStage().locator("[data-max-tokens]")).toHaveValue("3456");
});

test("эталонный next_step с видео и подборкой в MAX получает 100/pass", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const summary={status:'GENERATED',conversation_result:'Обсудили участок.',key_facts:[],quotes:[],next_step:'Агент отправит в MAX видеообзор объекта и подборку альтернативных участков под требования клиента',error:''};
    const agreements=[{id:'a1',action:'отправить видеообзор объекта',owner:'агент',recipient:'клиент',deadline:'',channel:'MAX',status:'promised',evidence:'Отправлю вам видеообзор в MAX'},{id:'a2',action:'отправить подборку альтернативных участков под требования клиента',owner:'агент',recipient:'клиент',deadline:'',channel:'MAX',status:'promised',evidence:'Также отправлю подборку альтернативных участков'}];
    const primary={action:'отправить видеообзор объекта и подборку альтернативных участков',owner:'агент',deadline:'',channel:'MAX',status:'promised',agreement_ids:['a1','a2']};
    const ctx={summary,conversation_store:{conversation:{call_results:['агент отправит материалы'],agreements,primary_next_step:primary}}};
    const judge={status:'fail',score:0,next_step_verified:false,agreements_checked:99,agreements_verified:0,agreements_rejected:99,checked_components:{action:false,owner:false,recipient:false,deadline:false,channel:false,status:false,sequence:false},errors:[],warnings:[],explanation:'Judge пытается подменить результат.'};
    const output=actionCheckRecalculate(validateActionCheckJudgeOutput(judge,ctx),ctx);return {output,html:renderActionCheckPanel(output)};
  })()`));
  expect(result.output).toMatchObject({ status: "pass", score: 100, next_step_verified: true, agreements_checked: 2, agreements_verified: 2, agreements_rejected: 0 });
  expect(Object.values(result.output.checked_components)).toEqual([true, true, true, true, true, true, true]);
  expect(result.html).toContain("Agreement status");
});

test("owner, channel и deadline сверяются со Store", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const run=(next,storeChannel='MAX')=>{const summary={status:'GENERATED',conversation_result:'Итог.',key_facts:[],quotes:[],next_step:next,error:''};const agreement={id:'a1',action:'отправить видео',owner:'агент',recipient:'клиент',deadline:'',channel:storeChannel,status:'promised',evidence:'Агент отправит видео в '+storeChannel};const ctx={summary,conversation_store:{conversation:{call_results:[],agreements:[agreement],primary_next_step:{action:'отправить видео',owner:'агент',deadline:'',channel:storeChannel,status:'promised',agreement_ids:['a1']}}}};const judge={status:'pass',score:100,next_step_verified:true,agreements_checked:0,agreements_verified:0,agreements_rejected:0,checked_components:{action:true,owner:true,recipient:true,deadline:true,channel:true,status:true,sequence:true},errors:[],warnings:[],explanation:'ok'};return actionCheckRecalculate(validateActionCheckJudgeOutput(judge,ctx),ctx)};
    return {correct:run('Агент отправит видео в MAX'),alias:run('Агент отправит видео в MAX','Макс'),owner:run('Клиент отправит видео в MAX'),channel:run('Агент отправит видео в WhatsApp'),deadline:run('Агент отправит видео в MAX завтра')};
  })()`));
  expect(result.correct).toMatchObject({ status: "pass", score: 100, next_step_verified: true });
  expect(result.alias).toMatchObject({ status: "pass", score: 100, next_step_verified: true });
  expect(result.owner).toMatchObject({ status: "fail", next_step_verified: false });
  expect(result.owner.errors).toContainEqual(expect.objectContaining({ type: "wrong_owner" }));
  expect(result.channel.errors).toContainEqual(expect.objectContaining({ type: "invented_channel" }));
  expect(result.deadline.errors).toContainEqual(expect.objectContaining({ type: "invented_deadline" }));
});

test("proposed, preliminary и promised нельзя завышать, confirmed проходит", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const run=(status,next,action='провести показ')=>{const summary={status:'GENERATED',conversation_result:'Итог.',key_facts:[],quotes:[],next_step:next,error:''};const agreement={id:'a1',action,owner:'агент',recipient:'клиент',deadline:'',channel:'',status,evidence:'Обсудили показ объекта'};const ctx={summary,conversation_store:{conversation:{call_results:[],agreements:[agreement],primary_next_step:{action,owner:'агент',deadline:'',channel:'',status,agreement_ids:['a1']}}}};const judge={status:'pass',score:100,next_step_verified:true,agreements_checked:0,agreements_verified:0,agreements_rejected:0,checked_components:{action:true,owner:true,recipient:true,deadline:true,channel:true,status:true,sequence:true},errors:[],warnings:[],explanation:'ok'};return actionCheckRecalculate(validateActionCheckJudgeOutput(judge,ctx),ctx)};
    return {proposed:run('proposed','Показ согласован'),preliminary:run('preliminary','Показ окончательно назначен'),confirmed:run('confirmed','Показ назначен'),promised:run('promised','Агент подготовил подборку','подготовить подборку'),readyBeforeCheck:run('promised','Подборка готова до проверки','проверить варианты и подготовить подборку')};
  })()`));
  expect(result.proposed.errors).toContainEqual(expect.objectContaining({ type: "proposal_as_agreement" }));
  expect(result.preliminary.errors).toContainEqual(expect.objectContaining({ type: "overstated_agreement" }));
  expect(result.confirmed).toMatchObject({ status: "pass", score: 100, next_step_verified: true });
  expect(result.promised.errors).toContainEqual(expect.objectContaining({ type: "completed_instead_of_promised" }));
  expect(result.readyBeforeCheck.errors).toContainEqual(expect.objectContaining({ type: "completed_instead_of_promised" }));
});

test("последовательность и критичные части primary action сохраняются, второстепенный agreement не требуется", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const run=(next,ids=['a1','a2'])=>{const summary={status:'GENERATED',conversation_result:'Итог.',key_facts:[],quotes:[],next_step:next,error:''};const agreements=[{id:'a1',action:'проверить варианты',owner:'агент',recipient:'клиент',deadline:'',channel:'',status:'promised',evidence:'Сначала проверю варианты'},{id:'a2',action:'отправить ссылку',owner:'агент',recipient:'клиент',deadline:'',channel:'',status:'promised',evidence:'Затем отправлю ссылку'},{id:'secondary',action:'позвонить коллегe',owner:'агент',recipient:'третье лицо',deadline:'',channel:'',status:'promised',evidence:'Позже позвоню коллеге'}];const ctx={summary,conversation_store:{conversation:{call_results:[],agreements,primary_next_step:{action:'проверить варианты и отправить ссылку',owner:'агент',deadline:'',channel:'',status:'promised',agreement_ids:ids}}}};const judge={status:'pass',score:100,next_step_verified:true,agreements_checked:0,agreements_verified:0,agreements_rejected:0,checked_components:{action:true,owner:true,recipient:true,deadline:true,channel:true,status:true,sequence:true},errors:[],warnings:[],explanation:'ok'};return actionCheckRecalculate(validateActionCheckJudgeOutput(judge,ctx),ctx)};
    return {ordered:run('Агент сначала проверит варианты, затем отправит ссылку'),reversed:run('Агент сначала отправит ссылку, затем проверит варианты'),missing:run('Агент проверит варианты')};
  })()`));
  expect(result.ordered).toMatchObject({ status: "pass", score: 100, agreements_checked: 2, agreements_verified: 2 });
  expect(result.reversed.errors).toContainEqual(expect.objectContaining({ type: "sequence_distortion" }));
  expect(result.missing.errors).toContainEqual(expect.objectContaining({ type: "missing_action_part" }));
  expect(result.ordered.agreements_checked).toBe(2);
});

test("secondary agreement вне primary_next_step не снижает action score", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const summary={status:'GENERATED',conversation_result:'Итог.',key_facts:[],quotes:[],next_step:'Агент отправит видео',error:''};const agreements=[{id:'primary',action:'отправить видео',owner:'агент',recipient:'клиент',deadline:'',channel:'',status:'promised',evidence:'Отправлю видео'},{id:'secondary',action:'позвонить коллеге',owner:'агент',recipient:'третье лицо',deadline:'',channel:'',status:'promised',evidence:'Позже позвоню коллеге'}];const ctx={summary,conversation_store:{conversation:{call_results:[],agreements,primary_next_step:{action:'отправить видео',owner:'агент',deadline:'',channel:'',status:'promised',agreement_ids:['primary']}}}};const warning={type:'agreement_not_reflected',field:'agreement',summary_fragment:'Агент отправит видео',problem:'Не отражён второстепенный звонок.',expected:'позвонить коллеге',evidence:'Позже позвоню коллеге'};const judge={status:'warning',score:85,next_step_verified:true,agreements_checked:2,agreements_verified:1,agreements_rejected:1,checked_components:{action:true,owner:true,recipient:true,deadline:true,channel:true,status:true,sequence:true},errors:[],warnings:[warning],explanation:'warning'};const validated=validateActionCheckJudgeOutput(judge,ctx);return {validated,output:actionCheckRecalculate(validated,ctx)};
  })()`));
  expect(result.validated.warnings).toEqual([]);
  expect(result.output).toMatchObject({ status: "pass", score: 100, agreements_checked: 1, agreements_verified: 1, agreements_rejected: 0 });
});

test("канонический primary action не требует повторять детализацию связанных agreements", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const next='отправить видео и скинуть ссылку на подбор (агент)';
    const agreements=[
      {id:'a1',action:'отправить видео',owner:'агент',recipient:'клиент',deadline:'после звонка',channel:'MAX',status:'confirmed',evidence:'Скину видео'},
      {id:'a2',action:'подготовить подборку вариантов',owner:'агент',recipient:'клиент',deadline:'после звонка',channel:'MAX',status:'confirmed',evidence:'Посмотрю, что есть'},
      {id:'a3',action:'скинуть ссылку на подбор',owner:'агент',recipient:'клиент',deadline:'после звонка',channel:'MAX',status:'confirmed',evidence:'Скину ссылку на подбор'}
    ];
    const ctx={summary:{status:'GENERATED',conversation_result:'Итог.',key_facts:[],quotes:[],next_step:next,error:''},conversation_store:{conversation:{call_results:[],agreements,primary_next_step:{action:next,owner:'агент',deadline:'после звонка',channel:'MAX',status:'confirmed',agreement_ids:['a1','a2','a3']}}}};
    return {issues:actionCheckCodeIssues(ctx),version:defaultPipeline().find(item=>item.outKey==='action_check').promptVersion};
  })()`));
  expect(result.version).toBe(6);
  expect(result.issues).toEqual([]);
});

test("общая фраза, missing next_step и not_defined обрабатываются кодом", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const judge={status:'pass',score:100,next_step_verified:true,agreements_checked:0,agreements_verified:0,agreements_rejected:0,checked_components:{action:true,owner:true,recipient:true,deadline:true,channel:true,status:true,sequence:true},errors:[],warnings:[],explanation:'ok'};
    const defined=next=>{const ctx={summary:{status:'GENERATED',conversation_result:'Итог.',key_facts:[],quotes:[],next_step:next,error:''},conversation_store:{conversation:{call_results:[],agreements:[{id:'a1',action:'отправить подборку',owner:'агент',recipient:'клиент',deadline:'',channel:'',status:'promised',evidence:'Отправлю подборку'}],primary_next_step:{action:'отправить подборку',owner:'агент',deadline:'',channel:'',status:'promised',agreement_ids:['a1']}}}};return actionCheckRecalculate(validateActionCheckJudgeOutput(judge,ctx),ctx)};
    const undefinedCtx={summary:{status:'GENERATED',conversation_result:'Итог.',key_facts:[],quotes:[],next_step:'Следующий шаг не согласован',error:''},conversation_store:{conversation:{call_results:[],agreements:[],primary_next_step:{action:'',owner:'',deadline:'',channel:'',status:'not_defined',agreement_ids:[]}}}};
    return {vague:defined('Будем на связи'),missing:defined('Следующий шаг не согласован'),notDefined:actionCheckRecalculate(validateActionCheckJudgeOutput(judge,undefinedCtx),undefinedCtx)};
  })()`));
  expect(result.vague.errors).toContainEqual(expect.objectContaining({ type: "missing_next_step" }));
  expect(result.missing.status).toBe("fail");
  expect(result.notDefined).toMatchObject({ status: "pass", score: 100, next_step_verified: true, agreements_checked: 0 });
});

test("пустой primary_next_step из Conversation Store нормализуется и не останавливает Action Check", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const run='report-97',tr='transcript-97',pipe='pipeline-97',storeHash='store-97';
    const summary={status:'GENERATED',conversation_result:'Итог.',key_facts:[],quotes:[],next_step:'Следующий шаг не согласован.',error:''};
    const conversation={call_results:[],agreements:[],primary_next_step:{}};
    const ctx={summary,conversation_store:{status:'MANUAL_REVIEW',conversation,provenance:{run_id:run,transcript_hash:tr,pipeline_configuration_hash:pipe},store_meta:{conversation_store_hash:storeHash,status:'MANUAL_REVIEW'}},__run_id:run,__transcript_hash:tr,__pipeline_configuration_hash:pipe,__summary_provenance:{run_id:run,transcript_hash:tr,pipeline_configuration_hash:pipe,conversation_store_hash:storeHash}};
    const malformed={...ctx,conversation_store:{...ctx.conversation_store,conversation:{...conversation,primary_next_step:{status:'promised'}}}};
    return {selected:actionCheckStore(ctx),dependency:actionCheckDependency(ctx),malformedDependency:actionCheckDependency(malformed)};
  })()`));
  expect(result.selected.primary_next_step).toEqual({ action: "", owner: "", deadline: "не определено", channel: "", status: "not_defined", agreement_ids: [] });
  expect(result.dependency).toBe("");
  expect(result.malformedDependency).toContain("agreement_ids: expected array");
});

test("action score/status/counts пересчитываются, semantic duplicate штрафуется один раз", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const summary={status:'GENERATED',conversation_result:'Итог.',key_facts:[],quotes:[],next_step:'Агент отправит видео в MAX',error:''};const agreement={id:'a1',action:'отправить видео',owner:'агент',recipient:'клиент',deadline:'',channel:'MAX',status:'promised',evidence:'Агент отправит видео в MAX'};const ctx={summary,conversation_store:{conversation:{call_results:[],agreements:[agreement],primary_next_step:{action:'отправить видео',owner:'агент',deadline:'',channel:'MAX',status:'promised',agreement_ids:['a1']}}}};
    const issue={type:'agreement_not_reflected',field:'agreement',summary_fragment:'Агент отправит видео в MAX',problem:'Второстепенная деталь agreement не отражена.',expected:'отправить видео',evidence:'Агент отправит видео в MAX'};
    const judge={status:'pass',score:100,next_step_verified:false,agreements_checked:9,agreements_verified:0,agreements_rejected:9,checked_components:{action:false,owner:false,recipient:false,deadline:false,channel:false,status:false,sequence:false},errors:[issue],warnings:[issue],explanation:'spoof'};
    return actionCheckRecalculate(validateActionCheckJudgeOutput(judge,ctx),ctx);
  })()`));
  expect(result).toMatchObject({ status: "warning", score: 85, next_step_verified: true, agreements_checked: 1, agreements_verified: 0, agreements_rejected: 1 });
  expect(result.warnings).toHaveLength(1);
});

test("Action Check принимает канонический составной шаг и восстанавливает связанные agreements", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const summary = {
      status: "GENERATED",
      conversation_result: "Итог.",
      key_facts: [],
      quotes: [],
      next_step: "агент отправит видео и подборку; клиент изучит присланные материалы; канал: MAX; дедлайн: после звонка; статус: preliminary",
      error: "",
    };
    const agreements = [
      { id: "agreement_1", action: "отправить видеообзор", owner: "агент", recipient: "клиент", deadline: "после звонка", channel: "MAX", status: "confirmed", evidence: "Скину вам видео в MAX." },
      { id: "agreement_2", action: "агент подготовит подборку", owner: "агент", recipient: "клиент", deadline: "после звонка", channel: "MAX", status: "confirmed", evidence: "Скину ссылку на подбор." },
      { id: "agreement_3", action: "агент отправит материалы", owner: "агент", recipient: "клиент", deadline: "после звонка", channel: "MAX", status: "confirmed", evidence: "Скину видео и ссылку." },
      { id: "agreement_4", action: "клиент изучит информацию", owner: "клиент", recipient: "агент", deadline: "не определено", channel: "", status: "promised", evidence: "Скиньте видео, я посмотрю." },
    ];
    const ctx = {
      summary,
      conversation_store: {
        conversation: {
          call_results: [],
          agreements,
          primary_next_step: {
            action: "агент отправит видео и подборку; клиент изучит присланные материалы",
            owner: "оба",
            deadline: "после звонка",
            channel: "MAX",
            status: "preliminary",
            agreement_ids: [],
          },
        },
      },
    };
    const recipientIssue = {
      type: "wrong_recipient",
      field: "recipient",
      summary_fragment: "агент отправит видео и подборку; клиент изучит присланные материалы",
      problem: "Получатели не указаны.",
      expected: "агент -> клиент; клиент -> агент",
      evidence: JSON.stringify(agreements[0]),
    };
    const judge = {
      status: "fail",
      score: 60,
      next_step_verified: false,
      agreements_checked: 4,
      agreements_verified: 3,
      agreements_rejected: 1,
      checked_components: { action: true, owner: true, recipient: false, deadline: true, channel: true, status: true, sequence: true },
      errors: [recipientIssue],
      warnings: [],
      explanation: "Ложная ошибка recipient.",
    };
    const validated = validateActionCheckJudgeOutput(judge, ctx);
    return { linked: actionCheckLinkedAgreements(actionCheckStore(ctx), ctx), output: actionCheckRecalculate(validated, ctx) };
  });

  expect(result.linked.map((item: any) => item.id)).toEqual(["agreement_1", "agreement_2", "agreement_3", "agreement_4"]);
  expect(result.output).toMatchObject({
    status: "pass",
    score: 100,
    next_step_verified: true,
    agreements_checked: 4,
    agreements_verified: 4,
    agreements_rejected: 0,
    checked_components: { recipient: true },
    errors: [],
  });
});

test("action schema проверяет fragment/evidence, удаляет out-of-scope и dependency ловит hash mismatch", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const summary={status:'GENERATED',conversation_result:'Итог.',key_facts:[],quotes:[],next_step:'Агент отправит видео',error:''};const conversation={call_results:[],agreements:[{id:'a1',action:'отправить видео',owner:'агент',recipient:'клиент',deadline:'',channel:'',status:'promised',evidence:'Агент отправит видео'}],primary_next_step:{action:'отправить видео',owner:'агент',deadline:'',channel:'',status:'promised',agreement_ids:['a1']}};const ctx={summary,conversation_store:{conversation}};
    const base={status:'pass',score:100,next_step_verified:true,agreements_checked:1,agreements_verified:1,agreements_rejected:0,checked_components:{action:true,owner:true,recipient:true,deadline:true,channel:true,status:true,sequence:true},errors:[],warnings:[],explanation:'ok'};
    const issue=(type,fragment,evidence)=>({type,field:'action',summary_fragment:fragment,problem:'Проблема.',expected:'отправить видео',evidence});const check=value=>{try{return {value:validateActionCheckJudgeOutput(value,ctx),error:''}}catch(error){return {error:error.message}}};
    const run='r',tr='t',pipe='p',storeHash='s';const mismatchCtx={summary,conversation_store:{status:'READY',conversation,provenance:{run_id:run,transcript_hash:tr,pipeline_configuration_hash:pipe},store_meta:{conversation_store_hash:storeHash}},__run_id:run,__transcript_hash:'other',__pipeline_configuration_hash:pipe,__summary_provenance:{run_id:run,transcript_hash:tr,pipeline_configuration_hash:pipe,conversation_store_hash:storeHash}};
    return {fragment:check({...base,errors:[issue('wrong_action','нет такого фрагмента','Агент отправит видео')]}),evidence:check({...base,errors:[issue('wrong_action','Агент отправит видео','нет такого evidence')]}),outscope:check({...base,errors:[issue('money_or_number_error','Агент отправит видео','Агент отправит видео')]}),dependency:actionCheckDependency(mismatchCtx)};
  })()`));
  expect(result.fragment.error).toContain("fragment is absent from summary.next_step");
  expect(result.evidence.error).toContain("evidence is absent from Conversation Store/transcript");
  expect(result.outscope.value.errors).toEqual([]);
  expect(result.dependency).toContain("stale run or transcript hash");
});

test("action stage не вызывает LLM при dependency error и делает один repair retry", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(async () => {
    const stage={type:'check',outKey:'action_check',name:'Проверка договорённостей и следующего шага',provider:'ai-tunnel',model:'deepseek-v3.2-exp',temperature:0,maxTokens:2500,prompt:MODULE_ACTION_CHECK_PROMPT};const original=callModelWithTransientRetry;let blockedCalls=0;callModelWithTransientRetry=async()=>{blockedCalls++;throw new Error('must not call')};const blocked=await runStage(stage,{summary:null,conversation_store:null,__transcript:'Клиент: тест'});
    const run='a-run',tr='a-tr',pipe='a-pipe',storeHash='a-store';const summary={status:'GENERATED',conversation_result:'Итог.',key_facts:[],quotes:[],next_step:'Агент отправит видео',error:''};const conversation={call_results:[],agreements:[{id:'a1',action:'отправить видео',owner:'агент',recipient:'клиент',deadline:'',channel:'',status:'promised',evidence:'Агент отправит видео'}],primary_next_step:{action:'отправить видео',owner:'агент',deadline:'',channel:'',status:'promised',agreement_ids:['a1']}};const ctx={summary,conversation_store:{status:'READY',conversation,provenance:{run_id:run,transcript_hash:tr,pipeline_configuration_hash:pipe},store_meta:{conversation_store_hash:storeHash}},__run_id:run,__transcript_hash:tr,__pipeline_configuration_hash:pipe,__summary_provenance:{run_id:run,transcript_hash:tr,pipeline_configuration_hash:pipe,conversation_store_hash:storeHash},__transcript:'Агент: Отправлю видео.'};const valid={status:'fail',score:0,next_step_verified:false,agreements_checked:0,agreements_verified:0,agreements_rejected:0,checked_components:{action:false,owner:false,recipient:false,deadline:false,channel:false,status:false,sequence:false},errors:[],warnings:[],explanation:'ok'};let retryCalls=0;callModelWithTransientRetry=async()=>{retryCalls++;return{text:retryCalls===1?'{broken':JSON.stringify(valid),tokens:5,actualModel:'deepseek-v3.2-exp',actualProvider:'ai-tunnel'}};const repaired=await runStage(stage,ctx);callModelWithTransientRetry=original;return{blockedCalls,blocked,retryCalls,repaired};
  })()`));
  expect(result.blockedCalls).toBe(0);
  expect(result.blocked.output).toMatchObject({ status: "error", next_step_verified: false });
  expect(result.retryCalls).toBe(2);
  expect(result.repaired).toMatchObject({ retry_count: 1, parseErr: null });
  expect(result.repaired.output).toMatchObject({ status: "pass", score: 100, next_step_verified: true });
});

test("этап №15 мигрирует из Code в Checker без дублей и изменения соседей", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const defaults=defaultPipeline(),stage=defaults.find(item=>item.outKey==='presentation_check');
    const source=[{id:'before',enabled:true,type:'llm',name:'До',outKey:'custom_before'},{id:'presentation',enabled:false,type:'code',vendor:'Code',name:'Проверка формата и правил',codeFn:'presentationCheck',outKey:'presentation_check',promptVersion:2,prompt:''},{id:'after',enabled:true,type:'code',name:'После',codeFn:'summaryQualityGate',outKey:'summary_quality_gate'}];
    const migrated=migratePipelineConfig(source,[]),target=migrated.find(item=>item.outKey==='presentation_check');
    return {stage,target,count:migrated.filter(item=>item.outKey==='presentation_check').length,before:migrated.find(item=>item.id==='before'),after:migrated.find(item=>item.id==='after')};
  })()`));
  expect(result.stage).toMatchObject({ name: "Проверка формата, структуры и краткости", type: "check", outKey: "presentation_check", provider: "ai-tunnel", model: "gpt-5-mini", temperature: 0, maxTokens: 8000 });
  expect(result.stage.codeFn).toBeUndefined();
  expect(result.target).toMatchObject({ id: "presentation", enabled: false, name: "Проверка формата, структуры и краткости", type: "check", outKey: "presentation_check" });
  expect(result.target.codeFn).toBeUndefined();
  expect(result.count).toBe(1);
  expect(result.before).toMatchObject({ id: "before", name: "До", outKey: "custom_before", type: "llm" });
  expect(result.after).toMatchObject({ id: "after", name: "Summary Quality Gate", outKey: "summary_quality_gate", codeFn: "summaryQualityGate" });
});

test("корректные summary, пустые списки и 3–4 key facts получают 100/pass", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const judge={status:'fail',score:0,structure_score:100,brevity_score:100,readability_score:100,repetition_score:100,limits_score:0,checks:{required_fields_present:false,conversation_result_valid:false,key_facts_valid:false,quotes_valid:false,next_step_valid:false,character_limit_valid:false,no_excessive_repetition:false,easy_to_scan:false},metrics:{total_characters:9999,conversation_result_characters:0,key_facts_count:99,quotes_count:99,next_step_characters:0,sentence_count:99},errors:[],warnings:[],explanation:'Judge tried to override result'};
    const summary=(facts=[],quotes=[])=>({status:'GENERATED',conversation_result:'Клиент выбирает участок для строительства дома.',key_facts:facts,quotes,next_step:'Агент отправит в MAX видеообзор объекта и подборку альтернативных участков под требования клиента.',error:''});
    const run=(value)=>presentationCheckRecalculate(validatePresentationJudgeOutput(judge,{summary:value}),{summary:value});
    const empty=run(summary()),three=run(summary([{label:'Бюджет',value:'до 12 млн рублей'},{label:'Площадь',value:'от 8 соток'},{label:'Локация',value:'Новорижское направление'}])),four=run(summary([{label:'Бюджет',value:'до 12 млн рублей'},{label:'Площадь',value:'от 8 соток'},{label:'Локация',value:'Новорижское направление'},{label:'Назначение',value:'ИЖС'}],['Нужен участок под дом']));
    return {empty,three,four,html:renderPresentationCheckPanel(four)};
  })()`));
  for (const output of [result.empty, result.three, result.four]) expect(output).toMatchObject({ status: "pass", score: 100, structure_score: 100, brevity_score: 100, readability_score: 100, repetition_score: 100, limits_score: 100 });
  expect(result.empty.metrics).toMatchObject({ key_facts_count: 0, quotes_count: 0 });
  expect(result.four.metrics).toMatchObject({ key_facts_count: 4, quotes_count: 1 });
  expect(result.html).toContain("Формат, структура и краткость");
  expect(result.html).toContain("Explanation");
});

test("лимиты key_facts, quotes и 1200 символов пересчитываются кодом", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const judge={status:'pass',score:100,structure_score:100,brevity_score:100,readability_score:100,repetition_score:100,limits_score:100,checks:{required_fields_present:true,conversation_result_valid:true,key_facts_valid:true,quotes_valid:true,next_step_valid:true,character_limit_valid:true,no_excessive_repetition:true,easy_to_scan:true},metrics:{total_characters:0,conversation_result_characters:0,key_facts_count:0,quotes_count:0,next_step_characters:0,sentence_count:0},errors:[],warnings:[],explanation:'ok'};
    const make=(result,facts=[],quotes=[])=>({status:'GENERATED',conversation_result:result,key_facts:facts,quotes,next_step:'Агент отправит материалы.',error:''});
    const run=(summary)=>presentationCheckRecalculate(validatePresentationJudgeOutput(judge,{summary}),{summary});
    const facts=Array.from({length:5},(_,index)=>({label:'Факт '+index,value:'Значение '+index}));
    return {five:run(make('Клиент выбирает участок.',facts)),threeQuotes:run(make('Клиент выбирает участок.',[],['Первая цитата','Вторая цитата','Третья цитата'])),within:run(make('А'.repeat(1070))),over:run(make('А'.repeat(1210)))};
  })()`));
  expect(result.five).toMatchObject({ status: "fail", checks: { key_facts_valid: false }, metrics: { key_facts_count: 5 } });
  expect(result.five.errors).toEqual(expect.arrayContaining([expect.objectContaining({ type: "too_many_key_facts" })]));
  expect(result.threeQuotes).toMatchObject({ status: "fail", checks: { quotes_valid: false }, metrics: { quotes_count: 3 } });
  expect(result.threeQuotes.errors).toEqual(expect.arrayContaining([expect.objectContaining({ type: "too_many_quotes" })]));
  expect(["pass", "warning"]).toContain(result.within.status);
  expect(result.within.metrics.total_characters).toBeGreaterThanOrEqual(1001);
  expect(result.within.metrics.total_characters).toBeLessThanOrEqual(1200);
  expect(result.over).toMatchObject({ status: "fail", limits_score: 0, checks: { character_limit_valid: false } });
  expect(result.over.errors).toEqual(expect.arrayContaining([expect.objectContaining({ type: "excessive_length" })]));
});

test("Presentation guards находят повторы, формальности, markdown и запрещённые значения", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const judge={status:'pass',score:100,structure_score:100,brevity_score:100,readability_score:100,repetition_score:100,limits_score:100,checks:{required_fields_present:true,conversation_result_valid:true,key_facts_valid:true,quotes_valid:true,next_step_valid:true,character_limit_valid:true,no_excessive_repetition:true,easy_to_scan:true},metrics:{total_characters:0,conversation_result_characters:0,key_facts_count:0,quotes_count:0,next_step_characters:0,sentence_count:0},errors:[],warnings:[],explanation:'ok'};
    const run=(summary)=>presentationCheckRecalculate(validatePresentationJudgeOutput(judge,{summary}),{summary});
    const make=(conversation_result,key_facts=[],next_step='Агент отправит материалы.',quotes=[])=>({status:'GENERATED',conversation_result,key_facts,quotes,next_step,error:''});
    return {
      repeated:run(make('Клиент выбирает участок в Истре. Клиент выбирает участок в Истре.')),
      moderate:run(make('Клиент выбирает участок в Истре.',[{label:'Локация',value:'Истра'}])),
      formal:run(make('По итогам разговора клиент выбирает участок.')),
      long:run(make('Клиент подробно описал требования к участку, инфраструктуре, расположению, подъездным путям, коммуникациям, соседям, форме участка, рельефу, расстоянию до города, транспортной доступности, документам, срокам сделки и дополнительным условиям, которые необходимо учитывать при подготовке материалов.')),
      heading:run(make('Ключевые факты: клиент выбирает участок.')),
      markdown:run(make('Клиент выбирает **участок**.')),
      forbidden:run(make('Клиент выбирает участок.',[{label:'Срок',value:'не определено'}])),
      duplicate:run(make('Клиент выбирает участок.',[{label:'Локация',value:'Истра'},{label:'Локация',value:'Истра'}])),
      empty:run(make('Клиент выбирает участок.',[{label:'',value:'Истра'}])),
      recommendation:run(make('Клиент выбирает участок.',[],'Рекомендуется агенту отправить материалы.')),
      longNext:run(make('Клиент выбирает участок.',[],'Агент отправит клиенту подробную подборку участков с описанием каждого варианта, приложит видеообзоры, планы, сведения о коммуникациях, документах, транспортной доступности и затем отдельно свяжется для обсуждения всех материалов и согласования дальнейших действий.'))
    };
  })()`));
  expect(result.repeated.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ type: "semantic_repetition" })]));
  expect(result.moderate.errors.concat(result.moderate.warnings).map((item: any) => item.type)).not.toContain("semantic_repetition");
  expect(result.formal).toMatchObject({ status: "warning" });
  expect(result.formal.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ type: "formal_intro" })]));
  expect(result.long.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ type: "long_sentence" })]));
  expect(result.heading.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ type: "heading_inside_value" })]));
  expect(result.markdown.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ type: "markdown_inside_value" })]));
  expect(result.forbidden).toMatchObject({ status: "fail" });
  expect(result.forbidden.errors).toEqual(expect.arrayContaining([expect.objectContaining({ type: "forbidden_value" })]));
  expect(result.duplicate.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ type: "duplicate_key_fact" })]));
  expect(result.empty).toMatchObject({ status: "fail", checks: { key_facts_valid: false } });
  expect(result.recommendation).toMatchObject({ status: "fail", checks: { next_step_valid: false } });
  expect(result.longNext.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ type: "next_step_not_concise" })]));
});

test("Judge оценивает перегруженность и связность, но не может подменить score/status", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const summary={status:'GENERATED',conversation_result:'Клиент выбирает участок. Дополнительные условия требуют уточнения.',key_facts:[],quotes:[],next_step:'Агент отправит материалы.',error:''};
    const base={status:'pass',score:100,structure_score:100,brevity_score:100,readability_score:100,repetition_score:100,limits_score:100,checks:{required_fields_present:true,conversation_result_valid:true,key_facts_valid:true,quotes_valid:true,next_step_valid:true,character_limit_valid:true,no_excessive_repetition:true,easy_to_scan:true},metrics:{total_characters:0,conversation_result_characters:0,key_facts_count:0,quotes_count:0,next_step_characters:0,sentence_count:0},errors:[],warnings:[],explanation:'ok'};
    const excessive={...base,warnings:[{type:'excessive_detail',field:'conversation_result',summary_fragment:'Дополнительные условия требуют уточнения.',problem:'Текст перегружен второстепенными деталями.'}]};
    const fragmented={...base,errors:[{type:'fragmented_text',field:'conversation_result',summary_fragment:'Клиент выбирает участок.',problem:'Факты перечислены бессвязно.'}],readability_score:60};
    const spoof={...base,status:'fail',score:0,limits_score:0};
    const outscope={...base,warnings:[{type:'unclear_wording',field:'conversation_result',summary_fragment:'Клиент выбирает участок.',problem:'Нужно проверить галлюцинацию и сумму бюджета.'}]};
    const run=(judge)=>presentationCheckRecalculate(validatePresentationJudgeOutput(judge,{summary}),{summary});
    return {excessive:run(excessive),fragmented:run(fragmented),spoof:run(spoof),outscope:run(outscope)};
  })()`));
  expect(result.excessive.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ type: "excessive_detail" })]));
  expect(result.fragmented).toMatchObject({ status: "fail", checks: { easy_to_scan: false } });
  expect(result.fragmented.errors).toEqual(expect.arrayContaining([expect.objectContaining({ type: "fragmented_text" })]));
  expect(result.spoof).toMatchObject({ status: "pass", score: 100, limits_score: 100 });
  expect(result.outscope).toMatchObject({ status: "pass", score: 100, errors: [], warnings: [] });
});

test("Presentation отбрасывает JSON-сериализацию вместо точного summary_fragment", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const summary={status:'GENERATED',conversation_result:'Клиент выбирает участок.',key_facts:[{label:'Площадь',value:'6'}],quotes:[],next_step:'Агент отправит материалы.',error:''};
    const judge={status:'warning',score:90,structure_score:100,brevity_score:100,readability_score:100,repetition_score:100,limits_score:100,checks:{required_fields_present:true,conversation_result_valid:true,key_facts_valid:true,quotes_valid:true,next_step_valid:true,character_limit_valid:true,no_excessive_repetition:true,easy_to_scan:true},metrics:{total_characters:0,conversation_result_characters:0,key_facts_count:0,quotes_count:0,next_step_characters:0,sentence_count:0},errors:[{type:'unclear_wording',field:'key_facts',summary_fragment:'\\"Площадь\\",\\"value\\":\\"6\\"',problem:'Сериализованный фрагмент.'}],warnings:[],explanation:'ok'};
    const validated=validatePresentationJudgeOutput(judge,{summary});
    return {validated,output:presentationCheckRecalculate(validated,{summary}),stage:defaultPipeline().find(item=>item.outKey==='presentation_check')};
  })()`));
  expect(result.validated.errors).toEqual([]);
  expect(result.output).toMatchObject({ status: "pass", score: 100 });
  expect(result.stage).toMatchObject({ promptVersion: 7 });
});

test("Presentation Judge не может объявить подтверждённый канал MAX запрещённым значением", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const summary={status:'GENERATED',conversation_result:'Клиент выбирает участок.',key_facts:[{label:'Предпочитаемый канал связи',value:'MAX'}],quotes:[],next_step:'Агент отправит материалы в MAX.',error:''};
    const issue={type:'forbidden_value',field:'key_facts',summary_fragment:'MAX',problem:'Неоднозначное значение канала.'};
    const judge={status:'fail',score:0,structure_score:100,brevity_score:100,readability_score:85,repetition_score:100,limits_score:100,checks:{required_fields_present:true,conversation_result_valid:true,key_facts_valid:true,quotes_valid:true,next_step_valid:true,character_limit_valid:true,no_excessive_repetition:true,easy_to_scan:true},metrics:{total_characters:0,conversation_result_characters:0,key_facts_count:0,quotes_count:0,next_step_characters:0,sentence_count:0},errors:[issue],warnings:[],explanation:'MAX ошибочно признан запрещённым.'};
    const validated=validatePresentationJudgeOutput(judge,{summary});
    const output=presentationCheckRecalculate(validated,{summary});
    const stage=defaultPipeline().find(item=>item.outKey==='presentation_check');
    return {validated,output,stage:{promptVersion:stage.promptVersion,prompt:stage.prompt}};
  })()`));
  expect(result.validated.errors).toEqual([]);
  expect(result.output).toMatchObject({ status: "pass", score: 100, errors: [] });
  expect(result.stage.promptVersion).toBe(7);
  expect(result.stage.prompt).toContain("канал MAX, не являются запрещёнными");
});

test("schema и run/hash mismatch блокируют Presentation LLM", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(async () => {
    const stage={type:'check',outKey:'presentation_check',name:'Проверка формата, структуры и краткости',provider:'ai-tunnel',model:'deepseek-v3.2-exp',temperature:0,maxTokens:2500,prompt:MODULE_PRESENTATION_CHECK_PROMPT};
    const summary={status:'GENERATED',conversation_result:'Клиент выбирает участок.',key_facts:[],quotes:[],next_step:'Агент отправит материалы.',error:''};
    const ctx={summary,conversation_store:{store_meta:{status:'READY',conversation_store_hash:'store-hash'},provenance:{run_id:'run-2',transcript_hash:'tr',pipeline_configuration_hash:'pipe'}},__run_id:'run-1',__transcript_hash:'tr',__pipeline_configuration_hash:'pipe',__summary_provenance:{run_id:'run-1',transcript_hash:'tr',pipeline_configuration_hash:'pipe',conversation_store_hash:'store-hash'}};
    const original=callModelWithTransientRetry;let calls=0;callModelWithTransientRetry=async()=>{calls++;throw new Error('must not call')};
    const mismatch=await runStage(stage,ctx),invalid=await runStage(stage,{...ctx,summary:{...summary,next_step:null}});callModelWithTransientRetry=original;
    return {mismatch,invalid,calls};
  })()`));
  expect(result.calls).toBe(0);
  expect(result.mismatch.output).toMatchObject({ status: "error", score: 0 });
  expect(result.mismatch.output.explanation).toContain("stale run");
  expect(result.invalid.output).toMatchObject({ status: "error", score: 0 });
  expect(result.invalid.output.explanation).toContain("next_step: expected string, received null");
});

test("Presentation Judge принимает только разрешённые issue type и точный fragment", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const summary={status:'GENERATED',conversation_result:'Клиент выбирает участок.',key_facts:[],quotes:[],next_step:'Агент отправит материалы.',error:''};
    const base={status:'pass',score:100,structure_score:100,brevity_score:100,readability_score:100,repetition_score:100,limits_score:100,checks:{required_fields_present:true,conversation_result_valid:true,key_facts_valid:true,quotes_valid:true,next_step_valid:true,character_limit_valid:true,no_excessive_repetition:true,easy_to_scan:true},metrics:{total_characters:0,conversation_result_characters:0,key_facts_count:0,quotes_count:0,next_step_characters:0,sentence_count:0},errors:[],warnings:[],explanation:'ok'};
    const check=(issue)=>{try{return{value:validatePresentationJudgeOutput({...base,warnings:[issue]},{summary}),error:''}}catch(error){return{error:error.message}}};
    return {unknown:check({type:'hallucination',field:'conversation_result',summary_fragment:'Клиент выбирает участок.',problem:'Неизвестный тип.'}),fragment:check({type:'unclear_wording',field:'conversation_result',summary_fragment:'нет такого текста',problem:'Фраза неясна.'}),serialized:check({type:'unclear_wording',field:'conversation_result',summary_fragment:'{"conversation_result":"Клиент выбирает участок."}',problem:'Модель вернула JSON-фрагмент.'}),valid:check({type:'unclear_wording',field:'conversation_result',summary_fragment:'Клиент выбирает участок.',problem:'Фраза неясна.'})};
  })()`));
  expect(result.unknown.error).toContain("unknown presentation issue type");
  expect(result.fragment.error).toContain("fragment is absent from summary");
  expect(result.serialized.value.warnings).toEqual([]);
  expect(result.valid.value.warnings).toEqual([expect.objectContaining({ type: "unclear_wording" })]);
});

test("Summary Quality Gate считает ровно пять критериев с весами 30/25/20/15/10", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate((fixture) => eval(`(() => {
    ${fixture}
    const perfect=moduleSummaryQualityGateV1(qgContext());
    const all96=qgContext();qgKeys.forEach(key=>all96[key].score=96);const auto96=moduleSummaryQualityGateV1(all96);
    const one88=qgContext();qgWarning(one88,'truth_check',88);const warning96=moduleSummaryQualityGateV1(one88);
    const all92=qgContext();qgKeys.forEach(key=>qgWarning(all92,key,92));const warning92=moduleSummaryQualityGateV1(all92);
    const all89=qgContext();qgKeys.forEach(key=>qgWarning(all89,key,89));const review89=moduleSummaryQualityGateV1(all89);
    const one79=qgContext();qgFail(one79,'presentation_check',79);const review79=moduleSummaryQualityGateV1(one79);
    const weighted=qgContext();weighted.truth_check.score=96.3;weighted.critical_completeness_check.score=95.7;qgWarning(weighted,'agent_utility_check',94.2);qgWarning(weighted,'action_check',93.6);qgWarning(weighted,'presentation_check',92.4);const rounded=moduleSummaryQualityGateV1(weighted);
    const confidenceA=qgContext(),confidenceB=qgContext();qgKeys.forEach(key=>{confidenceA[key].confidence=.01;confidenceB[key].confidence=.99});confidenceA.fact_check.score=100;confidenceA.need_check={score:100,rejected_attributes:[]};confidenceA.outcome_check.score=100;confidenceB.fact_check.score=0;confidenceB.need_check={score:0,rejected_attributes:[]};confidenceB.outcome_check.score=0;
    const viaStage=CODE_FUNCS.summaryQualityGate({codeFn:'summaryQualityGate',outKey:'summary_quality_gate'},qgContext());
    return {perfect,auto96,warning96,warning92,review89,review79,rounded,viaStage,ignoredA:moduleSummaryQualityGateV1(confidenceA),ignoredB:moduleSummaryQualityGateV1(confidenceB)};
  })()`), qualityGateFixture);
  expect(result.perfect).toMatchObject({ status: "AUTO_SAVE", decision: "AUTO_SAVE", summary_quality_score: 100, can_save_to_crm: true, requires_manual_review: false });
  expect(Object.keys(result.perfect.criteria)).toEqual(["truthfulness", "critical_completeness", "agent_utility", "action_quality", "presentation_quality"]);
  expect(Object.values(result.perfect.criteria).map((item: any) => item.weight)).toEqual([0.3, 0.25, 0.2, 0.15, 0.1]);
  expect(result.auto96).toMatchObject({ decision: "AUTO_SAVE", summary_quality_score: 96 });
  expect(result.warning96).toMatchObject({ decision: "SAVE_WITH_WARNING", summary_quality_score: 96.4, can_save_to_crm: true });
  expect(result.warning92).toMatchObject({ decision: "SAVE_WITH_WARNING", summary_quality_score: 92 });
  expect(result.review89).toMatchObject({ decision: "REVIEW_REQUIRED", summary_quality_score: 89, can_save_to_crm: false, requires_manual_review: true });
  expect(result.review79).toMatchObject({ decision: "REVIEW_REQUIRED" });
  expect(result.rounded.summary_quality_score).toBe(94.9);
  expect(result.rounded.criteria.truthfulness.weighted_score).toBeCloseTo(28.89, 3);
  expect(result.viaStage).toMatchObject({ isSummaryQualityGate: true, status: "ok", output: { decision: "AUTO_SAVE", summary_quality_score: 100 } });
  expect(result.ignoredA.summary_quality_score).toBe(result.ignoredB.summary_quality_score);
  expect(result.ignoredA.decision).toBe(result.ignoredB.decision);
});

test("Quality Gate применяет hard stops независимо от высокого общего score", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate((fixture) => eval(`(() => {
    ${fixture}
    const run=mutate=>{const ctx=qgContext();qgKeys.forEach(key=>ctx[key].score=99);mutate(ctx);return moduleSummaryQualityGateV1(ctx)};
    const hallucination=run(ctx=>{ctx.truth_check.status='fail';ctx.truth_check.has_hallucinations=true;ctx.truth_check.critical_errors=[{type:'hallucination',field:'conversation_result',problem:'Галлюцинация.'}]});
    const wrongNext=run(ctx=>{ctx.action_check.status='fail';ctx.action_check.next_step_verified=false;ctx.action_check.errors=[{type:'missing_next_step',field:'next_step',problem:'Шаг отсутствует.'}]});
    const pii=run(ctx=>{ctx.truth_check.status='fail';ctx.truth_check.has_pii=true;ctx.truth_check.critical_errors=[{type:'pii_exposure',field:'conversation_result',problem:'PII.'}]});
    const cannotContinue=run(ctx=>{ctx.agent_utility_check.status='fail';ctx.agent_utility_check.can_continue_without_recording=false;ctx.agent_utility_check.problems=[{type:'recording_required',problem:'Нужна запись.'}]});
    const invalidStructure=run(ctx=>{ctx.presentation_check.status='fail';ctx.presentation_check.errors=[{type:'invalid_structure',field:'conversation_result',problem:'Структура нарушена.'}];ctx.presentation_check.checks.required_fields_present=false});
    const tooLong=run(ctx=>{ctx.presentation_check.status='fail';ctx.presentation_check.errors=[{type:'excessive_length',field:'root',problem:'Более 1200 символов.'}];ctx.presentation_check.metrics.total_characters=1201;ctx.presentation_check.checks.character_limit_valid=false});
    const duplicate=run(ctx=>{ctx.action_check.status='fail';ctx.action_check.errors=[{type:'invented_deadline',field:'deadline',problem:'Срок придуман.'},{type:'invented_deadline',field:'deadline',problem:'Срок придуман повторно.'}]});
    const warning=run(ctx=>{qgWarning(ctx,'presentation_check',98)});
    return {hallucination,wrongNext,pii,cannotContinue,invalidStructure,tooLong,duplicate,warning};
  })()`), qualityGateFixture);
  expect(result.hallucination).toMatchObject({ decision: "REVIEW_REQUIRED", summary_quality_score: 89 });
  expect(result.hallucination.hard_stops.map((item: any) => item.code)).toContain("HALLUCINATION");
  expect(result.wrongNext.hard_stops.map((item: any) => item.code)).toEqual(expect.arrayContaining(["WRONG_NEXT_STEP", "MISSING_CRITICAL_NEXT_STEP"]));
  expect(result.pii.hard_stops.map((item: any) => item.code)).toContain("PII_EXPOSURE");
  expect(result.cannotContinue.hard_stops.map((item: any) => item.code)).toContain("CANNOT_CONTINUE_WITHOUT_RECORDING");
  expect(result.invalidStructure.hard_stops.map((item: any) => item.code)).toContain("INVALID_SUMMARY_STRUCTURE");
  expect(result.tooLong.hard_stops.map((item: any) => item.code)).toContain("SUMMARY_TOO_LONG");
  expect(result.duplicate.hard_stops.filter((item: any) => item.code === "INVENTED_DEADLINE")).toHaveLength(1);
  // 2026-07-21 калибровка: один мелкий некритичный warning у судьи, отличного
  // от Truth (здесь presentation_check), при score>=85 по каждому критерию и
  // score>=90 суммарно теперь допускается AUTO_SAVE -- раньше любой единственный
  // warning у любого судьи навсегда блокировал AUTO_SAVE, из-за чего порог был
  // почти недостижим на живых прогонах (см. golden dataset в
  // tests/smoke/quality-gate-golden-dataset.spec.ts).
  expect(result.warning).toMatchObject({ decision: "AUTO_SAVE", hard_stops: [] });
  expect(result.warning.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ source: "presentation_check", type: "minor_warning" })]));
});

test("Quality Gate отклоняет ошибочные, неполные и stale результаты проверщиков", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate((fixture) => eval(`(() => {
    ${fixture}
    const execute=mutate=>{const ctx=qgContext();mutate(ctx);return moduleSummaryQualityGateV1(ctx)};
    const checkerError=execute(ctx=>{ctx.truth_check.status='error';ctx.truth_check.score=0;ctx.truth_check.explanation='Сбой проверщика.'});
    const missing=execute(ctx=>{delete ctx.agent_utility_check});
    const invalidScore=execute(ctx=>{ctx.action_check.score=101});
    const inconsistent=execute(ctx=>{ctx.truth_check.critical_errors=[{type:'fact_distortion',problem:'Ошибка при pass.'}]});
    const staleRun=execute(ctx=>{ctx.__stage_provenance.truth_check.run_id='old-run'});
    const staleTranscript=execute(ctx=>{ctx.__stage_provenance.action_check.transcript_hash='old-transcript'});
    const staleStore=execute(ctx=>{ctx.__stage_provenance.presentation_check.conversation_store_hash='old-store'});
    const stalePipeline=execute(ctx=>{ctx.__stage_provenance.critical_completeness_check.pipeline_configuration_hash='old-pipeline'});
    const missingExecution=execute(ctx=>{delete ctx.__stage_provenance.agent_utility_check.stage_execution_id});
    const missingProvenance=execute(ctx=>{ctx.__stage_provenance={}});
    const summaryError=execute(ctx=>{ctx.summary.status='ERROR'});
    const storeError=execute(ctx=>{ctx.conversation_store.store_meta.status='TECHNICAL_ERROR'});
    const hashA=moduleSummaryQualityGateV1(qgContext()).metadata.quality_gate_hash;
    const hashB=moduleSummaryQualityGateV1(qgContext()).metadata.quality_gate_hash;
    const changed=qgContext();changed.truth_check.score=99;const hashC=moduleSummaryQualityGateV1(changed).metadata.quality_gate_hash;
    return {checkerError,missing,invalidScore,inconsistent,staleRun,staleTranscript,staleStore,stalePipeline,missingExecution,missingProvenance,summaryError,storeError,hashA,hashB,hashC};
  })()`), qualityGateFixture);
  for (const key of ["checkerError", "missing", "invalidScore", "inconsistent", "staleRun", "staleTranscript", "staleStore", "stalePipeline", "missingExecution", "missingProvenance", "summaryError", "storeError"] as const) {
    expect(result[key]).toMatchObject({ status: "TECHNICAL_ERROR", decision: "TECHNICAL_ERROR", summary_quality_score: null, weighted_quality_score: null, effective_quality_score: null, can_save_to_crm: false, requires_manual_review: false });
  }
  expect(result.checkerError.technical_errors.map((item: any) => item.code)).toContain("CHECKER_STATUS_ERROR");
  expect(result.missing.technical_errors.map((item: any) => item.code)).toContain("MISSING_CHECK_RESULT");
  expect(result.invalidScore.technical_errors.map((item: any) => item.code)).toContain("INVALID_CHECK_SCORE");
  expect(result.inconsistent.technical_errors.map((item: any) => item.code)).toContain("CHECKER_OUTPUT_INCONSISTENT");
  for (const key of ["staleRun", "staleTranscript", "staleStore", "stalePipeline", "missingExecution", "missingProvenance"] as const) {
    expect(result[key].technical_errors.map((item: any) => item.code)).toContain("STALE_OR_FOREIGN_CHECK_RESULT");
  }
  expect(result.hashA).toBe(result.hashB);
  expect(result.hashC).not.toBe(result.hashA);
});

test("Quality Gate разделяет политику Summary и проверенных атрибутов", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate((fixture) => eval(`(() => {
    ${fixture}
    const readyWarnings=qgContext();readyWarnings.conversation_store.store_meta.status='READY_WITH_WARNINGS';const warning=moduleSummaryQualityGateV1(readyWarnings);
    const storeReview=qgContext();storeReview.conversation_store.store_meta.status='MANUAL_REVIEW';const storeManual=moduleSummaryQualityGateV1(storeReview);
    const summaryReview=qgContext();summaryReview.summary.status='MANUAL_REVIEW';const summaryManual=moduleSummaryQualityGateV1(summaryReview);
    const lowFunding=qgContext();lowFunding.conversation_store.conversation.attributes.funding_source.confidence=.7;const low=moduleSummaryQualityGateV1(lowFunding);
    const disputedFunding=qgContext();disputedFunding.need_check.rejected_attributes=[{attribute:'funding_source',disputed:true}];const disputed=moduleSummaryQualityGateV1(disputedFunding);
    const emptyInterest=qgContext();emptyInterest.conversation_store.conversation.attributes.interest=[];const empty=moduleSummaryQualityGateV1(emptyInterest);
    const perfect=moduleSummaryQualityGateV1(qgContext());
    const html=renderSummaryQualityPanel(perfect);
    const rootKeys=Object.keys(perfect);
    const hasNull=JSON.stringify(perfect).includes(':null');
    return {warning,storeManual,summaryManual,low,disputed,empty,perfect,html,rootKeys,hasNull};
  })()`), qualityGateFixture);
  expect(result.warning).toMatchObject({ decision: "SAVE_WITH_WARNING", store_status: "READY_WITH_WARNINGS", can_save_to_crm: true });
  expect(result.storeManual).toMatchObject({ decision: "REVIEW_REQUIRED", can_save_to_crm: false, requires_manual_review: true });
  expect(result.storeManual.hard_stops.map((item: any) => item.code)).toContain("STORE_MANUAL_REVIEW");
  expect(result.summaryManual.hard_stops.map((item: any) => item.code)).toContain("SUMMARY_MANUAL_REVIEW");
  expect(result.low.crm_write_policy).toMatchObject({ summary: "AUTO_SAVE", attributes: { funding_source: "DO_NOT_SAVE", purchase_term: "SAVE" } });
  expect(result.disputed.crm_write_policy.attributes.funding_source).toBe("REVIEW_REQUIRED");
  expect(result.empty.crm_write_policy.attributes.interest).toBe("DO_NOT_SAVE");
  expect(result.perfect.crm_write_policy.attributes.purchase_term).toBe("SAVE");
  expect(result.rootKeys).toEqual(["status", "summary_quality_score", "weighted_quality_score", "effective_quality_score", "confidence", "decision", "criteria", "thresholds", "hard_stops", "warnings", "technical_errors", "can_save_to_crm", "requires_manual_review", "summary_status", "store_status", "explanation", "crm_write_policy", "metadata"]);
  expect(result.hasNull).toBe(false);
  for (const text of ["Summary Quality Score", "Decision", "Можно сохранить в CRM", "Ручная проверка", "Достоверность", "Полнота критически важной информации", "Полезность для агента", "Договорённости и следующий шаг", "Формат, структура и краткость", "Weighted score", "Hard stops", "Warnings", "Technical errors", "CRM write policy", "Funding source", "Purchase term", "Explanation"]) {
    expect(result.html).toContain(text);
  }
});

test("решение Summary Quality Gate однозначно управляет CRM stage", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate((fixture) => eval(`(() => {
    ${fixture}
    const conversation={facts:{goal:{value:'покупка',verified:true}},needs:{interest:{value:'Строительство',verified:true}},outcome:{next_step:{value:'Агент отправит материалы',verified:true}}};
    const summary={summary:'Клиент выбирает участок.',semantic_coverage_preserved:true};
    const run=gate=>CODE_FUNCS.crm({}, {conversation,summary,summary_quality_gate:gate}).output;
    const auto=moduleSummaryQualityGateV1(qgContext());
    const reviewCtx=qgContext();qgFail(reviewCtx,'action_check',70);reviewCtx.action_check.next_step_verified=false;const review=moduleSummaryQualityGateV1(reviewCtx);
    const technicalCtx=qgContext();technicalCtx.truth_check.status='error';technicalCtx.truth_check.score=0;technicalCtx.truth_check.explanation='Сбой.';const technical=moduleSummaryQualityGateV1(technicalCtx);
    return {auto:run(auto),review:run(review),technical:run(technical)};
  })()`), qualityGateFixture);
  expect(result.auto).toMatchObject({ saved: true, draft: false, publish_decision: "SAVED" });
  expect(result.review).toMatchObject({ saved: false, draft: true, publish_decision: "DEFERRED" });
  expect(result.technical).toMatchObject({ card: null, saved: false, draft: false, execution_status: "ERROR", publish_decision: "BLOCKED" });
});

test("CRM v1 сохраняет только разрешённые Summary и verified attributes", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate((fixture) => eval(`(() => {
    ${fixture}
    CRM_IDEMPOTENCY_RESULTS.clear();CRM_RECORD_STATE.clear();
    let writes=0,queues=0,autoPayload=null,warningPayload=null,reviewItem=null;
    const adapterFor=capture=>({write(payload){writes++;capture(payload);return{id:payload.crm_record_id,request_id:payload.audit.crm_request_id}},queueReview(item){queues++;reviewItem=item;return{id:item.crm_record_id,request_id:item.audit.crm_request_id,review_item_id:'review-1'}}});
    const autoCtx=crmContext('crm-auto');autoCtx.facts={fake:'не использовать'};autoCtx.needs={funding_source:'из summary'};autoCtx.outcome={fake:'не использовать'};autoCtx.__crm_adapter=adapterFor(value=>autoPayload=value);const auto=moduleCrmV1(autoCtx);
    const warningCtx=crmContext('crm-warning');qgWarning(warningCtx,'presentation_check',92);crmRefreshGate(warningCtx);warningCtx.__crm_adapter=adapterFor(value=>warningPayload=value);const warning=moduleCrmV1(warningCtx);
    const reviewCtx=crmContext('crm-review');qgFail(reviewCtx,'action_check',70);reviewCtx.action_check.next_step_verified=false;crmRefreshGate(reviewCtx);reviewCtx.__crm_adapter=adapterFor(()=>{});const review=moduleCrmV1(reviewCtx);
    const technicalCtx=crmContext('crm-technical');technicalCtx.truth_check.status='error';technicalCtx.truth_check.score=0;technicalCtx.truth_check.explanation='Сбой.';crmRefreshGate(technicalCtx);technicalCtx.__crm_adapter=adapterFor(()=>{});const technical=moduleCrmV1(technicalCtx);
    const missingCtx=crmContext('crm-missing');delete missingCtx.summary_quality_gate;missingCtx.__crm_adapter=adapterFor(()=>{});const missing=moduleCrmV1(missingCtx);
    const skipCtx=crmContext('crm-skip');skipCtx.summary_quality_gate.crm_write_policy.summary='DO_NOT_SAVE';crmResignGate(skipCtx);skipCtx.__crm_adapter=adapterFor(()=>{});const skipped=moduleCrmV1(skipCtx);
    const emptyCtx=crmContext('crm-empty-blocks');emptyCtx.summary.key_facts=[];emptyCtx.summary.quotes=[];crmResignGate(emptyCtx);let emptyPayload;emptyCtx.__crm_adapter=adapterFor(value=>emptyPayload=value);const empty=moduleCrmV1(emptyCtx);
    return {auto,warning,review,technical,missing,skipped,empty,writes,queues,autoPayload,warningPayload,reviewItem,emptyPresentation:emptyPayload.presentation_text};
  })()`), crmFixture);
  expect(result.auto).toMatchObject({ status: "SAVED", decision: "AUTO_SAVE", summary_write: { attempted: true, saved: true, mode: "AUTO_SAVE", warning_flag: false }, attribute_writes: { interest: { saved: true, value: ["Строительство"] }, funding_source: { saved: true, value: "наличные / депозит" }, purchase_term: { saved: true, value: "не определено" } } });
  // 2026-07-21 калибровка: единственный некритичный warning у presentation_check
  // (score 92, всё остальное чисто) теперь укладывается в допуск AUTO_SAVE
  // (см. комментарий у SUMMARY_QUALITY_GATE_THRESHOLDS) -- warnings в выдаче
  // CRM при этом никуда не исчезают, только меняется decision/status/флаг.
  expect(result.warning).toMatchObject({ status: "SAVED", decision: "AUTO_SAVE", summary_write: { saved: true, warning_flag: false } });
  expect(result.warning.warnings.length).toBeGreaterThan(0);
  expect(result.review).toMatchObject({ status: "QUEUED_FOR_REVIEW", summary_write: { attempted: false, saved: false } });
  expect(result.technical).toMatchObject({ status: "TECHNICAL_ERROR", summary_write: { attempted: false, saved: false } });
  expect(result.missing.errors[0].code).toBe("MISSING_QUALITY_GATE");
  expect(result.skipped).toMatchObject({ status: "SKIPPED", summary_write: { attempted: false, saved: false, mode: "DO_NOT_SAVE" } });
  expect(result.writes).toBe(3);
  expect(result.queues).toBe(1);
  expect(result.autoPayload.summary).toEqual({ conversation_result: "Клиент выбирает участок.", key_facts: [], quotes: [], next_step: "Агент отправит материалы." });
  expect(result.autoPayload.attributes).toEqual({ interest: ["Строительство"], funding_source: "наличные / депозит", purchase_term: "не определено" });
  expect(JSON.stringify(result.autoPayload)).not.toContain("не использовать");
  expect(result.reviewItem).toMatchObject({ crm_record_id: "crm-review", run_id: "qg-run", summary_quality_score: 89 });
  expect(result.empty).toMatchObject({ status: "SAVED" });
  expect(result.emptyPresentation).not.toContain("Ключевые факты");
  expect(result.emptyPresentation).not.toContain("Важная цитата");
  expect(result.emptyPresentation).toBe("Итог разговора\n\nКлиент выбирает участок.\n\nДоговорённости и следующий шаг\n\nАгент отправит материалы.");
});

test("CRM v1 блокирует stale outputs, изменённые hashes, PII, null и неизвестные enum", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate((fixture) => eval(`(() => {
    ${fixture}
    CRM_IDEMPOTENCY_RESULTS.clear();let calls=0;const adapter={write(){calls++;return{id:'unexpected'}},queueReview(){calls++;return{review_item_id:'unexpected'}}};
    const run=mutate=>{const ctx=crmContext('guard-'+String(calls)+'-'+Math.random());ctx.__crm_adapter=adapter;mutate(ctx);return moduleCrmV1(ctx)};
    const staleRun=run(ctx=>{ctx.summary_quality_gate.metadata.run_id='old-run'});
    const staleTranscript=run(ctx=>{ctx.summary_quality_gate.metadata.transcript_hash='old-transcript'});
    const storeHash=run(ctx=>{ctx.conversation_store.store_meta.conversation_store_hash='old-store'});
    const stalePipeline=run(ctx=>{ctx.__stage_provenance.summary.pipeline_configuration_hash='old-pipeline'});
    const summaryHash=run(ctx=>{ctx.summary.conversation_result='Изменённое summary.'});
    const gateHash=run(ctx=>{ctx.summary_quality_gate.metadata.quality_gate_hash='tampered'});
    const gateOutput=run(ctx=>{ctx.summary_quality_gate.warnings.push({source:'x',type:'x',message:'tampered'})});
    const pii=run(ctx=>{ctx.summary.conversation_result='Телефон +7 999 123-45-67';crmResignGate(ctx)});
    const nullValue=run(ctx=>{ctx.conversation_store.conversation.attributes.funding_source.value=null;crmUpdateStoreHash(ctx);crmRefreshGate(ctx)});
    const unknown=run(ctx=>{ctx.conversation_store.conversation.attributes.purchase_term.value='2-3 месяца';crmUpdateStoreHash(ctx);crmRefreshGate(ctx)});
    const forbidden=run(ctx=>{ctx.summary_quality_gate.can_save_to_crm=false;crmResignGate(ctx)});
    return {staleRun,staleTranscript,storeHash,stalePipeline,summaryHash,gateHash,gateOutput,pii,nullValue,unknown,forbidden,calls};
  })()`), crmFixture);
  for (const key of ["staleRun", "staleTranscript", "stalePipeline"] as const) expect(result[key].errors[0].code).toBe("STALE_OR_FOREIGN_OUTPUT");
  expect(result.storeHash.errors[0].code).toBe("STORE_HASH_MISMATCH");
  expect(result.summaryHash.errors[0].code).toBe("SUMMARY_HASH_MISMATCH");
  expect(result.gateHash.errors[0].code).toBe("QUALITY_GATE_HASH_MISMATCH");
  expect(result.gateOutput.errors[0].code).toBe("QUALITY_GATE_HASH_MISMATCH");
  expect(result.pii.errors[0].code).toBe("PII_IN_SUMMARY");
  expect(result.nullValue.errors[0].code).toBe("NULL_OR_UNDEFINED_IN_PAYLOAD");
  expect(result.unknown.errors[0].code).toBe("UNKNOWN_CRM_ENUM");
  expect(result.forbidden.errors[0].code).toBe("QUALITY_GATE_SAVE_NOT_ALLOWED");
  expect(result.calls).toBe(0);
});

test("CRM v1 независимо применяет attribute policies и защищает ручные значения", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate((fixture) => eval(`(() => {
    ${fixture}
    CRM_IDEMPOTENCY_RESULTS.clear();const payloads={};
    const adapter=key=>({write(payload){payloads[key]=payload;return{id:payload.crm_record_id,request_id:payload.audit.crm_request_id}},queueReview(){throw new Error('unexpected')}});
    const multipleCtx=crmContext('attr-multiple');multipleCtx.conversation_store.conversation.attributes.interest.push({value:'Ипотека',confidence:.97,evidence:'Клиент: Ипотека одобрена',source_fact_ids:['fact_2'],source:'need_check',verification_status:'verified'});crmUpdateStoreHash(multipleCtx);crmRefreshGate(multipleCtx);multipleCtx.__crm_adapter=adapter('multiple');const multiple=moduleCrmV1(multipleCtx);
    const emptyCtx=crmContext('attr-empty');emptyCtx.conversation_store.conversation.attributes.interest=[];crmUpdateStoreHash(emptyCtx);crmRefreshGate(emptyCtx);emptyCtx.__crm_adapter=adapter('empty');const empty=moduleCrmV1(emptyCtx);
    const disputedCtx=crmContext('attr-disputed');disputedCtx.summary_quality_gate.crm_write_policy.attributes.funding_source='REVIEW_REQUIRED';crmResignGate(disputedCtx);disputedCtx.__crm_adapter=adapter('disputed');const disputed=moduleCrmV1(disputedCtx);
    const manualCtx=crmContext('attr-manual');manualCtx.__crm_current_record.manual_fields=['funding_source'];manualCtx.__crm_current_record.attribute_sources.funding_source='manual';manualCtx.__crm_adapter=adapter('manual');const manual=moduleCrmV1(manualCtx);
    const conflictCtx=crmContext('attr-conflict');conflictCtx.__crm_expected_revision=1;conflictCtx.__crm_adapter=adapter('conflict');const conflict=moduleCrmV1(conflictCtx);
    const partialCtx=crmContext('attr-partial');partialCtx.__crm_adapter={write(payload){return{id:payload.crm_record_id,field_results:{summary:{saved:true},interest:{saved:true},funding_source:{saved:false},purchase_term:{saved:true}}}}};const partial=moduleCrmV1(partialCtx);
    let historyPayload;const historyCtx=crmContext('attr-history');historyCtx.__crm_adapter={write(payload){historyPayload=payload;return{id:payload.crm_record_id}}};const history=moduleCrmV1(historyCtx);
    return {multiple,empty,disputed,manual,conflict,partial,history,payloads,historyPayload};
  })()`), crmFixture);
  expect(result.multiple.attribute_writes.interest).toMatchObject({ attempted: true, saved: true, value: ["Строительство", "Ипотека"] });
  expect(result.payloads.multiple.attributes.interest).toEqual(["Строительство", "Ипотека"]);
  expect(result.empty).toMatchObject({ status: "SAVED", attribute_writes: { interest: { policy: "DO_NOT_SAVE", attempted: false, saved: false, value: [] } } });
  expect(result.payloads.empty.attributes).not.toHaveProperty("interest");
  expect(result.disputed.attribute_writes.funding_source).toMatchObject({ policy: "REVIEW_REQUIRED", attempted: false, saved: false });
  expect(result.payloads.disputed.attributes).not.toHaveProperty("funding_source");
  expect(result.manual.warnings.map((item: any) => item.code)).toContain("MANUAL_VALUE_PRESERVED");
  expect(result.payloads.manual.attributes).not.toHaveProperty("funding_source");
  expect(result.conflict).toMatchObject({ status: "CRM_ERROR", summary_write: { attempted: false, saved: false } });
  expect(result.conflict.errors[0].code).toBe("CRM_CONFLICT");
  expect(result.partial).toMatchObject({ status: "CRM_ERROR", summary_write: { attempted: true, saved: false } });
  expect(result.partial.errors[0].code).toBe("PARTIAL_WRITE");
  expect(result.history).toMatchObject({ status: "SAVED" });
  expect(result.historyPayload).toMatchObject({ previous_summary_version: "summary_v0", history: { previous_summary_version: "summary_v0", previous_summary: { conversation_result: "Предыдущее summary." } } });
});

test("CRM v1 обеспечивает idempotency и retry только временных ошибок", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate((fixture) => eval(`(() => {
    ${fixture}
    CRM_IDEMPOTENCY_RESULTS.clear();
    let replayCalls=0;const replayAdapter={write(payload){replayCalls++;return{id:payload.crm_record_id,request_id:'request-replay'}}};const replayCtx=crmContext('retry-replay');replayCtx.__crm_adapter=replayAdapter;const first=moduleCrmV1(replayCtx),replay=moduleCrmV1(replayCtx);const changedCtx=crmContext('retry-replay');changedCtx.summary.conversation_result='Другое проверенное summary.';crmResignGate(changedCtx);changedCtx.__crm_adapter=replayAdapter;const changedReplay=moduleCrmV1(changedCtx);
    const transient=(record,status,failures)=>{let calls=0,waits=[];const ctx=crmContext(record);ctx.__crm_retry_wait=ms=>waits.push(ms);ctx.__crm_adapter={write(payload){calls++;if(calls<=failures){const error=new Error(status===0?'network timeout':'temporary');error.status=status;throw error}return{id:payload.crm_record_id}}};const output=moduleCrmV1(ctx);return{output,calls,waits}};
    const permanent=(record,status)=>{let calls=0;const ctx=crmContext(record);ctx.__crm_adapter={write(){calls++;const error=new Error('permanent');error.status=status;throw error}};return{output:moduleCrmV1(ctx),calls}};
    const timeout=transient('retry-timeout',0,2),limited=transient('retry-429',429,1),badRequest=permanent('retry-400',400),forbidden=permanent('retry-403',403),conflict=permanent('retry-409',409);
    let missingCalls=0;const missingCtx=crmContext('retry-no-id');missingCtx.__crm_adapter={write(){missingCalls++;return{request_id:'without-id'}}};const missingId=moduleCrmV1(missingCtx);
    return {first,replay,changedReplay,replayCalls,timeout,limited,badRequest,forbidden,conflict,missingId,missingCalls};
  })()`), crmFixture);
  expect(result.first.status).toBe("SAVED");
  expect(result.replay.status).toBe("SAVED");
  expect(result.replayCalls).toBe(1);
  expect(result.replay.warnings.map((item: any) => item.code)).toContain("IDEMPOTENT_REPLAY");
  expect(result.changedReplay.warnings.map((item: any) => item.code)).toContain("RUN_ALREADY_SAVED");
  expect(result.timeout).toMatchObject({ output: { status: "SAVED" }, calls: 3, waits: [100, 200] });
  expect(result.limited).toMatchObject({ output: { status: "SAVED" }, calls: 2, waits: [100] });
  for (const key of ["badRequest", "forbidden", "conflict"] as const) expect(result[key]).toMatchObject({ output: { status: "CRM_ERROR" }, calls: 1 });
  expect(result.conflict.output.errors[0].code).toBe("CRM_CONFLICT");
  expect(result.missingId).toMatchObject({ status: "CRM_ERROR", summary_write: { attempted: true, saved: false } });
  expect(result.missingId.errors[0].code).toBe("CRM_RESPONSE_ID_MISSING");
  expect(result.missingCalls).toBe(1);
});

test("CRM v1 возвращает строгий audit-контракт и раскрывает его в UI", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate((fixture) => eval(`(() => {
    ${fixture}
    CRM_IDEMPOTENCY_RESULTS.clear();const ctx=crmContext('crm-ui');ctx.__crm_stage_execution_id='qg-run:17:crm';ctx.__crm_adapter={write(payload){return{id:payload.crm_record_id,request_id:'crm-request-ui'}}};const stage={codeFn:'crm',outKey:'crm',name:'Сохранение в CRM'},report=CODE_FUNCS.crm(stage,ctx),output=report.output,html=renderReport(stage,report,17).outerHTML;
    const stoppedHtml=renderReport(stage,{output:{status:'NOT_RUN',decision:'NOT_RUN'},metrics:[],checks:[]},17).outerHTML;
    return {output,html,stoppedHtml,rootKeys:Object.keys(output),auditKeys:Object.keys(output.audit),hasNull:JSON.stringify(output).includes(':null')};
  })()`), crmFixture);
  expect(result.output).toMatchObject({ status: "SAVED", crm_record_id: "crm-ui", quality: { summary_quality_score: 100, quality_gate_decision: "AUTO_SAVE", warning_count: 0, hard_stop_count: 0 }, audit: { run_id: "qg-run", stage_execution_id: "qg-run:17:crm", call_id: "call-1", transcript_hash: "qg-transcript", conversation_store_hash: expect.any(String), pipeline_configuration_hash: "qg-pipeline", crm_request_id: "crm-request-ui", saved_at: "2026-07-21T10:00:00.000Z", actor: "AI_PIPELINE" }, errors: [], warnings: [] });
  expect(result.rootKeys).toEqual(["status", "decision", "crm_record_id", "summary_write", "attribute_writes", "quality", "audit", "errors", "warnings"]);
  expect(result.auditKeys).toEqual(["run_id", "stage_execution_id", "call_id", "transcript_hash", "conversation_store_hash", "summary_hash", "quality_gate_hash", "pipeline_configuration_hash", "crm_request_id", "saved_at", "idempotency_key", "pipeline_version", "prompt_version", "model_id", "summary_quality_score", "decision", "warning_count", "hard_stop_count", "attribute_changes", "actor"]);
  expect(result.hasNull).toBe(false);
  for (const text of ["Status", "CRM record", "Summary saved", "Save mode", "Warning flag", "Interest policy/result", "Funding source policy/result", "Purchase term policy/result", "Summary Quality Score", "Quality Gate decision", "Idempotency", "CRM request ID", "Saved at", "Errors", "Warnings"]) expect(result.html).toContain(text);
  expect(result.html).not.toContain("Карточка создана");
  expect(result.stoppedHtml).toContain("NOT_RUN");
  expect(result.stoppedHtml).toContain("Summary saved");
  expect(result.stoppedHtml).not.toContain("JSON получен");
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
  expect(result.store).toMatchObject({ quality: { decision: "DEPENDENCY_ERROR" }, errors: [{ code: "MISSING_DEPENDENCY", path: "ctx.fact_check" }] });
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
  expect(result.incomplete.semantic_coverage_preserved).toBe(true);
  expect(result.incomplete.missing_after_shortening).toEqual([]);
  expect(result.summaryPrompt).toContain("ОБЯЗАТЕЛЬНЫЕ ФАКТЫ ПОСЛЕ ПРОВЕРКИ КАЧЕСТВА");
  expect(result.summaryPrompt).toContain("Есть основная сумма");
  expect(result.factPrompt).not.toContain("при малейшем сомнении снижать оценку");
  expect(result.factPrompt).toContain("АКТИВНЫЙ КОНТРАКТ FACT JUDGE ИМЕЕТ ПРИОРИТЕТ");
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
    return {retry,calls,summary:ctx.summary,gate:ctx.quality_gate,publish:ctx.publish_result,reports:reports.map(item=>({key:item.stage.outKey,retry:item.report.retry_attempt,outputRetry:item.report.output&&item.report.output.retry_attempt}))};
  })()`));

  expect(result.retry.attempted).toBe(true);
  expect(result.calls).toEqual(["summary", "truth_check", "quality_gate", "publish_result"]);
  expect(result.summary.summary).toContain("Финансовая ситуация");
  expect(result.gate.decision).toBe("AUTO_SAVE");
  expect(result.publish.saved).toBe(true);
  expect(result.reports.every((report: { retry?: number }) => report.retry === 1)).toBe(true);
  expect(result.reports.every((report: { outputRetry?: number }) => report.outputRetry === undefined)).toBe(true);
});

test("технически невалидный quality-retry сохраняет последнюю валидную версию", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(async () => {
    localStorage.setItem('pipelineLabV3.openaiApiKey','test-key');
    const validSummary={status:'GENERATED',conversation_result:'Клиент ищет участок.',key_facts:[],quotes:[],next_step:'Агент отправит подборку.',error:''};
    const originalGate={decision:'REVIEW_REQUIRED',store_status:'READY_WITH_WARNINGS',summary_status:'GENERATED',technical_errors:[],hard_stops:[],warnings:[{message:'Стилистическое замечание'}]};
    ctx={summary:validSummary,summary_quality_gate:originalGate,__latest_summary_quality_gate:originalGate};
    const active=[{outKey:'summary',type:'llm',name:'Summary'},{outKey:'truth_check',type:'check',name:'Truth'},{outKey:'summary_quality_gate',type:'code',name:'Gate'},{outKey:'publish_result',type:'code',codeFn:'crm',name:'CRM'}];
    const reports=active.map(stage=>({stage,report:{output:stage.outKey==='summary'?validSummary:stage.outKey==='summary_quality_gate'?originalGate:{status:'pass'},status:'ok',meta:{score:95}}}));
    const originalRunStage=runStage;const calls=[];
    runStage=async stage=>{calls.push(stage.outKey);if(stage.outKey==='summary')return {output:{status:'technical_error',error_code:'SUMMARY_INVALID_OUTPUT'},status:'bad',parseErr:'TRUNCATED_JSON',tokens:10,cost:.01};if(stage.outKey==='publish_result')return {output:{status:'QUEUED_FOR_REVIEW'},status:'attn'};throw new Error('downstream retry must not run');};
    const retry=await retrySummaryQualityFlow(active,reports);runStage=originalRunStage;
    return {retry,calls,summary:ctx.summary,gate:ctx.summary_quality_gate,summaryReport:reports.find(item=>item.stage.outKey==='summary').report,publishReport:reports.find(item=>item.stage.outKey==='publish_result').report};
  })()`));
  expect(result.retry).toMatchObject({ attempted: true });
  expect(result.retry.reason).toContain("RETRY_TECHNICAL_ROLLBACK");
  expect(result.calls).toEqual(["summary", "publish_result"]);
  expect(result.summary).toMatchObject({ status: "GENERATED", conversation_result: "Клиент ищет участок." });
  expect(result.gate).toMatchObject({ decision: "REVIEW_REQUIRED" });
  expect(result.summaryReport).toMatchObject({ status: "ok", output: { status: "GENERATED" } });
  expect(result.publishReport).toMatchObject({ status: "attn", output: { status: "QUEUED_FOR_REVIEW" } });
});

test("Conversation Store отклоняет legacy-входы без обязательных verified-блоков", async ({ page }) => {
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
  expect(result.store).toMatchObject({ quality: { decision: "DEPENDENCY_ERROR" }, errors: [{ code: "MISSING_DEPENDENCY", path: "ctx.fact_check" }] });
  expect(JSON.stringify(result.store.conversation)).not.toContain("PASS");
  expect(JSON.stringify(result.store.conversation)).not.toContain("79990000000");
});

test("Presentation применяет единый максимум 1200", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => ({
    target:CODE_FUNCS.presentationCheck({}, {summary:{summary:'А'.repeat(1120)+'\\nСледующий шаг: звонок'}}).output,
    maximum:CODE_FUNCS.presentationCheck({}, {summary:{summary:'А'.repeat(1210)+'\\nСледующий шаг: звонок'}}).output
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

test("неполные legacy-проверки не создают READY Store", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => CODE_FUNCS.conversationStore({}, {
    __transcript:'У нас есть основная сумма, и мы чуть-чуть добираемся.',
    validation:{score:.94},
    fact_judge:{decision:'FAIL'},
    need_judge:{decision:'FAIL'},
    outcome_judge:{decision:'FAIL'}
  }).output)()`));
  expect(result).toMatchObject({ quality: { decision: "DEPENDENCY_ERROR" }, errors: [{ code: "MISSING_DEPENDENCY", path: "ctx.fact_check" }] });
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

test("LLM-извлечение не получает искусственную оценку до независимой проверки", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const reports=[
      {stage:{type:'code',outKey:'validation',codeFn:'validate',name:'Валидация'},report:{status:'ok',output:{score:.99,decision:'PASS'}}},
      {stage:{type:'llm',outKey:'facts',name:'Факты'},report:{status:'ok',output:{facts:[{confidence:.97}]}}},
      {stage:{type:'hybrid',outKey:'fact_judge',name:'Проверка фактов'},report:{status:'ok',output:{score:94,decision:'PASS',verified_facts:[{confidence:.96}]}}},
      {stage:{type:'llm',outKey:'needs',name:'Потребности'},report:{status:'ok',output:{requirements:[{confidence:.95}]}}},
      {stage:{type:'hybrid',outKey:'need_judge',name:'Проверка потребностей'},report:{status:'ok',output:{score:96,decision:'PASS',verified_requirements:[{confidence:.94}]}}},
      {stage:{type:'code',outKey:'conversation',codeFn:'conversationStore',name:'Store'},report:{status:'ok',output:{quality:{store_score:.925},facts:[{confidence:.95}]}}},
      {stage:{type:'llm',outKey:'summary',name:'Summary'},report:{status:'ok',output:{summary:'Готово',semantic_coverage_preserved:true}}},
      {stage:{type:'check',outKey:'truth_check',name:'Truth'},report:{status:'ok',output:{score:91,decision:'PASS'}}},
      {stage:{type:'code',outKey:'quality_gate',name:'Gate'},report:{status:'warn',output:{summary_quality_score:84,decision:'REVIEW_REQUIRED'}}},
      {stage:{type:'code',outKey:'publish_result',name:'Publish'},report:{status:'warn',output:{saved:false,draft:true}}},
      {stage:{type:'llm',outKey:'failed_step',name:'Ошибка модели'},report:{status:'bad',error:'model unavailable',output:{status:'technical_error',decision:'ERROR'}}}
    ];
    reports.forEach(item=>{ item.report.meta=buildStageMeta(item.stage,item.report); });
    const immediate=reports.map(item=>({outKey:item.stage.outKey,score:item.report.meta.score,confidence:item.report.meta.confidence}));
    attachReviewerScores(reports);
    return {immediate,final:reports.map(item=>({outKey:item.stage.outKey,score:item.report.meta.score,confidence:item.report.meta.confidence,evaluation:item.report.evaluation,metrics:item.report.metrics}))};
  })()`));
  expect(result.immediate.filter((item: any) => !["conversation", "failed_step", "facts", "needs"].includes(item.outKey)).every((item: any) => item.score != null && item.confidence != null)).toBe(true);
  expect(result.immediate.find((item: any) => item.outKey === "conversation")).toMatchObject({ confidence: null });
  expect(result.immediate.find((item: any) => item.outKey === "facts")).toMatchObject({ score: null, confidence: 0.97 });
  expect(result.immediate.find((item: any) => item.outKey === "needs")).toMatchObject({ score: null, confidence: null });
  expect(result.immediate.find((item: any) => item.outKey === "summary")).toMatchObject({ score: 35, confidence: 0.35 });
  expect(result.final.filter((item: any) => !["conversation", "failed_step"].includes(item.outKey)).every((item: any) => item.score != null && item.confidence != null)).toBe(true);
  expect(result.final.find((item: any) => item.outKey === "facts")).toMatchObject({ score: 94, confidence: 0.97 });
  expect(result.final.find((item: any) => item.outKey === "facts")).toMatchObject({
    evaluation: { status: "pass", score: 94, decision: "PASS", source_stage: "fact_judge", source_stage_name: "Проверка фактов" },
    metrics: expect.arrayContaining([["Итоговая оценка", 94], ["Источник оценки", "Проверка фактов"]]),
  });
  expect(result.final.find((item: any) => item.outKey === "needs")).toMatchObject({
    score: 96,
    confidence: 0.96,
    evaluation: { status: "pass", score: 96, decision: "PASS", source_stage: "need_judge", source_stage_name: "Проверка потребностей" },
    metrics: expect.arrayContaining([["Итоговая оценка", 96], ["Источник оценки", "Проверка потребностей"]]),
  });
  expect(result.final.find((item: any) => item.outKey === "summary")).toMatchObject({ score: 84, confidence: 0.84 });
  expect(result.final.find((item: any) => item.outKey === "failed_step")).toMatchObject({ score: null, confidence: null });
});

test("итоговое Summary разделяет текст, факты с цитатами и следующий шаг, а потребности читает из справочника", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const summary='Клиент планирует покупку квартиры. Ключевые факты: • Тип запроса: просмотр — «Посмотреть хотелось бы. • » • Источник средств: ипотека — «В ипотеку предполагаем, да». • Дата просмотра: 14 июля после 18:30 — «четырнадцатого. • после 18:30» • » • Подтверждение: агент перезвонит во вторник в 13:00 — «подтвержу во вторник» • Источник средств: ипотека — «В ипотеку предполагаем, да». Договорённости / следующий шаг: агент перезвонит во вторник в 13:00 для подтверждения просмотра.';
    const sections=summaryDisplaySections(summary);
    const canonical=canonicalSummaryFormat(summary);
    ctx={publish_result:{card:{interested_in:['Ипотека'],source_of_funds:'ипотека в процессе',purchase_timeline:'до 1 месяца',property_requirements:{rooms:['2 комнаты']}}}};
    const needs=displayNeeds();
    const mortgageProcess=mortgageFundingFromText('Клиент: В ипотеку предполагаем, да.');
    const mortgageApproved=mortgageFundingFromText('Клиент: Ипотека уже одобрена банком.');
    const published=CODE_FUNCS.crm({}, {__transcript:'Клиент: В ипотеку предполагаем, да.',conversation:{facts:{goal:{value:'покупка',verified:true}},needs:{need_1:{value:'просмотр',verified:true}},crm_needs:{interested_in:['Ипотека'],source_of_funds:'не определено'},outcome:{next_step:{value:'перезвонить',verified:true}}},summary:{summary:'Покупка с ипотекой.',semantic_coverage_preserved:true},quality_gate:{decision:'AUTO_SAVE',summary_quality_score:95}}).output;
    return {sections,canonical,needs,mortgageProcess,mortgageApproved,published,html:renderFinalSummary(canonical),finalRenderer:renderFinal.toString()};
  })()`));
  expect(result.sections.main).toBe("Клиент планирует покупку квартиры.");
  expect(result.sections.facts).toHaveLength(3);
  expect(result.sections.facts).not.toContain("»");
  expect(result.sections.facts.filter((item: string) => item.includes("Источник средств"))).toHaveLength(1);
  expect(result.sections.facts.some((item: string) => item.includes("Подтверждение"))).toBe(false);
  expect(result.canonical).toContain("\n• Источник средств: ипотека");
  expect(result.canonical).toContain("\nДоговорённости / следующий шаг:");
  expect(result.needs).toMatchObject({ interested_in: ["Ипотека"], source_of_funds: "ипотека в процессе", timeline: "до 1 месяца" });
  expect(result.mortgageProcess).toBe("ипотека в процессе");
  expect(result.mortgageApproved).toBe("ипотека одобрена");
  expect(result.published.card.source_of_funds).toBe("ипотека в процессе");
  expect(result.html).toContain("Ключевые факты и цитаты");
  expect(result.html).toContain("Договорённости / следующий шаг:");
  expect(result.finalRenderer).not.toContain("Требования:");
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
  expect(result.store).toMatchObject({ quality: { decision: "DEPENDENCY_ERROR" }, errors: [{ code: "MISSING_DEPENDENCY", path: "ctx.fact_check" }] });
  expect(result.shortened.final_length).toBeLessThanOrEqual(800);
  expect(result.shortened.summary).toContain("Договорённости / следующий шаг:");
  expect(result.shortened.missing_after_shortening).toEqual([]);
  expect(result.truth).toMatchObject({ score: 90, status: "pass", decision: "PASS", has_fact_distortions: false, critical_errors: [] });
  expect(result.critical).toMatchObject({ score: 100, status: "pass", decision: "PASS", missed_critical_facts: [] });
});

test("production regression 44 сохраняет подтверждённый срок покупки и данные Need Judge", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const transcript='Клиент: У меня сейчас на вкладах всё лежит, проценты терять не хочу. Сделка через два месяца, ориентировочно хочу выйти на сделку в середине сентября. Буду брать ипотеку в банке.';
    const rawNeeds={crm_needs:{interested_in:['Новостройки','Ипотека'],source_of_funds:'не определено',purchase_timeline:'2–3 месяца'},needs:[
      {category:'финансы',type:'источник средств',value:'деньги на вкладах',confidence:.96,speaker:'Клиент',evidence:'на вкладах всё лежит',verification_status:'pending'},
      {category:'срок',type:'покупка',value:'середина сентября, через два месяца',confidence:.96,speaker:'Клиент',evidence:'сделка через два месяца',verification_status:'pending'}
    ]};
    const code=moduleGenericCheck('needs',rawNeeds);
    const judged=mergeNeedCheck(code,{verified_needs:[{category:'способ оплаты',description:'наличные',citation:'на вкладах всё лежит'},{category:'срок',description:'покупка',citation:'сделка через два месяца'}],failed_needs:[],missed_needs:[],crm_validation:{interested_in:'PASS',source_of_funds:'PASS',purchase_timeline:'PASS'},scores:{overall:90},decision:'WARNING'},null,rawNeeds,transcript);
    const store=CODE_FUNCS.conversationStore({}, {__transcript:transcript,validation:{score:.99},fact_judge:{verified_facts:[{category:'Срок',type:'сделка',value:'через два месяца',confidence:.96,evidence:'сделка через два месяца'}],scores:{overall:90},decision:'PASS'},need_judge:judged,needs:rawNeeds,outcome_judge:{verified_outcome:{next_step:{value:'выйти на сделку',confidence:.95,evidence:'выйти на сделку в середине сентября'}},scores:{overall:90},decision:'PASS'},outcome:{next_step:{value:'выйти на сделку',confidence:.95,evidence:'выйти на сделку в середине сентября'}}}).output;
    const longSummary=('Клиент планирует покупку новостройки с привлечением ипотеки и хочет безопасно оформить сделку. '.repeat(8))+'Ключевые факты и цитаты: • Деньги находятся на вкладах — «на вкладах всё лежит». • Срок сделки — через два месяца — «в середине сентября». • Требуется проверка договора. • Клиент опасается мошенников. Договорённости / следующий шаг: клиент планирует выйти на сделку в середине сентября.';
    const shortened=semanticShortenSummary(longSummary,{__transcript:transcript,needs:rawNeeds,conversation:store,outcome:{next_step:{value:'выйти на сделку'}}},800,800);
    return {judged,store,shortened,cash:hasExplicitCashEvidence(transcript),timeline:purchaseTimelineFromText(transcript),runStageSource:runStage.toString()};
  })()`));

  expect(result.judged.verified_needs).toHaveLength(2);
  expect(result.store).toMatchObject({ quality: { decision: "DEPENDENCY_ERROR" }, errors: [{ code: "MISSING_DEPENDENCY", path: "ctx.fact_check" }] });
  expect(result.cash).toBe(true);
  expect(result.timeline).toBe("2–3 месяца");
  expect(result.shortened.final_length).toBeLessThanOrEqual(800);
  expect(result.shortened.summary).toContain("Договорённости / следующий шаг:");
  expect(result.runStageSource).toContain("hybridRetryCount=1");
  expect(result.runStageSource).toContain("Math.max(Number(stage.maxTokens)||0,14000)");
});

test("production regression 45 сохраняет semantic verdict, структуру needs и корректное решение Gate", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const transcript='Клиент: Вы частное лицо? И номер для связи с вами 34:30 заканчивается. Я просто покупатель. Скорее всего, за наличные. Агент: Три комнаты, требуется ремонт. Клиент: Давайте контрольный звонок завтра в 12:00, а просмотр завтра в 16:00.';
    const factsCode=moduleGenericCheck('facts',{facts:[{category:'статус',type:'для себя',value:'для себя',speaker:'Клиент',evidence:'я просто покупатель',confidence:.99}]});
    const factJudge=mergeHybridCheck(factsCode,{verified_facts:[{category:'статус',type:'для себя',value:'для себя',speaker:'Клиент',evidence:'я просто покупатель',confidence:.99}],failed_facts:[],scores:{overall:79},decision:'WARNING'},null,{verifiedKey:'verified_facts',rejectedKey:'rejected_facts',qualityKey:'fact_check_quality'});
    const rawNeeds={crm_needs:{interested_in:[],source_of_funds:'наличные / депозит',purchase_timeline:'не определено'},needs:[
      {category:'комнаты',type:'количество',value:'3',speaker:'Клиент',evidence:'три комнаты',confidence:.96},
      {category:'предпочтения',type:'способ оплаты',value:'наличные, без ипотеки',speaker:'Клиент',evidence:'скорее всего, за наличные',confidence:.9}
    ]};
    const needJudge=mergeNeedCheck(moduleGenericCheck('needs',rawNeeds),{verified_needs:[{category:'комнаты',description:'количество',citation:'три комнаты'},{category:'предпочтения',description:'способ оплаты',citation:'за наличные'}],failed_needs:[],crm_validation:{interested_in:'FAIL',source_of_funds:'PASS',purchase_timeline:'PASS'},scores:{overall:70},decision:'WARNING'},null,rawNeeds,transcript);
    const validation=analyzeTranscriptQuality(transcript);
    const short=semanticShortenSummary('Клиент рассматривает покупку квартиры за наличные. Ключевые факты и цитаты: • Просмотр назначен на завтра в 16:00. Договорённости / следующий шаг: контрольный звонок завтра в 12:00, просмотр в 16:00.',{__transcript:transcript,needs:rawNeeds},800,800);
    const context=normalizeModuleSummaryJudge({outKey:'context_check'},{score:90,status:'warning',decision:'WARNING',can_continue_without_recording:true,context_clarity:0,business_usefulness:0,missing_for_next_agent:['Не указана мотивация клиента.','Не указана договорённость.']},{__transcript:transcript,summary:short});
    const presentation=CODE_FUNCS.presentationCheck({}, {summary:{summary:'Клиент покупает за наличные и идёт на просмотр завтра в 16:00. Ключевые факты и цитаты: • Покупка за наличные. • Просмотр завтра в 16:00. Договорённости / следующий шаг: контрольный звонок завтра в 12:00.'}}).output;
    const gate=CODE_FUNCS.summaryQualityGate({}, {__transcript:transcript,summary:short,truth_check:{score:100,status:'pass',critical_errors:[]},critical_facts_check:{score:100,status:'pass',missed_critical_facts:[]},context_check:context,action_check:{score:100,status:'pass',action_errors:[],is_result_reflected:true,is_agreement_reflected:true,is_next_step_reflected:true},presentation_check:{...presentation,score:90,status:'warning'}}).output;
    const store={facts:{fact_1:{value:'покупка',verified:true}},needs:{need_1:{value:'3 комнаты',verified:true}},crm_needs:rawNeeds.crm_needs,outcome:{next_step:{value:'контрольный звонок',verified:true}}};
    const published=CODE_FUNCS.crm({}, {__transcript:transcript,conversation:store,summary:short,quality_gate:{...gate,decision:'SAVE_WITH_WARNING'}}).output;
    return {validation,factJudge,needJudge,short,context,presentation,gate,published};
  })()`));

  expect(result.validation.quality).toMatchObject({ has_pii_phone: true, has_role_confusion_risk: true });
  expect(result.validation.quality.stt_quality_score).toBeLessThanOrEqual(0.95);
  expect(result.factJudge).toMatchObject({ score: 79, decision: "PASS_WITH_WARNINGS" });
  expect(result.needJudge).toMatchObject({ score: 70, decision: "PASS_WITH_WARNINGS", crm_validation: { interested_in: "PASS" } });
  expect(result.needJudge.verified_needs).toEqual(expect.arrayContaining([expect.objectContaining({ type: "способ оплаты", value: "наличные, без ипотеки", speaker: "Клиент", classification_supported: true })]));
  expect(result.needJudge.rejected_needs).toEqual(expect.arrayContaining([expect.objectContaining({ reason_code: "OBJECT_FACT_NOT_CLIENT_NEED" })]));
  expect(result.short).toMatchObject({ shortened: false, semantic_coverage_preserved: true, missing_after_shortening: [] });
  expect(result.context).toMatchObject({ score: 100, decision: "PASS", missing_for_next_agent: [] });
  expect(result.presentation.duplicate_information.length).toBeGreaterThan(0);
  expect(result.gate).toMatchObject({ critical_penalty_applied: false, decision: "SAVE_WITH_WARNING" });
  expect(result.published).toMatchObject({ saved: true, draft: false, execution_status: "SUCCESS", publish_decision: "SAVED" });
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

test("production regression 47 калибрует роли, STT, needs и итоговый Gate", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const transcript='Клиент: С ней всё в порядке. Там два собственника.\\nАгент: Я ищу для себя и хочу проверить юридические риски.\\nКлиент: Тогда я вам обязательно наберу, и когда буду показывать, сообщу.\\nАгент: У меня наличные на депозите.\\nКлиент: Мне нужно жильё для себя.\\nКлиент: Семёновский Волдиский, гваза 17:500.\\nАгент: До метро 7 ми—8 мину.\\nКлиент: Давайте по.';
    const validation=CODE_FUNCS.validate({}, {__transcript:transcript}).output;
    const raw={crm_needs:{interested_in:[]},needs:[
      {category:'юридическая безопасность',value:'проверить юридические риски',speaker:'Агент',evidence:'хочу проверить юридические риски',confidence:.98},
      {category:'собственники',value:'два собственника',speaker:'Клиент',evidence:'там два собственника',confidence:.98},
      {category:'источник средств',value:'наличные / депозит',speaker:'Агент',evidence:'у меня наличные на депозите',confidence:.98},
      {category:'цель покупки',value:'жильё для себя',speaker:'Клиент',evidence:'мне нужно жильё для себя',confidence:.98}
    ]};
    const judged=mergeNeedCheck(moduleGenericCheck('needs',raw),{verified_needs:raw.needs,failed_needs:[],scores:{overall:92},decision:'WARNING'},null,raw,transcript);
    const fact=mergeHybridCheck(moduleGenericCheck('facts',{facts:[{category:'собственники',value:'два собственника'}]}),{verified_facts:[{category:'собственники',value:'два собственника'}],failed_facts:[],missed_facts:[{category:'собственники',value:'два собственника'}],scores:{overall:90},decision:'WARNING'},null,{verifiedKey:'verified_facts',rejectedKey:'rejected_facts',qualityKey:'fact_check_quality'});
    const summary='Клиент хочет проверить юридические риски. Ключевые факты и цитаты:\\n• Клиент хочет проверить юридические риски — «хочу проверить юридические риски».\\nДоговорённости / следующий шаг: агент свяжется после проверки.';
    const presentation=CODE_FUNCS.presentationCheck({}, {summary:{summary}}).output;
    const judge={score:100,status:'pass',explanation:'ok'};
    const gate=CODE_FUNCS.summaryQualityGate({}, {validation,summary:{summary},truth_check:{...judge,critical_errors:[]},critical_facts_check:{...judge,missed_critical_facts:[]},context_utility_check:{...judge,missing_for_next_agent:[],can_continue_without_recording:true},action_check:{...judge,action_errors:[],is_result_reflected:true,is_agreement_reflected:true,is_next_step_reflected:true},presentation_check:presentation}).output;
    return {validation,judged,fact,presentation,gate};
  })()`));

  expect(result.validation).toMatchObject({ decision: "FAIL", valid: false });
  expect(result.validation.metrics.role_confusion_ratio).toBeGreaterThan(0);
  expect(result.validation.metrics.damaged_phrase_ratio).toBeGreaterThan(0);
  expect(result.judged.verified_needs).toHaveLength(1);
  expect(result.judged.rejected_needs).toEqual(expect.arrayContaining([
    expect.objectContaining({ reason_code: "OBJECT_FACT_NOT_CLIENT_NEED" }),
    expect.objectContaining({ reason_code: "AGENT_STATEMENT_NOT_CLIENT_NEED" }),
  ]));
  expect(result.fact).toMatchObject({ missed_fact_already_present: true, missed_items: [] });
  expect(result.presentation).toMatchObject({ has_duplicate_information: true });
  expect(result.presentation.duplicate_items[0]).toMatchObject({ locations: ["main_text", "key_facts"] });
  expect(result.gate.summary_quality_score).toBeCloseTo(85, 1);
  expect(result.gate.decision).toBe("SAVE_WITH_WARNING");
});

test("Need classification различает объект, потребность, evidence и speaker", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const transcript='Агент: Квартира 54 м². До метро 7 минут. Там два собственника.\\nКлиент: Мне нужно не меньше 54 м². Мне важно не больше 10 минут до метро. Мне важно, чтобы был один собственник.';
    return {
      areaFact:validateModuleNeed({category:'площадь',value:'54 м²',speaker:'Агент',evidence:'Квартира 54 м²'},transcript),
      areaNeed:validateModuleNeed({category:'площадь',value:'не меньше 54 м²',speaker:'Клиент',evidence:'Мне нужно не меньше 54 м²'},transcript),
      metroFact:validateModuleNeed({category:'транспорт',value:'до метро 7 минут',speaker:'Агент',evidence:'До метро 7 минут'},transcript),
      metroNeed:validateModuleNeed({category:'транспорт',value:'не больше 10 минут до метро',speaker:'Клиент',evidence:'Мне важно не больше 10 минут до метро'},transcript),
      ownerFact:validateModuleNeed({category:'собственники',value:'два собственника',speaker:'Агент',evidence:'Там два собственника'},transcript),
      ownerNeed:validateModuleNeed({category:'собственники',value:'один собственник',speaker:'Клиент',evidence:'Мне важно, чтобы был один собственник'},transcript),
      badValue:validateModuleNeed({category:'окружение',value:'хороший двор как парк',speaker:'Клиент',evidence:'Кто там во дворе? Как люди?'},''),
      wrongSpeaker:validateModuleNeed({category:'площадь',value:'не меньше 54 м²',speaker:'Агент',evidence:'Мне нужно не меньше 54 м²'},transcript)
    };
  })()`));
  expect(result.areaFact.reason_code).toBe("AGENT_STATEMENT_NOT_CLIENT_NEED");
  expect(result.metroFact.reason_code).toBe("AGENT_STATEMENT_NOT_CLIENT_NEED");
  expect(result.ownerFact.reason_code).toBe("AGENT_STATEMENT_NOT_CLIENT_NEED");
  expect(result.areaNeed.valid).toBe(true);
  expect(result.metroNeed.valid).toBe(true);
  expect(result.ownerNeed.valid).toBe(true);
  expect(result.badValue.reason_code).toBe("VALUE_NOT_SUPPORTED_BY_EVIDENCE");
  expect(result.wrongSpeaker.reason_code).toBe("AGENT_STATEMENT_NOT_CLIENT_NEED");
});

test("production regression 48 восстанавливает Judge, Store и Summary без ложных ошибок", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(async () => {
    const transcript='Оператор: Номер для связи 46 39 у вас заканчивается?\\nКлиент: Да. Для себя, наличкой. Можно посмотреть завтра?\\nАгент: Давайте в 15:30.\\nКлиент: А вторую квартиру покажете позже?\\nАгент: Да, без проблем. Да-да. Но ключей от второй квартиры сейчас нет.\\nКлиент: Хорошо, спасибо.\\nАгент: До завтра.';
    const validation=CODE_FUNCS.validate({}, {__transcript:transcript}).output;
    const sourceOutcome={call_result:{value:'просмотр назначен',confidence:.99,evidence:'Давайте в 15:30'},next_step:{value:'провести просмотр',confidence:.99,evidence:'Давайте в 15:30'},agreements:[{value:'просмотр завтра в 15:30',confidence:.99,evidence:'Давайте в 15:30'},{value:'вторую квартиру покажут позже',confidence:.95,evidence:'А вторую квартиру покажете позже?'}]};
    cleanupOutcomeV9(sourceOutcome);
    const outcomeJudge=mergeHybridCheck(moduleGenericCheck('outcome',sourceOutcome),{verified_items:[{item:'call_result',status:'PASS'},{item:'next_step',status:'PASS'}],failed_items:[],scores:{overall:100},decision:'PASS'},null,{verifiedKey:'verified_outcome',rejectedKey:'rejected_outcome',qualityKey:'outcome_check_quality',sourceHasData:true,sourceData:sourceOutcome});
    let summary={summary:'Клиент покупает для себя и платит наличными; просмотр согласован на завтра в 15:30. Вторая квартира сейчас недоступна без ключей, агент договорился показать её позже.\\nКлючевые факты и цитаты:\\n• Покупает для себя и платит наличными — «Для себя, наличкой».\\n• Вторая квартира сейчас недоступна — «ключей нет».\\nДоговорённости / следующий шаг: просмотр завтра в 15:30; вторую квартиру покажут позже.'};
    summary=cleanupSummaryOutcome(summary,{__transcript:transcript,outcome:sourceOutcome});
    summary={...summary,...semanticShortenSummary(summary.summary,{__transcript:transcript,outcome:sourceOutcome},SUMMARY_MAX_LENGTH,SUMMARY_MAX_LENGTH)};
    const presentation=CODE_FUNCS.presentationCheck({}, {summary}).output;
    const critical=normalizeModuleSummaryJudge({outKey:'critical_facts_check'},{score:90,status:'warning',decision:'WARNING',missed_critical_facts:[{fact_type:'purchase_term',fact:'Срок покупки не определен.',evidence_from_transcript:'Клиент не упоминает конкретный срок покупки.'}]},{__transcript:transcript,summary});
    const prompt=ensureModuleTranscriptPrompt({outKey:'need_judge',name:'Проверка Потребностей',type:'hybrid'},'Проверь {{ctx.needs}}',{__transcript:transcript,needs:{needs:[{value:'наличные'}]}}).prompt;
    const originalCallModel=callModel;
    let attempts=0;
    callModel=async()=>{attempts++;if(attempts===1)throw new Error('Failed to fetch');return {text:'{}',tokens:1};};
    const retried=await callModelWithTransientRetry('x','m','ai-tunnel',0,20);
    callModel=originalCallModel;
    const base={score:100,status:'pass',explanation:'ok'};
    const gate=CODE_FUNCS.summaryQualityGate({}, {validation,summary,truth_check:{...base,critical_errors:[]},critical_facts_check:{...base,missed_critical_facts:[]},context_utility_check:{...base,missing_for_next_agent:[],can_continue_without_recording:true},action_check:{...base,action_errors:[],is_result_reflected:true,is_agreement_reflected:true,is_next_step_reflected:true},presentation_check:presentation}).output;
    return {validation,sourceOutcome,outcomeJudge,summary,presentation,critical,prompt,attempts,retried,gate};
  })()`));

  expect(result.validation).toMatchObject({ decision: "PASS", score: 1 });
  expect(result.validation.issues.some((item: any) => item.type === "excessive_noise")).toBe(false);
  expect(result.sourceOutcome.agreements).toHaveLength(1);
  expect(result.outcomeJudge.verified_outcome).toMatchObject({ call_result: { value: "просмотр назначен" }, next_step: { value: "провести просмотр" } });
  expect(Array.isArray(result.outcomeJudge.verified_outcome)).toBe(false);
  expect(result.summary.summary).not.toMatch(/показать (?:её|вторую квартиру) позже|вторую квартиру покажут позже/i);
  expect(result.presentation).toMatchObject({ has_duplicate_information: false, score: 100 });
  expect(result.critical).toMatchObject({ missed_critical_facts: [], score: 100, status: "pass" });
  expect(result.prompt).toContain("Каждый элемент классифицируй ровно один раз");
  expect(result.attempts).toBe(2);
  expect(result.retried.networkRetryCount).toBe(1);
  expect(result.gate).toMatchObject({ decision: "SAVE_WITH_WARNING", summary_quality_score: 98 });
});

test("production regression 54 выявляет путаницу ролей и потерю главных смыслов", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const transcript=[
      'Агент: Марсель, правильно?',
      'Клиент: Да.',
      'Агент: Однокомнатная квартира, 35 квадратных метров, второй этаж. Окна выходят на парковку, солнце после трёх.',
      'Клиент: Нам нужно тихо.',
      'Агент: Один взрослый собственник, покупал до брака, свободная продажа, документы чистые, без переуступок.',
      'Клиент: Мы с таким сталкивались, имеем опыт. Покупателем и собственником будет дочь Дарья. Деньги наличные.',
      'Клиент: Сначала дочь посмотрит. Если понравится, наш риэлтор проверит документы, потом обсудим цену и скидку.',
      'Агент: Я передам контакт дочери, чтобы она согласовала просмотр.'
    ].join('\\n');
    const summary={summary:'Клиент звонила по интересу к объекту; покупка оформляется дочерью, которая будет собственником. Агент передаст контакт дочери для согласования просмотра.\\nКлючевые факты и цитаты:\\n• Источник средств — наличные — «Деньги наличные».\\n• Юридическая чистота — без переуступок — «Документы чистые».\\n• Требование по тишине — «Нам нужно тихо».\\n• Возможна скидка — «обсудим цену и скидку».\\nДоговорённости / следующий шаг: дочь согласует просмотр, затем риэлтор проверит документы.'};
    const perfect={score:100,status:'pass',decision:'PASS',explanation:'Все требования выполнены.'};
    const presentation=CODE_FUNCS.presentationCheck({}, {summary}).output;
    const gate=CODE_FUNCS.summaryQualityGate({}, {
      __transcript:transcript,
      summary,
      truth_check:{...perfect,critical_errors:[],has_hallucinations:false,has_fact_distortions:false,has_role_confusion:false},
      critical_facts_check:{...perfect,critical_facts_total:8,critical_facts_reflected:8,missed_critical_facts:[]},
      context_utility_check:{...perfect,context_clarity:8,business_usefulness:9,information_priority:8,can_continue_without_recording:true,missing_for_next_agent:[]},
      action_check:{...perfect,action_errors:[],is_result_reflected:true,is_agreement_reflected:true,is_next_step_reflected:true},
      presentation_check:presentation
    }).output;
    const nameFacts=verifiedModuleItems([
      {category:'Клиент',type:'имя',value:'Ольга',speaker:'Оператор',confidence:.99,evidence:'Как вас зовут?'},
      {category:'Клиент',type:'имя',value:'Марсель',speaker:'Клиент',confidence:.99,evidence:'Марсель, правильно? Да.'},
      {category:'Клиент',type:'имя',value:'Ольга',speaker:'Агент',confidence:.99,evidence:'А меня зовут Ольга.'},
      {category:'agent_name',value:'Ольга',confidence:.99,evidence:'Меня Ольга зовут.'}
    ],'fact_judge');
    const rawNeeds={crm_needs:{interested_in:[]},needs:[{category:'требование',value:'тихо',speaker:'Клиент',evidence:'Нам нужно тихо',confidence:.99}]};
    const needCheck=mergeNeedCheck(moduleGenericCheck('needs',rawNeeds),{
      verified_needs:rawNeeds.needs,
      failed_needs:[],
      scores:{overall:90},
      decision:'WARNING'
    },null,rawNeeds,transcript);
    const prompt=ensureModuleTranscriptPrompt({outKey:'critical_facts_check',type:'check',name:'Проверка критически важных фактов'},'Проверь Summary',{__transcript:transcript,summary}).prompt;
    return {gate,nameFacts,needCheck,prompt,presentation};
  })()`));

  expect(result.nameFacts.map((item: any) => item.value)).toEqual(["Марсель", "Ольга"]);
  expect(result.needCheck.property_requirements).toMatchObject({
    rooms: ["1-комнатная"],
    hard_constraints: ["тихо", "юридически чистая, без переуступок"],
  });
  expect(result.needCheck.market_type_interest).toEqual(["Вторичная недвижимость"]);
  expect(result.prompt).toContain("TOP-10 важных фактов");
  expect(result.presentation.forbidden_card_duplicates).toEqual([]);
  expect(result.gate.judges.truth_check).toMatchObject({ status: "fail", score: 60, has_role_confusion: true });
  expect(result.gate.judges.critical_facts_check.semantic_coverage_percent).toBeLessThan(90);
  expect(result.gate.judges.context_utility_check).toMatchObject({ status: "warning", score: 65 });
  expect(result.gate.judges.presentation_check.readability_issues).toContain(
    "Канцелярская формулировка; проще: «Покупателем и собственником будет дочь Дарья».",
  );
  expect(result.gate.summary_quality_score).toBeGreaterThanOrEqual(55);
  expect(result.gate.summary_quality_score).toBeLessThanOrEqual(75);
  expect(["JUDGE_REVIEW", "REVIEW_REQUIRED"]).toContain(result.gate.decision);
});

test("STT возвращает воспроизводимый контракт качества текста без ложной точности аудио", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const stage={type:'svc',vendor:'Nexara',name:'STT + улучшение транскрипции',codeFn:'stt',outKey:'stt'};
    const run=(transcript,extra={})=>CODE_FUNCS.stt(stage,{__transcript:transcript,...extra});
    const clean='Клиент: Добрый день, хочу посмотреть квартиру.\\nАгент: Подскажите, какой район вас интересует?\\nКлиент: Центр города, бюджет до десяти миллионов.\\nАгент: Хорошо, сегодня пришлю подходящие варианты.';
    const phone='Клиент: Добрый день, хочу посмотреть квартиру.\\nАгент: Подскажите, какой район вас интересует?\\nКлиент: Центр города, бюджет до десяти миллионов.\\nАгент: Хорошо, сегодня пришлю варианты, телефон +7 999 123-45-67.';
    const confirmations=run('Клиент: Хочу посмотреть квартиру.\\nАгент: Запрос понял, район центральный?\\nКлиент: Да-да, всё так.\\nАгент: Уточню варианты и перезвоню.').output;
    const ugu=run('Клиент: Нужна квартира в центре.\\nАгент: Рассматриваете вторичный рынок?\\nКлиент: Угу.\\nАгент: Тогда подготовлю варианты сегодня.').output;
    const base=run(clean);
    const withPhone=run(phone).output;
    const unknown=run('Клиент: Нужна квартира.\\nUnknown Speaker: Какой бюджет рассматриваете?\\nКлиент: До десяти миллионов.\\nАгент: Подготовлю варианты сегодня.').output;
    const truncated=run('Клиент: Хочу посмотреть квартиру.\\nАгент: Какой район вас интересует?\\nКлиент: Центр города.\\nАгент: Я уточню и').output;
    const confused=run('Клиент: Добрый день, продаю квартиру.\\nАгент: Я ищу для себя и хочу купить квартиру.\\nКлиент: Бюджет до десяти миллионов.\\nАгент: Я перезвоню сегодня.').output;
    const empty=run('   ').output;
    const real=run(clean,{nexara:{transcript:clean,metadata:{confidence:.93}}}).output;
    const html=renderReport(stage,base,1).outerHTML;
    return {confirmations,ugu,base:base.output,withPhone,unknown,truncated,confused,empty,real,html};
  })()`));

  expect(Object.keys(result.base)).toEqual(["transcript", "mode", "provider", "simulated", "metrics", "quality", "decision", "issues"]);
  expect(result.confirmations.metrics.damaged_phrase_ratio).toBe(0);
  expect(result.confirmations.issues.some((issue: any) => issue.type === "damaged_phrase")).toBe(false);
  expect(result.ugu.metrics.damaged_phrase_ratio).toBe(0);
  expect(result.withPhone.metrics.pii_phone_detected).toBe(true);
  expect(result.withPhone.issues).toEqual(expect.arrayContaining([expect.objectContaining({ type: "pii_phone", severity: "warning" })]));
  expect(result.withPhone.decision).toBe(result.base.decision);
  expect(result.withPhone.quality.overall_score).toBe(result.base.quality.overall_score);
  expect(result.unknown.metrics.unknown_speaker_ratio).toBeCloseTo(0.25, 3);
  expect(result.truncated.decision).toBe("MANUAL_REVIEW");
  expect(result.truncated.issues).toEqual(expect.arrayContaining([expect.objectContaining({ type: "incomplete_transcript" })]));
  expect(result.confused.metrics.role_confusion_ratio).toBeGreaterThan(0);
  expect(result.confused.quality.role_quality_score).toBeLessThan(result.base.quality.role_quality_score);
  expect(result.empty.decision).toBe("FAIL");
  expect(result.base).toMatchObject({ mode: "transcript_quality_check", provider: "Nexara", simulated: true });
  expect(result.base.quality.confidence).toBeLessThanOrEqual(0.85);
  expect(result.base.quality.confidence).not.toBe(result.base.quality.overall_score);
  expect(result.real).toMatchObject({ mode: "real_stt", provider: "Nexara", simulated: false });
  expect(result.real.quality.confidence).toBe(0.93);
  const expectedOverall = result.base.quality.transcript_integrity_score * 0.45
    + result.base.quality.role_quality_score * 0.30
    + result.base.quality.noise_quality_score * 0.25;
  expect(result.base.quality.overall_score).toBeCloseTo(expectedOverall, 3);
  expect(result.html).toContain("Проверка готовой транскрипции");
  expect(result.html).toContain("Качество текста");
  expect(result.html).toContain("Качество ролей");
  expect(result.html).toContain("Повреждённые фразы");
  expect(result.html).not.toContain("STT Quality");
  expect(result.html).toContain("Оценка качества текста транскрипции, без сравнения с аудио");
});

test("Валидация транскрипции соблюдает контракт пригодности и downstream policy", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(async () => {
    const stage={type:'code',name:'Валидация транскрипции',codeFn:'validate',outKey:'validation'};
    const clean='Клиент: Добрый день, хочу посмотреть квартиру.\\nАгент: Какой район вас интересует?\\nКлиент: Центр города, рядом с метро.\\nАгент: Сегодня пришлю подходящие варианты.';
    const stt=(transcript,metrics={},confidence=.82)=>({transcript,mode:'transcript_quality_check',provider:'Nexara',simulated:true,metrics:{chars:transcript.length,turns:transcript.split('\\n').length,roles:['Клиент','Агент'],unknown_speaker_ratio:0,damaged_phrase_ratio:0,role_confusion_ratio:0,pii_phone_detected:false,...metrics},quality:{transcript_integrity_score:1,role_quality_score:1,noise_quality_score:1,overall_score:1,confidence},decision:'PASS',issues:[]});
    const run=(transcript,metrics={},confidence=.82)=>CODE_FUNCS.validate(stage,{stt:stt(transcript,metrics,confidence)});
    const full=run(clean);
    const operatorAndAgent=run('Оператор: Добрый день, соединяю вас с агентом.\\nКлиент: Хочу посмотреть квартиру в центре.\\nАгент: Какой бюджет рассматриваете?\\nКлиент: До десяти миллионов.\\nАгент: Сегодня пришлю варианты.').output;
    const operatorOnly=run('Клиент: Хочу записаться на консультацию по услуге.\\nОператор: Какое время вам удобно?\\nКлиент: Завтра после обеда.\\nОператор: Записала вас на пятнадцать часов.').output;
    const noConversation=run('Оператор: Гудки.\\nКлиент: Алло.').output;
    const noClient=run('Оператор: Соединяю с отделом продаж.\\nАгент: Я готов ответить на вопросы.').output;
    const empty=run('').output;
    const confirmations=run(clean+'\\nКлиент: Да.\\nАгент: Угу.').output;
    const shortAnswer=run('Клиент: Хочу посмотреть квартиру.\\nАгент: Подтвердить просмотр на завтра?\\nКлиент: Да.').output;
    const technicalArtifact=run(clean+'\\nАгент: {"service":').output;
    const phoneText=clean.replace('Сегодня пришлю подходящие варианты.','Сегодня пришлю подходящие варианты, телефон +7 999 123-45-67.');
    const phone=run(phoneText,{pii_phone_detected:true}).output;
    const unknown=run(clean,{unknown_speaker_ratio:.15}).output;
    const confused=run(clean,{role_confusion_ratio:.08}).output;
    const truncated=run('Клиент: Хочу посмотреть квартиру.\\nАгент: Какой район вас интересует?\\nКлиент: Центр города.\\nАгент: Я тогда…').output;
    const withoutBudget=run('Клиент: Хочу посмотреть квартиру в центре.\\nАгент: Когда вам удобно приехать?\\nКлиент: Можно завтра после обеда.\\nАгент: Хорошо, подтвержу время звонком.').output;
    const withoutTimeline=run('Клиент: Хочу купить квартиру в центре.\\nАгент: Какие районы рассматриваете?\\nКлиент: Только центральный район.\\nАгент: Пришлю варианты сегодня.').output;
    const viewingDate=run('Клиент: Хочу посмотреть квартиру.\\nАгент: Когда вам удобно приехать на просмотр?\\nКлиент: Завтра в шестнадцать часов.\\nАгент: Просмотр подтверждён.').output;
    const fallback=CODE_FUNCS.validate(stage,{__transcript:clean}).output;
    const lowConfidence=run(clean,{},.61).output;
    const formula=full.output.criteria[0].score*.20+full.output.criteria[1].score*.20+full.output.criteria[2].score*.30+full.output.criteria[3].score*.10+full.output.criteria[4].score*.20;
    const html=renderReport(stage,full,2).outerHTML;
    const originalPipeline=pipeline;
    let downstreamRan=false;
    CODE_FUNCS.validationTestMarker=()=>{downstreamRan=true;return {output:{ran:true},status:'ok',metrics:[],checks:[]}};
    pipeline=[stage,{type:'code',name:'Маркер downstream',codeFn:'validationTestMarker',outKey:'marker',enabled:true}].map((item,index)=>({id:'validation-test-'+index,enabled:true,...item}));
    document.getElementById('transcript').value='Оператор: Соединяю с отделом.\\nАгент: Готов ответить на вопросы.';
    await runPipeline();
    const pipelineStop={downstreamRan,validation:ctx.validation,marker:ctx.marker};
    pipeline=originalPipeline;
    delete CODE_FUNCS.validationTestMarker;
    return {full:full.output,operatorAndAgent,operatorOnly,noConversation,noClient,empty,confirmations,shortAnswer,technicalArtifact,phone,unknown,confused,truncated,withoutBudget,withoutTimeline,viewingDate,fallback,lowConfidence,formula,html,pipelineStop};
  })()`));

  expect(result.full).toMatchObject({ valid: true, input_source: "stt", call_scenario: "agent_only", decision: "PASS" });
  expect(result.operatorAndAgent.call_scenario).toBe("operator_and_agent");
  expect(result.operatorOnly).toMatchObject({ call_scenario: "operator_only", decision: "PASS", valid: true });
  expect(result.noConversation).toMatchObject({ call_scenario: "no_conversation", decision: "FAIL", valid: false });
  expect(result.noClient).toMatchObject({ decision: "FAIL", valid: false });
  expect(result.empty).toMatchObject({ decision: "FAIL", valid: false });
  expect(result.confirmations.metrics.damaged_phrase_ratio).toBe(0);
  expect(result.shortAnswer.checks.ending_complete).toBe(true);
  expect(result.technicalArtifact).toMatchObject({ decision: "FAIL", valid: false });
  expect(result.phone.checks.pii_detected).toBe(true);
  expect(result.phone.decision).toBe(result.full.decision);
  expect(result.phone.score).toBe(result.full.score);
  expect(result.unknown.decision).toBe("MANUAL_REVIEW");
  expect(result.confused.decision).toBe("MANUAL_REVIEW");
  expect(result.truncated).toMatchObject({ decision: "MANUAL_REVIEW", checks: { ending_complete: false } });
  expect(result.withoutBudget.decision).toBe("PASS");
  expect(result.withoutTimeline.decision).toBe("PASS");
  expect(result.viewingDate.decision).toBe("PASS");
  expect(result.fallback).toMatchObject({ input_source: "raw_transcript_fallback", decision: "PASS" });
  expect(result.fallback.issues).toEqual(expect.arrayContaining([expect.objectContaining({ type: "raw_transcript_input", severity: "info" })]));
  expect(result.full.score).toBeCloseTo(result.formula, 3);
  expect(result.lowConfidence.confidence).toBeLessThanOrEqual(0.61);
  expect(result.empty.downstream_policy).toMatchObject({ allow_fact_extraction: false, allow_need_extraction: false, allow_outcome_extraction: false });
  expect(result.unknown.downstream_policy).toMatchObject({ allow_fact_extraction: true, require_manual_review: true });
  expect(Object.keys(result.full)).toEqual(["valid", "input_source", "call_scenario", "decision", "score", "confidence", "checks", "metrics", "criteria", "issues", "downstream_policy"]);
  expect(result.full.criteria).toHaveLength(5);
  expect(result.pipelineStop).toMatchObject({ downstreamRan: false, marker: undefined, validation: { decision: "FAIL" } });
  expect(result.html).toContain("Пригодность для анализа");
  expect(result.html).toContain("Сценарий звонка");
  expect(result.html).toContain("Критические неоднозначности");
  expect(result.html).toContain("PII");
  expect(result.html).not.toContain("PII</b> · fail");
});

test("Fact Agent использует новый root schema, точные ошибки и ограниченный repair", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(async () => {
    const fact=(id='fact_1',category='client_finance')=>({id,category,name:'бюджет',value:10000000,normalized_value:10000000,speaker:'Клиент',evidence:'бюджет до десяти миллионов',confidence:.96,verification_status:'pending'});
    const quote=(factId='fact_1')=>({id:'quote_1',text:'бюджет до десяти миллионов',speaker:'Клиент',supports_fact_ids:[factId],confidence:.96,verification_status:'pending'});
    const valid={facts:[fact()],quotes:[quote()],extraction_meta:{fact_count:1,quote_count:1,decision:'EXTRACTED'}};
    const allCategories={facts:FACT_CATEGORY_VALUES.map((category,index)=>fact('fact_'+(index+1),category)),quotes:[],extraction_meta:{fact_count:FACT_CATEGORY_VALUES.length,quote_count:0,decision:'EXTRACTED'}};
    const empty={facts:[],quotes:[],extraction_meta:{fact_count:0,quote_count:0,decision:'NO_FACTS'}};
    const validate=value=>{try{return {ok:true,value:validateFactExtractionRoot(value)}}catch(error){return {ok:false,name:error.name,error:error.message}}};
    const nullValue=JSON.parse(JSON.stringify(valid));nullValue.facts[0].value=null;
    const nullNormalized=JSON.parse(JSON.stringify(valid));nullNormalized.facts[0].normalized_value=null;
    const unknownCategory=JSON.parse(JSON.stringify(valid));unknownCategory.facts[0].category='unknown_category';
    const identity=validate({facts:[fact('fact_identity','client_identity')],quotes:[],extraction_meta:{fact_count:1,quote_count:0,decision:'EXTRACTED'}});
    const role=validate({facts:[fact('fact_role','client_role')],quotes:[],extraction_meta:{fact_count:1,quote_count:0,decision:'EXTRACTED'}});
    const report60Categories=['client_identity','client_role','object_context','object_information','object_information','object_context','object_information','object_context','object_information','object_information','object_information','object_information','object_information','object_information','object_information','object_information','client_finance','client_constraint','communication_context','client_objection','search_criteria','client_question','client_question'];
    const report60Facts=report60Categories.map((category,index)=>({...fact('fact_'+String(index+1).padStart(3,'0'),category),value:index===16?'до пяти с половиной':'значение '+index,normalized_value:index===16?5500000:'значение '+index,name:index===18?'preferred_channel':'name_'+index}));
    const report60={facts:report60Facts,quotes:[0,1,2,3,4].map((index)=>({id:'quote_'+String(index+1).padStart(3,'0'),text:'цитата '+index,speaker:'Клиент',supports_fact_ids:['fact_'+String(index+17).padStart(3,'0')],confidence:.99,verification_status:'pending'})),extraction_meta:{fact_count:23,quote_count:5,decision:'EXTRACTED'}};
    const duplicate={facts:[fact('fact_1'),fact('fact_1')],quotes:[],extraction_meta:{fact_count:2,quote_count:0,decision:'EXTRACTED'}};
    const missingReference=JSON.parse(JSON.stringify(valid));missingReference.quotes[0].supports_fact_ids=['fact_missing'];
    const countMismatch=JSON.parse(JSON.stringify(valid));countMismatch.extraction_meta.fact_count=2;
    const oldRoot={client_name:{value:'Анна'},intent:{value:'купить'},budget:{value:10000000}};
    const legacyArray=[{id:'f1',category:'client_intent',value:'интересуется участком',normalized_value:null,speaker:'client',evidence:'интересуется участком',source_turn_ids:[1],confidence:.95}];
    const stage={type:'llm',name:'Извлечение фактов и цитат',outKey:'facts',model:'gpt-5-mini',prompt:'Верни JSON. Транскрипция: {{transcript}}'};
    const transcript='Клиент: Хочу купить квартиру, бюджет до десяти миллионов.\\nАгент: Подготовлю варианты.';
    const original=callModelWithTransientRetry;
    let markdownCalls=0;
    const fence=String.fromCharCode(96).repeat(3);
    callModelWithTransientRetry=async()=>{markdownCalls++;return {text:fence+'json\\n'+JSON.stringify(valid)+'\\n'+fence,tokens:10,actualModel:'gpt-5-mini',actualProvider:'test',finishReason:'stop'}};
    const markdown=await runStage(stage,{__transcript:transcript});
    let truncatedCalls=0;
    callModelWithTransientRetry=async()=>{truncatedCalls++;return truncatedCalls===1
      ? {text:'{"facts":[',tokens:3,actualModel:'gpt-5-mini',actualProvider:'test',finishReason:'length'}
      : {text:JSON.stringify(valid),tokens:10,actualModel:'gpt-5-mini',actualProvider:'test',finishReason:'stop'}};
    const truncated=await runStage(stage,{__transcript:transcript});
    let schemaCalls=0;
    const schemaRaw=JSON.stringify(nullValue);
    callModelWithTransientRetry=async()=>{schemaCalls++;return {text:schemaRaw,tokens:8,actualModel:'gpt-5-mini',actualProvider:'test',finishReason:'stop'}};
    const schemaMismatch=await runStage(stage,{__transcript:transcript});
    let categoryRepairCalls=0;const categoryRepairPrompts=[];
    const repairedCategory=JSON.parse(JSON.stringify(valid));repairedCategory.facts[0].category='client_finance';
    callModelWithTransientRetry=async(prompt)=>{categoryRepairCalls++;categoryRepairPrompts.push(prompt);return {text:JSON.stringify(categoryRepairCalls===1?unknownCategory:repairedCategory),tokens:8,actualModel:'gpt-5-mini',actualProvider:'test',finishReason:'stop'}};
    const categoryRepair=await runStage(stage,{__transcript:transcript});
    let repeatedUnknownCalls=0;
    callModelWithTransientRetry=async()=>{repeatedUnknownCalls++;return {text:JSON.stringify(unknownCategory),tokens:8,actualModel:'gpt-5-mini',actualProvider:'test',finishReason:'stop'}};
    const repeatedUnknown=await runStage(stage,{__transcript:transcript});
    let contractCalls=0;
    FACT_CATEGORIES.delete('client_identity');
    callModelWithTransientRetry=async()=>{contractCalls++;return {text:JSON.stringify(valid),tokens:8,actualModel:'gpt-5-mini',actualProvider:'test',finishReason:'stop'}};
    const contractMismatch=await runStage(stage,{__transcript:transcript});
    FACT_CATEGORIES.add('client_identity');
    let oldRootCalls=0;
    const oldRaw=JSON.stringify(oldRoot);
    callModelWithTransientRetry=async()=>{oldRootCalls++;return {text:oldRaw,tokens:8,actualModel:'gpt-5-mini',actualProvider:'test',finishReason:'stop'}};
    const oldRootReport=await runStage(stage,{__transcript:transcript});
    let legacyArrayCalls=0;
    callModelWithTransientRetry=async()=>{legacyArrayCalls++;return {text:JSON.stringify(legacyArray),tokens:8,actualModel:'gpt-5-mini',actualProvider:'AI Tunnel',finishReason:'stop'}};
    const legacyArrayReport=await runStage(stage,{__transcript:'Клиент: интересуется участком'});
    let downstreamRan=false;
    CODE_FUNCS.factSchemaPrecheck=()=>({output:{decision:'PASS'},status:'ok',metrics:[],checks:[]});
    CODE_FUNCS.factSchemaMarker=()=>{downstreamRan=true;return {output:{ran:true},status:'ok',metrics:[],checks:[]}};
    const originalPipeline=pipeline;
    pipeline=[{id:'fact-schema-precheck',enabled:true,type:'code',name:'Валидация транскрипции',codeFn:'factSchemaPrecheck',outKey:'validation'},{...stage,id:'fact-schema-stage',enabled:true,provider:'mock'},...Array.from({length:14},(_,index)=>({id:'fact-schema-marker-'+index,enabled:true,type:'code',name:'Маркер downstream '+index,codeFn:'factSchemaMarker',outKey:'marker_'+index}))];
    renderStages();
    document.getElementById('transcript').value=transcript;
    callModelWithTransientRetry=async()=>({text:schemaRaw,tokens:8,actualModel:'gpt-5-mini',actualProvider:'test',finishReason:'stop'});
    await runPipeline();
    const pipelineStop={downstreamRan,marker:ctx.marker_0,facts:ctx.facts,execution:ctx.pipeline_execution,finalText:document.getElementById('reports').innerText};
    pipeline=originalPipeline;
    renderStages();
    delete CODE_FUNCS.factSchemaMarker;
    delete CODE_FUNCS.factSchemaPrecheck;
    callModelWithTransientRetry=original;
    return {
      valid:validate(valid),identity,role,allCategories:validate(allCategories),report60:validate(report60),empty:validate(empty),nullValue:validate(nullValue),nullNormalized:validate(nullNormalized),unknownCategory:validate(unknownCategory),duplicate:validate(duplicate),missingReference:validate(missingReference),countMismatch:validate(countMismatch),oldRoot:validate(oldRoot),
      markdownCalls,markdown,truncatedCalls,truncated,schemaCalls,schemaMismatch,categoryRepairCalls,categoryRepair,categoryRepairPrompts,repeatedUnknownCalls,repeatedUnknown,contractCalls,contractMismatch,appendix:factExtractionContractAppendix(),schemaEnum:FACT_EXTRACTION_JSON_SCHEMA.properties.facts.items.properties.category.enum,uiCategories:document.querySelector('[data-fact-category-contract]')?.textContent||'',oldRootCalls,oldRootReport,legacyArrayCalls,legacyArrayReport,pipelineStop
    };
  })()`));

  expect(result.valid).toMatchObject({ ok: true, value: { extraction_meta: { decision: "EXTRACTED" } } });
  expect(result.identity.ok).toBe(true);
  expect(result.role.ok).toBe(true);
  expect(result.allCategories.ok).toBe(true);
  expect(result.report60).toMatchObject({ ok: true, value: { extraction_meta: { fact_count: 23, quote_count: 5 } } });
  expect(result.empty).toMatchObject({ ok: true, value: { facts: [], quotes: [], extraction_meta: { decision: "NO_FACTS" } } });
  expect(result.nullValue).toEqual({ ok: false, name: "FactSchemaError", error: "facts[0].value: expected string | number | boolean | string[] | number[], received null" });
  expect(result.nullNormalized).toMatchObject({ ok: true, value: { facts: [expect.objectContaining({ normalized_value: null })] } });
  expect(result.unknownCategory.error).toBe('facts[0].category: unknown enum value "unknown_category"');
  expect(result.duplicate.error).toBe('facts[1].id: duplicate id "fact_1"');
  expect(result.missingReference.error).toBe('quotes[0].supports_fact_ids[0]: unknown fact id "fact_missing"');
  expect(result.countMismatch.error).toBe("extraction_meta.fact_count: expected 1, received 2");
  expect(result.oldRoot.error).toBe("facts: expected defined, received undefined");
  expect(result.markdownCalls).toBe(1);
  expect(result.markdown).toMatchObject({ parseErr: null, output: { extraction_meta: { decision: "EXTRACTED" } } });
  expect(result.truncatedCalls).toBe(2);
  expect(result.truncated).toMatchObject({ parseErr: null, output: { extraction_meta: { decision: "EXTRACTED" } } });
  expect(result.truncated.output.retry_count).toBeUndefined();
  expect(result.markdown.prompt_audit).toMatchObject({ transcript_present: true, transcript_injected: true, resolved_prompt_contains_transcript: true });
  expect(result.markdown.resolved_prompt).toContain("Клиент: Хочу купить квартиру");
  expect(result.schemaCalls).toBe(1);
  expect(result.schemaMismatch).toMatchObject({
    status: "bad",
    raw: expect.any(String),
    output: { status: "technical_error", error_code: "SCHEMA_VALIDATION_FAILED", parse_error: "facts[0].value: expected string | number | boolean | string[] | number[], received null", retry_count: 0 },
  });
  expect(result.schemaMismatch.output.raw_response).toBe(result.schemaMismatch.raw);
  expect(result.categoryRepairCalls).toBe(2);
  expect(result.categoryRepair).toMatchObject({ parseErr: null, output: { facts: [expect.objectContaining({ category: "client_finance" })] } });
  expect(result.categoryRepairPrompts[1]).toContain("Использованы недопустимые category: unknown_category");
  expect(result.categoryRepairPrompts[1]).toContain("Измени только category");
  expect(result.repeatedUnknownCalls).toBe(2);
  expect(result.repeatedUnknown.output).toMatchObject({ status: "technical_error", error_code: "SCHEMA_VALIDATION_FAILED", retry_count: 1 });
  expect(result.contractCalls).toBe(0);
  expect(result.contractMismatch.output).toMatchObject({ status: "technical_error", error_code: "CONTRACT_CONFIGURATION_ERROR", retry_count: 0 });
  expect(result.schemaEnum).toEqual([
    "client_identity", "client_role", "client_intent", "object_context", "object_information", "search_location", "search_criteria", "client_finance", "client_question", "client_objection", "client_constraint", "client_preference", "client_motivation", "legal_context", "communication_channel", "agent_commitment", "communication_result", "communication_context", "other_important",
  ]);
  expect(result.uiCategories).toContain("client_identity");
  expect(result.uiCategories).toContain("other_important");
  expect(result.appendix).not.toMatch(/результат звонка|договор[её]нност|следующ(?:ий|его) шаг|ответственн|срок действия/i);
  expect(result.oldRootCalls).toBe(1);
  expect(result.oldRootReport.output).toMatchObject({ status: "technical_error", error_code: "SCHEMA_VALIDATION_FAILED", parse_error: "facts: expected defined, received undefined" });
  expect(result.legacyArrayCalls).toBe(1);
  expect(result.legacyArrayReport).toMatchObject({ status: "warn", parseErr: null, output: { facts: [expect.objectContaining({ id: "f1", normalized_value: null, speaker: "Клиент" })] }, contract_audit: { status: "RECOVERED_WITH_WARNING", structured_output_requested: true, structured_output_applied: true, response_schema_id: "facts_v2", parser_schema_id: "facts_v2", warnings: ["ROOT_ARRAY_AUTO_WRAPPED"] } });
  expect(result.pipelineStop).toMatchObject({ downstreamRan: false, marker: undefined, facts: { status: "technical_error", error_code: "SCHEMA_VALIDATION_FAILED" } });
  expect(result.pipelineStop.execution).toMatchObject({ pipeline_status: "TECHNICAL_ERROR", steps_total: 16, steps_executed: 2, steps_successful: 1, stopped_at_stage: "facts" });
  expect(result.pipelineStop.execution.stages.slice(2).every((stage: { status: string }) => stage.status === "NOT_RUN")).toBe(true);
  expect(result.pipelineStop.finalText).toContain("Этапов выполнено: 2");
  expect(result.pipelineStop.finalText).toContain("Успешно пройдено: 1");
  expect(result.pipelineStop.finalText).not.toContain("Шагов пройдено: 16");
  expect(result.pipelineStop.facts.facts).toBeUndefined();
});

test("Проверка фактов валидирует вход, Judge и сама рассчитывает решение", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(async () => {
    const fact=(id,category='client_intent',overrides={})=>({id,category,name:category,value:'значение '+id,normalized_value:'значение '+id,speaker:'Клиент',evidence:'значение '+id,confidence:.96,verification_status:'pending',...overrides});
    const quote=(id,factId,overrides={})=>({id,text:'значение '+factId,speaker:'Клиент',supports_fact_ids:[factId],confidence:.96,verification_status:'pending',...overrides});
    const root=(facts,quotes=[])=>({facts,quotes,extraction_meta:{fact_count:facts.length,quote_count:quotes.length,decision:facts.length?'EXTRACTED':'NO_FACTS'}});
    const quality={facts_checked:999,facts_verified:0,facts_rejected:999,quotes_checked:999,quotes_verified:0,quotes_rejected:999,critical_facts_missing:999,precision_score:0,critical_recall_score:0,quote_score:0,overall_score:0,decision:'FAIL'};
    const criterion={name:'Evidence match',status:'pass',score:100,explanation:'Проверено'};
    const judge=(input,{rejectFacts=[],rejectQuotes=[],missing=[],unknownVerified=null}={})=>{
      const rejectFactIds=new Set(rejectFacts.map(item=>item.id));
      const rejectQuoteIds=new Set(rejectQuotes.map(item=>item.id));
      return {verified_facts:[...input.facts.filter(item=>!rejectFactIds.has(item.id)).map(item=>({id:item.id,verified:true,reason:'подтверждён'})),...(unknownVerified?[{id:unknownVerified,verified:true,reason:'подтверждён'}]:[])],rejected_facts:rejectFacts,verified_quotes:input.quotes.filter(item=>!rejectQuoteIds.has(item.id)).map(item=>({id:item.id,verified:true,reason:'дословная цитата'})),rejected_quotes:rejectQuotes,missing_critical_facts:missing,fact_check_quality:{...quality},criteria:[criterion]};
    };
    const stage={type:'hybrid',name:'Проверка фактов',codeFn:'factCheckCode',outKey:'fact_check',model:'gpt-5-mini',provider:'mock',prompt:'Факты: {{ctx.facts}} Транскрипция: {{transcript}}'};
    const transcript='Клиент: Хочу купить квартиру. Бюджет до десяти миллионов.\\nАгент: Подготовлю варианты.';
    const runMerge=(input,verdict)=>{
      const code=CODE_FUNCS.factCheckCode(stage,{facts:input,__transcript:transcript});
      try{validateFactJudgeOutput(verdict,input);return mergeFactCheck(code,verdict,null,input)}catch(error){return mergeFactCheck(code,null,error.message,input)}
    };
    const validInput=root([fact('fact_1','client_intent')],[quote('quote_1','fact_1')]);
    const valid=runMerge(validInput,judge(validInput));
    const invalidRoot={facts:[]};
    let invalidRootCalls=0;
    const original=callModelWithTransientRetry;
    callModelWithTransientRetry=async()=>{invalidRootCalls++;return {text:'{}',tokens:1,actualModel:'test',actualProvider:'test'}};
    const invalidRootReport=await runStage(stage,{facts:invalidRoot,__transcript:transcript});
    const duplicateInput=root([fact('fact_1'),fact('fact_1')]);
    const brokenReference=root([fact('fact_1')],[quote('quote_1','missing')]);
    const invalidCategory=root([fact('fact_1','not_allowed')]);
    const invalidSpeaker=root([fact('fact_1','client_intent',{speaker:'Покупатель'})]);
    const phoneInput=root([fact('fact_1','communication_context',{value:'+7 999 123-45-67',normalized_value:'+7 999 123-45-67'})]);
    const codeError=input=>CODE_FUNCS.factCheckCode(stage,{facts:input,__transcript:transcript}).schemaError;
    const fourFacts=root([fact('fact_1','client_intent'),fact('fact_2','client_finance'),fact('fact_3','communication_context'),fact('fact_4','search_criteria')]);
    const rejected=(id,error_type,severity='warning',normalization_disputed=false)=>({id,verified:false,reason:error_type,error_type,severity,normalization_disputed});
    const objectPrice=runMerge(validInput,judge(validInput,{rejectFacts:[rejected('fact_1','object_price_as_budget','critical')]}));
    const questionAsFact=runMerge(validInput,judge(validInput,{rejectFacts:[rejected('fact_1','question_as_fact')]}));
    const speakerMismatch=runMerge(validInput,judge(validInput,{rejectFacts:[rejected('fact_1','speaker_mismatch','critical')]}));
    const incorrectNormalization=runMerge(fourFacts,judge(fourFacts,{rejectFacts:[rejected('fact_2','incorrect_normalization','warning',true)]}));
    const duplicateSemantic=runMerge(fourFacts,judge(fourFacts,{rejectFacts:[rejected('fact_4','duplicate_fact')]}));
    const validQuote=runMerge(validInput,judge(validInput));
    const distortedQuote=runMerge(validInput,judge(validInput,{rejectQuotes:[{id:'quote_1',verified:false,reason:'искажена',error_type:'distorted_quote',severity:'warning'}]}));
    const missingBudget=runMerge(validInput,judge(validInput,{missing:[{category:'budget_max',name:'Максимальный бюджет',reason:'пропущен бюджет',critical:true}]}));
    const scoreSpoof=runMerge(validInput,judge(validInput));
    const channelEvidence='Агент: вам в Телегу, в Макс? Клиент: Да, давайте в Макс лучше.';
    const wrongChannelInput=root([fact('fact_channel','communication_context',{name:'preferred_channel',value:'Телеграм (Макс)',normalized_value:'Телеграм (Макс)',evidence:channelEvidence})]);
    const correctChannelInput=root([fact('fact_channel','communication_context',{name:'preferred_channel',value:'MAX',normalized_value:'MAX',evidence:channelEvidence})]);
    const cyrillicChannelInput=root([fact('fact_channel','communication_context',{name:'preferred_channel',value:'Макс',normalized_value:'Макс',evidence:channelEvidence})]);
    const wrongChannel=runMerge(wrongChannelInput,judge(wrongChannelInput));
    const correctChannel=runMerge(correctChannelInput,judge(correctChannelInput));
    const cyrillicChannel=runMerge(cyrillicChannelInput,judge(cyrillicChannelInput));
    const questionFact=fact('fact_question','client_intent',{name:'asserted_intent',value:'Сколько коммунальные платежи?',normalized_value:'Сколько коммунальные платежи?',evidence:'Сколько коммунальные платежи?'});
    const questionQuote={id:'quote_question',text:'Сколько коммунальные платежи?',speaker:'Клиент',supports_fact_ids:['fact_question'],confidence:.98,verification_status:'pending'};
    const questionRoot=root([questionFact],[questionQuote]);
    const rejectedQuestionQuote=runMerge(questionRoot,judge(questionRoot));
    const legitimateQuestionFact=fact('fact_client_question','client_question',{name:'client_question',value:'Сколько коммунальные платежи?',normalized_value:'Сколько коммунальные платежи?',evidence:'Сколько коммунальные платежи?'});
    const legitimateQuestionQuote={...questionQuote,id:'quote_client_question',supports_fact_ids:['fact_client_question']};
    const legitimateQuestionRoot=root([legitimateQuestionFact],[legitimateQuestionQuote]);
    const legitimateQuestion=runMerge(legitimateQuestionRoot,judge(legitimateQuestionRoot));
    const realReportMissing={category:'communication_context',name:'agent_follow_up_timing',reason:'Агент обещал связаться сегодня либо завтра; это следующий шаг.',critical:true};
    const outcomeOwnedMissing=runMerge(validInput,judge(validInput,{missing:[realReportMissing]}));
    let unknownCalls=0;
    callModelWithTransientRetry=async()=>{unknownCalls++;return {text:JSON.stringify(judge(validInput,{unknownVerified:'fact_missing'})),tokens:10,actualModel:'test',actualProvider:'test',finishReason:'stop'}};
    const unknownJudge=await runStage(stage,{facts:validInput,__transcript:transcript});
    let downstreamRan=false;
    CODE_FUNCS.factCheckDownstreamMarker=()=>{downstreamRan=true;return {output:{ran:true},status:'ok',metrics:[],checks:[]}};
    const originalPipeline=pipeline;
    pipeline=[{...stage,id:'fact-check-stage',enabled:true},{id:'fact-check-marker',enabled:true,type:'code',name:'Маркер downstream',codeFn:'factCheckDownstreamMarker',outKey:'marker'}];
    renderStages();
    document.getElementById('transcript').value=transcript;
    await runPipeline();
    const pipelineStop={downstreamRan,marker:ctx.marker,fact_check:ctx.fact_check};
    pipeline=originalPipeline;renderStages();delete CODE_FUNCS.factCheckDownstreamMarker;
    const store=CODE_FUNCS.conversationStore({}, {__transcript:transcript,validation:{score:1},fact_check:valid,need_check:{verified_needs:[{value:'купить',confidence:.96,evidence:'хочу купить',verified:true}],fact_check_quality:{score:1,decision:'PASS'},need_check_quality:{score:1,decision:'PASS'},decision:'PASS'},outcome_check:{verified_outcome:{next_step:{value:'перезвонить',confidence:.96,evidence:'перезвоню',verified:true}},outcome_check_quality:{score:1,decision:'PASS'},decision:'PASS'}}).output;
    callModelWithTransientRetry=original;
    return {valid,invalidRootCalls,invalidRootReport,duplicate:codeError(duplicateInput),brokenReference:codeError(brokenReference),invalidCategory:codeError(invalidCategory),invalidSpeaker:codeError(invalidSpeaker),phone:codeError(phoneInput),objectPrice,questionAsFact,speakerMismatch,incorrectNormalization,duplicateSemantic,validQuote,distortedQuote,missingBudget,scoreSpoof,wrongChannel,correctChannel,cyrillicChannel,rejectedQuestionQuote,legitimateQuestion,outcomeOwnedMissing,unknownCalls,unknownJudge,pipelineStop,store};
  })()`));

  expect(result.valid).toMatchObject({ decision: "PASS", fact_check_quality: { facts_checked: 1, facts_verified: 1, facts_rejected: 0, quotes_checked: 1, quotes_verified: 1, precision_score: 1, critical_recall_score: 1, quote_score: 1, overall_score: 1, decision: "PASS" } });
  expect(result.invalidRootCalls).toBe(0);
  expect(result.invalidRootReport.output).toMatchObject({ status: "technical_error", error_code: "SCHEMA_VALIDATION_FAILED", schema_error: "quotes: expected defined, received undefined" });
  expect(result.duplicate).toBe('facts[1].id: duplicate id "fact_1"');
  expect(result.brokenReference).toBe('quotes[0].supports_fact_ids[0]: unknown fact id "missing"');
  expect(result.invalidCategory).toBe('facts[0].category: unknown enum value "not_allowed"');
  expect(result.invalidSpeaker).toBe("facts[0].speaker: expected Клиент | Агент | Оператор | Третье лицо, received string");
  expect(result.phone).toBe("facts[0].value: phone number is forbidden");
  expect(result.objectPrice).toMatchObject({ decision: "FAIL", rejected_facts: [expect.objectContaining({ error_type: "object_price_as_budget" })] });
  expect(result.questionAsFact.rejected_facts[0].error_type).toBe("question_as_fact");
  expect(result.speakerMismatch).toMatchObject({ decision: "FAIL", rejected_facts: [expect.objectContaining({ error_type: "speaker_mismatch" })] });
  expect(result.incorrectNormalization).toMatchObject({ decision: "MANUAL_REVIEW", rejected_facts: [expect.objectContaining({ error_type: "incorrect_normalization", normalization_disputed: true })] });
  expect(result.duplicateSemantic.rejected_facts[0].error_type).toBe("duplicate_fact");
  expect(result.validQuote.verified_quotes).toHaveLength(1);
  expect(result.distortedQuote).toMatchObject({ decision: "PASS_WITH_WARNINGS", rejected_quotes: [expect.objectContaining({ error_type: "distorted_quote" })] });
  expect(result.missingBudget).toMatchObject({ decision: "MANUAL_REVIEW", fact_check_quality: { critical_facts_missing: 1, critical_recall_score: 0.5 } });
  expect(result.scoreSpoof.fact_check_quality).toMatchObject({ precision_score: 1, critical_recall_score: 1, quote_score: 1, overall_score: 1, decision: "PASS" });
  expect(result.wrongChannel.rejected_facts).toEqual([expect.objectContaining({ id: "fact_channel", error_type: "evidence_mismatch" })]);
  expect(result.correctChannel.verified_facts).toEqual([expect.objectContaining({ id: "fact_channel", value: "MAX", normalized_value: "MAX" })]);
  expect(result.cyrillicChannel.verified_facts).toEqual([expect.objectContaining({ id: "fact_channel", value: "Макс", normalized_value: "Макс" })]);
  expect(result.rejectedQuestionQuote).toMatchObject({ verified_facts: [], verified_quotes: [], rejected_facts: [expect.objectContaining({ id: "fact_question", error_type: "question_as_fact" })], rejected_quotes: [expect.objectContaining({ id: "quote_question", error_type: "quote_supports_rejected_fact" })] });
  expect(result.legitimateQuestion).toMatchObject({ decision: "PASS", verified_facts: [expect.objectContaining({ id: "fact_client_question", category: "client_question" })], verified_quotes: [expect.objectContaining({ id: "quote_client_question", supports_fact_ids: ["fact_client_question"] })], rejected_facts: [], rejected_quotes: [] });
  expect(result.outcomeOwnedMissing).toMatchObject({ decision: "PASS", missing_critical_facts: [], outcome_owned_missing_ignored: [expect.objectContaining({ name: "agent_follow_up_timing" })] });
  // 2026-07-22: schema-class errors on fact_check/need_check/outcome_check now get
  // one retry attempt (a real production run showed this recovers a dropped-id
  // formatting slip) -- this mock always returns the same broken "fact_missing"
  // id regardless of call count, so the retry can't help here and the final
  // outcome below is unchanged; only the call count grows from 1 to 2.
  expect(result.unknownCalls).toBe(2);
  expect(result.unknownJudge.output).toMatchObject({ status: "technical_error", error_code: "INVALID_JUDGE_OUTPUT" });
  expect(result.unknownJudge.output.schema_error).toContain('verified_facts[1].id: unknown input id "fact_missing"');
  expect(result.pipelineStop).toMatchObject({ downstreamRan: false, marker: undefined, fact_check: { status: "technical_error", error_code: "SCHEMA_VALIDATION_FAILED" } });
});

test("Need Agent использует новый контракт, канонические справочники и verified facts", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(async () => {
    const fact=(id,category,evidence,value=evidence,overrides={})=>({id,category,name:category,value,normalized_value:value,speaker:'Клиент',evidence,confidence:.96,verification_status:'verified',verified:true,source:'fact_check',...overrides});
    const pending=f=>({id:f.id,category:f.category,name:f.name,value:f.value,normalized_value:f.normalized_value,speaker:f.speaker,evidence:f.evidence,confidence:f.confidence,verification_status:'pending'});
    const item=(value,source_fact_ids=[],evidence='')=>({value,confidence:.95,evidence,source_fact_ids,verification_status:'pending'});
    const requirement=(id,type,value,source_fact_ids,evidence)=>({id,type,value,confidence:.95,evidence,source_fact_ids,verification_status:'pending'});
    const root=(interest=[],funding=item('не определено'),term=item('не определено'),requirements=[])=>({attributes:{interest,funding_source:funding,purchase_term:term},requirements,need_meta:{interest_count:interest.length,requirements_count:requirements.length,decision:interest.length||requirements.length||funding.value!=='не определено'||term.value!=='не определено'?'EXTRACTED':'NO_NEEDS'}});
    const ctxFor=facts=>({__transcript:facts.map(f=>f.evidence).join('\\n'),fact_check:{decision:'PASS',verified_facts:facts},facts:{facts:facts.map(pending),quotes:[],extraction_meta:{fact_count:facts.length,quote_count:0,decision:facts.length?'EXTRACTED':'NO_FACTS'}}});
    const validate=(value,ctx)=>{try{return {ok:true,value:validateNeedExtractionRoot(value,ctx)}}catch(error){return {ok:false,name:error.name,error:error.message}}};
    const general=fact('fact_general','client_intent','Хочу купить квартиру');
    const baseCtx=ctxFor([general]);
    const emptyInterest=validate(root(),baseCtx);
    const mortgage=fact('fact_mortgage','client_finance','Ипотека одобрена банком');
    const newbuild=fact('fact_newbuild','search_criteria','Интересуют новостройки');
    const multiCtx=ctxFor([mortgage,newbuild]);
    const multipleInterest=validate(root([item('Новостройки',['fact_newbuild'],newbuild.evidence),item('Ипотека',['fact_mortgage'],mortgage.evidence)],item('ипотека одобрена',['fact_mortgage'],mortgage.evidence)),multiCtx);
    const unknownInterest=validate(root([item('Вторичка',['fact_general'],general.evidence)]),baseCtx);
    const legacyCash=validate(root([],item('наличные',['fact_general'],general.evidence)),baseCtx);
    const canonicalCash=validate(root([],item('наличные / депозит',['fact_general'],'Оплачу наличными')),baseCtx);
    const legacyTerm=validate(root([],item('не определено'),item('2-3 месяца',['fact_general'],general.evidence)),baseCtx);
    const canonicalTerm=validate(root([],item('не определено'),item('2–3 месяца',['fact_general'],'Куплю через два-три месяца')),baseCtx);
    const refusal=fact('fact_refusal','client_finance','Ипотека мне не нужна');
    const refusalResult=validate(root([],item('наличные / депозит',['fact_refusal'],refusal.evidence)),ctxFor([refusal]));
    const plot=fact('fact_plot','search_criteria','Ищу участок в области');
    const plotResult=validate(root([item('Строительство',['fact_plot'],plot.evidence)]),ctxFor([plot]));
    const viewing=fact('fact_viewing','communication_context','Просмотр назначен через два месяца');
    const viewingResult=validate(root([],item('не определено'),item('2–3 месяца',['fact_viewing'],viewing.evidence)),ctxFor([viewing]));
    const cash=fact('fact_cash','client_finance','Оплачу наличными, деньги на депозите');
    const cashResult=validate(root(),ctxFor([cash]));
    const approvedResult=validate(root(),ctxFor([mortgage]));
    const pastSale=fact('fact_past_sale','client_finance','Квартиру уже продал, деньги получил');
    const pastSaleResult=validate(root(),ctxFor([pastSale]));
    const futureSale=fact('fact_future_sale','client_finance','Сначала продам свою квартиру, это источник покупки');
    const futureSaleResult=validate(root(),ctxFor([futureSale]));
    const address=fact('fact_address','object_context','Интересует квартира по адресу улица Ленина, дом 10','улица Ленина, дом 10');
    const addressResult=validate(root([],item('не определено'),item('не определено'),[requirement('req_address','search_location','улица Ленина, дом 10',['fact_address'],address.evidence)]),ctxFor([address]));
    const districts=fact('fact_districts','search_criteria','Рассматриваю Центральный и Петроградский районы',['Центральный район','Петроградский район'],{name:'search_location'});
    const districtsResult=validate(root(),ctxFor([districts]));
    const listingPrice=fact('fact_price','object_information','Цена объявления десять миллионов',10000000);
    const listingPriceResult=validate(root([],item('не определено'),item('не определено'),[requirement('req_price','price_limit',10000000,['fact_price'],listingPrice.evidence)]),ctxFor([listingPrice]));
    const budget=fact('fact_budget','client_finance','Мой бюджет до десяти миллионов',10000000,{name:'budget_max'});
    const budgetResult=validate(root(),ctxFor([budget]));
    const reportBudget=fact('fact_report_budget','client_finance','у меня просто цена до пяти с половиной, вот так.','до пяти с половиной',{name:'максимальная цена',normalized_value:5500000});
    const reportLocation=fact('fact_report_location','search_location','Деревня Мистолово.','Деревня Мистолово',{name:'область поиска',normalized_value:'Деревня Мистолово'});
    const reportObjectArea=fact('fact_report_object_area','object_information','Шесть соток? — Да.','6 соток',{name:'land_area',normalized_value:6});
    const reportArea=fact('fact_report_area','client_constraint','Минимум шесть соток мне надо.','минимум шесть соток',{name:'minimum_area',normalized_value:6});
    const reportNeedsResult=validate(root(),ctxFor([reportObjectArea,reportBudget,reportArea,reportLocation]));
    const badSource=validate(root([],item('не определено'),item('не определено'),[requirement('req_1','rooms','две комнаты',['fact_missing'],'Нужно две комнаты')]),baseCtx);
    const mismatch=root([item('Новостройки',['fact_newbuild'],newbuild.evidence)]);mismatch.need_meta.interest_count=2;
    const countMismatch=validate(mismatch,multiCtx);
    const stage={type:'llm',name:'Определение потребностей',outKey:'needs',model:'gpt-5-mini',provider:'mock',prompt:'Verified: {{ctx.fact_check.verified_facts}} Facts: {{ctx.facts}} Transcript: {{transcript}}'};
    const original=callModelWithTransientRetry;
    let blockedCalls=0;
    callModelWithTransientRetry=async()=>{blockedCalls++;return {text:JSON.stringify(root()),tokens:1,actualModel:'test',actualProvider:'test'}};
    const upstreamBlocked=await runStage(stage,{__transcript:'Клиент: Хочу квартиру',fact_check:{decision:'FAIL',verified_facts:[]},facts:{facts:[]}});
    let downstreamRan=false;
    CODE_FUNCS.needDownstreamMarker=()=>{downstreamRan=true;return {output:{ran:true},status:'ok',metrics:[],checks:[]}};
    const originalPipeline=pipeline;
    pipeline=[{...stage,id:'need-stage',enabled:true},{id:'need-marker',enabled:true,type:'code',name:'Маркер downstream',codeFn:'needDownstreamMarker',outKey:'marker'}];
    renderStages();document.getElementById('transcript').value='Клиент: Хочу квартиру';await runPipeline();
    const pipelineStop={downstreamRan,marker:ctx.marker,needs:ctx.needs};
    pipeline=originalPipeline;renderStages();delete CODE_FUNCS.needDownstreamMarker;callModelWithTransientRetry=original;
    return {emptyInterest,multipleInterest,unknownInterest,legacyCash,canonicalCash,legacyTerm,canonicalTerm,refusalResult,plotResult,viewingResult,cashResult,approvedResult,pastSaleResult,futureSaleResult,addressResult,districtsResult,listingPriceResult,budgetResult,reportNeedsResult,badSource,countMismatch,blockedCalls,upstreamBlocked,pipelineStop};
  })()`));

  expect(result.emptyInterest).toMatchObject({ ok: true, value: { attributes: { interest: [] }, need_meta: { decision: "NO_NEEDS" } } });
  expect(result.multipleInterest.value.attributes.interest.map((item: any) => item.value)).toEqual(["Новостройки", "Ипотека"]);
  expect(result.unknownInterest.error).toBe('attributes.interest[0].value: expected canonical enum, received "Вторичка"');
  expect(result.legacyCash.error).toBe('attributes.funding_source.value: expected canonical enum, received "наличные"');
  expect(result.canonicalCash.ok).toBe(true);
  expect(result.legacyTerm.error).toBe('attributes.purchase_term.value: expected canonical enum, received "2-3 месяца"');
  expect(result.canonicalTerm.ok).toBe(true);
  expect(result.refusalResult.value.attributes.funding_source.value).toBe("не определено");
  expect(result.plotResult.value.attributes.interest).toEqual([]);
  expect(result.viewingResult.value.attributes.purchase_term.value).toBe("не определено");
  expect(result.cashResult.value.attributes.funding_source.value).toBe("наличные / депозит");
  expect(result.approvedResult.value.attributes.interest.map((item: any) => item.value)).toContain("Ипотека");
  expect(result.approvedResult.value.attributes.funding_source.value).toBe("ипотека одобрена");
  expect(result.pastSaleResult.value.attributes.funding_source.value).toBe("наличные / депозит");
  expect(result.futureSaleResult.value.attributes.funding_source.value).toBe("продажа своей квартиры");
  expect(result.addressResult.value.requirements).toEqual([]);
  expect(result.districtsResult.value.requirements).toEqual([expect.objectContaining({ type: "search_location", value: ["Центральный район", "Петроградский район"], source_fact_ids: ["fact_districts"] })]);
  expect(result.listingPriceResult.value.requirements).toEqual([]);
  expect(result.budgetResult.value.requirements).toEqual([expect.objectContaining({ type: "price_limit", value: 10000000, source_fact_ids: ["fact_budget"] })]);
  expect(result.reportNeedsResult.value).toMatchObject({
    need_meta: { decision: "EXTRACTED", requirements_count: 3 },
    requirements: expect.arrayContaining([
      expect.objectContaining({ type: "price_limit", value: 5500000, source_fact_ids: ["fact_report_budget"] }),
      expect.objectContaining({ type: "minimum_land_area", value: 6, source_fact_ids: ["fact_report_area"] }),
      expect.objectContaining({ type: "search_location", value: "Мистолово", source_fact_ids: ["fact_report_location"] }),
    ]),
  });
  expect(result.reportNeedsResult.value.requirements).not.toEqual(expect.arrayContaining([
    expect.objectContaining({ source_fact_ids: ["fact_report_object_area"] }),
  ]));
  expect(result.badSource.error).toBe('requirements[0].source_fact_ids[0]: unknown verified fact id "fact_missing"');
  expect(result.countMismatch.error).toBe("need_meta.interest_count: expected 1, received 2");
  expect(result.blockedCalls).toBe(0);
  expect(result.upstreamBlocked.output).toMatchObject({ status: "technical_error", error_code: "UPSTREAM_FACT_CHECK_FAILED" });
  expect(result.pipelineStop).toMatchObject({ downstreamRan: false, marker: undefined, needs: { status: "technical_error", error_code: "UPSTREAM_FACT_CHECK_FAILED" } });
});

test("Outcome Agent использует новый строгий контракт и semantic guards", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(async () => {
    const resultItem=(value,evidence='Клиент: договорились')=>({id:'result_1',value,evidence,confidence:.96,verification_status:'pending'});
    const agreement=(id,action,evidence,status='promised',extra={})=>({id,action,owner:'агент',recipient:'клиент',deadline:'',channel:'',status,evidence,confidence:.95,verification_status:'pending',...extra});
    const primary=(ids=[],extra={})=>({action:ids.length?'Агент выполнит действие':'',owner:ids.length?'агент':'',deadline:'',channel:'',status:ids.length?'promised':'not_defined',agreement_ids:ids,confidence:.95,verification_status:'pending',...extra});
    const root=(call_results=[],agreements=[],next=primary(),meta={})=>({call_results,agreements,primary_next_step:next,outcome_meta:{result_count:call_results.length,agreement_count:agreements.length,decision:call_results.length||agreements.length?'EXTRACTED':'NO_OUTCOME',...meta}});
    const ctx={__transcript:'Клиент: Да, договорились. Агент: Я отправлю видео, подготовлю подборку и уточню информацию.',fact_check:{status:'ok',decision:'PASS',verified_facts:[]},need_check:{status:'ok',decision:'PASS',verified_attributes:{},verified_requirements:[]}};
    const check=value=>{try{return {ok:true,value:validateOutcomeExtractionRoot(value,ctx)}}catch(error){return {ok:false,error:error.message}}};
    const videoAgreement=agreement('agr_video','Агент отправит видео','Агент: Я отправлю видео клиенту','promised',{channel:'видео'});
    const video=check(root([], [videoAgreement], primary(['agr_video'],{action:'Агент отправил видео',channel:'видео'})));
    const selectionAgreement=agreement('agr_selection','Агент подготовит подборку','Агент: Я подготовлю подборку');
    const selection=check(root([], [selectionAgreement], primary(['agr_selection'],{action:'Агент подготовил подборку'})));
    const proposedViewing=agreement('agr_view','Предложить просмотр квартиры','Агент: Могу предложить вам просмотр','proposed');
    const proposed=check(root([resultItem('назначен показ','Агент предложил просмотр')],[proposedViewing],primary(['agr_view'],{action:'Провести просмотр',status:'confirmed'})));
    const preliminaryAgreement=agreement('agr_pre','Провести просмотр','Клиент: Предварительно давайте посмотрим','preliminary');
    const preliminary=check(root([resultItem('показ предварительно согласован','Клиент: Предварительно давайте посмотрим')],[preliminaryAgreement],primary(['agr_pre'],{action:'Провести просмотр',status:'preliminary'})));
    const confirmedAgreement=agreement('agr_confirmed','Провести просмотр','Клиент: Да, договорились на просмотр','confirmed');
    const confirmed=check(root([resultItem('назначен показ','Клиент: Да, договорились на просмотр')],[confirmedAgreement],primary(['agr_confirmed'],{action:'Провести просмотр',status:'confirmed'})));
    const vague=check(root([resultItem('назначен повторный звонок','Клиент: Будем на связи')]));
    const clarifyAgreement=agreement('agr_clarify','Агент уточнит информацию','Агент: Я уточню информацию и сообщу');
    const clarify=check(root([], [clarifyAgreement],primary(['agr_clarify'],{action:'Агент уточнил информацию'})));
    const objectFact=check(root([], [agreement('agr_object','Квартира продаётся','Квартира продаётся, площадь 54 метра')]));
    const mortgageFact=check(root([], [agreement('agr_mortgage','Ипотека не нужна','Клиент: Ипотека мне не нужна')]));
    const agentRefusal=check(root([resultItem('отказ','Агент: Тогда отказываемся от продолжения')]));
    const viewingDateAsTerm=check({...root(),purchase_term:'2–3 месяца'});
    const unknownResult=check(root([resultItem('недостаточно информации','Клиент: Пока не решил')]));
    const invented=check(root([], [agreement('agr_invented','Агент отправит материалы','Агент: Я отправлю материалы','promised',{deadline:'завтра',channel:'WhatsApp'})],primary(['agr_invented'],{action:'Агент отправит материалы',deadline:'завтра',channel:'WhatsApp'})));
    const duplicate=check(root([], [videoAgreement,{...videoAgreement}]));
    const badReference=check(root([], [videoAgreement],primary(['agr_missing'])));
    const proposedPrimary=check(root([], [proposedViewing],primary(['agr_view'],{action:'Провести просмотр',status:'confirmed'})));
    const countMismatch=check(root([], [videoAgreement],primary(),{agreement_count:2}));
    const empty=check(root());
    const current=check(root([], [videoAgreement,selectionAgreement],primary(['agr_video'],{action:'Агент отправит видео',channel:'видео'})));
    const deadlineCtx={...ctx,__transcript:'Агент:\\n— Сегодня уточню всю информацию и либо сегодня, либо завтра свяжусь с вами.\\nКлиент:\\n— Хорошо.'};
    const deadlineAgreement=agreement('agr_deadline','уточнить расходы и сообщить клиенту','Если вам нужны точные цифры, я уточню их у собственника и сообщу.');
    const recoveredDeadline=validateOutcomeExtractionRoot(root([], [deadlineAgreement],primary(['agr_deadline'],{action:'уточнить расходы и сообщить клиенту'})),deadlineCtx);
    const immediateCtx={...ctx,__transcript:'Агент:\\n— Я сейчас скину вам видео.\\nКлиент:\\n— Хорошо, жду.'};
    const immediateAgreement=agreement('agr_immediate','отправить видео клиенту','Агент: Я сейчас скину вам видео.');
    const recoveredImmediateDeadline=validateOutcomeExtractionRoot(root([], [immediateAgreement],primary(['agr_immediate'],{action:'отправить видео клиенту'})),immediateCtx);
    const oldRoot=check({call_result:{value:'назначен показ'},next_step:{},agreements:{value:[]}});
    const stage={type:'llm',name:'Результат звонка и следующий шаг',outKey:'outcome',model:'gpt-5-mini',provider:'mock',prompt:'{{transcript}}'};
    const original=callModelWithTransientRetry;
    let dependencyCalls=0;
    callModelWithTransientRetry=async()=>{dependencyCalls++;return {text:'{}',tokens:1,actualModel:'test',actualProvider:'test'}};
    const dependency=await runStage(stage,{__transcript:'Клиент: Да',fact_check:{status:'technical_error'},need_check:{status:'ok'}});
    let schemaCalls=0;
    callModelWithTransientRetry=async()=>{schemaCalls++;return {text:JSON.stringify({...root(),primary_next_step:{...primary(),owner:null}}),tokens:1,actualModel:'test',actualProvider:'test'}};
    const schemaFailure=await runStage(stage,ctx);
    let downstreamRan=false;
    CODE_FUNCS.outcomeDownstreamMarker=()=>{downstreamRan=true;return {output:{ran:true},status:'ok',metrics:[],checks:[]}};
    const originalCredentials=hasProviderCredentials;hasProviderCredentials=()=>true;
    const originalPipeline=pipeline;
    pipeline=[{...stage,id:'outcome-stage',enabled:true},{id:'outcome-marker',enabled:true,type:'code',name:'Маркер downstream',codeFn:'outcomeDownstreamMarker',outKey:'marker'}];
    renderStages();document.getElementById('transcript').value='Клиент: Да';await runPipeline();
    const pipelineStop={downstreamRan,marker:ctx.marker,outcome:ctx.outcome};
    pipeline=originalPipeline;renderStages();hasProviderCredentials=originalCredentials;delete CODE_FUNCS.outcomeDownstreamMarker;callModelWithTransientRetry=original;
    return {video,selection,proposed,preliminary,confirmed,vague,clarify,objectFact,mortgageFact,agentRefusal,viewingDateAsTerm,unknownResult,invented,duplicate,badReference,proposedPrimary,countMismatch,empty,current,recoveredDeadline,recoveredImmediateDeadline,oldRoot,dependencyCalls,dependency,schemaCalls,schemaFailure,pipelineStop};
  })()`));

  expect(result.video.value.call_results.map((item: any) => item.value)).toContain("агент отправит материалы");
  expect(result.video.value.primary_next_step.action).toBe("Агент отправит видео");
  expect(result.selection.value.call_results.map((item: any) => item.value)).toContain("агент подготовит подборку");
  expect(result.selection.value.primary_next_step.action).toBe("Агент подготовит подборку");
  expect(result.recoveredDeadline.agreements[0]).toMatchObject({ deadline: "сегодня либо завтра", evidence: expect.stringContaining("Сегодня уточню всю информацию") });
  expect(result.recoveredDeadline.primary_next_step.deadline).toBe("сегодня либо завтра");
  expect(result.recoveredImmediateDeadline.agreements[0].deadline).toBe("после звонка");
  expect(result.recoveredImmediateDeadline.primary_next_step.deadline).toBe("после звонка");
  expect(result.proposed.value.call_results).toEqual([]);
  expect(result.proposed.value.primary_next_step).toMatchObject({ status: "not_defined", owner: "", agreement_ids: [] });
  expect(result.preliminary.value.call_results.map((item: any) => item.value)).toContain("показ предварительно согласован");
  expect(result.preliminary.value.primary_next_step.status).toBe("preliminary");
  expect(result.confirmed.value.call_results.map((item: any) => item.value)).toContain("назначен показ");
  expect(result.confirmed.value.primary_next_step.status).toBe("confirmed");
  expect(result.vague.value).toMatchObject({ call_results: [], outcome_meta: { decision: "NO_OUTCOME" } });
  expect(result.clarify.value.call_results.map((item: any) => item.value)).toContain("агент уточнит информацию");
  expect(result.clarify.value.primary_next_step.action).toBe("Агент уточнит информацию");
  expect(result.objectFact.value).toMatchObject({ agreements: [], primary_next_step: { status: "not_defined" } });
  expect(result.mortgageFact.value.agreements).toEqual([]);
  expect(result.agentRefusal.value.call_results).toEqual([]);
  expect(result.viewingDateAsTerm.error).toBe("purchase_term: unexpected field");
  expect(result.unknownResult.error).toBe('call_results[0].value: expected canonical enum, received "недостаточно информации"');
  expect(result.invented.value.agreements[0]).toMatchObject({ deadline: "не определено", channel: "" });
  expect(result.invented.value.primary_next_step).toMatchObject({ deadline: "не определено", channel: "" });
  expect(result.duplicate.error).toBe('agreements[1].id: duplicate id "agr_video"');
  expect(result.badReference.error).toBe('primary_next_step.agreement_ids[0]: unknown agreement id "agr_missing"');
  expect(result.proposedPrimary.value.primary_next_step).toMatchObject({ status: "not_defined", agreement_ids: [] });
  expect(result.countMismatch.error).toBe("outcome_meta.agreement_count: expected 1, received 2");
  expect(result.empty.value).toMatchObject({ call_results: [], agreements: [], primary_next_step: { status: "not_defined", owner: "" }, outcome_meta: { decision: "NO_OUTCOME" } });
  expect(result.current.value.call_results.map((item: any) => item.value)).toEqual(expect.arrayContaining(["агент отправит материалы", "агент подготовит подборку"]));
  expect(result.oldRoot.error).toBe("call_results: expected defined, received undefined");
  expect(result.dependencyCalls).toBe(0);
  expect(result.dependency.output).toMatchObject({ status: "dependency_error", error_code: "DEPENDENCY_ERROR" });
  expect(result.schemaCalls).toBe(1);
  expect(result.schemaFailure.output).toMatchObject({ status: "technical_error", error_code: "SCHEMA_VALIDATION_FAILED", schema_error: "primary_next_step.owner: expected canonical enum, received null" });
  expect(result.schemaFailure.output.raw_response).toContain('"owner":null');
  expect(result.pipelineStop).toMatchObject({ downstreamRan: false, marker: undefined });
});

test("Проверка результата валидирует Judge, semantic guards и сама рассчитывает quality", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(async () => {
    const resultItem=(id,value,evidence)=>({id,value,evidence,confidence:.96,verification_status:'pending'});
    const agreement=(id,action,evidence,status='promised',extra={})=>({id,action,owner:'агент',recipient:'клиент',deadline:'',channel:'',status,evidence,confidence:.95,verification_status:'pending',...extra});
    const primary=(ids=[],extra={})=>({action:ids.length?'Выполнить действие':'',owner:ids.length?'агент':'',deadline:'',channel:'',status:ids.length?'promised':'not_defined',agreement_ids:ids,confidence:.95,verification_status:'pending',...extra});
    const root=(call_results=[],agreements=[],next=primary(),meta={})=>({call_results,agreements,primary_next_step:next,outcome_meta:{result_count:call_results.length,agreement_count:agreements.length,decision:call_results.length||agreements.length?'EXTRACTED':'NO_OUTCOME',...meta}});
    const deps={fact_check:{status:'ok',decision:'PASS',verified_facts:[]},need_check:{status:'ok',decision:'PASS',verified_attributes:{},verified_requirements:[]}};
    const ctxFor=(outcome,transcript)=>({__transcript:transcript,...deps,outcome});
    const quality={results_checked:999,results_verified:0,results_rejected:999,agreements_checked:999,agreements_verified:0,agreements_rejected:999,primary_next_step_verified:0,critical_outcomes_missing:999,result_accuracy_score:0,agreement_precision_score:0,next_step_accuracy_score:0,critical_recall_score:0,overall_score:0,decision:'FAIL'};
    const criterion={name:'Outcome semantics',status:'pass',score:100,explanation:'Проверено'};
    const judge=(input,{rejectResults=[],rejectAgreements=[],rejectPrimary=false,missing=[],decision='FAIL',mutateAgreement=null,mutatePrimary=null}={})=>{
      const rejectedResultIds=new Set(rejectResults.map(item=>item.id)),rejectedAgreementIds=new Set(rejectAgreements.map(item=>item.id));
      const verified_call_results=input.call_results.filter(item=>!rejectedResultIds.has(item.id)).map(item=>({...item,verified:true,reason:'подтверждено'}));
      const verified_agreements=input.agreements.filter(item=>!rejectedAgreementIds.has(item.id)).map(item=>({...item,verified:true,reason:'подтверждено'}));
      if(mutateAgreement&&verified_agreements[0]) Object.assign(verified_agreements[0],mutateAgreement);
      const verifiedPrimary=rejectPrimary?{action:'',owner:'',deadline:'',channel:'',status:'not_defined',agreement_ids:[],confidence:0,verification_status:'pending',verified:false,reason:'отклонено'}:{...input.primary_next_step,verified:true,reason:'подтверждено'};
      if(mutatePrimary&&!rejectPrimary) Object.assign(verifiedPrimary,mutatePrimary);
      return {verified_call_results,rejected_call_results:rejectResults,verified_agreements,rejected_agreements:rejectAgreements,verified_primary_next_step:verifiedPrimary,rejected_primary_next_step:rejectPrimary?{rejected:true,action:input.primary_next_step.action,error_type:'unsupported_primary',reason:'не подтверждено',evidence:'нет подтверждения'}:{rejected:false,action:'',error_type:'',reason:'',evidence:''},missing_critical_outcomes:missing,outcome_check_quality:{...quality,decision},criteria:[criterion]};
    };
    const run=(input,transcript,options={})=>{
      const ctx=ctxFor(input,transcript),code=CODE_FUNCS.outcomeCheckCode({},ctx);
      if(code.hardFail) return {code,output:mergeOutcomeCheck(code,null,code.schemaError||code.dependencyError,input,ctx)};
      const verdict=judge(code.input,options);
      try{validateOutcomeJudgeOutput(verdict,code.input);return {code,output:mergeOutcomeCheck(code,verdict,null,code.input,ctx)}}catch(error){return {code,output:mergeOutcomeCheck(code,null,error.message,code.input,ctx)}}
    };
    const rejectResult=(id,error_type,severity='warning',disputed=false)=>({id,verified:false,error_type,reason:error_type,evidence:'цитата',severity,disputed});
    const rejectAgreement=(id,error_type,severity='warning',disputed=false)=>({id,verified:false,error_type,reason:error_type,evidence:'цитата',severity,disputed});
    const videoAgr=agreement('agr_video','Агент отправит видео','Агент: Я отправлю видео клиенту','promised',{channel:'видео'});
    const videoInput=root([resultItem('res_video','агент отправит материалы','Агент: Я отправлю видео клиенту')],[videoAgr],primary(['agr_video'],{action:'Агент отправит видео',channel:'видео'}));
    const video=run(videoInput,'Агент: Я отправлю видео клиенту');
    const selectionAgr=agreement('agr_selection','Агент подготовит подборку','Агент: Я подготовлю подборку');
    const selection=run(root([resultItem('res_selection','агент подготовит подборку','Агент: Я подготовлю подборку')],[selectionAgr],primary(['agr_selection'],{action:'Агент подготовит подборку'})),'Агент: Я подготовлю подборку');
    const proposedAgr=agreement('agr_proposed','Предложить просмотр','Агент: Могу предложить просмотр','proposed');
    const proposed=run(root([], [proposedAgr]),'Агент: Могу предложить просмотр');
    const proposedPrimary=run(root([], [proposedAgr],primary(['agr_proposed'],{action:'Провести просмотр',status:'confirmed'})),'Агент: Могу предложить просмотр');
    const preliminaryAgr=agreement('agr_pre','Провести просмотр','Клиент: Предварительно можем посмотреть','preliminary');
    const preliminary=run(root([resultItem('res_pre','назначен показ','Клиент: Предварительно можем посмотреть')],[preliminaryAgr],primary(['agr_pre'],{action:'Провести просмотр',status:'preliminary'})),'Клиент: Предварительно можем посмотреть');
    const confirmedAgr=agreement('agr_confirm','Провести просмотр','Клиент: Да, договорились на просмотр','confirmed');
    const confirmed=run(root([resultItem('res_confirm','назначен показ','Клиент: Да, договорились на просмотр')],[confirmedAgr],primary(['agr_confirm'],{action:'Провести просмотр',status:'confirmed'})),'Клиент: Да, договорились на просмотр');
    const vague=run(root([resultItem('res_call','назначен повторный звонок','Клиент: Будем на связи')]),'Клиент: Будем на связи');
    const clarifyAgr=agreement('agr_clarify','Агент уточнит информацию','Агент: Я уточню информацию');
    const clarify=run(root([resultItem('res_clarify','агент уточнит информацию','Агент: Я уточню информацию')],[clarifyAgr],primary(['agr_clarify'],{action:'Агент уточнит информацию'})),'Агент: Я уточню информацию');
    const objectFact=run(root([], [agreement('agr_object','Квартира продаётся','Квартира продаётся, площадь 54 метра')]),'Агент: Квартира продаётся, площадь 54 метра');
    const interest=run(root([], [agreement('agr_interest','Клиент хочет посмотреть другие варианты','Клиент: Я готов посмотреть другие варианты','proposed',{owner:'клиент',recipient:'агент'})]),'Клиент: Я готов посмотреть другие варианты');
    const refusal=run(root([resultItem('res_refusal','отказ','Агент: Тогда отказываемся')]),'Агент: Тогда отказываемся');
    const deadline=run(root([], [agreement('agr_deadline','Агент отправит материалы','Агент: Я отправлю материалы','promised',{deadline:'завтра'})]),'Агент: Я отправлю материалы');
    const channel=run(root([], [agreement('agr_channel','Агент отправит материалы','Агент: Я отправлю материалы','promised',{channel:'WhatsApp'})]),'Агент: Я отправлю материалы');
    const wrongOwner=run(root([], [agreement('agr_owner','Клиент отправит видео','Агент: Я отправлю видео','promised',{owner:'клиент'})]),'Агент: Я отправлю видео');
    const completed=run(root([], [agreement('agr_completed','Агент отправил видео','Агент: Я отправлю видео')]),'Агент: Я отправлю видео');
    const invalidReference=run(root([], [videoAgr],primary(['missing'])),'Агент: Я отправлю видео');
    const duplicate=run(root([], [videoAgr,{...videoAgr}]),'Агент: Я отправлю видео');
    const resultCount=run(root([resultItem('res_count','клиент думает','Клиент: Я подумаю')],[],primary(),{result_count:2}),'Клиент: Я подумаю');
    const agreementCount=run(root([], [videoAgr],primary(),{agreement_count:2}),'Агент: Я отправлю видео');
    const missing=run(root(), 'Клиент: Хорошо',{missing:[{type:'primary_next_step',name:'Следующий шаг',reason:'пропущен',critical:true}],decision:'PASS'});
    const primaryRejected=run(videoInput,'Агент: Я отправлю видео клиенту',{rejectPrimary:true,decision:'PASS'});
    const spoof=run(videoInput,'Агент: Я отправлю видео клиенту',{decision:'FAIL'});
    const changed=run(videoInput,'Агент: Я отправлю видео клиенту',{mutateAgreement:{owner:'клиент'}});
    const immediateAgr=agreement('agr_immediate','Агент отправит видео','Агент: Я сейчас скину вам видео в MAX','confirmed',{channel:'MAX'});
    const immediateInput=root([resultItem('res_immediate','агент отправит материалы','Агент: Я сейчас скину вам видео в MAX')],[immediateAgr],primary(['agr_immediate'],{action:'Агент отправит видео',status:'confirmed',channel:'MAX'}));
    const equivalentDeadline=run(immediateInput,'Агент: Я сейчас скину вам видео в MAX',{mutateAgreement:{deadline:'после звонка'},mutatePrimary:{deadline:'после звонка'},decision:'PASS'});
    const rejectedExtra=rejectAgreement('agr_selection','unsupported_agreement');
    const partialInput=root([resultItem('res_video','агент отправит материалы','Агент: Я отправлю видео клиенту')],[videoAgr,selectionAgr],primary(['agr_video'],{action:'Агент отправит видео',channel:'видео'}));
    const partial=run(partialInput,'Агент: Я отправлю видео клиенту. Агент: Я подготовлю подборку.',{rejectAgreements:[rejectedExtra]});
    const store=CODE_FUNCS.conversationStore({}, {__transcript:'Агент: Я отправлю видео клиенту.',validation:{score:1},fact_check:{decision:'PASS',verified_facts:[{id:'fact_1',verified:true,verification_status:'verified',confidence:.95}]},need_check:{decision:'PASS',verified_attributes:{},verified_requirements:[]},outcome_check:partial.output}).output;
    const stage={type:'hybrid',name:'Проверка результата звонка',codeFn:'outcomeCheckCode',outKey:'outcome_check',model:'gpt-5-mini',provider:'mock',prompt:'{{ctx.outcome}} {{transcript}}'};
    const original=callModelWithTransientRetry;let dependencyCalls=0;
    callModelWithTransientRetry=async()=>{dependencyCalls++;return {text:'{}',tokens:1,actualModel:'test',actualProvider:'test'}};
    const dependency=await runStage(stage,{__transcript:'Клиент: Хорошо',outcome:root(),fact_check:{status:'ok',decision:'PASS'}});
    let downstreamRan=false;CODE_FUNCS.outcomeCheckMarker=()=>{downstreamRan=true;return {output:{ran:true},status:'ok',metrics:[],checks:[]}};
    const originalPipeline=pipeline;pipeline=[{...stage,id:'outcome-check-stage',enabled:true},{id:'outcome-check-marker',enabled:true,type:'code',name:'Маркер downstream',codeFn:'outcomeCheckMarker',outKey:'marker'}];renderStages();document.getElementById('transcript').value='Клиент: Хорошо';await runPipeline();
    const pipelineStop={downstreamRan,marker:ctx.marker,outcome_check:ctx.outcome_check};pipeline=originalPipeline;renderStages();delete CODE_FUNCS.outcomeCheckMarker;callModelWithTransientRetry=original;
    return {video,selection,proposed,proposedPrimary,preliminary,confirmed,vague,clarify,objectFact,interest,refusal,deadline,channel,wrongOwner,completed,invalidReference,duplicate,resultCount,agreementCount,missing,primaryRejected,spoof,changed,equivalentDeadline,partial,store,dependencyCalls,dependency,pipelineStop};
  })()`));

  expect(result.video.output).toMatchObject({ decision: "PASS", verified_call_results: [expect.objectContaining({ value: "агент отправит материалы" })], verified_agreements: [expect.objectContaining({ action: "Агент отправит видео", owner: "агент" })], verified_primary_next_step: expect.objectContaining({ action: "Агент отправит видео", verified: true }) });
  expect(result.selection.output.verified_call_results).toEqual([expect.objectContaining({ value: "агент подготовит подборку" })]);
  expect(result.proposed.output).toMatchObject({ decision: "PASS", verified_agreements: [expect.objectContaining({ status: "proposed" })], verified_primary_next_step: { status: "not_defined", verified: true } });
  expect(result.proposedPrimary.output).toMatchObject({ status: "technical_error", error_code: "SCHEMA_VALIDATION_FAILED", schema_error: "primary_next_step.agreement_ids[0]: proposed agreement cannot be primary" });
  expect(result.preliminary.output.rejected_call_results).toEqual([expect.objectContaining({ id: "res_pre", error_type: "invented_showing" })]);
  expect(result.confirmed.output).toMatchObject({ decision: "PASS", verified_call_results: [expect.objectContaining({ value: "назначен показ" })] });
  expect(result.vague.output.rejected_call_results).toEqual([expect.objectContaining({ error_type: "vague_contact_not_callback" })]);
  expect(result.clarify.output.verified_call_results).toEqual([expect.objectContaining({ value: "агент уточнит информацию" })]);
  expect(result.objectFact.output.rejected_agreements).toEqual([expect.objectContaining({ error_type: "fact_not_agreement" })]);
  expect(result.interest.output.rejected_agreements).toEqual([expect.objectContaining({ error_type: "interest_not_agreement" })]);
  expect(result.refusal.output.rejected_call_results).toEqual([expect.objectContaining({ error_type: "invented_refusal" })]);
  expect(result.deadline.output.rejected_agreements).toEqual([expect.objectContaining({ error_type: "invented_deadline" })]);
  expect(result.channel.output.rejected_agreements).toEqual([expect.objectContaining({ error_type: "invented_channel" })]);
  expect(result.wrongOwner.output).toMatchObject({ decision: "FAIL", rejected_agreements: [expect.objectContaining({ error_type: "wrong_owner", severity: "critical" })] });
  expect(result.completed.output.rejected_agreements).toEqual([expect.objectContaining({ error_type: "future_action_as_completed" })]);
  expect(result.invalidReference.output.schema_error).toBe('primary_next_step.agreement_ids[0]: unknown agreement id "missing"');
  expect(result.duplicate.output.schema_error).toBe('agreements[1].id: duplicate id "agr_video"');
  expect(result.resultCount.output.schema_error).toBe("outcome_meta.result_count: expected 1, received 2");
  expect(result.agreementCount.output.schema_error).toBe("outcome_meta.agreement_count: expected 1, received 2");
  expect(result.missing.output).toMatchObject({ decision: "MANUAL_REVIEW", outcome_check_quality: { critical_outcomes_missing: 1, critical_recall_score: 0 } });
  expect(result.primaryRejected.output).toMatchObject({ decision: "FAIL", outcome_check_quality: { primary_next_step_verified: 0, next_step_accuracy_score: 0 } });
  expect(result.spoof.output).toMatchObject({ decision: "PASS", outcome_check_quality: { result_accuracy_score: 1, agreement_precision_score: 1, next_step_accuracy_score: 1, critical_recall_score: 1, overall_score: 1, decision: "PASS" } });
  expect(result.changed.output).toMatchObject({ status: "technical_error", error_code: "INVALID_JUDGE_OUTPUT", schema_error: "verified_agreements[0].owner: Judge changed input value" });
  expect(result.equivalentDeadline.output).toMatchObject({ decision: "PASS", verified_agreements: [expect.objectContaining({ id: "agr_immediate", deadline: "" })], verified_primary_next_step: expect.objectContaining({ deadline: "", verified: true }) });
  expect(result.partial.output.verified_agreements.map((item: any) => item.id)).toEqual(["agr_video"]);
  expect(result.dependencyCalls).toBe(0);
  expect(result.dependency.output).toMatchObject({ status: "dependency_error", error_code: "DEPENDENCY_ERROR" });
  expect(result.pipelineStop).toMatchObject({ downstreamRan: false, marker: undefined });
});

test("Судьи принимают синонимы статуса ('partial_pass'/'warn'/'ok'/'error' и т.п.) вместо строгого pass|warning|fail (реальные прогоны 2026-07-22)", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    return {
      criteriaArray: normalizeCriteriaArray([{name:'real-report',status:'partial_pass',score:93.75,explanation:'e'},{name:'x',status:'warn',score:90,explanation:'e'},{name:'y',status:'OK',score:100,explanation:'e'},{name:'z',status:'error',score:0,explanation:'e'},{name:'w',status:'unknown_value',score:50,explanation:'e'}]),
      single: [normalizeCriteriaStatus('partial pass'), normalizeCriteriaStatus('pass-with-warnings'), normalizeCriteriaStatus('partially_passed'), normalizeCriteriaStatus('needs review'), normalizeCriteriaStatus('warn'), normalizeCriteriaStatus('Warning'), normalizeCriteriaStatus('ok'), normalizeCriteriaStatus('failed'), normalizeCriteriaStatus('critical'), normalizeCriteriaStatus('totally_unknown')]
    };
  })()`));
  expect(result.criteriaArray.map((item: any) => item.status)).toEqual(["warning", "warning", "pass", "fail", "unknown_value"]);
  expect(result.single).toEqual(["warning", "warning", "warning", "warning", "warning", "warning", "pass", "fail", "fail", "totally_unknown"]);
});

test("Проверка результата звонка восстанавливается после пропущенного id и переформулированного evidence в ответе Judge (реальный прогон 2026-07-21)", async ({ page }) => {
  // Реальный прод-прогон: Outcome Agent дал один call_result с id "result_1";
  // Judge подтвердил его правильно по смыслу (то же value), но в ответе
  // пропустил "id" и переписал "evidence" со вставленными репликами спикеров
  // -- раньше это была невосстановимая ошибка схемы (matching input result
  // not found), которая полностью останавливала Conversation Store, Summary
  // и все 5 судей ниже по пайплайну. Одиночный неопознанный кандидат теперь
  // сопоставляется однозначно, а evidence больше не обязан быть побайтово
  // идентичным (это цитата, не сама проверяемая величина).
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(async () => {
    const input={
      call_results:[{id:'result_1',value:'агент отправит материалы',evidence:'Скину видео. — Ну, давайте, я жду от вас видео. — Да, давайте в Макс лучше.',confidence:.99,verification_status:'pending'}],
      agreements:[{id:'agreement_001',action:'отправить видеообзор объекта',owner:'агент',recipient:'клиент',deadline:'',channel:'MAX',status:'confirmed',evidence:'Скину видео. Давайте в Макс лучше.',confidence:.99,verification_status:'pending'}],
      primary_next_step:{action:'отправить видеообзор объекта',owner:'агент',deadline:'',channel:'MAX',status:'confirmed',agreement_ids:['agreement_001'],confidence:.99,verification_status:'pending'},
      outcome_meta:{result_count:1,agreement_count:1,decision:'EXTRACTED'}
    };
    const realWorldVerdict={
      verified_call_results:[{value:'агент отправит материалы',evidence:'Агент: «Скину видео и сейчас посмотрю, че у нас есть, скину ссылку на подбор.» Клиент: «Ну, давайте, я жду от вас видео.»',confidence:.99,reason:'подтверждено'}],
      rejected_call_results:[],
      verified_agreements:[{action:'отправить видеообзор объекта',owner:'агент',recipient:'клиент',deadline:'',channel:'MAX',status:'confirmed',confidence:.99,reason:'подтверждено'}],
      rejected_agreements:[],
      verified_primary_next_step:{...input.primary_next_step,reason:'подтверждено'},
      rejected_primary_next_step:{rejected:false,action:'',error_type:'',reason:'',evidence:''},
      missing_critical_outcomes:[],
      outcome_check_quality:{results_checked:1,results_verified:1,results_rejected:0,agreements_checked:1,agreements_verified:1,agreements_rejected:0,primary_next_step_verified:1,critical_outcomes_missing:0,result_accuracy_score:1,agreement_precision_score:1,next_step_accuracy_score:1,critical_recall_score:1,overall_score:1,decision:'PASS'},
      criteria:[{name:'Outcome semantics',status:'pass',score:100,explanation:'Проверено'}]
    };
    const ctx={__transcript:'Клиент: Хорошо',outcome:input,fact_check:{status:'ok',decision:'PASS',verified_facts:[]},need_check:{status:'ok',decision:'PASS',verified_attributes:{},verified_requirements:[]}};
    const code=CODE_FUNCS.outcomeCheckCode({},ctx);
    const validated=validateOutcomeJudgeOutput(realWorldVerdict,code.input);
    const merged=mergeOutcomeCheck(code,validated,null,code.input,ctx);
    return {validated,merged};
  })()`));

  expect(result.merged.decision).toBe("PASS");
  expect(result.merged.verified_call_results).toEqual([expect.objectContaining({ id: "result_1", value: "агент отправит материалы", verified: true })]);
  expect(result.merged.verified_agreements).toEqual([expect.objectContaining({ id: "agreement_001", action: "отправить видеообзор объекта", verified: true })]);
  expect(result.merged.verified_primary_next_step).toMatchObject({ action: "отправить видеообзор объекта", verified: true });
});

test("Outcome Check принимает общий MAX из verified channel fact для связанных действий", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const input={call_results:[],agreements:[
      {id:'agreement_1',action:'отправить видео',owner:'агент',recipient:'клиент',deadline:'после звонка',channel:'MAX',status:'confirmed',evidence:'сейчас скину видео и посмотрю варианты',confidence:.9,verification_status:'pending'},
      {id:'agreement_2',action:'отправить ссылку на подбор',owner:'агент',recipient:'клиент',deadline:'после звонка',channel:'MAX',status:'confirmed',evidence:'сейчас скину ссылку на подбор',confidence:.9,verification_status:'pending'}
    ],primary_next_step:{action:'отправить видео и ссылку',owner:'агент',deadline:'после звонка',channel:'MAX',status:'confirmed',agreement_ids:['agreement_1','agreement_2'],confidence:.9,verification_status:'pending'}};
    const factCtx={fact_check:{verified_facts:[{id:'fact_channel',category:'communication_channel',value:'Макс',normalized_value:'MAX',evidence:'Да, давайте в Макс лучше.',verification_status:'verified',verified:true}]}};
    const transcriptCtx={fact_check:{verified_facts:[]},__transcript:'Агент: Вам в Телегу, в Макс?\\nКлиент: Да, давайте в Макс лучше.'};
    const fromFact=outcomeSemanticGuards(input,factCtx),fromTranscript=outcomeSemanticGuards(input,transcriptCtx);
    return {fromFact:{agreementIssues:[...fromFact.agreementIssues.entries()],primaryIssue:fromFact.primaryIssue},fromTranscript:{agreementIssues:[...fromTranscript.agreementIssues.entries()],primaryIssue:fromTranscript.primaryIssue}};
  })()`));

  expect(result).toEqual({
    fromFact: { agreementIssues: [], primaryIssue: null },
    fromTranscript: { agreementIssues: [], primaryIssue: null },
  });
});

test("Outcome Check безопасно отклоняет пустой recipient вместо технической ошибки", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const input={call_results:[],agreements:[{id:'agreement_1',action:'изучить материалы',owner:'клиент',recipient:'агент',deadline:'',channel:'',status:'promised',evidence:'Я посмотрю.',confidence:.8,verification_status:'pending'}],primary_next_step:{action:'',owner:'',deadline:'',channel:'',status:'not_defined',agreement_ids:[],confidence:0,verification_status:'pending'}};
    const verdict={items:[{id:'agreement_1',verdict:'needs_correction',reason:'получатель не подтверждён',confidence:.75,corrections:{recipient:'',confidence:.75}},{id:'primary_next_step',verdict:'verified',reason:'следующий шаг не определён',confidence:.9,corrections:{}}],overall_confidence:.8,warnings:[]};
    const recipient=validateOutcomeJudgeOutput(verdict,input);
    const pendingStatus={items:[{id:'agreement_1',verdict:'verified',reason:'обещание подтверждено',confidence:.8,corrections:{}},{id:'primary_next_step',verdict:'needs_correction',reason:'договорённость не окончательная',confidence:.8,corrections:{status:'pending'}}],overall_confidence:.8,warnings:[]};
    return {recipient,pending:validateOutcomeJudgeOutput(pendingStatus,input),version:defaultPipeline().find(item=>item.outKey==='outcome_check').promptVersion};
  })()`));

  expect(result.recipient.items[0]).toMatchObject({ id: "agreement_1", verdict: "rejected", corrections: {} });
  expect(result.pending.items[1]).toMatchObject({ id: "primary_next_step", verdict: "needs_correction", corrections: { status: "preliminary" } });
  expect(result.version).toBe(8);
});

test("Conversation Store v1 собирает только verified данные и проверяет provenance, ссылки и PII", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(async () => {
    const fact=(id='fact_1')=>({id,category:'client_intent',name:'Цель',value:'Купить квартиру',normalized_value:'Купить квартиру',speaker:'Клиент',evidence:'Клиент: Хочу купить квартиру',confidence:.96,verification_status:'verified',verified:true,source:'fact_check'});
    const quote=(factId='fact_1',text='Хочу купить квартиру')=>({id:'quote_1',text,speaker:'Клиент',supports_fact_ids:[factId],confidence:.95,verification_status:'verified',verified:true,source:'fact_check'});
    const attribute=(value,ids=['fact_1'])=>({value,confidence:.94,evidence:'Клиент: '+value,source_fact_ids:ids,verification_status:'verified',verified:true,source:'need_check'});
    const requirement=(id='req_1',factId='fact_1')=>({id,type:'search_location',value:['Центральный район'],confidence:.93,evidence:'Клиент: Центральный район',source_fact_ids:[factId],verification_status:'verified',verified:true,source:'need_check'});
    const callResult=()=>({id:'result_1',value:'агент отправит материалы',evidence:'Агент: Я отправлю видео',confidence:.95,verification_status:'verified',verified:true,source:'outcome_check'});
    const agreement=(id='agr_1')=>({id,action:'Агент отправит видео',owner:'агент',recipient:'клиент',deadline:'',channel:'видео',status:'promised',evidence:'Агент: Я отправлю видео',confidence:.95,verification_status:'verified',verified:true,source:'outcome_check'});
    const next=(ids=['agr_1'])=>({action:ids.length?'Агент отправит видео':'',owner:ids.length?'агент':'',deadline:'',channel:ids.length?'видео':'',status:ids.length?'promised':'not_defined',agreement_ids:ids,confidence:.95,verification_status:'verified',verified:true,source:'outcome_check'});
    const make=(options={})=>{
      const run=options.run||'run_1',transcript=options.transcript||'transcript_hash',pipelineHash=options.pipelineHash||'pipeline_hash';
      const decisions=options.decisions||['PASS','PASS','PASS'],scores=options.scores||[.97,.91,.94];
      const facts=options.facts||[fact()],quotes=options.quotes||[quote()];
      const interest=options.interest===undefined?[attribute('Новостройки')]:options.interest;
      const funding=options.funding||attribute('не определено',[]),term=options.term||attribute('не определено',[]);
      const requirements=options.requirements===undefined?[requirement()]:options.requirements;
      const callResults=options.callResults===undefined?[callResult()]:options.callResults,agreements=options.agreements===undefined?[agreement()]:options.agreements;
      const primary=options.primary||next(agreements.length?[agreements[0].id]:[]);
      const ctx={__run_id:run,__transcript_hash:transcript,__pipeline_configuration_hash:pipelineHash,
        fact_check:{status:'ok',decision:decisions[0],verified_facts:facts,verified_quotes:quotes,rejected_facts:options.rejectedFacts||[fact('fact_rejected')],missing_critical_facts:[{name:'Не сохранять'}],fact_check_quality:{overall_score:scores[0],decision:decisions[0]}},
        need_check:{status:'ok',decision:decisions[1],verified_attributes:{interest,funding_source:funding,purchase_term:term},verified_requirements:requirements,rejected_requirements:[requirement('req_rejected')],missing_critical_needs:[{name:'Не сохранять'}],need_check_quality:{overall_score:scores[1],decision:decisions[1]}},
        outcome_check:{status:'ok',decision:decisions[2],verified_call_results:callResults,verified_agreements:agreements,verified_primary_next_step:primary,rejected_agreements:[agreement('agr_rejected')],missing_critical_outcomes:[{name:'Не сохранять'}],outcome_check_quality:{overall_score:scores[2],decision:decisions[2]}}};
      ctx.__stage_provenance={};['fact_check','need_check','outcome_check'].forEach((key,index)=>ctx.__stage_provenance[key]={run_id:options.stageRun||run,transcript_hash:options.stageTranscript||transcript,pipeline_configuration_hash:options.stagePipeline||pipelineHash,stage_execution_id:(options.stageRun||run)+':0'+(index+1)+':stage'});
      return ctx;
    };
    const store=ctx=>CODE_FUNCS.conversationStore({},ctx);
    const readyCtx=make(),before=JSON.stringify(readyCtx),ready=store(readyCtx),after=JSON.stringify(readyCtx);
    const warnings=store(make({decisions:['PASS','PASS_WITH_WARNINGS','PASS']}));
    const cleanRecoveryCtx=make({decisions:['PASS_WITH_WARNINGS','PASS','PASS'],rejectedFacts:[]});
    cleanRecoveryCtx.fact_check.missing_critical_facts=[];
    cleanRecoveryCtx.fact_check.rejected_quotes=[];
    cleanRecoveryCtx.fact_check.corrected_items=[];
    cleanRecoveryCtx.fact_check.warnings=[];
    cleanRecoveryCtx.fact_check.fact_check_quality.recovered_items_count=2;
    const cleanRecovery=store(cleanRecoveryCtx);
    const manual=store(make({decisions:['PASS','MANUAL_REVIEW','PASS']}));
    const failedDecision=store(make({decisions:['PASS','FAIL','PASS']}));
    const missingFactCtx=make();delete missingFactCtx.fact_check;const missingFact=store(missingFactCtx);
    const failedCtx=make();failedCtx.fact_check.status='technical_error';const failed=store(failedCtx);
    const pendingFact={...fact('fact_pending'),verification_status:'pending',verified:false};
    const filtered=store(make({facts:[fact(),pendingFact]}));
    const brokenQuote=store(make({quotes:[quote('missing_fact')]}));
    const brokenRequirement=store(make({requirements:[requirement('req_broken','fact_rejected')]}));
    const brokenPrimary=store(make({primary:next(['missing_agreement'])}));
    const duplicate=store(make({facts:[fact(),fact()]}));
    const stale=store(make({stageRun:'old_run'}));
    const transcriptMismatch=store(make({stageTranscript:'old_transcript'}));
    const pipelineMismatch=store(make({stagePipeline:'old_pipeline'}));
    const pii=store(make({quotes:[quote('fact_1','Позвоните +7 999 123-45-67 или client@example.com')]}));
    const noFundingEvidence=store(make({funding:{...attribute('ипотека в процессе'),evidence:''}}));
    const nullableNormalized=store(make({facts:[{...fact(),normalized_value:null}]}));
    const correctedQuestionRequirement=store(make({requirements:[
      requirement('req_valid'),
      {...requirement('req_question'),value:null,normalized_value:null,category:'client_question',verification_status:'corrected',applied_corrections:{value:{from:'Сколько получится соток?',to:null}}}
    ]}));
    const correctedFact=store(make({facts:[{...fact(),verification_status:'corrected',applied_corrections:{source_turn_ids:{from:null,to:['turn_1']}}}]}));
    const minimum=store(make({scores:[.92,.73,.88]}));
    const deterministicA=store(make()),deterministicB=store(make());
    const empty=store(make({interest:[],requirements:[],callResults:[],agreements:[],primary:next([])}));
    const frozenValue=ready.output.conversation.facts[0].value;readyCtx.fact_check.verified_facts[0].value='ПОДМЕНЕНО';
    let downstreamRan=false;CODE_FUNCS.storeDownstreamMarker=()=>{downstreamRan=true;return {output:{ran:true},status:'ok',metrics:[],checks:[]}};
    const originalPipeline=pipeline;pipeline=[{id:'store-stage',enabled:true,type:'code',name:'Conversation Store',codeFn:'conversationStore',outKey:'conversation_store'},{id:'store-marker',enabled:true,type:'code',name:'Маркер downstream',codeFn:'storeDownstreamMarker',outKey:'marker'}];renderStages();document.getElementById('transcript').value='Клиент: Тест';await runPipeline();
    const pipelineStop={downstreamRan,marker:ctx.marker,conversation_store:ctx.conversation_store};pipeline=originalPipeline;renderStages();delete CODE_FUNCS.storeDownstreamMarker;
    return {ready,warnings,cleanRecovery,manual,failedDecision,missingFact,failed,filtered,brokenQuote,brokenRequirement,brokenPrimary,duplicate,stale,transcriptMismatch,pipelineMismatch,pii,noFundingEvidence,nullableNormalized,correctedQuestionRequirement,correctedFact,minimum,hashA:deterministicA.output.store_meta.conversation_store_hash,hashB:deterministicB.output.store_meta.conversation_store_hash,inputUnchanged:before===after,frozen:Object.isFrozen(ready.output)&&Object.isFrozen(ready.output.conversation.facts[0]),frozenValue,storedAfterMutation:ready.output.conversation.facts[0].value,empty,pipelineStop};
  })()`));

  expect(result.ready.output).toMatchObject({ quality: { decision: "READY", overall_confidence: 0.91 }, store_meta: { schema_version: "conversation_store_v1", status: "READY" }, provenance: { run_id: "run_1", transcript_hash: "transcript_hash", pipeline_configuration_hash: "pipeline_hash", source_stage_ids: { fact_check: "run_1:01:stage", need_check: "run_1:02:stage", outcome_check: "run_1:03:stage" } } });
  expect(result.ready.output.conversation.facts).toEqual([expect.objectContaining({ id: "fact_1", source: "fact_check", value: "Купить квартиру" })]);
  expect(result.ready.output.conversation.facts[0].verified).toBeUndefined();
  expect(JSON.stringify(result.ready.output.conversation)).not.toContain("fact_rejected");
  expect(JSON.stringify(result.ready.output.conversation)).not.toContain("Не сохранять");
  expect(result.warnings.output.quality.decision).toBe("READY_WITH_WARNINGS");
  expect(result.cleanRecovery.output.quality.decision).toBe("READY");
  expect(result.manual.output.quality.decision).toBe("MANUAL_REVIEW");
  expect(result.failedDecision.output.quality.decision).toBe("MANUAL_REVIEW");
  expect(result.missingFact.output).toMatchObject({ quality: { decision: "DEPENDENCY_ERROR" }, errors: [{ code: "MISSING_DEPENDENCY", path: "ctx.fact_check" }] });
  expect(result.failed.output).toMatchObject({ quality: { decision: "DEPENDENCY_ERROR" }, errors: [{ code: "FAILED_DEPENDENCY", path: "ctx.fact_check.status" }] });
  expect(result.filtered.output.conversation.facts.map((item: any) => item.id)).toEqual(["fact_1"]);
  expect(result.brokenQuote.output).toMatchObject({ quality: { decision: "TECHNICAL_ERROR" }, errors: [{ code: "BROKEN_FACT_REFERENCE", path: "conversation.quotes[0].supports_fact_ids[0]" }] });
  expect(result.brokenRequirement.output.errors[0]).toMatchObject({ code: "BROKEN_FACT_REFERENCE", path: "conversation.requirements[0].source_fact_ids[0]" });
  expect(result.brokenPrimary.output.errors[0]).toMatchObject({ code: "BROKEN_AGREEMENT_REFERENCE", path: "conversation.primary_next_step.agreement_ids[0]" });
  expect(result.duplicate.output.errors[0]).toMatchObject({ code: "DUPLICATE_ID", path: "conversation.facts[1].id" });
  expect(result.stale.output.errors[0]).toMatchObject({ code: "STALE_OR_FOREIGN_STAGE_OUTPUT", path: "provenance.source_stage_ids.fact_check" });
  expect(result.transcriptMismatch.output.errors[0].code).toBe("STALE_OR_FOREIGN_STAGE_OUTPUT");
  expect(result.pipelineMismatch.output.errors[0].code).toBe("STALE_OR_FOREIGN_STAGE_OUTPUT");
  expect(result.pii.output.errors[0]).toMatchObject({ code: "PII_IN_VERIFIED_DATA", path: "conversation.quotes[0]" });
  expect(result.noFundingEvidence.output.errors[0]).toMatchObject({ code: "UNVERIFIED_ATTRIBUTE", path: "conversation.attributes.funding_source.evidence" });
  expect(result.nullableNormalized.output.quality.decision).toBe("READY");
  expect(result.nullableNormalized.output.conversation.facts[0].normalized_value).toBeUndefined();
  expect(result.correctedQuestionRequirement.output.quality.decision).toBe("READY");
  expect(result.correctedQuestionRequirement.output.conversation.requirements.map((item: any) => item.id)).toEqual(["req_valid"]);
  expect(result.correctedFact.output).toMatchObject({ quality: { decision: "READY" }, conversation: { facts: [{ id: "fact_1", verification_status: "corrected" }], quotes: [{ supports_fact_ids: ["fact_1"] }] } });
  expect(result.correctedFact.output.conversation.facts[0].applied_corrections).toBeUndefined();
  expect(result.minimum.output.quality.overall_confidence).toBe(0.73);
  expect(result.hashA).toBe(result.hashB);
  expect(result.inputUnchanged).toBe(true);
  expect(result.frozen).toBe(true);
  expect(result.storedAfterMutation).toBe(result.frozenValue);
  expect(result.empty.output).toMatchObject({ quality: { decision: "READY" }, conversation: { facts: [expect.any(Object)], attributes: { interest: [], funding_source: { value: "не определено" }, purchase_term: { value: "не определено" } }, requirements: [], call_results: [], agreements: [], primary_next_step: { status: "not_defined", agreement_ids: [] } } });
  expect(result.ready.metrics.map((item: any[]) => item[0])).toEqual(expect.arrayContaining(["Store status", "Overall confidence", "Facts stored", "Quotes stored", "Attributes stored", "Requirements stored", "Call results stored", "Agreements stored", "Primary next step", "Reference integrity", "Run/hash consistency", "Conversation Store hash"]));
  expect(result.pipelineStop).toMatchObject({ downstreamRan: false, marker: undefined, conversation_store: { quality: { decision: "DEPENDENCY_ERROR" }, store_meta: { status: "DEPENDENCY_ERROR" } } });
});

test("Генерация саммари использует только Conversation Store, проверяет grounding и управляет retry", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(async () => {
    const store=(status='READY')=>({
      conversation:{
        facts:[
          {id:'fact_budget',category:'budget',name:'Бюджет',value:'до 12 млн ₽',evidence:'Клиент: Бюджет до 12 млн ₽'},
          {id:'fact_goal',category:'intent',name:'Цель',value:'ищет квартиру',evidence:'Клиент ищет квартиру в Центральном районе'}
        ],
        quotes:[{id:'quote_1',text:'Бюджет до 12 миллионов',speaker:'Клиент',supports_fact_ids:['fact_budget']}],
        attributes:{interest:[{value:'Новостройки'}],funding_source:{value:'наличные / депозит'},purchase_term:{value:'2–3 месяца'}},
        requirements:[{id:'req_1',type:'search_location',value:'Центральный район',source_fact_ids:['fact_goal']}],
        call_results:[{id:'result_1',value:'агент отправит материалы'}],
        agreements:[{id:'agreement_1',action:'Агент отправит видео и подборку',owner:'агент',recipient:'клиент',deadline:'',channel:'',status:'promised',evidence:'Агент: Я отправлю видео и подборку'}],
        primary_next_step:{action:'Агент отправит видео и подборку',owner:'агент',deadline:'',channel:'',status:'promised',agreement_ids:['agreement_1']}
      },
      quality:{decision:status},store_meta:{status}
    });
    const valid={status:'GENERATED',conversation_result:'Клиент ищет квартиру в Центральном районе.',key_facts:[{label:'Бюджет',value:'до 12 млн ₽'},{label:'Финансирование',value:'наличные / депозит'},{label:'Срок покупки',value:'2–3 месяца'},{label:'Требование',value:'Центральный район'}],quotes:['Бюджет до 12 миллионов'],next_step:'Агент отправит видео и подборку.',error:''};
    const empty={status:'GENERATED',conversation_result:'Клиент ищет квартиру.',key_facts:[],quotes:[],next_step:'Агент отправит видео и подборку.',error:''};
    const stage=defaultPipeline().find(item=>item.outKey==='summary');
    const original=callModelWithTransientRetry;
    const run=async(responses,status='READY')=>{
      let calls=0,requestedFormat=null;
      callModelWithTransientRetry=async(...args)=>{requestedFormat=args[5];const response=responses[Math.min(calls,responses.length-1)];calls++;return {text:response,tokens:10,actualModel:'gpt-5-mini',actualProvider:'ai-tunnel',finishReason:null}};
      const report=await runStage(stage,{conversation_store:store(status),__transcript:'Клиент: Бюджет до 12 миллионов. Агент: Я отправлю видео и подборку.'});
      return {calls,report,requestedFormat};
    };
    const success=await run([JSON.stringify(valid)]);
    const warning=await run([JSON.stringify(empty)],'READY_WITH_WARNINGS');
    const manual=await run([JSON.stringify(empty)],'MANUAL_REVIEW');
    const markdown=await run(['\`\`\`json\\n'+JSON.stringify(empty)+'\\n\`\`\`']);
    const extraText=await run(['Ответ модели: '+JSON.stringify(empty)]);
    const syntaxRetry=await run(['{"status":"GENERATED"',JSON.stringify(empty)]);
    const tooMany={...empty,key_facts:[...valid.key_facts,{label:'Лишнее',value:'ищет квартиру'}]};
    const countRetry=await run([JSON.stringify(tooMany),JSON.stringify(empty)]);
    const quoteCountRetry=await run([JSON.stringify({...empty,quotes:['Бюджет до 12 миллионов','Бюджет до 12 миллионов','Бюджет до 12 миллионов']}),JSON.stringify(empty)]);
    const missing={status:'GENERATED',conversation_result:'Клиент ищет квартиру.',key_facts:[],quotes:[],error:''};
    const missingRetry=await run([JSON.stringify(missing),JSON.stringify(empty)]);
    const nullValue=await run([JSON.stringify({...empty,key_facts:[{label:'Бюджет',value:null}]})]);
    const unknown=await run([JSON.stringify({...empty,unexpected:true})]);
    const phone=await run([JSON.stringify({...empty,conversation_result:'Клиент ищет квартиру, телефон +7 999 123-45-67.'})]);
    const unknownValue=await run([JSON.stringify({...empty,key_facts:[{label:'Финансирование',value:'не определено'}]})]);
    const unknownTerm=await run([JSON.stringify({...empty,key_facts:[{label:'Срок покупки',value:'не определено'}]})]);
    const unknownComposite=await run([JSON.stringify({...empty,key_facts:[{label:'Финансирование и срок покупки',value:'финансирование: не определено; срок покупки: не определено'}]})]);
    const tooLong=await run([JSON.stringify({...empty,conversation_result:'Квартира '.repeat(140)})]);
    const badFact=await run([JSON.stringify({...empty,key_facts:[{label:'Комнаты',value:'пять комнат'}]})]);
    const groundingRetry=await run([JSON.stringify({...empty,key_facts:[{label:'Комнаты',value:'пять комнат'}]}),JSON.stringify(valid)]);
    const badQuote=await run([JSON.stringify({...empty,quotes:['Бюджет примерно 20 миллионов']})]);
    const badNext=await run([JSON.stringify({...empty,next_step:'Клиент подпишет договор.'})]);
    const badDeadline=await run([JSON.stringify({...empty,next_step:'Агент отправит видео завтра.'})]);
    const badChannel=await run([JSON.stringify({...empty,next_step:'Агент отправит видео в WhatsApp.'})]);
    const preliminaryStore=store();preliminaryStore.conversation.primary_next_step={action:'Посмотреть квартиру',owner:'оба',deadline:'',channel:'',status:'preliminary',agreement_ids:['agreement_1']};preliminaryStore.conversation.agreements=[{...preliminaryStore.conversation.agreements[0],action:'Посмотреть квартиру',status:'preliminary',evidence:'Предварительно посмотрим квартиру'}];
    let preliminaryCalls=0;callModelWithTransientRetry=async()=>{preliminaryCalls++;return {text:JSON.stringify({...empty,next_step:'Показ назначен.'}),tokens:5,actualModel:'gpt-5-mini',actualProvider:'ai-tunnel'}};
    const preliminary=await runStage(stage,{conversation_store:preliminaryStore,__transcript:'Предварительно посмотрим квартиру'});
    let dependencyCalls=0;callModelWithTransientRetry=async()=>{dependencyCalls++;throw new Error('model must not be called')};
    const missingStore=await runStage(stage,{__transcript:'Клиент: тест'});
    const technicalStore=await runStage(stage,{conversation_store:store('TECHNICAL_ERROR'),__transcript:'Клиент: тест'});
    const dependencyStore=await runStage(stage,{conversation_store:store('DEPENDENCY_ERROR'),__transcript:'Клиент: тест'});
    const targetStore=store();targetStore.conversation={
      facts:[
        {id:'f1',value:'Клиент Николай рассматривает покупку участка ИЖС',evidence:'Клиент Николай рассматривает покупку участка ИЖС в районе Мистолово с бюджетом до 5,5 млн ₽'},
        {id:'f2',value:'до 5,5 млн ₽',evidence:'Бюджет до 5,5 млн ₽'},
        {id:'f3',value:'участок 6 соток в КП Охтинское Раздолье за 4,65 млн ₽',evidence:'Обсудили участок 6 соток в КП Охтинское Раздолье за 4,65 млн ₽'},
        {id:'f4',value:'ежемесячный взнос 9 600 ₽',evidence:'Клиента смущает ежемесячный взнос 9 600 ₽'}
      ],
      requirements:[{id:'r1',value:['ИЖС','площадь от 6 соток']},{id:'r2',value:['Мистолово','Капитолово','Лаврики']}],attributes:{interest:[],funding_source:{},purchase_term:{}},
      quotes:[{id:'q1',text:'Вот этот побор 9 600 мне прямо не это'}],call_results:[{id:'cr1',value:'агент отправит материалы'}],
      agreements:[{id:'a1',action:'Агент отправит в MAX видеообзор объекта и подборку альтернативных участков под требования клиента',owner:'агент',recipient:'клиент',deadline:'',channel:'MAX',status:'promised',evidence:'Агент предложил отправить видеообзор и подобрать альтернативные участки в MAX'}],
      primary_next_step:{action:'Агент отправит в MAX видеообзор объекта и подборку альтернативных участков под требования клиента',owner:'агент',deadline:'',channel:'MAX',status:'promised',agreement_ids:['a1']}
    };
    const target={status:'GENERATED',conversation_result:'Клиент Николай рассматривает покупку участка ИЖС от 6 соток в районе Мистолово с бюджетом до 5,5 млн ₽. Обсудили участок 6 соток в КП „Охтинское Раздолье“ за 4,65 млн ₽; клиента смущает ежемесячный взнос 9 600 ₽. Агент предложил отправить видеообзор и подобрать альтернативные участки.',key_facts:[{label:'Бюджет',value:'до 5,5 млн ₽'},{label:'Требования',value:'ИЖС, площадь от 6 соток'},{label:'Локации',value:'Мистолово, Капитолово, Лаврики'},{label:'Основное сомнение',value:'ежемесячный взнос 9 600 ₽'}],quotes:['Вот этот побор 9 600 мне прямо не это'],next_step:'Агент отправит в Макс видеообзор объекта и подборку альтернативных участков под требования клиента',error:''};
    let targetCalls=0;callModelWithTransientRetry=async()=>{targetCalls++;return {text:JSON.stringify(target),tokens:20,actualModel:'gpt-5-mini',actualProvider:'ai-tunnel'}};
    const targetReport=await runStage(stage,{conversation_store:targetStore,__transcript:'Вот этот побор 9 600 мне прямо не это. Агент предложил отправить видеообзор и подборку в MAX.'});
    let downstreamRan=false;CODE_FUNCS.summaryStoreSeed=()=>({output:store('TECHNICAL_ERROR'),status:'ok',metrics:[],checks:[]});CODE_FUNCS.summaryMarker=()=>{downstreamRan=true;return {output:{ran:true},status:'ok',metrics:[],checks:[]}};
    const originalPipeline=pipeline;pipeline=[{id:'summary-seed',enabled:true,type:'code',name:'Store seed',codeFn:'summaryStoreSeed',outKey:'conversation_store'},{...stage,id:'summary-stage',enabled:true},{id:'summary-marker',enabled:true,type:'code',name:'Marker',codeFn:'summaryMarker',outKey:'marker'}];renderStages();document.getElementById('transcript').value='Клиент: тест';await runPipeline();
    const pipelineStop={downstreamRan,marker:ctx.marker,summary:ctx.summary};pipeline=originalPipeline;renderStages();delete CODE_FUNCS.summaryStoreSeed;delete CODE_FUNCS.summaryMarker;
    callModelWithTransientRetry=original;
    const validator=value=>{try{return {ok:true,value:validateModuleSummaryOutput(value)}}catch(error){return {ok:false,error:error.message}}};
    const uiWith=renderModuleSummaryResult(valid),uiEmpty=renderModuleSummaryResult(empty);
    return {settings:{provider:stage.provider,model:stage.model,temperature:stage.temperature,maxTokens:stage.maxTokens,outKey:stage.outKey},success,warning,manual,markdown,extraText,syntaxRetry,countRetry,quoteCountRetry,missingRetry,nullValue,unknown,phone,unknownValue,unknownTerm,unknownComposite,tooLong,badFact,groundingRetry,badQuote,badNext,badDeadline,badChannel,preliminary,preliminaryCalls,dependencyCalls,missingStore,technicalStore,dependencyStore,targetCalls,targetReport,pipelineStop,uiWith,uiEmpty,directEmpty:validator(empty)};
  })()`));

  expect(result.settings).toEqual({ provider: "ai-tunnel", model: "gpt-5-mini", temperature: 0, maxTokens: 8000, outKey: "summary" });
  expect(result.success.calls).toBe(1);
  expect(result.success.report.output).toEqual(expect.objectContaining({ status: "GENERATED", conversation_result: "Клиент ищет квартиру в Центральном районе. Агент отправит клиенту видеообзор и ссылку на подборку.", key_facts: expect.arrayContaining([expect.objectContaining({ label: "Бюджет", value: "до 12 млн ₽" })]), quotes: ["Бюджет до 12 миллионов"], next_step: "Агент отправит клиенту видеообзор и ссылку на подборку.", error: "" }));
  expect(result.success.report.output).not.toHaveProperty("score");
  expect(result.success.report.summary_metrics).toMatchObject({ json_valid: true, grounded_key_facts: "4/4", grounded_quotes: "1/1", next_step_match: true, pii_absent: true, generation_status: "GENERATED", store_status: "READY", next_step_source: "primary_next_step", retry_count: 0, model: "gpt-5-mini", tokens: 10 });
  expect(result.success.report.prompt_audit).toMatchObject({ transcript_present: true, transcript_injected: false, resolved_prompt_contains_transcript: false, card_metadata_omitted: 0, verified_quote_count: 1 });
  expect(result.success.requestedFormat).toMatchObject({ type: "json_schema", json_schema: { name: "module_summary_v1", strict: true, schema: { additionalProperties: false } } });
  expect(result.success.report.contract_audit).toMatchObject({ prompt_schema_id: "module_summary_v1", response_schema_id: "module_summary_v1", parser_schema_id: "module_summary_v1", runtime_schema_id: "module_summary_v1", contract_status: "VALID" });
  expect(result.warning.report.output.status).toBe("GENERATED");
  expect(result.manual.report.output.status).toBe("MANUAL_REVIEW");
  expect(result.directEmpty.ok).toBe(true);
  expect(result.markdown).toMatchObject({ calls: 1, report: { output: { status: "GENERATED" }, retry_count: 0 } });
  expect(result.extraText).toMatchObject({ calls: 1, report: { output: { status: "GENERATED" }, retry_count: 0 } });
  expect(result.syntaxRetry).toMatchObject({ calls: 2, report: { output: { status: "GENERATED" }, retry_count: 1 } });
  expect(result.countRetry.calls).toBe(2);
  expect(result.quoteCountRetry.calls).toBe(2);
  expect(result.missingRetry.calls).toBe(2);
  expect(result.nullValue.calls).toBe(1);
  expect(result.nullValue.report.output).toMatchObject({ status: "technical_error", error_code: "SUMMARY_INVALID_OUTPUT", errors: [{ path: "root", message: "key_facts[0].value: expected string, received null" }] });
  expect(result.unknown.calls).toBe(1);
  expect(result.unknown.report).toMatchObject({ output: { status: "GENERATED" }, contract_audit: { repair_attempted: true, removed_fields: ["unexpected"], contract_status: "RECOVERED_WITH_WARNING" } });
  expect(result.phone.report.output).toMatchObject({ status: "technical_error", error_code: "SUMMARY_INVALID_OUTPUT" });
  expect(result.unknownValue).toMatchObject({ calls: 1, report: { output: { status: "GENERATED", key_facts: [] }, retry_count: 0 } });
  expect(result.unknownValue.report.policy_repair_count).toBeGreaterThanOrEqual(1);
  expect(result.unknownTerm).toMatchObject({ calls: 1, report: { output: { status: "GENERATED", key_facts: [] }, retry_count: 0 } });
  expect(result.unknownTerm.report.policy_repair_count).toBeGreaterThanOrEqual(1);
  expect(result.unknownComposite).toMatchObject({ calls: 1, report: { output: { status: "GENERATED", key_facts: [] }, retry_count: 0, contract_audit: { repair_attempted: true, removed_items: ["key_facts[0]"], contract_status: "RECOVERED_WITH_WARNING" } } });
  expect(result.tooLong.report.output.errors[0].message).toContain("1200");
  expect(result.badFact).toMatchObject({ calls: 2, report: { output: { status: "technical_error", error_code: "SUMMARY_UNGROUNDED_CONTENT", errors: [expect.objectContaining({ path: "key_facts[0]", message: "Факт отсутствует в Conversation Store." })] }, retry_count: 1 } });
  expect(result.groundingRetry).toMatchObject({ calls: 2, report: { output: { status: "GENERATED" }, retry_count: 1 } });
  expect(result.badQuote.report.output).toMatchObject({ status: "GENERATED", quotes: ["Бюджет до 12 миллионов"] });
  expect(result.badNext.report).toMatchObject({ output: { status: "GENERATED", next_step: "Агент отправит клиенту видеообзор и ссылку на подборку." } });
  expect(result.badNext.report.policy_repair_count).toBeGreaterThan(0);
  expect(result.badDeadline.report.output.errors).toEqual(expect.arrayContaining([expect.objectContaining({ path: "next_step", message: expect.stringContaining("Срок") })]));
  expect(result.badChannel.report.output.errors).toEqual(expect.arrayContaining([expect.objectContaining({ path: "next_step", message: expect.stringContaining("Канал") })]));
  expect(result.preliminaryCalls).toBe(1);
  expect(result.preliminary.output).toMatchObject({ status: "GENERATED", next_step: "Агент: Посмотреть квартиру." });
  expect(result.dependencyCalls).toBe(0);
  for (const blocked of [result.missingStore, result.technicalStore, result.dependencyStore]) expect(blocked.output).toEqual({ status: "ERROR", conversation_result: "", key_facts: [], quotes: [], next_step: "", error: "Conversation Store не готов к генерации саммари.", confidence: null });
  expect(result.targetCalls).toBe(1);
  expect(result.targetReport.output).toMatchObject({ status: "GENERATED", conversation_result: expect.stringContaining("Клиент Николай"), key_facts: [expect.objectContaining({ label: "Бюджет", value: "до 5,5 млн ₽" }), expect.objectContaining({ label: "Требования" }), expect.objectContaining({ label: "Локации" }), expect.objectContaining({ label: "Основное сомнение" })], quotes: ["Вот этот побор 9 600 мне прямо не это"], next_step: "Агент отправит клиенту в MAX видеообзор и ссылку на подборку." });
  expect(result.pipelineStop).toMatchObject({ downstreamRan: false, marker: undefined, summary: { status: "ERROR" } });
  expect(result.uiWith).toContain("Итог разговора");
  expect(result.uiWith).toContain("Ключевые факты");
  expect(result.uiWith).toContain("Важная цитата");
  expect(result.uiWith).toContain("Договорённости и следующий шаг");
  expect(result.uiEmpty).not.toContain("Ключевые факты");
  expect(result.uiEmpty).not.toContain("Важные цитаты");
});

test("Truth parser восстанавливает поля issue и уважает пустой verified primary", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(() => {
    const summary={status:'MANUAL_REVIEW',conversation_result:'Клиент ищет участок.',key_facts:[],quotes:['Не, ну у меня просто цена до пяти с половиной, вот так.'],next_step:'Следующий шаг не согласован.',error:''};
    const ctx={summary,conversation_store:{conversation:{facts:[],requirements:[],attributes:{},quotes:[{text:'Не, ну у меня просто цена до пяти с половиной, вот так.',speaker:'Клиент'}],call_results:[{value:'агент отправит материалы'}],agreements:[],primary_next_step:{}}},__transcript:'Клиент: Не, ну у меня просто цена до пяти с половиной, вот так.\\nАгент: Я отправлю видео.'};
    const judge={status:'fail',score:90,has_hallucinations:false,has_fact_distortions:false,has_role_confusion:false,has_money_or_number_errors:false,has_agreement_errors:true,has_quote_errors:true,has_pii:false,critical_errors:[{type:'next_step_error',summary_fragment:'Следующий шаг не согласован.',evidence:'Агент: Я отправлю видео.'},{type:'quote_distortion',field:'quotes',summary_fragment:'Не, ну у меня просто цена до пяти с половина, вот так.',problem:'Judge исказил правильную цитату.',evidence:'Не, ну у меня просто цена до пяти с половиной, вот так.'}],warnings:[],checked_fields:{conversation_result:true,key_facts:true,quotes:true,next_step:true},explanation:'Judge попытался восстановить отклонённый шаг и исказил цитату.'};
    const validated=validateTruthJudgeOutput(judge,ctx);return {validated,output:truthRecalculate(validated,truthGroundingIssues(ctx)),version:defaultPipeline().find(item=>item.outKey==='truth_check').promptVersion};
  })()`));
  expect(result.validated.critical_errors).toEqual([]);
  expect(result.output).toMatchObject({ status: "pass", score: 100, has_agreement_errors: false, has_quote_errors: false });
  expect(result.version).toBe(6);
});

test("Проверка достоверности валидирует зависимости, grounding и сама пересчитывает score", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(async () => {
    const runId='run_truth',transcriptHash='transcript_truth',pipelineHash='pipeline_truth',storeHash='store_truth';
    const transcript=[
      'Клиент: Николай, рассматриваю участок ИЖС от 6 соток в районе Мистолово. Бюджет до 5,5 млн ₽.',
      'Клиент: Вот этот побор 9 600 мне прямо не это.',
      'Клиент: Это предложение агента?',
      'Агент: Я отправлю видео и подборку в MAX.'
    ].join('\\n');
    const store=()=>({conversation:{
      facts:[
        {id:'f_budget',category:'budget',name:'Бюджет',value:'до 5,5 млн ₽',normalized_value:5500000,evidence:'Клиент: Бюджет до 5,5 млн ₽'},
        {id:'f_price',category:'property',name:'Цена объекта',value:'4,65 млн ₽',normalized_value:4650000,evidence:'Цена участка 4,65 млн ₽'},
        {id:'f_goal',category:'intent',name:'Цель',value:'участок ИЖС',normalized_value:'участок ИЖС',evidence:'Клиент рассматривает участок ИЖС'},
        {id:'f_objection',category:'objection',name:'Сомнение',value:'ежемесячный взнос 9 600 ₽',normalized_value:9600,evidence:'Клиента смущает ежемесячный взнос 9 600 ₽'}
      ],
      requirements:[{id:'r1',type:'area',value:['ИЖС','площадь от 6 соток']},{id:'r2',type:'search_location',value:['Мистолово','Капитолово','Лаврики']}],
      attributes:{interest:[],funding_source:{},purchase_term:{}},
      quotes:[{id:'q1',text:'Вот этот побор 9 600 мне прямо не это',speaker:'Клиент'}],call_results:[{id:'cr1',value:'агент отправит материалы'}],
      agreements:[{id:'a1',action:'Агент отправит видео и подборку',owner:'агент',recipient:'клиент',deadline:'',channel:'MAX',status:'promised',evidence:'Агент: Я отправлю видео и подборку в MAX'}],
      primary_next_step:{action:'Агент отправит видео и подборку',owner:'агент',deadline:'',channel:'MAX',status:'promised',agreement_ids:['a1']}
    },quality:{decision:'READY'},provenance:{run_id:runId,transcript_hash:transcriptHash,pipeline_configuration_hash:pipelineHash},store_meta:{status:'READY',conversation_store_hash:storeHash}});
    const target={status:'GENERATED',conversation_result:'Клиент Николай рассматривает покупку участка ИЖС от 6 соток в районе Мистолово с бюджетом до 5,5 млн ₽. Обсудили участок за 4,65 млн ₽; клиента смущает ежемесячный взнос 9 600 ₽. Агент предложил отправить видеообзор и подобрать альтернативные участки.',key_facts:[{label:'Бюджет',value:'до 5,5 млн ₽'},{label:'Требования',value:'ИЖС, площадь от 6 соток'},{label:'Локации',value:'Мистолово, Капитолово, Лаврики'},{label:'Основное сомнение',value:'ежемесячный взнос 9 600 ₽'}],quotes:['Вот этот побор 9 600 мне прямо не это'],next_step:'Агент отправит видео и подборку в MAX.',error:''};
    const checked={conversation_result:true,key_facts:true,quotes:true,next_step:true};
    const cleanJudge={status:'fail',score:0,has_hallucinations:true,has_fact_distortions:true,has_role_confusion:true,has_money_or_number_errors:true,has_agreement_errors:true,has_quote_errors:true,has_pii:true,critical_errors:[],warnings:[],checked_fields:checked,explanation:'Фактических ошибок не найдено.'};
    const issue=(type,field,summary_fragment,problem,evidence)=>({type,field,summary_fragment,problem,evidence});
    const stage=defaultPipeline().find(item=>item.outKey==='truth_check');
    const context=(summary=target,conversationStore=store(),extra={})=>({summary,conversation_store:conversationStore,__transcript:transcript,__run_id:runId,__transcript_hash:transcriptHash,__pipeline_configuration_hash:pipelineHash,__stage_provenance:{summary:{run_id:runId,transcript_hash:transcriptHash,pipeline_configuration_hash:pipelineHash,conversation_store_hash:storeHash}},...extra});
    const original=callModelWithTransientRetry;
    const run=async(ctx,responses=[cleanJudge])=>{let calls=0;callModelWithTransientRetry=async()=>{const response=responses[Math.min(calls,responses.length-1)];calls++;return {text:JSON.stringify(response),tokens:10,actualModel:'claude-sonnet-4-6',actualProvider:'test'}};const report=await runStage(stage,ctx);return {calls,report};};
    const perfect=await run(context());
    const transcriptOnlySummary={...target,key_facts:[{label:'Гараж',value:'нужен гараж'}],quotes:[]};
    const transcriptOnly=await run(context(transcriptOnlySummary,store(),{__transcript:transcript+'\\nКлиент: Нужен гараж'}));
    const hallucination=await run(context({...target,key_facts:[{label:'Бассейн',value:'нужен бассейн'}],quotes:[]}));
    const objectPrice=await run(context({...target,key_facts:[{label:'Бюджет',value:'4,65 млн ₽'}],quotes:[]}));
    const wrongMoney=await run(context({...target,key_facts:[{label:'Бюджет',value:'до 7,5 млн ₽'}],quotes:[]}));
    const normalization=await run(context({...target,key_facts:[{label:'Бюджет',value:'до 5.5 млн ₽'}],quotes:[]}));
    const roleSummary={...target,conversation_result:'Клиент сообщил, что отправит видео.',key_facts:[],quotes:[]};
    const roleJudge={...cleanJudge,critical_errors:[issue('role_confusion','conversation_result','Клиент сообщил, что отправит видео.','Слова агента приписаны клиенту.','Агент: Я отправлю видео и подборку в MAX.')]};
    const role=await run(context(roleSummary),[roleJudge]);
    const questionSummary={...target,conversation_result:'Клиент подтвердил предложение агента.',key_facts:[],quotes:[]};
    const questionJudge={...cleanJudge,critical_errors:[issue('question_as_fact','conversation_result','Клиент подтвердил предложение агента.','Вопрос клиента превращён в подтверждённый факт.','Клиент: Это предложение агента?')]};
    const question=await run(context(questionSummary),[questionJudge]);
    const nextCase=async(status,next)=>{const value=store();value.conversation.primary_next_step.status=status;value.conversation.agreements[0].status=status;return run(context({...target,next_step:next},value));};
    const proposed=await nextCase('proposed','Показ назначен.');
    const preliminary=await nextCase('preliminary','Показ подтверждён.');
    const completed=await nextCase('promised','Агент отправил видео и подборку в MAX.');
    const wrongOwner=await nextCase('promised','Клиент отправит видео и подборку в MAX.');
    const deadline=await nextCase('promised','Агент отправит видео и подборку в MAX завтра.');
    const channel=await nextCase('promised','Агент отправит видео и подборку в WhatsApp.');
    const aliasStore=store();aliasStore.conversation.primary_next_step.channel='Макс';aliasStore.conversation.agreements[0].channel='Макс';const channelAlias=await run(context(target,aliasStore));
    const verifiedQuote=await run(context({...target,key_facts:[]}));
    const changedQuote=await run(context({...target,key_facts:[],quotes:['Вот этот взнос 9 600 мне не нравится']}));
    const agentQuote=await run(context({...target,key_facts:[],quotes:['Я отправлю видео и подборку в MAX']}));
    const pii=await run(context({...target,conversation_result:'Телефон клиента +7 999 123-45-67.',key_facts:[],quotes:[]}));
    let dependencyCalls=0;callModelWithTransientRetry=async()=>{dependencyCalls++;throw new Error('must not call model')};
    const emptyStore=store();emptyStore.conversation={};const empty=await runStage(stage,context(target,emptyStore));
    const staleCtx=context();staleCtx.__stage_provenance.summary.conversation_store_hash='old_hash';const stale=await runStage(stage,staleCtx);
    const spoof=await run(context(),[{...cleanJudge,status:'fail',score:1,has_hallucinations:true}]);
    const spoofIssue=issue('hallucination','conversation_result',questionSummary.conversation_result,'Факт отсутствует в исходных данных.','Клиент: Это предложение агента?');
    const spoofStatus=await run(context(questionSummary),[{...cleanJudge,status:'pass',score:100,critical_errors:[spoofIssue]}]);
    const invalidIssue={type:'hallucination',field:'conversation_result',problem:'ошибка',evidence:'Клиент: Это предложение агента?'};
    const repair=await run(context(questionSummary),[{...cleanJudge,critical_errors:[invalidIssue]},cleanJudge]);
    const badEvidence=await run(context(questionSummary),[{...cleanJudge,critical_errors:[issue('hallucination','conversation_result',questionSummary.conversation_result,'Факт отсутствует в исходных данных.','Несуществующее доказательство')]},cleanJudge]);
    const styleAsHallucination=await run(context(questionSummary),[{...cleanJudge,critical_errors:[issue('hallucination','conversation_result',questionSummary.conversation_result,'Стилистическая формулировка слишком длинная.','Клиент: Это предложение агента?')]},cleanJudge]);
    const omittedCrm=await run(context(questionSummary),[{...cleanJudge,warnings:[issue('fact_not_in_store','conversation_result',questionSummary.conversation_result,'В саммари не указан этаж из карточки CRM.','Клиент: Это предложение агента?')]},cleanJudge]);
    callModelWithTransientRetry=original;
    const html=renderReport(stage,perfect.report,1).outerHTML;
    return {perfect,transcriptOnly,hallucination,objectPrice,wrongMoney,normalization,role,question,proposed,preliminary,completed,wrongOwner,deadline,channel,channelAlias,verifiedQuote,changedQuote,agentQuote,pii,dependencyCalls,empty,stale,spoof,spoofStatus,repair,badEvidence,styleAsHallucination,omittedCrm,target:perfect,html,promptVersion:stage.promptVersion};
  })()`));

  expect(result.promptVersion).toBe(6);
  expect(result.perfect).toMatchObject({ calls: 1, report: { output: { status: "pass", score: 100, has_hallucinations: false, has_fact_distortions: false, has_role_confusion: false, has_money_or_number_errors: false, has_agreement_errors: false, has_quote_errors: false, has_pii: false, critical_errors: [], warnings: [], checked_fields: { conversation_result: true, key_facts: true, quotes: true, next_step: true } } } });
  expect(result.transcriptOnly.report.output).toMatchObject({ score: 95, warnings: [expect.objectContaining({ type: "fact_not_in_store" })] });
  expect(result.hallucination.report.output).toMatchObject({ status: "fail", score: 65, has_hallucinations: true, critical_errors: [expect.objectContaining({ type: "hallucination" })] });
  expect(result.objectPrice.report.output).toMatchObject({ status: "fail", score: 65, has_money_or_number_errors: true, critical_errors: [expect.objectContaining({ type: "money_or_number_error" })] });
  expect(result.wrongMoney.report.output).toMatchObject({ status: "fail", score: 65, has_money_or_number_errors: true });
  expect(result.normalization.report.output).toMatchObject({ status: "pass", score: 95, warnings: [expect.objectContaining({ type: "normalization_error" })] });
  expect(result.role.report.output).toMatchObject({ status: "fail", score: 75, has_role_confusion: true });
  expect(result.question.report.output).toMatchObject({ status: "fail", score: 80, has_fact_distortions: true, critical_errors: [expect.objectContaining({ type: "question_as_fact" })] });
  expect(result.proposed.report.output).toMatchObject({ status: "fail", has_agreement_errors: true, critical_errors: expect.arrayContaining([expect.objectContaining({ type: "overstated_agreement" })]) });
  expect(result.preliminary.report.output.critical_errors).toEqual(expect.arrayContaining([expect.objectContaining({ type: "overstated_agreement" })]));
  expect(result.completed.report.output.critical_errors).toEqual(expect.arrayContaining([expect.objectContaining({ type: "completed_instead_of_promised" })]));
  expect(result.wrongOwner.report.output.critical_errors).toEqual(expect.arrayContaining([expect.objectContaining({ type: "wrong_owner" })]));
  expect(result.deadline.report.output.critical_errors).toEqual(expect.arrayContaining([expect.objectContaining({ type: "invented_deadline" })]));
  expect(result.channel.report.output.critical_errors).toEqual(expect.arrayContaining([expect.objectContaining({ type: "invented_channel" })]));
  expect(result.channelAlias.report.output).toMatchObject({ status: "pass", score: 100, has_agreement_errors: false });
  expect(result.verifiedQuote.report.output).toMatchObject({ status: "pass", score: 100, has_quote_errors: false });
  expect(result.changedQuote.report.output).toMatchObject({ status: "fail", score: 85, has_quote_errors: true, critical_errors: [expect.objectContaining({ type: "quote_distortion" })] });
  expect(result.agentQuote.report.output).toMatchObject({ status: "fail", score: 75, has_role_confusion: true });
  expect(result.pii.report.output).toMatchObject({ status: "fail", score: 50, has_pii: true, critical_errors: [expect.objectContaining({ type: "pii_exposure" })] });
  expect(result.dependencyCalls).toBe(0);
  expect(result.empty.output).toMatchObject({ status: "error", score: 0, explanation: expect.stringContaining("non-empty") });
  expect(result.stale.output).toMatchObject({ status: "error", score: 0, explanation: expect.stringContaining("stale store hash") });
  expect(result.spoof.report.output).toMatchObject({ status: "pass", score: 100, has_hallucinations: false });
  expect(result.spoofStatus.report.output).toMatchObject({ status: "fail", score: 65, has_hallucinations: true });
  expect(result.repair).toMatchObject({ calls: 2, report: { output: { status: "pass", score: 100 }, retry_count: 1 } });
  expect(result.badEvidence).toMatchObject({ calls: 2, report: { output: { status: "pass", score: 100 } } });
  expect(result.styleAsHallucination).toMatchObject({ calls: 2, report: { output: { status: "pass", score: 100 } } });
  expect(result.omittedCrm).toMatchObject({ calls: 2, report: { output: { status: "pass", score: 100 } } });
  expect(result.target.report.output).toMatchObject({ status: "pass", score: 100 });
  expect(result.html).toContain("Hallucinations");
  expect(result.html).toContain("Fact distortions");
  expect(result.html).toContain("Critical errors");
  expect(result.html).toContain("Warnings");
  expect(result.html).toContain("explanation");
  expect(result.html).not.toContain("Confidence</div>");
});

test("production report 2026-07-23 распознаёт client_finance как бюджет и сохраняет главное возражение в Summary", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const budgetFact={id:'fact_7',category:'client_finance',name:'максимальная цена',value:'до пяти с половиной',normalized_value:5500000,evidence:'Не, ну у меня просто цена до пяти с половиной, вот так.',verification_status:'verified'};
    const objectPrice={id:'fact_3',category:'object_information',name:'цена в объявлении',value:'Четыре 650',normalized_value:4650000,evidence:'Четыре 650.',verification_status:'verified'};
    const objection={id:'fact_10',category:'client_objection',name:'возражение против ежемесячных взносов',value:'не устраивает взнос 9600',evidence:'Ну, конечно, вот этот побор, конечно, 9600, мне прямо не это.',verification_status:'verified'};
    const summary={status:'GENERATED',conversation_result:'Николай интересуется участком, бюджет до 5 500 000. Агент отправит материалы.',key_facts:[{label:'Бюджет',value:'5 500 000'},{label:'Локация',value:'Мистолово'},{label:'Цена в объявлении',value:'4 650 000'},{label:'Минимальный размер участка',value:'минимум 6 соток'}],quotes:[objection.evidence,'Да, давайте в Макс лучше.'],next_step:'Агент отправит материалы.',error:''};
    const store={conversation:{facts:[budgetFact,objectPrice,objection],requirements:[],attributes:{},primary_next_step:{action:'отправить материалы',status:'confirmed'}}};
    const budgetIssues=truthGroundingIssues({summary,conversation_store:store,__transcript:[budgetFact.evidence,objectPrice.evidence,objection.evidence].join('\\n')});
    const policy=moduleSummaryApplyStorePolicy(structuredClone(summary),store);
    const presentationCtx={summary:policy.value};
    const base={status:'fail',score:0,structure_score:0,brevity_score:0,readability_score:0,repetition_score:0,limits_score:0,checks:{required_fields_present:true,conversation_result_valid:true,key_facts_valid:true,quotes_valid:true,next_step_valid:true,character_limit_valid:true,no_excessive_repetition:true,easy_to_scan:false},metrics:{total_characters:0,conversation_result_characters:0,key_facts_count:4,quotes_count:1,next_step_characters:25,sentence_count:8},errors:[{type:'fragmented_text',field:'key_facts',summary_fragment:'минимум 6 соток',problem:'Избыточное слово «минимум», лучше коротко «6 соток».'}],warnings:[{type:'next_step_not_concise',field:'next_step',summary_fragment:'Агент отправит материалы.',problem:'Дублирует conversation_result.'}],explanation:'Проверка'};
    const presentation=validatePresentationJudgeOutput(base,presentationCtx);
    return {budgetIssues,policy,presentation};
  });

  expect(result.budgetIssues).not.toEqual(expect.arrayContaining([expect.objectContaining({ type: "money_or_number_error", field: "key_facts[0]" })]));
  expect(result.policy.count).toBe(2);
  expect(result.policy.value.key_facts).toEqual(expect.arrayContaining([expect.objectContaining({ label: "Бюджет", value: "до 5 500 000 ₽" })]));
  expect(result.policy.value.key_facts).toEqual(expect.arrayContaining([expect.objectContaining({ label: "Главное возражение", value: "не устраивает взнос 9600" })]));
  expect(result.policy.value.key_facts).not.toEqual(expect.arrayContaining([expect.objectContaining({ label: "Цена в объявлении" })]));
  expect(result.policy.value.quotes).toEqual(["Ну, конечно, вот этот побор, конечно, 9600, мне прямо не это.", "Да, давайте в Макс лучше."]);
  expect(result.presentation.errors).toEqual([]);
  expect(result.presentation.warnings).toEqual([]);
});

test("новый production report 2026-07-23 нормализует единицы, локацию и повтор следующего шага", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const budget={id:'fact_10',category:'client_finance',name:'максимальная цена',value:'до пяти с половиной',normalized_value:5500000,evidence:'у меня просто цена до пяти с половиной, вот так.',verification_status:'verified'};
    const objection={id:'fact_14',category:'client_objection',name:'возражение по ежемесячным взносам',value:'против ежемесячных взносов 9600',normalized_value:9600,evidence:'Ну, конечно, вот этот побор, конечно, 9600, мне прямо не это.',verification_status:'verified'};
    const summary={status:'GENERATED',conversation_result:'Клиент Николай звонит по участку в Деревня Мистолово и ищет минимум шесть соток. Разговор закончился договорённостью, что агент после звонка пришлёт подробный видеообзор и ссылку на подборку в канал Макс; предложение организовать просмотр было озвучено, но не согласовано.',key_facts:[{label:'Локация',value:'Деревня Мистолово'},{label:'Бюджет',value:'до пяти с половиной'},{label:'Минимальный размер участка',value:'минимум шесть соток'},{label:'Главное возражение',value:'против ежемесячных взносов 9600'}],quotes:['у меня просто цена до пяти с половиной, вот так.'],next_step:'отправить видео и скинуть ссылку на подбор; подготовить подборку вариантов',error:''};
    const store={conversation:{facts:[budget,objection],requirements:[],attributes:{},primary_next_step:{action:summary.next_step,status:'confirmed'}}};
    return moduleSummaryApplyStorePolicy(structuredClone(summary),store);
  });

  expect(result.value.conversation_result).toContain("в Мистолово");
  expect(result.value.conversation_result).not.toContain("в Деревня");
  expect(result.value.conversation_result).not.toContain(";");
  expect(result.value.key_facts).toContainEqual({ label: "Бюджет", value: "до 5 500 000 ₽" });
  expect(result.value.next_step).toBe("подготовить подборку вариантов и отправить видеообзор со ссылкой");
});

test("production report после деплоя нормализует падеж, сотки и разговорное возражение", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const landArea={id:'fact_7',category:'search_criteria',name:'минимальная площадь',value:6,normalized_value:6,evidence:'Ну, минимум шесть соток мне надо.',verification_status:'verified'};
    const objection={id:'fact_11',category:'client_objection',name:'главное возражение',value:'Ну, конечно, вот этот побор, конечно, 9600, мне прямо не это.',normalized_value:'Ну, конечно, вот этот побор, конечно, 9600, мне прямо не это.',evidence:'Ну, конечно, вот этот побор, конечно, 9600, мне прямо не это.',verification_status:'verified'};
    const summary={status:'GENERATED',conversation_result:'Николай запросил получить видеообзор и подборку по Деревня Мистолово.',key_facts:[{label:'Местоположение',value:'Деревня Мистолово'},{label:'Минимальная площадь',value:'6'},{label:'Главное возражение',value:objection.value}],quotes:[],next_step:'Следующий шаг не согласован.',error:''};
    const store={conversation:{facts:[landArea,objection],requirements:[],attributes:{},primary_next_step:{action:'',status:'not_defined'}}};
    return moduleSummaryApplyStorePolicy(structuredClone(summary),store);
  });

  expect(result.value.conversation_result).toContain("по Мистолово");
  expect(result.value.conversation_result).not.toContain("по Деревня");
  expect(result.value.key_facts).toContainEqual({ label: "Минимальная площадь", value: "6 соток" });
  expect(result.value.key_facts).toContainEqual({ label: "Главное возражение", value: "ежемесячный взнос 9 600 ₽" });
});

test("production report явно отражает получателя next step без повтора в итоге разговора", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const summary={status:'GENERATED',conversation_result:'Николай ищет участок в Деревне Мистолово минимум 6 соток. Агент отправит видео и ссылку на подбор в Макс после звонка.',key_facts:[],quotes:[],next_step:'отправить видео и ссылку на подбор; посмотреть варианты (агент, канал Макс, после звонка)',error:''};
    const store={conversation:{facts:[],requirements:[],attributes:{},agreements:[{id:'agreement_1',action:'отправить видеообзор',owner:'агент',recipient:'клиент',deadline:'после звонка',channel:'Макс',status:'confirmed'},{id:'agreement_2',action:'скинуть ссылку на подбор',owner:'агент',recipient:'клиент',deadline:'после звонка',channel:'Макс',status:'confirmed'}],primary_next_step:{action:'отправить видео и ссылку на подбор; посмотреть дополнительные варианты',owner:'агент',deadline:'после звонка',channel:'Макс',status:'confirmed',agreement_ids:['agreement_1','agreement_2']}}};
    return moduleSummaryApplyStorePolicy(structuredClone(summary),store);
  });

  expect(result.value.next_step).toBe("Агент после звонка отправит клиенту в Макс видеообзор и ссылку на подборку, затем посмотрит дополнительные варианты.");
  expect(result.value.conversation_result).toBe("Николай ищет участок в Деревне Мистолово минимум 6 соток. Агент после звонка отправит клиенту в Макс видеообзор и ссылку на подборку, затем посмотрит дополнительные варианты.");
});

test("Summary сохраняет подбор вариантов из связанной договорённости", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const summary={status:'GENERATED',conversation_result:'Клиент ищет участок. Агент отправит видео и ссылку на подборку.',key_facts:[],quotes:[],next_step:'Агент после звонка отправит клиенту в MAX видеообзор и ссылку на подборку.',error:''};
    const store={conversation:{facts:[],requirements:[{id:'requirement_1',type:'price_limit',value:5500000}],attributes:{},agreements:[
      {id:'agreement_1',action:'отправить видеообзор',owner:'агент',recipient:'клиент',deadline:'после звонка',channel:'MAX',status:'confirmed'},
      {id:'agreement_2',action:'отправить ссылку на подбор',evidence:'скину видео и сейчас посмотрю, что у нас есть, скину ссылку на подбор',owner:'агент',recipient:'клиент',deadline:'после звонка',channel:'MAX',status:'confirmed'},
      {id:'agreement_3',action:'подобрать другие варианты',evidence:'сейчас посмотрю, что у нас есть',owner:'агент',recipient:'клиент',deadline:'после звонка',channel:'MAX',status:'confirmed'}
    ],primary_next_step:{action:'отправить видеообзор, отправить ссылку на подбор и подготовить подборку вариантов',owner:'агент',deadline:'после звонка',channel:'MAX',status:'confirmed',agreement_ids:['agreement_1','agreement_2','agreement_3']}}};
    return moduleSummaryApplyStorePolicy(structuredClone(summary),store);
  });

  expect(result.value.next_step).toBe("Агент после звонка отправит клиенту в MAX видеообзор, затем посмотрит дополнительные варианты и отправит ссылку на подборку.");
  expect(result.value.conversation_result).toBe("Клиент ищет участок. Агент после звонка отправит клиенту в MAX видеообзор, затем посмотрит дополнительные варианты и отправит ссылку на подборку.");
});

test("Summary заменяет короткий повтор отправки видео на рабочий итог", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const summary={status:'GENERATED',conversation_result:'ожидает видео.',key_facts:[],quotes:[],next_step:'Агент после звонка отправит клиенту в MAX видеообзор и ссылку на подборку.',error:''};
    const store={conversation:{facts:[],requirements:[{id:'requirement_1',type:'price_limit',value:5500000}],attributes:{},agreements:[
      {id:'agreement_1',action:'отправить видеообзор',owner:'агент',recipient:'клиент',deadline:'после звонка',channel:'MAX',status:'confirmed'},
      {id:'agreement_2',action:'отправить ссылку на подбор',owner:'агент',recipient:'клиент',deadline:'после звонка',channel:'MAX',status:'confirmed'}
    ],primary_next_step:{action:'отправить видеообзор; отправить ссылку на подбор',owner:'агент',deadline:'после звонка',channel:'MAX',status:'confirmed',agreement_ids:['agreement_1','agreement_2']}}};
    return moduleSummaryApplyStorePolicy(structuredClone(summary),store);
  });

  expect(result.value.conversation_result).toBe("Клиент ищет участок по указанным параметрам. Агент после звонка отправит клиенту в MAX видеообзор и ссылку на подборку.");
  expect(result.value.next_step).toBe("Агент после звонка отправит клиенту в MAX видеообзор и ссылку на подборку.");
});

test("детерминированные проверки не создают ложные warnings из подтверждённого контекста", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const offer={id:'fact_1',category:'agent_commitment',name:'агент отправит видео',value:'агент отправит видеообзор',normalized_value:null,speaker:'Агент',evidence:'Хорошо, я тогда сейчас скину вам видео, вам в Телегу, в Макс?',confidence:.9,verification_status:'pending'};
    const factRejection=factCodeSemanticRejection(offer,new Set());
    const needWarnings=relevantNeedJudgeWarnings(['Пропущена потребность interest: клиент явно интересуется участком (fact_1).'],{fact_check:{verified_facts:[{id:'fact_1',category:'client_intent',name:'цель обращения',value:'интересуется участком',evidence:'по поводу участка звоню'}]}});
    const evidence='Э-э, скину видео и сейчас посмотрю, че у нас есть, скину ссылку на подбор.';
    const actionCtx={summary:{next_step:'Агент после звонка отправит клиенту в Макс видеообзор, затем посмотрит дополнительные варианты и отправит ссылку на подборку.'},conversation_store:{store_meta:{status:'READY'},conversation:{call_results:[],agreements:[
      {id:'agreement_1',action:'отправить видеообзор',owner:'агент',recipient:'клиент',deadline:'после звонка',channel:'Макс',status:'confirmed',evidence},
      {id:'agreement_2',action:'отправить ссылку на подбор',owner:'агент',recipient:'клиент',deadline:'после звонка',channel:'Макс',status:'confirmed',evidence},
      {id:'agreement_3',action:'посмотреть имеющиеся варианты и подобрать подходящие',owner:'агент',recipient:'клиент',deadline:'после звонка',channel:'Макс',status:'confirmed',evidence}
    ],primary_next_step:{action:'отправить видеообзор; отправить ссылку на подбор; посмотреть имеющиеся варианты и подобрать подходящие',owner:'агент',deadline:'после звонка',channel:'Макс',status:'confirmed',agreement_ids:['agreement_1','agreement_2','agreement_3']}}}};
    const actionIssues=actionCheckCodeIssues(actionCtx);
    const agreementEvidence='Агент: "скину видео и сейчас посмотрю, что есть, скину ссылку на подбор." Клиент: "Да, давайте в Макс лучше."';
    const outcomeInput={call_results:[],agreements:[{id:'agreement_1',action:'скинуть подбор и ссылку на подборку',owner:'агент',recipient:'клиент',deadline:'после звонка',channel:'MAX',status:'confirmed',evidence:agreementEvidence,confidence:.9,verification_status:'pending'}],primary_next_step:{action:'скинуть подбор и ссылку на подборку',owner:'агент',deadline:'после звонка',channel:'MAX',status:'confirmed',agreement_ids:['agreement_1'],confidence:.9,verification_status:'pending'}};
    const outcomeIssues=outcomeSemanticGuards(outcomeInput,{__transcript:'Клиент: Да, давайте в Макс лучше.',fact_check:{verified_facts:[{category:'communication_channel',value:'MAX',normalized_value:'MAX',evidence:'Да, давайте в Макс лучше.',verified:true,verification_status:'verified'}]}});
    return {factRejection,needWarnings,actionIssues,outcomeAgreementIssues:[...outcomeIssues.agreementIssues.entries()]};
  });

  expect(result.factRejection).toBeNull();
  expect(result.needWarnings).toEqual([]);
  expect(result.actionIssues).not.toEqual(expect.arrayContaining([expect.objectContaining({type:"sequence_distortion"})]));
  expect(result.actionIssues).not.toEqual(expect.arrayContaining([expect.objectContaining({type:"wrong_owner"})]));
  expect(result.outcomeAgreementIssues).toEqual([]);
});

test("Summary сохраняет просмотр вариантов перед отправкой подборки", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const summary={status:'GENERATED',conversation_result:'Клиент ищет участок.',key_facts:[],quotes:[],next_step:'отправить видео, посмотреть варианты и направить подборку',error:''};
    const store={conversation:{facts:[],requirements:[],attributes:{},agreements:[
      {id:'agreement_1',action:'отправить видеообзор',owner:'агент',recipient:'клиент',deadline:'после звонка',channel:'MAX',status:'confirmed'},
      {id:'agreement_2',action:'посмотреть варианты и направить подборку',owner:'агент',recipient:'клиент',deadline:'после звонка',channel:'MAX',status:'confirmed'}
    ],primary_next_step:{action:'отправить видео, посмотреть доступные варианты и направить подборку',owner:'агент',deadline:'после звонка',channel:'MAX',status:'confirmed',agreement_ids:['agreement_1','agreement_2']}}};
    return moduleSummaryApplyStorePolicy(structuredClone(summary),store);
  });

  expect(result.value.next_step).toBe("Агент после звонка отправит клиенту в MAX видеообзор, затем посмотрит дополнительные варианты и отправит ссылку на подборку.");
});

test("Summary выбирает доказательные цитаты и сохраняет альтернативную географию", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const facts=[
      {id:'fact_1',category:'client_intent',name:'цель обращения',value:'звонок по поводу участка',evidence:'Слушайте, по поводу участка звоню вам.'},
      {id:'fact_2',category:'search_location',name:'место поиска',value:'Деревня Мистолово',evidence:'Деревня Мистолово.'},
      {id:'fact_8',category:'client_finance',name:'максимальный бюджет',value:'до пяти с половиной',normalized_value:5500000,evidence:'Не, ну у меня просто цена до пяти с половиной, вот так.'},
      {id:'fact_9',category:'client_objection',name:'возражение',value:'не устраивают взносы',normalized_value:9600,evidence:'Ну, конечно, вот этот побор, конечно, 9600, мне прямо не это.'}
    ];
    const quotes=[
      {id:'quote_1',text:facts[0].evidence,speaker:'Клиент',supports_fact_ids:['fact_1']},
      {id:'quote_5',text:facts[2].evidence,speaker:'Клиент',supports_fact_ids:['fact_8']},
      {id:'quote_6',text:facts[3].evidence,speaker:'Клиент',supports_fact_ids:['fact_9']}
    ];
    const summary={status:'GENERATED',conversation_result:'Клиент ищет участок.',key_facts:[{label:'Область поиска',value:'деревня Мистолово'}],quotes:[facts[0].evidence],next_step:'Следующий шаг не согласован.',error:''};
    const store={conversation:{facts,quotes,requirements:[],attributes:{},primary_next_step:{action:'',status:'not_defined'}}};
    const transcript='Клиент: — Блин, в Мистолово ничего. Там, Мистолово, Капитолова, Лаврики, что-нибудь такое.';
    return moduleSummaryApplyStorePolicy(structuredClone(summary),store,transcript);
  });

  expect(result.value.key_facts).toContainEqual({label:"Районы поиска",value:"Мистолово, Капитолово, Лаврики"});
  expect(result.value.quotes).toEqual([
    "Не, ну у меня просто цена до пяти с половиной, вот так.",
    "Ну, конечно, вот этот побор, конечно, 9600, мне прямо не это."
  ]);
  expect(result.value.quotes).not.toContain("Слушайте, по поводу участка звоню вам.");
});

test("Fact policy добавляет перечисленные клиентом районы в проверяемый контракт", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const transcript='Клиент:\n— Деревня Мистолово.\nКлиент:\n— Блин, в Мистолово ничего. Там, Мистолово, Капитолова, Лаврики, что-нибудь такое.';
    const evidence='Деревня Мистолово.';
    const value={facts:[{id:'fact_1',category:'search_location',name:'область поиска',value:'Мистолово',normalized_value:'Мистолово',speaker:'Клиент',evidence,confidence:.9,verification_status:'pending'}],quotes:[],extraction_meta:{fact_count:1,quote_count:0,decision:'EXTRACTED'}};
    return applyFactExtractionPolicies(value,{__transcript:transcript});
  });

  expect(result.warnings).toContain("SEARCH_LOCATION_RANGE_POLICY_ADDED");
  expect(result.value.facts).toContainEqual(expect.objectContaining({
    category: "search_location",
    name: "районы поиска",
    value: ["Мистолово", "Капитолова", "Лаврики"],
    normalized_value: ["Мистолово", "Капитолова", "Лаврики"],
    verification_status: "pending"
  }));
  expect(result.value.extraction_meta.fact_count).toBe(2);
});

test("Need producer публикует дедупликацию отдельно от требований, а Judge получает только бизнес-контракт", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const verifiedFacts=[
      {id:'fact_1',category:'search_location',name:'область поиска',value:'Капитолова',normalized_value:'Капитолова',speaker:'Клиент',evidence:'Рассматриваю Капитолова.',confidence:.96,verification_status:'verified',verified:true},
      {id:'fact_2',category:'search_location',name:'районы поиска',value:['Мистолово','Капитолова','Лаврики'],normalized_value:['Мистолово','Капитолова','Лаврики'],speaker:'Клиент',evidence:'Там, Мистолово, Капитолова, Лаврики, что-нибудь такое.',confidence:.96,verification_status:'verified',verified:true},
    ];
    const pendingFacts=verifiedFacts.map(({verified,...fact})=>({...fact,verification_status:'pending'}));
    const requirement=(id,value,fact)=>({id,type:'search_location',value,normalized_value:value,confidence:.95,evidence:fact.evidence,source_fact_ids:[fact.id],verification_status:'pending'});
    const input={
      attributes:{interest:[],funding_source:{value:'не определено',confidence:1,evidence:'',source_fact_ids:[],verification_status:'pending'},purchase_term:{value:'не определено',confidence:1,evidence:'',source_fact_ids:[],verification_status:'pending'}},
      requirements:[requirement('req_1','Капитолова',verifiedFacts[0]),requirement('req_2',['Мистолово','Капитолова','Лаврики'],verifiedFacts[1])],
      need_meta:{interest_count:0,requirements_count:2,decision:'EXTRACTED'}
    };
    const ctx={facts:{facts:pendingFacts,quotes:[],extraction_meta:{fact_count:2,quote_count:0,decision:'EXTRACTED'}},fact_check:{status:'ok',decision:'PASS',verified_facts:verifiedFacts}};
    const published=validateNeedExtractionRoot(input,ctx);
    const check=CODE_FUNCS.needCheckCode({}, {...ctx,needs:published});
    return {published,judgeInput:check.input,hardFail:check.hardFail};
  });

  expect(result.hardFail).toBe(false);
  expect(result.published.requirements).toEqual([
    expect.objectContaining({value:["Мистолово","Капитолово","Лаврики"],source_fact_ids:["fact_2","fact_1"]}),
  ]);
  expect(result.published.requirements[0]).not.toHaveProperty("deduplication_provenance");
  expect(result.published.need_meta.transformations).toEqual([
    expect.objectContaining({
      type:"MERGE_OVERLAPPING_SEARCH_LOCATIONS",
      output_requirement_id:result.published.requirements[0].id,
      source_requirement_ids:expect.arrayContaining([result.published.requirements[0].id]),
    }),
  ]);
  expect(result.published.need_meta.transformations[0].source_requirement_ids).toHaveLength(2);
  expect(result.judgeInput.need_meta).not.toHaveProperty("transformations");
});

test("технический сбой Need Judge сохраняет provisional-данные и разрешает диагностический downstream", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const item={value:'не определено',confidence:1,evidence:'',source_fact_ids:[],verification_status:'pending'};
    const input={attributes:{interest:[],funding_source:item,purchase_term:item},requirements:[{id:'req_1',type:'property_type',value:'ИЖС',normalized_value:'ИЖС',confidence:.95,evidence:'Нужен ИЖС.',source_fact_ids:['fact_1'],verification_status:'pending'}],need_meta:{interest_count:0,requirements_count:1,decision:'EXTRACTED'}};
    const fallback=mergeNeedCheckV2({criteria:[],hardFail:false},null,'JUDGE_RESULT_UNAVAILABLE',input,{});
    return {fallback,outcomeDependency:outcomeDependencyError({fact_check:{status:'ok',decision:'PASS'},need_check:fallback})};
  });

  expect(result.fallback).toMatchObject({
    status:"technical_error",
    execution_status:"TECHNICAL_ERROR",
    evaluation_status:"NOT_EVALUATED",
    continue_pipeline:true,
    decision:"ERROR",
    provisional_requirements:[expect.objectContaining({id:"req_1",verification_status:"unverified_due_to_technical_error",verified:false})],
  });
  expect(result.outcomeDependency).toBeNull();
});

test("локация из ответа на вопрос об объекте не становится областью поиска", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const transcript=["Оператор: Где находится участок?","Клиент: Деревня Мистолово.","Оператор: Какие районы рассматриваете?","Клиент: Там, Мистолово, Капитолова, Лаврики, что-нибудь такое."].join("\n");
    const value={facts:[{id:'fact_1',category:'search_location',name:'поиск: локация',value:'Деревня Мистолово',normalized_value:'Деревня Мистолово',speaker:'Клиент',evidence:'Деревня Мистолово.',confidence:.98,verification_status:'pending'}],quotes:[],extraction_meta:{fact_count:1,quote_count:0,decision:'EXTRACTED'}};
    const policy=applyFactExtractionPolicies(value,{__transcript:transcript});
    const recovered=conversationStoreRecoveredRequirements(policy.value.facts,[]);
    return {policy,requirements:deduplicateSearchLocationRequirements(recovered)};
  });

  expect(result.policy.warnings).toContain("OBJECT_LOCATION_RECLASSIFIED");
  expect(result.policy.value.facts).toContainEqual(expect.objectContaining({ id: "fact_1", category: "object_context" }));
  expect(result.policy.value.facts).toContainEqual(expect.objectContaining({ category: "search_location", value: ["Мистолово", "Капитолова", "Лаврики"] }));
  expect(result.requirements.requirements.filter((item: any) => item.type === "search_location")).toEqual([
    expect.objectContaining({ value: ["Мистолово", "Капитолово", "Лаврики"] }),
  ]);
});

test("земельный Summary нормализуется без дублей и получает confidence", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const facts=[
      {id:'goal',category:'client_intent',value:'покупка участка',evidence:'по поводу участка звоню',verification_status:'verified'},
      {id:'budget',category:'client_finance',value:5500000,normalized_value:5500000,evidence:'цена до пяти с половиной',verification_status:'verified'},
      {id:'objection',category:'client_objection',value:'возражение против ежемесячных взносов 9600',evidence:'Вот этот побор 9600 мне прямо не это.',verification_status:'verified'},
    ];
    const requirements=[
      {id:'type',type:'property_type',value:'ИЖС',evidence:'ИЖС?',verification_status:'verified'},
      {id:'area',type:'minimum_land_area',value:6,normalized_value:6,evidence:'минимум шесть соток',verification_status:'verified'},
      {id:'price',type:'price_limit',value:5500000,normalized_value:5500000,evidence:'цена до пяти с половиной',verification_status:'verified'},
      {id:'locations',type:'search_location',value:['Мистолово','Капитолово','Лаврики'],evidence:'Мистолово, Капитолова, Лаврики',verification_status:'verified'},
    ];
    const store={conversation:{facts,requirements,attributes:{},quotes:[{id:'q',text:facts[2].evidence,speaker:'Клиент',supports_fact_ids:['objection']}],agreements:[{id:'a',recipient:'клиент',action:'отправить видеообзор и подборку альтернативных участков',owner:'агент',deadline:'после звонка',channel:'MAX',status:'confirmed'}],primary_next_step:{action:'отправить видеообзор и подборку альтернативных участков',owner:'агент',deadline:'после звонка',channel:'MAX',status:'confirmed',agreement_ids:['a']}}};
    const draft={status:'GENERATED',conversation_result:'Клиент интересуется участком в районе Деревня Мистолово / Капитолова / Лаврики и отвергает взнос.',key_facts:[{label:'Бюджет',value:'5 500 000'}],quotes:['цена до пяти с половиной',facts[2].evidence],next_step:'отправить материалы',error:''};
    const summary=moduleSummaryApplyStorePolicy(draft,store).value;
    const grounding=moduleSummaryGrounding(summary,store);
    const expected=criticalCompletenessExpectedItems({conversation_store:store});
    const confidence=moduleSummaryConfidence({conversation_store:{...store,quality:{overall_confidence:1}},fact_check:{overall_confidence:.95},need_check:{overall_confidence:.95},outcome_check:{overall_confidence:.9}});
    return {summary,expected,confidence,grounding};
  });

  expect(result.summary.conversation_result).toBe("Клиент рассматривает покупку участка ИЖС от 6 соток в Мистолове, Капитолове или Лавриках с бюджетом до 5,5 млн ₽. Клиента смущает ежемесячный взнос 9 600 ₽.");
  expect(result.summary.key_facts).toEqual([]);
  expect(result.summary.quotes).toEqual(["Вот этот побор 9600 мне прямо не это."]);
  expect(result.grounding).toEqual([]);
  expect(result.expected.map((item: any) => item.id)).toEqual(["critical-client-goal","critical-budget","critical-property-type","critical-minimum-land-area","critical-search-location","critical-objection"]);
  expect(result.confidence).toBe(.963);
});

test("production-вариативность восстанавливает локации и не создаёт ложные corrections", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const transcript="Агент:\n— Вам ИЖС?\nКлиент:\n— Да, да, конечно, я понял.";
    const extracted=applyFactExtractionPolicies({
      facts:[{id:'fact_1',category:'search_criteria',name:'требование по назначению (ИЖС)',value:true,normalized_value:true,speaker:'Клиент',evidence:'Да, да, конечно, я понял.',confidence:.9,verification_status:'pending'}],
      quotes:[{id:'quote_1',text:'Да, да, конечно, я понял.',speaker:'Клиент',supports_fact_ids:['fact_1'],confidence:.9,verification_status:'pending'}],
      extraction_meta:{fact_count:1,quote_count:1,decision:'EXTRACTED'}
    },{transcript});
    const locationFact={id:'location',category:'search_location',name:'область поиска',value:['Капитолово','Лаврики'],normalized_value:['Капитолово','Лаврики'],speaker:'Клиент',evidence:'Я ищу участки. Там, Мистолово, Капитолова, Лаврики, что-нибудь такое.',confidence:.95,verification_status:'verified',verified:true};
    const areaFact={id:'area',category:'search_criteria',name:'минимальная площадь участка',value:'6 соток',normalized_value:'6 соток',speaker:'Клиент',evidence:'Ну, минимум шесть соток мне надо.',confidence:.95,verification_status:'verified',verified:true};
    const needs=normalizeNeedExtractionSemantics({
      attributes:{interest:[],funding_source:{value:'не определено',confidence:1,evidence:'',source_fact_ids:[],verification_status:'pending'},purchase_term:{value:'не определено',confidence:1,evidence:'',source_fact_ids:[],verification_status:'pending'}},
      requirements:[{id:'req_location',type:'search_location',value:['Капитолово','Лаврики'],confidence:.9,evidence:locationFact.evidence,source_fact_ids:['location'],verification_status:'pending'},{id:'req_area',type:'minimum_land_area',value:'6 соток',confidence:.95,evidence:areaFact.evidence,source_fact_ids:['area'],verification_status:'pending'}],
      need_meta:{interest_count:0,requirements_count:2,decision:'EXTRACTED'}
    },{fact_check:{verified_facts:[locationFact,areaFact]}});
    const needInput=needJudgeBusinessInput(needs);
    const needJudge=validateNeedJudgeOutput({items:[
      {id:'funding_source',verdict:'verified',reason:'Не указано.',confidence:.9,corrections:{}},
      {id:'purchase_term',verdict:'verified',reason:'Не указано.',confidence:.9,corrections:{}},
      ...needInput.requirements.map(item=>({id:item.id,verdict:item.type==='search_location'?'rejected':'verified',reason:item.type==='search_location'?'Капитолова не совпадает с Капитолово.':'Подтверждено.',confidence:.9,corrections:{}}))
    ],overall_confidence:.9,warnings:[]},needInput);
    const needCheck=mergeNeedCheckV2({hardFail:false,criteria:[]},needJudge,null,needInput,{fact_check:{verified_facts:[locationFact,areaFact]}});
    const outcomeInput=normalizeOutcomeSemantics({
      call_results:[],
      agreements:[{id:'agreement_1',action:'проверить дополнительные варианты',owner:'агент',recipient:'клиент',deadline:'после звонка',channel:'',status:'confirmed',evidence:'Сейчас посмотрю, что есть ещё.',confidence:.9,verification_status:'pending'}],
      primary_next_step:{action:'проверить дополнительные варианты',owner:'агент',deadline:'после звонка',channel:'',status:'confirmed',agreement_ids:['agreement_1'],confidence:.9,verification_status:'pending'},
      outcome_meta:{result_count:0,agreement_count:1,decision:'EXTRACTED'}
    },{fact_check:{verified_facts:[]},transcript:'Агент:\n— Сейчас посмотрю, что есть ещё.'});
    const judge=validateOutcomeJudgeOutput({items:[
      {id:'agreement_1',verdict:'needs_correction',reason:'Канал MAX общий.',confidence:.85,corrections:{channel:'MAX',confidence:.85}},
      {id:'primary_next_step',verdict:'verified',reason:'Шаг подтверждён.',confidence:.9,corrections:{}}
    ],overall_confidence:.9,warnings:[]},outcomeInput);
    const outcome=mergeOutcomeCheck({hardFail:false,criteria:[]},judge,null,outcomeInput,{});
    const summary={status:'GENERATED',conversation_result:'Клиент рассматривает покупку участка.',key_facts:[],quotes:[],next_step:'Агент отправит клиенту подборку альтернативных участков.',error:'',confidence:.95};
    const utility=validateAgentUtilityJudgeOutput({status:'fail',score:80,can_continue_without_recording:false,context_clarity:80,actionability:80,scanability:100,recording_independence:80,missing_for_next_agent:[],useful_summary_elements:[],problems:[{type:'missing_action_context',field:'next_step',summary_fragment:summary.next_step,problem:'Не указаны критерии приоритизации подборки и фильтры вариантов.'},{type:'crm_data_without_working_context',field:'key_facts',summary_fragment:summary.conversation_result,problem:'Ключевые факты записаны в свободном тексте conversation_result, но поле key_facts пустое — это усложняет быстрое считывание карточки и машинную обработку.'},{type:'difficult_to_scan',field:'next_step',summary_fragment:summary.next_step,problem:'Нет приоритизации или краткого контекста: что должно быть в подборке и какие параметры считать первыми.'}],explanation:'Проверка'}, {summary,conversation_store:{conversation:{agreements:[{id:'a',action:'отправить подборку',owner:'агент'}],primary_next_step:{action:'отправить подборку',owner:'агент',status:'confirmed',agreement_ids:['a']}}}});
    const materials=normalizeOutcomeSemantics({call_results:[],agreements:[{id:'agreement_materials',action:'отправить ссылку на подбор',owner:'агент',recipient:'клиент',deadline:'',channel:'',status:'confirmed',evidence:'Скину ссылку на подбор.',confidence:.9,verification_status:'pending'}],primary_next_step:{action:'отправить ссылку на подбор',owner:'агент',deadline:'',channel:'',status:'confirmed',agreement_ids:['agreement_materials'],confidence:.9,verification_status:'pending'},outcome_meta:{result_count:0,agreement_count:1,decision:'EXTRACTED'}},{fact_check:{verified_facts:[{category:'communication_channel',value:'MAX',normalized_value:'MAX',evidence:'Да, давайте в Макс лучше.',verified:true,verification_status:'verified'}]},__transcript:'Агент: Сейчас скину ссылку на подбор.\nКлиент: Да, давайте в Макс лучше.'});
    const expected=criticalCompletenessExpectedItems({conversation_store:{conversation:{facts:[{id:'goal',category:'client_intent',value:'узнать про участок',evidence:'Слушайте, по поводу участка звоню вам.',verification_status:'verified'}],requirements:[{id:'budget',type:'price_limit',value:5500000,evidence:'до пяти с половиной',verification_status:'verified'},{id:'type',type:'property_type',value:'ИЖС',evidence:'ИЖС',verification_status:'verified'}],attributes:{},call_results:[],agreements:[],primary_next_step:{}}}});
    const truthPurchaseIssue=repairTruthJudgeIssue({type:'fact_distortion',field:'conversation_result',summary_fragment:'Клиент рассматривает покупку участка',problem:'Явное намерение покупки не подтверждено.',evidence:'fact_1 evidence: Слушайте, по поводу участка звоню вам.'},{summary,conversation_store:{conversation:{requirements:[{type:'price_limit'},{type:'property_type'},{type:'search_location'}]}}});
    const presentationOptional=validatePresentationIssue({type:'empty_required_field',field:'key_facts',summary_fragment:'Клиент рассматривает покупку участка',problem:'Поле key_facts пусто.'},'errors[0]',{summary});
    return {
      facts:extracted.value.facts,
      quoteRefs:extracted.value.quotes[0].supports_fact_ids,
      locations:needs.requirements.find((item: any)=>item.type==='search_location').value,
      area:needs.requirements.find((item: any)=>item.type==='minimum_land_area').value,
      transformations:needs.need_meta.transformations,
      needCheck:{score:needCheck.score,decision:needCheck.decision},
      outcome:{score:outcome.score,decision:outcome.decision,agreement:outcome.verified_agreements[0],primary:outcome.verified_primary_next_step},
      materials:materials.agreements[0],
      expectedIds:expected.map(item=>item.id),
      truthPurchaseIssue,
      presentationOptional,
      utilityProblems:utility.problems,
      actionCovered:actionCheckPartCovered('проверить дополнительные варианты',summary.next_step),
      presentationStatus:validatePresentationSummaryShape(summary).status
    };
  });

  expect(result.facts.filter((item: any) => /ижс/i.test(String(item.normalized_value ?? item.value)))).toHaveLength(1);
  expect(result.quoteRefs).toEqual([result.facts[0].id]);
  expect(result.locations).toEqual(["Мистолово", "Капитолово", "Лаврики"]);
  expect(result.area).toBe(6);
  expect(result.transformations).toContainEqual(expect.objectContaining({ type: "RECOVER_SEARCH_LOCATION_RANGE" }));
  expect(result.needCheck).toEqual({ score: 100, decision: "PASS" });
  expect(result.outcome).toMatchObject({ score: 100, decision: "PASS", agreement: { channel: "", status: "promised" }, primary: { status: "promised" } });
  expect(result.materials).toMatchObject({ channel: "MAX", status: "promised", deadline: "после звонка" });
  expect(result.expectedIds).not.toContain("critical-client-goal");
  expect(result.truthPurchaseIssue).toBeNull();
  expect(result.presentationOptional).toBeNull();
  expect(result.utilityProblems).toEqual([]);
  expect(result.actionCovered).toBe(true);
  expect(result.presentationStatus).toBe("GENERATED");
});

test("проверки качества не штрафуют общий client goal, дословную цитату и принадлежащий агенту файл", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const summary={status:'GENERATED',conversation_result:'Клиент ищет участок по указанным параметрам.',key_facts:[{label:'Бюджет',value:'до 5 500 000 ₽'}],quotes:['Ну, конечно, вот этот побор, конечно, 9600, мне прямо не это.'],next_step:'Агент отправит видеообзор и ссылку на подборку.',error:''};
    const conversation_store={conversation:{facts:[{id:'f1',category:'client_goal',name:'цель обращения',value:'узнать про участок',evidence:'Слушайте, по поводу участка звоню вам.'}],requirements:[{id:'r1',type:'price_limit',value:5500000,evidence:'до пяти с половиной'}],attributes:{},call_results:[],agreements:[],primary_next_step:{}}};
    const completeness=criticalCompletenessRecalculate({critical_items:[{id:'c1',category:'client_goal',expected:'цель обращения — узнать про участок',present:false,summary_field:'',summary_fragment:'',evidence:'Слушайте, по поводу участка звоню вам.'},{id:'c2',category:'budget',expected:'бюджет до 5,5 млн',present:true,summary_field:'key_facts',summary_fragment:'до 5 500 000 ₽',evidence:'до пяти с половиной'}],missing_items:[{id:'c1',type:'client_goal',category:'client_goal',expected:'цель обращения — узнать про участок',importance:'critical',reason:'общий контекст',evidence:'Слушайте, по поводу участка звоню вам.'}],warnings:[],explanation:'Проверка'}, {summary,conversation_store});
    const presentation=validatePresentationJudgeOutput({status:'fail',score:60,structure_score:100,brevity_score:100,readability_score:60,repetition_score:100,limits_score:100,checks:{required_fields_present:true,conversation_result_valid:true,key_facts_valid:true,quotes_valid:true,next_step_valid:true,character_limit_valid:true,no_excessive_repetition:true,easy_to_scan:false},metrics:{total_characters:200,conversation_result_characters:45,key_facts_count:1,quotes_count:1,next_step_characters:48,sentence_count:4},errors:[{type:'difficult_to_scan',field:'quotes[0]',summary_fragment:summary.quotes[0],problem:'разговорная фраза'},{type:'difficult_to_scan',field:'conversation_result',summary_fragment:'Мистолово, Капитолова, Лаврики',problem:'перечисление районов'}],warnings:[],explanation:'Проверка'}, {summary:{...summary,conversation_result:'Клиент ищет в Мистолово, Капитолова, Лаврики.'}});
    const utility=validateAgentUtilityJudgeOutput({status:'warning',score:95,can_continue_without_recording:true,context_clarity:100,actionability:90,scanability:100,recording_independence:100,missing_for_next_agent:[{type:'action_context',description:'не указан точный URL видеофайла'}],useful_summary_elements:[],problems:[{type:'ambiguous_wording',field:'next_step',summary_fragment:summary.next_step,problem:'неясно, какой конкретно видеофайл или URL отправлять'}],explanation:'Проверка'}, {summary,conversation_store,critical_completeness_check:{missing_items:[]}});
    return {completeness,presentation,utility};
  });

  expect(result.completeness).toMatchObject({status:"pass",score:100,critical_items_total:1,critical_items_missing:0});
  expect(result.presentation.errors).toEqual([]);
  expect(result.utility.problems).toEqual([]);
  expect(result.utility.missing_for_next_agent).toEqual([]);
});

test("результаты этапов по умолчанию свернуты и раскрываются по клику", async ({ page }) => {
  await page.goto(moduleUrl);
  const state = await page.evaluate(() => {
    const stage={type:'code',name:'Тестовый этап',codeFn:'validate',outKey:'validation'};
    const report=renderReport(stage,{status:'ok',ms:4,metrics:[['Score',100]],output:{status:'pass'}},1);
    document.body.appendChild(report);
    const header=report.querySelector('.rep-h');
    const before={collapsed:report.classList.contains('collapsed'),expanded:header.getAttribute('aria-expanded')};
    header.click();
    return {before,after:{collapsed:report.classList.contains('collapsed'),expanded:header.getAttribute('aria-expanded')}};
  });

  expect(state.before).toEqual({collapsed:true,expanded:"false"});
  expect(state.after).toEqual({collapsed:false,expanded:"true"});
});

test("Проверка потребностей валидирует Judge и сама рассчитывает quality", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => eval(`(async () => {
    const fact=(id,category,evidence,value=evidence)=>({id,category,name:category,value,normalized_value:value,speaker:'Клиент',evidence,confidence:.96,verification_status:'verified',verified:true,source:'fact_check'});
    const pending=f=>({id:f.id,category:f.category,name:f.name,value:f.value,normalized_value:f.normalized_value,speaker:f.speaker,evidence:f.evidence,confidence:f.confidence,verification_status:'pending'});
    const item=(value,source_fact_ids=[],evidence='')=>({value,confidence:.95,evidence,source_fact_ids,verification_status:'pending'});
    const req=(id,type,value,source_fact_ids,evidence)=>({id,type,value,confidence:.95,evidence,source_fact_ids,verification_status:'pending'});
    const root=(interest=[],funding=item('не определено'),term=item('не определено'),requirements=[])=>({attributes:{interest,funding_source:funding,purchase_term:term},requirements,need_meta:{interest_count:interest.length,requirements_count:requirements.length,decision:interest.length||requirements.length||funding.value!=='не определено'||term.value!=='не определено'?'EXTRACTED':'NO_NEEDS'}});
    const ctxFor=(facts,needs)=>({__transcript:facts.map(f=>f.evidence).join('\\n'),fact_check:{decision:'PASS',status:'ok',verified_facts:facts},facts:{facts:facts.map(pending),quotes:[],extraction_meta:{fact_count:facts.length,quote_count:0,decision:facts.length?'EXTRACTED':'NO_FACTS'}},needs});
    const quality={attributes_checked:999,attributes_verified:0,attributes_rejected:999,requirements_checked:999,requirements_verified:0,requirements_rejected:999,critical_needs_missing:999,attribute_accuracy_score:0,requirement_precision_score:0,critical_recall_score:0,overall_score:0,decision:'FAIL'};
    const criterion={name:'Need semantics',status:'pass',score:100,explanation:'Проверено'};
    const judge=(input,{rejectAttrs=[],rejectReqs=[],missing=[],newReq=null,decision='FAIL'}={})=>{
      const rejectedAttrKeys=new Set(rejectAttrs.map(item=>item.attribute+':'+JSON.stringify(item.value)));
      const verifiedAttr=(attribute,list)=>list.filter(source=>!rejectedAttrKeys.has(attribute+':'+JSON.stringify(source.value))).map(source=>({value:source.value,verified:true,reason:'подтверждено'}));
      const rejectedReqIds=new Set(rejectReqs.map(item=>item.id));
      return {verified_attributes:{interest:verifiedAttr('interest',input.attributes.interest),funding_source:verifiedAttr('funding_source',[input.attributes.funding_source]),purchase_term:verifiedAttr('purchase_term',[input.attributes.purchase_term])},rejected_attributes:rejectAttrs,verified_requirements:[...input.requirements.filter(source=>!rejectedReqIds.has(source.id)).map(source=>({id:source.id,value:source.value,verified:true,reason:'подтверждено'})),...(newReq?[newReq]:[])],rejected_requirements:rejectReqs,missing_critical_needs:missing,need_check_quality:{...quality,decision},criteria:[criterion]};
    };
    const stage={type:'hybrid',name:'Проверка потребностей',codeFn:'needCheckCode',outKey:'need_check',model:'gpt-5-mini',provider:'mock',prompt:'Needs: {{ctx.needs}} Facts: {{ctx.fact_check.verified_facts}} Transcript: {{transcript}}'};
    const run=(facts,input,options={})=>{
      const ctx=ctxFor(facts,input),code=CODE_FUNCS.needCheckCode(stage,ctx),normalized=code.input;
      const verdict=judge(normalized,options);
      try{validateNeedJudgeOutput(verdict,normalized);return {code,output:mergeNeedCheckV2(code,verdict,null,normalized)}}catch(error){return {code,output:mergeNeedCheckV2(code,null,error.message,normalized)}}
    };
    const rejectAttr=(attribute,value,error_type,disputed=false)=>({attribute,value,reason:error_type,error_type,severity:'warning',disputed});
    const rejectReq=(id,value,error_type)=>({id,value,verified:false,reason:error_type,error_type,severity:'warning',disputed:false});
    const general=fact('fact_general','client_intent','Хочу купить квартиру');
    const empty=run([general],root());
    const plot=fact('fact_plot','requirement','Ищу участок в области');
    const plotCheck=run([plot],root([item('Строительство',['fact_plot'],plot.evidence)]),{rejectAttrs:[rejectAttr('interest','Строительство','false_interest')]});
    const refusal=fact('fact_refusal','client_finance','Ипотека мне не нужна');
    const refusalCheck=run([refusal],root([],item('наличные / депозит',['fact_refusal'],refusal.evidence)),{rejectAttrs:[rejectAttr('funding_source','наличные / депозит','unsupported_funding')]});
    const viewing=fact('fact_viewing','communication_context','Просмотр назначен через два месяца');
    const viewingCheck=run([viewing],root([],item('не определено'),item('2–3 месяца',['fact_viewing'],viewing.evidence)),{rejectAttrs:[rejectAttr('purchase_term','2–3 месяца','viewing_date_not_purchase_term',true)]});
    const cash=fact('fact_cash','client_finance','Оплачу наличными, деньги на депозите');
    const cashCheck=run([cash],root([],item('наличные / депозит',['fact_cash'],cash.evidence)));
    const mortgage=fact('fact_mortgage','client_finance','Ипотека одобрена банком');
    const mortgageCheck=run([mortgage],root([item('Ипотека',['fact_mortgage'],mortgage.evidence)],item('ипотека одобрена',['fact_mortgage'],mortgage.evidence)));
    const futureSale=fact('fact_future_sale','client_finance','Сначала продам свою квартиру, это источник покупки');
    const futureSaleCheck=run([futureSale],root([],item('продажа своей квартиры',['fact_future_sale'],futureSale.evidence)));
    const sold=fact('fact_sold','client_finance','Квартиру уже продал, деньги получил');
    const soldCheck=run([sold],root([],item('наличные / депозит',['fact_sold'],sold.evidence)));
    const price=fact('fact_price','object_information','Цена объявления десять миллионов',10000000);
    const priceInput=root([],item('не определено'),item('не определено'),[req('req_price','price_limit',10000000,['fact_price'],price.evidence)]);
    const priceCheck=run([price],priceInput,{rejectReqs:[rejectReq('req_price',10000000,'object_price_as_requirement')]});
    const address=fact('fact_address','location','Интересует квартира по адресу улица Ленина, дом 10','улица Ленина, дом 10');
    const addressCheck=run([address],root([],item('не определено'),item('не определено'),[req('req_address','search_location','улица Ленина, дом 10',['fact_address'],address.evidence)]),{rejectReqs:[rejectReq('req_address','улица Ленина, дом 10','object_address_not_search_location')]});
    const districts=fact('fact_districts','location','Рассматриваю Центральный и Петроградский районы',['Центральный район','Петроградский район']);
    const districtsCheck=run([districts],root([],item('не определено'),item('не определено'),[req('req_districts','search_location',['Центральный район','Петроградский район'],['fact_districts'],districts.evidence)]));
    const objectArea=fact('fact_object_area','object_information','Площадь этой квартиры 54 м²','54 м²');
    const objectAreaCheck=run([objectArea],root([],item('не определено'),item('не определено'),[req('req_object_area','area','54 м²',['fact_object_area'],objectArea.evidence)]),{rejectReqs:[rejectReq('req_object_area','54 м²','object_characteristic_not_requirement')]});
    const minArea=fact('fact_min_area','requirement','Мне нужно не меньше 54 м²','не меньше 54 м²');
    const minAreaInput=root([],item('не определено'),item('не определено'),[req('req_min_area','area','не меньше 54 м²',['fact_min_area'],minArea.evidence)]);
    const minAreaCheck=run([minArea],minAreaInput);
    const objection=fact('fact_objection','client_objection','Мне важно обсудить высокую цену, но я не отказываюсь','Мне важно обсудить высокую цену, но я не отказываюсь');
    const objectionInput=root([],item('не определено'),item('не определено'),[req('req_objection','rejected_option','квартира отклонена',['fact_objection'],objection.evidence)]);
    const objectionReject={id:'req_objection',value:'квартира отклонена',verified:false,reason:'возражение не равно отказу',error_type:'objection_not_rejection',severity:'warning',disputed:false};
    const objectionCheck=run([objection],objectionInput,{rejectReqs:[objectionReject]});
    const budgetMissing=run([general],root(),{missing:[{type:'price_limit',name:'Бюджет клиента',reason:'пропущен бюджет',critical:true}]});
    const spoof=run([cash],root(),{decision:'FAIL'});
    const twoReqInput=root([],item('не определено'),item('не определено'),[req('req_ok','area','не меньше 54 м²',['fact_min_area'],minArea.evidence),req('req_bad','hard_constraint','только тихий двор',['fact_min_area'],minArea.evidence)]);
    const rejectedHard={id:'req_bad',value:'только тихий двор',verified:false,reason:'не подтверждено',error_type:'unsupported_requirement',severity:'warning',disputed:false};
    const partial=run([minArea],twoReqInput,{rejectReqs:[rejectedHard]});
    const changedJudge=run([minArea],minAreaInput,{newReq:{id:'req_missing',value:'новое',verified:true,reason:'создано'}});
    let invalidCalls=0;
    const original=callModelWithTransientRetry;
    callModelWithTransientRetry=async()=>{invalidCalls++;return {text:'{}',tokens:1,actualModel:'test',actualProvider:'test'}};
    const badEnum=root([item('Вторичка',['fact_general'],general.evidence)]);
    const invalidEnum=await runStage(stage,ctxFor([general],badEnum));
    let dependencyCalls=0;
    callModelWithTransientRetry=async()=>{dependencyCalls++;return {text:'{}',tokens:1,actualModel:'test',actualProvider:'test'}};
    const dependency=await runStage(stage,{__transcript:'Клиент: Хочу квартиру',needs:root(),facts:{facts:[]}});
    let downstreamRan=false;
    CODE_FUNCS.needCheckMarker=()=>{downstreamRan=true;return {output:{ran:true},status:'ok',metrics:[],checks:[]}};
    const originalPipeline=pipeline;
    pipeline=[{...stage,id:'need-check-stage',enabled:true},{id:'need-check-marker',enabled:true,type:'code',name:'Маркер downstream',codeFn:'needCheckMarker',outKey:'marker'}];renderStages();document.getElementById('transcript').value='Клиент: Хочу квартиру';await runPipeline();
    const pipelineStop={downstreamRan,marker:ctx.marker,need_check:ctx.need_check};pipeline=originalPipeline;renderStages();delete CODE_FUNCS.needCheckMarker;
    const store=CODE_FUNCS.conversationStore({}, {__transcript:minArea.evidence,validation:{score:1},fact_check:{decision:'PASS',verified_facts:[minArea]},need_check:partial.output,outcome_check:{verified_outcome:{next_step:{value:'перезвонить',confidence:.96,evidence:'перезвоню',verified:true}},outcome_check_quality:{score:1,decision:'PASS'},decision:'PASS'}}).output;
    callModelWithTransientRetry=original;
    return {empty,plotCheck,refusalCheck,viewingCheck,cashCheck,mortgageCheck,futureSaleCheck,soldCheck,priceCheck,addressCheck,districtsCheck,objectAreaCheck,minAreaCheck,objectionCheck,budgetMissing,spoof,partial,changedJudge,invalidCalls,invalidEnum,dependencyCalls,dependency,pipelineStop,store};
  })()`));

  expect(result.empty.output).toMatchObject({ decision: "PASS", verified_attributes: { interest: [], funding_source: { value: "не определено" }, purchase_term: { value: "не определено" } } });
  expect(result.plotCheck.output.rejected_attributes).toEqual([expect.objectContaining({ attribute: "interest", value: "Строительство", error_type: "false_interest" })]);
  expect(result.refusalCheck.output.rejected_attributes).toEqual([expect.objectContaining({ attribute: "funding_source", value: "наличные / депозит" })]);
  expect(result.viewingCheck.output.rejected_attributes).toEqual([expect.objectContaining({ attribute: "purchase_term", value: "2–3 месяца", disputed: true })]);
  expect(result.cashCheck.output.verified_attributes.funding_source.value).toBe("наличные / депозит");
  expect(result.mortgageCheck.output).toMatchObject({ verified_attributes: { interest: [expect.objectContaining({ value: "Ипотека" })], funding_source: { value: "ипотека одобрена" } } });
  expect(result.futureSaleCheck.output.verified_attributes.funding_source.value).toBe("продажа своей квартиры");
  expect(result.soldCheck.output.verified_attributes.funding_source.value).toBe("наличные / депозит");
  expect(result.priceCheck.output.rejected_requirements).toEqual([expect.objectContaining({ id: "req_price", error_type: "object_price_as_requirement" })]);
  expect(result.addressCheck.output.rejected_requirements).toEqual([expect.objectContaining({ id: "req_address", error_type: "object_address_not_search_location" })]);
  expect(result.districtsCheck.output.verified_requirements).toEqual([expect.objectContaining({ type: "search_location", value: ["Центральный район", "Петроградский район"] })]);
  expect(result.objectAreaCheck.output.rejected_requirements).toEqual([expect.objectContaining({ id: "req_object_area", error_type: "object_characteristic_not_requirement" })]);
  expect(result.minAreaCheck.output.verified_requirements).toEqual([expect.objectContaining({ type: "area", value: "не меньше 54 м²" })]);
  expect(result.objectionCheck.output.rejected_requirements).toEqual([expect.objectContaining({ error_type: "objection_not_rejection" })]);
  expect(result.budgetMissing.output).toMatchObject({ decision: "MANUAL_REVIEW", need_check_quality: { critical_needs_missing: 1, critical_recall_score: 0.667 } });
  expect(result.spoof.output).toMatchObject({ decision: "PASS", need_check_quality: { attribute_accuracy_score: 1, requirement_precision_score: 1, critical_recall_score: 1, overall_score: 1, decision: "PASS" } });
  expect(result.partial.output).toMatchObject({ verified_requirements: [expect.objectContaining({ id: "req_ok" })], rejected_requirements: [expect.objectContaining({ id: "req_bad" })] });
  expect(result.changedJudge.output).toMatchObject({ status: "technical_error", error_code: "INVALID_JUDGE_OUTPUT" });
  expect(result.invalidCalls).toBe(0);
  expect(result.invalidEnum.output).toMatchObject({ status: "technical_error", error_code: "SCHEMA_VALIDATION_FAILED", schema_error: 'attributes.interest[0].value: expected canonical enum, received "Вторичка"' });
  expect(result.dependencyCalls).toBe(0);
  expect(result.dependency.output).toMatchObject({ status: "dependency_error", error_code: "DEPENDENCY_ERROR" });
  expect(result.pipelineStop).toMatchObject({ downstreamRan: false, marker: undefined, need_check: { status: "dependency_error", error_code: "DEPENDENCY_ERROR" } });
});

test("подробные контракты настроенных Judge совместимы с внутренним runtime", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const factInput = {
      facts: [{ id: "fact_1", category: "client_finance", name: "budget_max", value: "до пяти с половиной", normalized_value: 5500000, speaker: "Клиент", evidence: "У меня до пяти с половиной.", confidence: 0.99, verification_status: "pending" }],
      quotes: [{ id: "quote_1", text: "У меня до пяти с половиной.", speaker: "Клиент", supports_fact_ids: ["fact_1"], confidence: 0.99, verification_status: "pending" }],
      extraction_meta: { fact_count: 1, quote_count: 1, decision: "EXTRACTED" },
    };
    const factVerdict = validateFactJudgeOutput({
      verified_facts: [{ ...factInput.facts[0], verified: true, source: "fact_check" }], rejected_facts: [],
      verified_quotes: [{ ...factInput.quotes[0], verified: true, source: "fact_check" }], rejected_quotes: [], missing_critical_facts: [],
      fact_check_quality: { facts_checked: 1, facts_verified: 1, facts_rejected: 0, quotes_checked: 1, quotes_verified: 1, quotes_rejected: 0, critical_facts_missing: 0, precision_score: 1, critical_recall_score: 1, overall_score: 1, decision: "PASS" }, criteria: [],
    }, factInput);
    const fact = mergeFactCheck({ criteria: [] }, factVerdict, null, factInput);

    const factCtx = { facts: factInput, fact_check: { status: "ok", decision: "PASS", verified_facts: fact.verified_facts } };
    const needsInput = validateNeedExtractionRoot({
      attributes: {
        interest: [],
        funding_source: { value: "не определено", evidence: [], source_fact_ids: [], confidence: 0.99, verification_status: "pending" },
        purchase_term: { value: "не определено", evidence: [], source_fact_ids: [], confidence: 0.99, verification_status: "pending" },
      },
      requirements: [{ id: "need_1", type: "minimum_land_area", value: "от 6 соток", normalized_value: 6, evidence: "Минимум шесть соток мне надо.", source_fact_ids: ["fact_1"], confidence: 0.99, verification_status: "pending" }],
      need_meta: { interest_count: 0, requirements_count: 1, decision: "EXTRACTED" },
    }, factCtx, false);
    const needVerdict = validateNeedJudgeOutput({
      verified_attributes: {
        interest: [],
        funding_source: { ...needsInput.attributes.funding_source, verified: true, source: "need_check" },
        purchase_term: { ...needsInput.attributes.purchase_term, verified: true, source: "need_check" },
      }, rejected_attributes: [],
      verified_requirements: [{ ...needsInput.requirements[0], verified: true, source: "need_check" }], rejected_requirements: [], missing_critical_needs: [],
      need_check_quality: { attributes_checked: 2, attributes_verified: 2, attributes_rejected: 0, requirements_checked: 1, requirements_verified: 1, requirements_rejected: 0, critical_needs_missing: 0, attribute_accuracy_score: 1, requirement_precision_score: 1, critical_recall_score: 1, overall_score: 1, decision: "PASS" }, criteria: [],
    }, needsInput);
    const needs = mergeNeedCheckV2({ criteria: [] }, needVerdict, null, needsInput);

    const outcomeInput = validateOutcomeExtractionRoot({
      call_results: [{ value: "агент отправит материалы", evidence: "Агент: отправлю видео в MAX.", confidence: 0.99, verification_status: "pending" }],
      agreements: [{ id: "agreement_1", action: "отправить видео", owner: "агент", recipient: "клиент", deadline: "", channel: "MAX", status: "confirmed", evidence: "Агент: отправлю видео в MAX.", confidence: 0.99, verification_status: "pending" }],
      primary_next_step: { action: "отправить видео", owner: "агент", deadline: "", channel: "MAX", status: "confirmed", agreement_ids: ["agreement_1"], confidence: 0.99, verification_status: "pending" },
      outcome_meta: { result_count: 1, agreement_count: 1, decision: "EXTRACTED" },
    }, { __transcript: "Агент: отправлю видео в MAX." }, false);
    const outcomeVerdict = validateOutcomeJudgeOutput({
      verified_call_results: [{ value: "агент отправит материалы", evidence: "Агент: отправлю видео в MAX.", confidence: 0.99, verified: true, source: "outcome_check" }], rejected_call_results: [],
      verified_agreements: [{ id: "agreement_1", action: "отправить видео", owner: "агент", recipient: "клиент", deadline: "", channel: "MAX", status: "confirmed", evidence: "Агент: отправлю видео в MAX.", confidence: 0.99, verified: true, source: "outcome_check" }], rejected_agreements: [],
      verified_primary_next_step: { action: "отправить видео", owner: "агент", deadline: "", channel: "MAX", status: "confirmed", agreement_ids: ["agreement_1"], confidence: 0.99, verified: true, source: "outcome_check" }, rejected_primary_next_step: null, missing_critical_outcomes: [],
      outcome_check_quality: { results_checked: 1, results_verified: 1, results_rejected: 0, agreements_checked: 1, agreements_verified: 1, agreements_rejected: 0, primary_next_step_verified: true, critical_outcomes_missing: 0, result_accuracy_score: 1, agreement_precision_score: 1, next_step_accuracy_score: 1, critical_recall_score: 1, overall_score: 1, decision: "PASS" }, criteria: [],
    }, outcomeInput);
    const outcomeCtx = { __transcript: "Агент: отправлю видео в MAX.", fact_check: { status: "ok", decision: "PASS" }, need_check: { status: "ok", decision: "PASS" } };
    const outcome = mergeOutcomeCheck({ criteria: [] }, outcomeVerdict, null, outcomeInput, outcomeCtx);
    return { fact, needs, outcome, resultId: outcomeInput.call_results[0].id, normalizedValue: needsInput.requirements[0].normalized_value };
  });

  expect(result.fact).toMatchObject({ decision: "PASS", fact_check_quality: { quote_score: 1 } });
  expect(result.needs).toMatchObject({ decision: "PASS", verified_requirements: [expect.objectContaining({ id: "need_1", normalized_value: 6 })] });
  expect(result.outcome).toMatchObject({ decision: "PASS", verified_primary_next_step: { verified: true } });
  expect(result.resultId).toBe("result_1");
  expect(result.normalizedValue).toBe(6);
});

test("verdict-only Judge применяет corrections кодом и не превращает semantic rejection в technical error", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(async () => {
    const factInput = {
      facts: [
        { id: "fact_1", category: "client_preference", name: "локация", value: "Мистолово", normalized_value: "Мистолово", speaker: "Клиент", evidence: "Посмотрите Мистолово", confidence: 0.96, verification_status: "pending" },
        { id: "fact_2", category: "client_preference", name: "ипотека", value: "ипотека одобрена", normalized_value: "ипотека одобрена", speaker: "Клиент", evidence: "Ипотека мне не нужна", confidence: 0.75, verification_status: "pending" },
      ], quotes: [], extraction_meta: { fact_count: 2, quote_count: 0, decision: "EXTRACTED" },
    };
    const factVerdict = validateFactJudgeOutput({
      items: [
        { id: "fact_1", verdict: "needs_correction", reason: "Уточнена категория", confidence: 0.97, corrections: { category: "search_criteria" } },
        { id: "fact_2", verdict: "rejected", reason: "Отказ от ипотеки не означает одобрение", confidence: 0.99, corrections: {} },
      ], overall_confidence: 0.98, warnings: [],
    }, factInput);
    const fact = mergeFactCheck({ criteria: [] }, factVerdict, null, factInput, { __transcript: "Клиент: Посмотрите Мистолово. Ипотека мне не нужна." });
    const invalidEvidence = (() => { try { validateFactJudgeOutput({ items: [
      { id: "fact_1", verdict: "needs_correction", reason: "Подмена", confidence: 0.9, corrections: { evidence: "другой текст" } },
      { id: "fact_2", verdict: "rejected", reason: "Нет подтверждения", confidence: 0.9, corrections: {} },
    ], overall_confidence: 0.9, warnings: [] }, factInput); return ""; } catch (error) { return error.message; } })();
    const unknownId = (() => { try { validateFactJudgeOutput({ items: [
      { id: "unknown", verdict: "verified", reason: "ok", confidence: 0.9, corrections: {} },
      { id: "fact_2", verdict: "rejected", reason: "нет", confidence: 0.9, corrections: {} },
    ], overall_confidence: 0.9, warnings: [] }, factInput); return ""; } catch (error) { return error.message; } })();
    const missingId = (() => { try { validateFactJudgeOutput({ items: [
      { id: "fact_1", verdict: "verified", reason: "ok", confidence: 0.9, corrections: {} },
    ], overall_confidence: 0.9, warnings: [] }, factInput); return ""; } catch (error) { return error.message; } })();

    const transcript = "Агент: Я сейчас отправлю вам видео и затем направлю подборку в MAX.";
    const outcomeInput = validateOutcomeExtractionRoot({
      call_results: [{ id: "result_1", value: "агент отправит материалы", evidence: "Я сейчас отправлю вам видео", confidence: 0.95, verification_status: "pending" }],
      agreements: [{ id: "agreement_1", action: "отправить видео и направить подборку", owner: "агент", recipient: "клиент", deadline: "", channel: "MAX", status: "promised", evidence: "Агент: Я сейчас отправлю вам видео и затем направлю подборку в MAX.", confidence: 0.95, verification_status: "pending" }],
      primary_next_step: { action: "отправить видео и направить подборку", owner: "агент", deadline: "", channel: "MAX", status: "promised", agreement_ids: ["agreement_1"], confidence: 0.95, verification_status: "pending" },
      outcome_meta: { result_count: 1, agreement_count: 1, decision: "EXTRACTED" },
    }, { __transcript: transcript }, false);
    const outcomeVerdict = validateOutcomeJudgeOutput({ items: [
      { id: "result_1", verdict: "verified", reason: "Результат подтверждён", confidence: 0.98, corrections: {} },
      { id: "agreement_1", verdict: "needs_correction", reason: "Сейчас означает после звонка", confidence: 0.99, corrections: { deadline: "после звонка" } },
      { id: "primary_next_step", verdict: "needs_correction", reason: "Срок основного шага нормализован", confidence: 0.99, corrections: { deadline: "после звонка" } },
    ], overall_confidence: 0.99, warnings: [] }, outcomeInput);
    const outcome = mergeOutcomeCheck({ criteria: [] }, outcomeVerdict, null, outcomeInput, { __transcript: transcript, fact_check: { status: "ok", decision: "PASS" }, need_check: { status: "ok", decision: "PASS" } });
    const store = {
      conversation: {
        facts: fact.verified_facts,
        quotes: [],
        attributes: { interest: [], funding_source: { value: "не определено" }, purchase_term: { value: "не определено" } },
        requirements: [],
        call_results: outcome.verified_call_results,
        agreements: outcome.verified_agreements,
        primary_next_step: outcome.verified_primary_next_step,
      },
      quality: { decision: "READY", overall_confidence: 0.98 },
      store_meta: { status: "READY", conversation_store_hash: "verdict_only_acceptance" },
    };
    const summaryStage = defaultPipeline().find((item) => item.outKey === "summary");
    const originalCall = callModelWithTransientRetry;
    callModelWithTransientRetry = async () => ({
      text: JSON.stringify({ status: "GENERATED", conversation_result: "Клиент рассматривает Мистолово.", key_facts: [{ label: "Локация", value: "Мистолово" }], quotes: [], next_step: "Агент отправит видео и направит подборку после звонка в MAX.", error: "" }),
      tokens: 20,
      actualModel: "gpt-5-mini",
      actualProvider: "ai-tunnel",
      finishReason: null,
    });
    const summary = await runStage(summaryStage, { conversation_store: store, __transcript: transcript });
    callModelWithTransientRetry = originalCall;
    const pass = { score: 100, status: "pass", decision: "PASS", explanation: "Проверка пройдена" };
    const presentation = CODE_FUNCS.presentationCheck({}, { summary: summary.output }).output;
    const gate = CODE_FUNCS.summaryQualityGate({}, {
      conversation_store: store,
      summary: summary.output,
      truth_check: { ...pass, critical_errors: [] },
      critical_facts_check: { ...pass, missed_critical_facts: [] },
      context_utility_check: { ...pass, missing_for_next_agent: [], can_continue_without_recording: true },
      action_check: { ...pass, action_errors: [], is_result_reflected: true, is_agreement_reflected: true, is_next_step_reflected: true },
      presentation_check: presentation,
    }).output;
    return { fact, invalidEvidence, unknownId, missingId, outcome, summary, gate };
  });

  expect(result.fact).toMatchObject({ status: "warn", decision: "REVIEW_REQUIRED", confidence: 0.98, reconciliation: { verified_count: 0, corrected_count: 1, rejected_count: 1 } });
  expect(result.fact.score).toBeLessThan(100);
  expect(result.fact.verified_facts[0]).toMatchObject({ category: "search_criteria", evidence: "Посмотрите Мистолово", verification_status: "corrected", applied_corrections: { category: { from: "client_preference", to: "search_criteria" } } });
  expect(result.invalidEvidence).toContain("invalid correction");
  expect(result.unknownId).toContain("unknown_id");
  expect(result.missingId).toContain("missing_id");
  expect(result.outcome).toMatchObject({ decision: "PASS_WITH_CORRECTIONS", confidence: 0.99, verified_agreements: [expect.objectContaining({ deadline: "после звонка", evidence: expect.stringContaining("сейчас"), verification_status: "corrected" })], verified_primary_next_step: { deadline: "после звонка", verification_status: "corrected" }, reconciliation: { corrected_count: 2, rejected_count: 0 } });
  expect(result.summary.output).toMatchObject({ status: "GENERATED", next_step: expect.stringContaining("после звонка") });
  expect(result.gate.decision).toMatch(/AUTO_SAVE|SAVE_WITH_WARNING/);
});

test("Need Judge не может заменить канонический interest произвольным CRM-значением", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const interest = { value: "Новостройки", confidence: 0.95, evidence: "Клиент: Звоню по апартаментам в ЖК.", source_fact_ids: ["fact_1"], verification_status: "pending" };
    const empty = { value: "не определено", confidence: 0.95, evidence: "", source_fact_ids: [], verification_status: "pending" };
    const input = { attributes: { interest: [interest], funding_source: empty, purchase_term: empty }, requirements: [], need_meta: { interest_count: 1, requirements_count: 0, decision: "EXTRACTED" } };
    const baseItems = [
      { id: "funding_source", verdict: "verified", reason: "Не определено корректно", confidence: 0.95, corrections: {} },
      { id: "purchase_term", verdict: "verified", reason: "Не определено корректно", confidence: 0.95, corrections: {} },
    ];
    const invalid = { items: [
      { id: "interest:0", verdict: "needs_correction", reason: "Заменить на свободный текст", confidence: 0.95, corrections: { value: "консультация по апартаментам", category: "client_intent" } },
      ...baseItems,
    ], overall_confidence: 0.95, warnings: [] };
    const rejected = { items: [
      { id: "interest:0", verdict: "rejected", reason: "Категория Новостройки не подтверждена", confidence: 0.95, corrections: {} },
      ...baseItems,
    ], overall_confidence: 0.95, warnings: [] };
    let invalidError = "";
    try { validateNeedJudgeOutput(invalid, input); } catch (error) { invalidError = error.message; }
    const parsed = validateNeedJudgeOutput(rejected, input);
    const merged = mergeNeedCheckV2({ criteria: [] }, parsed, null, input, { __transcript: "Клиент: Звоню по апартаментам в ЖК." });
    const schemaProperties = Object.keys(NEED_VERDICT_ONLY_JSON_SCHEMA.properties.items.items.properties.corrections.properties);
    return { invalidError, merged, schemaProperties, prompt: defaultPipeline().find(stage => stage.outKey === "need_check") };
  });

  expect(result.invalidError).toContain("corrections.value: invalid correction");
  expect(result.merged).toMatchObject({ decision: "REVIEW_REQUIRED", verified_attributes: { interest: [] }, rejected_attributes: [expect.objectContaining({ value: "Новостройки", verification_status: "rejected" })] });
  expect(result.schemaProperties.sort()).toEqual(["confidence", "source_fact_ids", "source_turn_ids"]);
  expect(result.prompt).toMatchObject({ promptVersion: 8 });
  expect(result.prompt.prompt).toContain('value, normalized_value, category, id и evidence исправлять запрещено');
});

test("production report 2026-07-23 сохраняет подтверждённый follow-up без ложных warning", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const transcript = [
      "Клиент: Я звоню по поводу апартаментов. Можете меня проконсультировать?",
      "Клиент: Хотел бы узнать по управляющей компании в доме.",
      "Клиент: Если удобно, можете написать мне в WhatsApp.",
      "Агент: Сегодня уточню всю информацию и либо сегодня, либо завтра свяжусь с вами.",
    ].join("\n");
    const validation = evaluateTranscriptValidation({ __transcript: transcript });
    const intent = { id: "fact_1", category: "client_intent", name: "цель обращения", value: "консультация по апартаментам", normalized_value: "консультация по апартаментам", speaker: "Клиент", evidence: "Я звоню по поводу апартаментов. Можете меня проконсультировать?", confidence: 0.95, verification_status: "pending" };
    const constraint = { id: "fact_2", category: "client_constraint", name: "готовность к просмотру", value: "пока не готов ехать", normalized_value: "временно не готов ехать", speaker: "Клиент", evidence: "Пока не готов ехать на просмотр.", confidence: 0.95, verification_status: "verified", verified: true };
    const empty = { value: "не определено", confidence: 0.95, evidence: "", source_fact_ids: [], verification_status: "pending" };
    const needs = normalizeNeedExtractionSemantics({ attributes: { interest: [], funding_source: empty, purchase_term: empty }, requirements: [], need_meta: { interest_count: 0, requirements_count: 0, decision: "NO_NEEDS" } }, { fact_check: { verified_facts: [constraint] } });
    const warnings = relevantNeedJudgeWarnings(["search_location"], { fact_check: { verified_facts: [{ category: "search_location", name: "адрес объекта", value: "проспект Андропова, 10", evidence: "Адрес объекта: проспект Андропова, 10.", verified: true }] } });
    const agreement = { id: "agreement_1", action: "уточнить информацию и связаться с клиентом", owner: "агент", recipient: "клиент", deadline: "сегодня или завтра", channel: "WhatsApp", status: "confirmed", evidence: "Сегодня уточню всю информацию и либо сегодня, либо завтра свяжусь с вами.", confidence: 0.9, verification_status: "pending" };
    const outcomeInput = { call_results: [{ id: "result_1", value: "агент уточнит информацию", evidence: agreement.evidence, confidence: 0.9, verification_status: "pending" }], agreements: [agreement], primary_next_step: { action: agreement.action, owner: "агент", deadline: "сегодня или завтра", channel: "WhatsApp", status: "confirmed", agreement_ids: ["agreement_1"], confidence: 0.9, verification_status: "pending" }, outcome_meta: { result_count: 1, agreement_count: 1, decision: "EXTRACTED" } };
    const guards = outcomeSemanticGuards(outcomeInput, { __transcript: transcript, fact_check: { verified_facts: [{ category: "communication_channel", value: "WhatsApp", normalized_value: "WhatsApp", evidence: "Если удобно, можете написать мне в WhatsApp.", verified: true, verification_status: "verified" }] } });
    const store = { conversation: { facts: [
      { id: "fact_address", category: "search_location", name: "адрес объекта", evidence: "Адрес объекта: проспект Андропова, 10." },
      { id: "fact_question", category: "client_question", name: "вопрос об управляющей компании", evidence: "Хотел бы узнать по управляющей компании в доме." },
    ], quotes: [
      { text: "Адрес объекта: проспект Андропова, 10.", speaker: "Клиент", supports_fact_ids: ["fact_address"] },
      { text: "Хотел бы узнать по управляющей компании в доме.", speaker: "Клиент", supports_fact_ids: ["fact_question"] },
    ], requirements: [], attributes: {}, agreements: [agreement], primary_next_step: { ...outcomeInput.primary_next_step, verification_status: "verified" } } };
    const summary = moduleSummaryApplyStorePolicy({ status: "GENERATED", conversation_result: "Клиенту важно узнать размер эксплуатационных и коммунальных платежей, распределение расходов, а также информацию по парковке.", key_facts: [{ label: "Адрес объекта", value: "проспект Андропова, 10" }], quotes: ["Адрес объекта: проспект Андропова, 10."], next_step: "Следующий шаг не согласован.", error: "" }, store, transcript).value;
    const needStage = { type: "llm", outKey: "needs" };
    return {
      validation: { decision: validation.decision, confidence: validation.confidence },
      intentRejection: factCodeSemanticRejection(intent, new Set()),
      requirements: needs.requirements,
      warnings,
      outcomeIssues: { agreements: guards.agreementIssues.size, primary: guards.primaryIssue },
      summary,
      needScore: stageScoreFromOutput(needStage, { output: needs, status: "ok" }),
    };
  });

  expect(result.validation).toEqual({ decision: "PASS", confidence: 0.955 });
  expect(result.intentRejection).toBeNull();
  expect(result.requirements).toEqual([]);
  expect(result.warnings).toEqual([]);
  expect(result.outcomeIssues).toEqual({ agreements: 0, primary: null });
  expect(result.summary.next_step).toBe("Агент: уточнить информацию и связаться с клиентом; срок — сегодня или завтра; канал — WhatsApp.");
  expect(result.summary.conversation_result).toContain(". Распределение расходов.");
  expect(result.summary.quotes).toEqual(["Хотел бы узнать по управляющей компании в доме."]);
  expect(result.needScore).toBeNull();
});

test("Summary Agent не получает карточку объекта и UI отклоняет системный промт вместо транскрибации", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const transcript = [
      "Агент: Объект находится по адресу проспект Андропова, 10, цена 5 500 000 рублей.",
      "Клиент: Хотел бы узнать по управляющей компании в доме.",
      "Агент: Сегодня уточню информацию и свяжусь с вами.",
    ].join("\n");
    const agreement = { id: "agreement_1", action: "уточнить информацию и связаться с клиентом", owner: "агент", recipient: "клиент", deadline: "сегодня", channel: "", status: "confirmed", evidence: "Сегодня уточню информацию и свяжусь с вами." };
    const store = {
      conversation: {
        facts: [
          { id: "fact_address", category: "search_location", name: "адрес объекта", value: "проспект Андропова, 10", evidence: "Объект находится по адресу проспект Андропова, 10." },
          { id: "fact_price", category: "object_information", name: "цена объекта", value: "5 500 000 рублей", evidence: "Цена 5 500 000 рублей." },
          { id: "fact_question", category: "client_question", name: "вопрос об управляющей компании", value: "управляющая компания", evidence: "Хотел бы узнать по управляющей компании в доме." },
        ],
        quotes: [
          { text: "Объект находится по адресу проспект Андропова, 10.", speaker: "Агент", supports_fact_ids: ["fact_address"] },
          { text: "Цена 5 500 000 рублей.", speaker: "Агент", supports_fact_ids: ["fact_price"] },
          { text: "Хотел бы узнать по управляющей компании в доме.", speaker: "Клиент", supports_fact_ids: ["fact_question"] },
        ],
        attributes: {},
        requirements: [],
        call_results: [],
        agreements: [agreement],
        primary_next_step: { ...agreement, agreement_ids: ["agreement_1"] },
      },
      quality: { decision: "PASS" },
      store_meta: { status: "READY" },
    };
    const audit = moduleSummaryPrompt({ prompt: "Сформируй summary." }, { conversation_store: store, __transcript: transcript });
    return {
      promptLike: looksLikePipelinePrompt("Ты — Summary Agent. Используй Conversation Store. Верни строго JSON с primary_next_step и verification_status."),
      dialogueLike: looksLikePipelinePrompt(transcript),
      safeFactIds: audit.safeStore.conversation.facts.map(fact => fact.id),
      safeQuotes: audit.safeStore.conversation.quotes.map(quote => quote.text),
      containsAddress: audit.prompt.includes("проспект Андропова"),
      containsPrice: audit.prompt.includes("5 500 000"),
      containsFullTranscript: audit.prompt.includes(transcript),
      promptAudit: { transcriptInjected: audit.transcriptInjected, omitted: audit.cardMetadataOmitted, quoteCount: audit.verifiedQuoteCount },
      badge: badgeText("not_run"),
    };
  });

  expect(result.promptLike).toBe(true);
  expect(result.dialogueLike).toBe(false);
  expect(result.safeFactIds).toEqual(["fact_question"]);
  expect(result.safeQuotes).toEqual(["Хотел бы узнать по управляющей компании в доме."]);
  expect(result.containsAddress).toBe(false);
  expect(result.containsPrice).toBe(false);
  expect(result.containsFullTranscript).toBe(false);
  expect(result.promptAudit).toEqual({ transcriptInjected: false, omitted: 2, quoteCount: 1 });
  expect(result.badge).toBe("Не запущен");
});

test("verdict-only Outcome reconciliation не переопределяет Judge семантическими guards", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const transcript = "Агент: Я отправлю видео в MAX и проверю дополнительные варианты. Клиент: Да, давайте в MAX лучше.";
    const input = validateOutcomeExtractionRoot({
      call_results: [
        { id: "result_1", value: "агент отправит материалы", evidence: "Агент: Я отправлю видео в MAX.", confidence: 0.98, verification_status: "pending" },
        { id: "result_2", value: "агент подготовит подборку", evidence: "Агент: Я проверю дополнительные варианты.", confidence: 0.98, verification_status: "pending" },
      ],
      agreements: [
        { id: "agreement_1", action: "отправить видео", owner: "агент", recipient: "клиент", deadline: "после звонка", channel: "MAX", status: "promised", evidence: "Агент: Я отправлю видео в MAX.", confidence: 0.98, verification_status: "pending" },
        { id: "agreement_2", action: "проверить дополнительные варианты", owner: "агент", recipient: "none", deadline: "после звонка", channel: "", status: "promised", evidence: "Агент: Я проверю дополнительные варианты.", confidence: 0.98, verification_status: "pending" },
      ],
      primary_next_step: { action: "отправить видео и проверить дополнительные варианты", owner: "агент", deadline: "после звонка", channel: "MAX", status: "promised", agreement_ids: ["agreement_1", "agreement_2"], confidence: 0.98, verification_status: "pending" },
      outcome_meta: { result_count: 2, agreement_count: 2, decision: "EXTRACTED" },
    }, { __transcript: transcript }, false);
    const verdict = validateOutcomeJudgeOutput({
      items: [
        { id: "result_1", verdict: "verified", reason: "Подтверждено", confidence: 0.99, corrections: {} },
        { id: "result_2", verdict: "verified", reason: "Подтверждено", confidence: 0.99, corrections: {} },
        { id: "agreement_1", verdict: "verified", reason: "MAX выбран клиентом", confidence: 0.99, corrections: {} },
        { id: "agreement_2", verdict: "verified", reason: "Внутреннее действие без получателя", confidence: 0.99, corrections: {} },
        { id: "primary_next_step", verdict: "verified", reason: "Основной шаг подтверждён", confidence: 0.99, corrections: {} },
      ],
      overall_confidence: 0.99,
      warnings: [],
    }, input);
    const merged = mergeOutcomeCheck({ criteria: [] }, verdict, null, input, {
      __transcript: transcript,
      fact_check: { status: "ok", decision: "PASS", verified_facts: [] },
      need_check: { status: "ok", decision: "PASS" },
    });
    let combinedChannelError = "";
    try {
      validateOutcomeJudgeOutput({
        items: verdict.items.map((item) => item.id === "agreement_1"
          ? { ...item, verdict: "needs_correction", corrections: { channel: "MAX (Telegram)" } }
          : item),
        overall_confidence: 0.99,
        warnings: [],
      }, input);
    } catch (error) {
      combinedChannelError = String(error.message);
    }
    return { merged, combinedChannelError };
  });

  expect(result.merged).toMatchObject({
    decision: "PASS",
    verified_agreements: [
      expect.objectContaining({ id: "agreement_1", channel: "MAX" }),
      expect.objectContaining({ id: "agreement_2", recipient: "none" }),
    ],
    rejected_agreements: [],
    reconciliation: { input_items_count: 5, verified_count: 5, corrected_count: 0, rejected_count: 0 },
  });
  expect(result.combinedChannelError).toContain("combined channel values are forbidden");
});

test("Conversation Store восстанавливает критические requirements, вопросы, steps и structured issues", async ({ page }) => {
  await page.goto(moduleUrl);
  const result = await page.evaluate(() => {
    const verified = (item, source) => ({ ...item, confidence: 0.98, verification_status: "verified", verified: true, source });
    const facts = [
      verified({ id: "fact_area", category: "client_constraint", name: "минимальная площадь", value: "минимум 6 соток", normalized_value: 6, speaker: "Клиент", evidence: "Минимум шесть соток мне надо." }, "fact_check"),
      verified({ id: "fact_budget", category: "client_finance", name: "бюджет", value: "до 5 500 000", normalized_value: 5500000, speaker: "Клиент", evidence: "У меня цена до пяти с половиной." }, "fact_check"),
      verified({ id: "fact_locations", category: "search_location", name: "районы поиска", value: ["Мистолово", "Капитолова", "Лаврики"], normalized_value: ["Мистолово", "Капитолова", "Лаврики"], speaker: "Клиент", evidence: "Мистолово, Капитолова, Лаврики." }, "fact_check"),
      verified({ id: "fact_question", category: "client_question", name: "кто продаёт", value: "Кто продаёт?", speaker: "Клиент", evidence: "Кто продаёт?" }, "fact_check"),
    ];
    const agreement = (id, action, recipient, channel = "") => verified({ id, action, owner: "агент", recipient, deadline: "после звонка", channel, status: "promised", evidence: "Агент: " + action, }, "outcome_check");
    const agreements = [agreement("agreement_video", "отправить видео", "клиент", "MAX"), agreement("agreement_check", "проверить дополнительные варианты", "none")];
    const ctx = {
      __run_id: "run_regression",
      __transcript_hash: "bf1eeff3",
      __pipeline_configuration_hash: "5a24b0b5",
      __transcript: "Клиент: Кто продаёт?\nАгент: Продаёт физическое лицо.\nКлиент: Спасибо.",
      fact_check: { status: "ok", decision: "PASS", verified_facts: facts, verified_quotes: [], fact_check_quality: { overall_score: 1, decision: "PASS" } },
      need_check: { status: "ok", decision: "PASS", verified_attributes: { interest: [], funding_source: verified({ value: "не определено", evidence: "", source_fact_ids: [] }, "need_check"), purchase_term: verified({ value: "не определено", evidence: "", source_fact_ids: [] }, "need_check") }, verified_requirements: [], missing_critical_needs: [{ id: "missing_budget", name: "price_limit", reason: "Пропущен ценовой предел клиента", severity: "critical", critical: true }], need_check_quality: { overall_score: 1, decision: "PASS" } },
      outcome_check: {
        status: "ok", decision: "PASS",
        verified_call_results: [verified({ id: "result_1", value: "агент отправит материалы", evidence: "Агент: отправить видео" }, "outcome_check")],
        verified_agreements: agreements,
        verified_primary_next_step: verified({ action: "отправить видео и проверить дополнительные варианты", owner: "агент", deadline: "после звонка", channel: "MAX", status: "promised", agreement_ids: agreements.map((item) => item.id) }, "outcome_check"),
        missing_critical_outcomes: [],
        outcome_check_quality: { overall_score: 1, decision: "PASS" },
      },
      __stage_provenance: {},
    };
    ["fact_check", "need_check", "outcome_check"].forEach((key, index) => {
      ctx.__stage_provenance[key] = { run_id: ctx.__run_id, transcript_hash: ctx.__transcript_hash, pipeline_configuration_hash: ctx.__pipeline_configuration_hash, stage_execution_id: ctx.__run_id + ":0" + (index + 1) + ":stage" };
    });
    const ready = buildConversationStoreV1(ctx);
    const broken = JSON.parse(JSON.stringify(ctx));
    broken.outcome_check.verified_primary_next_step = verified({ action: "", owner: "", deadline: "", channel: "", status: "not_defined", agreement_ids: [] }, "outcome_check");
    const critical = buildConversationStoreV1(broken);
    return { ready, critical, snapshotA: buildPipelineSemanticSnapshot({ ...ctx, summary: { status: "GENERATED", conversation_result: "Итог", key_facts: [], quotes: [], next_step: "Шаг", error: "" }, __run_id: "one" }), snapshotB: buildPipelineSemanticSnapshot({ ...ctx, summary: { status: "GENERATED", conversation_result: "Итог", key_facts: [], quotes: [], next_step: "Шаг", error: "" }, __run_id: "two" }) };
  });

  expect(result.ready.conversation.requirements).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "minimum_land_area", normalized_value: 6, source_fact_ids: ["fact_area"] }),
    expect.objectContaining({ type: "price_limit", normalized_value: 5500000, source_fact_ids: ["fact_budget"] }),
    expect.objectContaining({ type: "search_location", normalized_value: ["Мистолово", "Капитолово", "Лаврики"], source_fact_ids: ["fact_locations"] }),
  ]));
  expect(result.ready.conversation.facts.find((item) => item.id === "fact_question")?.question_status).toBe("answered");
  expect(result.ready.conversation.primary_next_step.steps).toEqual([
    { order: 1, action: "отправить видео", agreement_id: "agreement_video" },
    { order: 2, action: "проверить дополнительные варианты", agreement_id: "agreement_check" },
  ]);
  expect(result.ready.store_issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "RECOVERED_CRITICAL_REQUIREMENT", severity: "info" })]));
  expect(result.ready.store_issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "MISSING_CRITICAL_NEED_RESOLVED", status: "resolved", severity: "info", blocks_publish: false })]));
  expect(result.ready.quality.decision).toBe("READY");
  expect(result.critical.quality.decision).toBe("MANUAL_REVIEW");
  expect(result.critical.store_issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "PRIMARY_NEXT_STEP_MISSING", severity: "critical" })]));
  expect(result.snapshotA.semantic_hash).toBe(result.snapshotB.semantic_hash);
});
