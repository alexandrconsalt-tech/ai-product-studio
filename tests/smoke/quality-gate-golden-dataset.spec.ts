import { expect, test } from "@playwright/test";

/**
 * Golden dataset for Summary Quality Gate calibration (2026-07-21).
 *
 * CLAUDE.md §26 notes no golden dataset exists yet in this repository.
 * This file is the first one: 8 hand-labeled, representative cases spanning
 * the quality spectrum a real gpt-5-mini judge panel produces, each with an
 * expected decision and a one-line rationale for why. It exists to make the
 * Quality Gate's AUTO_SAVE/SAVE_WITH_WARNING/REVIEW_REQUIRED thresholds a
 * checked, reproducible calibration instead of a a tuned-by-feel constant --
 * any future threshold change should update this file's expectations
 * deliberately, not accidentally break it.
 *
 * Methodology: since no live API key is available in this environment, each
 * case supplies a realistic *judge-output* fixture (the shape a real Truth/
 * Critical-Facts/Utility/Action/Presentation judge would return for the
 * described scenario) rather than a live transcript -- this exercises the
 * same moduleSummaryQualityGateV1() that a real run's 5 judges feed into,
 * without depending on a network call. See CLAUDE.md's 2026-07-21 addendum
 * for the calibration rationale (why AUTO_SAVE was relaxed the way it was).
 */

const moduleUrl = "/pipeline-lab-v3.html?projectId=project_transcription_summary_module&productName=" +
  encodeURIComponent("Модуль транскрибации и AI-саммари звонков");

const goldenFixture = `
  const qgKeys=['truth_check','critical_completeness_check','agent_utility_check','action_check','presentation_check'];
  function qgContext(){
    const run='golden-run',transcript='golden-transcript',pipelineHash='golden-pipeline',storeHash='golden-store';
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
  function qgWarning(ctx,key,score,message){
    const value=ctx[key];value.status='warning';value.score=score;
    if(key==='truth_check'||key==='critical_completeness_check') value.warnings=[{type:'minor_warning',message:message||'Некритичное предупреждение.'}];
    else if(key==='agent_utility_check') value.problems=[{type:'unclear_wording',problem:message||'Некритичная неясность.'}];
    else value.warnings=[{type:'minor_warning',problem:message||'Некритичное предупреждение.'}];
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

type GoldenCase = { name: string; build: string; expectedDecision: string; rationale: string };

const GOLDEN_CASES: GoldenCase[] = [
  {
    name: "clean_full_call",
    rationale: "Все 5 судей чисты, без единого warning — образцовый случай.",
    build: `qgContext()`,
    expectedDecision: "AUTO_SAVE",
  },
  {
    name: "one_minor_style_nit_from_non_truth_judge",
    rationale: "Один мелкий стилистический warning у Presentation (не Truth), остальное чисто — калиброванная цель: такое больше не должно требовать ручной проверки.",
    build: `(() => { const ctx=qgContext(); qgWarning(ctx,'presentation_check',93,'Чуть длиннее обычного, но в пределах лимита.'); return ctx; })()`,
    expectedDecision: "AUTO_SAVE",
  },
  {
    name: "two_minor_nits_from_different_non_truth_judges",
    rationale: "Два независимых мелких warning (Critical Facts + Presentation) превышают допуск в 1 warning — решение остаётся на усмотрение человека с флагом, не блокируется полностью.",
    build: `(() => { const ctx=qgContext(); qgWarning(ctx,'critical_completeness_check',90,'Не критичная деталь.'); qgWarning(ctx,'presentation_check',92,'Мелкая придирка к формулировке.'); return ctx; })()`,
    expectedDecision: "SAVE_WITH_WARNING",
  },
  {
    name: "presentation_warning_exactly_at_required_floor_90",
    rationale: "Presentation в статусе warning ровно на обязательной границе 90 — единственный некритичный warning, остальные критерии и общий score проходят пороги.",
    build: `(() => { const ctx=qgContext(); qgWarning(ctx,'presentation_check',90,'Мелкая придирка ровно на границе допуска.'); return ctx; })()`,
    expectedDecision: "AUTO_SAVE",
  },
  {
    name: "presentation_warning_just_below_required_floor_89",
    rationale: "Тот же единственный warning, но на 1 балл ниже обязательной границы (89<90) — AUTO_SAVE запрещён, результат остаётся SAVE_WITH_WARNING.",
    build: `(() => { const ctx=qgContext(); qgWarning(ctx,'presentation_check',89,'Мелкая придирка чуть ниже границы допуска.'); return ctx; })()`,
    expectedDecision: "SAVE_WITH_WARNING",
  },
  {
    name: "truth_check_has_any_warning",
    rationale: "Truth сохраняет нулевую терпимость к warnings даже при высоком score — искажение фактов/денег/ролей это единственный критерий с прямым бизнес-риском.",
    build: `(() => { const ctx=qgContext(); qgWarning(ctx,'truth_check',95,'Спорная нормализация числа.'); return ctx; })()`,
    expectedDecision: "SAVE_WITH_WARNING",
  },
  {
    name: "truth_check_hallucination_hard_stop",
    rationale: "Галлюцинация — hard stop независимо от общего score.",
    build: `(() => { const ctx=qgContext(); qgKeys.forEach(key=>{ ctx[key].score=99; }); ctx.truth_check.status='fail'; ctx.truth_check.has_hallucinations=true; ctx.truth_check.critical_errors=[{type:'hallucination',field:'conversation_result',problem:'Выдуманный факт.'}]; return ctx; })()`,
    expectedDecision: "REVIEW_REQUIRED",
  },
  {
    name: "conversation_store_manual_review",
    rationale: "Store сам просит ручную проверку — судьи не могут это компенсировать высоким score.",
    build: `(() => { const ctx=qgContext(); ctx.conversation_store.store_meta.status='MANUAL_REVIEW'; return ctx; })()`,
    expectedDecision: "REVIEW_REQUIRED",
  },
  {
    name: "weak_call_low_action_score",
    rationale: "Action Check проваливается (score 65 < review_min_criterion 80) — независимо от остальных судей уходит в ручную проверку.",
    build: `(() => { const ctx=qgContext(); qgFail(ctx,'action_check',65); return ctx; })()`,
    expectedDecision: "REVIEW_REQUIRED",
  },
];

for (const goldenCase of GOLDEN_CASES) {
  test(`golden dataset: ${goldenCase.name} → ${goldenCase.expectedDecision}`, async ({ page }) => {
    await page.goto(moduleUrl);
    const decision = await page.evaluate(
      ({ fixture, build }) =>
        eval(`(() => {
          ${fixture}
          const ctx = ${build};
          return moduleSummaryQualityGateV1(ctx).decision;
        })()`),
      { fixture: goldenFixture, build: goldenCase.build },
    );
    expect(decision, goldenCase.rationale).toBe(goldenCase.expectedDecision);
  });
}
