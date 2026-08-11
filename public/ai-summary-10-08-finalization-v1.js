(function(root){
  'use strict';

  const SCORE_KEYS=Object.freeze(['faithfulness','completeness','usefulness','agreements_next_step','format']);
  const GATE_KEYS=Object.freeze(['gate_status','quality_score','confidence','scores','failed_criteria','warnings','technical_errors']);
  const CRM_KEYS=Object.freeze(['crm_action','summary','quality','pipeline_status','warnings','errors']);
  const SUMMARY_KEYS=Object.freeze(['conversation_result','key_facts','quotes','next_step']);
  const QUALITY_KEYS=Object.freeze(['gate_status','quality_score','confidence']);
  const CONTRACTS=Object.freeze({
    gate:Object.freeze({contractId:'ai_summary_10_08_summary_quality_gate',contractVersion:'v1',schemaId:'ai_summary_10_08_summary_quality_gate_v1'}),
    crm:Object.freeze({contractId:'ai_summary_10_08_crm_result',contractVersion:'v1',schemaId:'ai_summary_10_08_crm_result_v1'})
  });
  const SCORE_SCHEMA=Object.freeze({type:'object',additionalProperties:false,required:SCORE_KEYS,properties:Object.freeze(Object.fromEntries(SCORE_KEYS.map(key=>[key,{type:'number',minimum:0,maximum:100}])))});
  const SUMMARY_SCHEMA=Object.freeze({type:'object',additionalProperties:false,required:SUMMARY_KEYS,properties:Object.freeze({conversation_result:{type:'string'},key_facts:{type:'array',items:{type:'string'}},quotes:{type:'array',items:{type:'string'}},next_step:{type:'string'}})});
  const GATE_SCHEMA=Object.freeze({type:'object',additionalProperties:false,required:GATE_KEYS,properties:Object.freeze({gate_status:{type:'string',enum:['PASS','WARNING','BLOCKED','TECHNICAL_ERROR']},quality_score:{type:'number',minimum:0,maximum:100},confidence:{type:'number',minimum:0,maximum:1},scores:SCORE_SCHEMA,failed_criteria:{type:'array',items:{type:'string'}},warnings:{type:'array',items:{type:'string'}},technical_errors:{type:'array',items:{type:'string'}}})});
  const CRM_SCHEMA=Object.freeze({type:'object',additionalProperties:false,required:CRM_KEYS,properties:Object.freeze({crm_action:{type:'string',enum:['SAVE','SAVE_WITH_WARNING','REVIEW_REQUIRED','ERROR']},summary:SUMMARY_SCHEMA,quality:{type:'object',additionalProperties:false,required:QUALITY_KEYS,properties:{gate_status:{type:'string',enum:['PASS','WARNING','BLOCKED','TECHNICAL_ERROR']},quality_score:{type:'number',minimum:0,maximum:100},confidence:{type:'number',minimum:0,maximum:1}}},pipeline_status:{type:'string',enum:['READY','PARTIAL_READY','BLOCKED','TECHNICAL_ERROR']},warnings:{type:'array',items:{type:'string'}},errors:{type:'array',items:{type:'string'}}})});
  const STAGES=Object.freeze([
    Object.freeze({enabled:true,type:'code',name:'Summary Quality Gate',outKey:'summary_quality_gate',codeFn:'aiSummaryQualityGate',contractId:CONTRACTS.gate.contractId,contractVersion:CONTRACTS.gate.contractVersion,schemaId:CONTRACTS.gate.schemaId,stageVersion:'v1'}),
    Object.freeze({enabled:true,type:'code',name:'CRM Result',outKey:'crm_summary_result',codeFn:'aiSummaryCrmResult',contractId:CONTRACTS.crm.contractId,contractVersion:CONTRACTS.crm.contractVersion,schemaId:CONTRACTS.crm.schemaId,stageVersion:'v1'})
  ]);

  function isRecord(value){return Boolean(value&&typeof value==='object'&&!Array.isArray(value));}
  function exactKeys(value,keys){return isRecord(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.prototype.hasOwnProperty.call(value,key));}
  function strings(value){return Array.isArray(value)&&value.every(item=>typeof item==='string');}
  function score(value){return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100;}
  function clone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
  function unique(values){return [...new Set(values.filter(Boolean))];}
  function emptyScores(){return {faithfulness:0,completeness:0,usefulness:0,agreements_next_step:0,format:0};}
  function currentIdentity(ctx){return {run_id:String(ctx&&ctx.__run_id||''),transcript_hash:String(ctx&&ctx.__transcript_hash||''),pipeline_configuration_hash:String(ctx&&ctx.__pipeline_configuration_hash||'')};}

  function validateJudge(value){
    if(!exactKeys(value,['scores','quality_score','confidence','decision','issues'])) return false;
    if(!exactKeys(value.scores,SCORE_KEYS)||!SCORE_KEYS.every(key=>score(value.scores[key]))) return false;
    return score(value.quality_score)&&typeof value.confidence==='number'&&Number.isFinite(value.confidence)&&value.confidence>=0&&value.confidence<=1&&['pass','warning','fail','technical_error'].includes(value.decision)&&strings(value.issues);
  }
  function validateSummary(value){
    return exactKeys(value,SUMMARY_KEYS)&&typeof value.conversation_result==='string'&&strings(value.key_facts)&&strings(value.quotes)&&typeof value.next_step==='string';
  }
  function validateGate(value){
    return exactKeys(value,GATE_KEYS)&&['PASS','WARNING','BLOCKED','TECHNICAL_ERROR'].includes(value.gate_status)&&score(value.quality_score)&&typeof value.confidence==='number'&&Number.isFinite(value.confidence)&&value.confidence>=0&&value.confidence<=1&&exactKeys(value.scores,SCORE_KEYS)&&SCORE_KEYS.every(key=>score(value.scores[key]))&&strings(value.failed_criteria)&&strings(value.warnings)&&strings(value.technical_errors);
  }
  function validateCrm(value){
    return exactKeys(value,CRM_KEYS)&&['SAVE','SAVE_WITH_WARNING','REVIEW_REQUIRED','ERROR'].includes(value.crm_action)&&validateSummary(value.summary)&&exactKeys(value.quality,QUALITY_KEYS)&&['PASS','WARNING','BLOCKED','TECHNICAL_ERROR'].includes(value.quality.gate_status)&&score(value.quality.quality_score)&&typeof value.quality.confidence==='number'&&value.quality.confidence>=0&&value.quality.confidence<=1&&['READY','PARTIAL_READY','BLOCKED','TECHNICAL_ERROR'].includes(value.pipeline_status)&&strings(value.warnings)&&strings(value.errors);
  }
  function provenanceErrors(provenance,current){
    const errors=[];
    if(!provenance||!isRecord(provenance)) return ['CURRENT_RUN_PROVENANCE_UNPROVEN'];
    if(!current.run_id||provenance.run_id!==current.run_id) errors.push('STALE_RUN_ID');
    if(!current.transcript_hash||provenance.transcript_hash!==current.transcript_hash) errors.push('STALE_TRANSCRIPT_HASH');
    if(!current.pipeline_configuration_hash||provenance.pipeline_configuration_hash!==current.pipeline_configuration_hash) errors.push('STALE_CONFIGURATION_HASH');
    return errors;
  }
  function judgeRuntimeErrors(provenance){
    const errors=[];
    if(!provenance||!isRecord(provenance)) return errors;
    if(provenance.execution_status&&provenance.execution_status!=='SUCCESS') errors.push('SUMMARY_JUDGE_TECHNICAL_ERROR');
    if(provenance.parse_status&&provenance.parse_status!=='SUCCESS') errors.push('SUMMARY_JUDGE_PARSE_FAILED');
    if(provenance.schema_status&&provenance.schema_status!=='VALID') errors.push('SUMMARY_JUDGE_SCHEMA_INVALID');
    if(provenance.structured_output_requested===true&&provenance.structured_output_applied!==true) errors.push('SUMMARY_JUDGE_STRUCTURED_OUTPUT_INVALID');
    return errors;
  }
  function gateTechnical(errors,judge){
    const valid=validateJudge(judge);
    return {gate_status:'TECHNICAL_ERROR',quality_score:valid?judge.quality_score:0,confidence:valid?judge.confidence:0,scores:valid?clone(judge.scores):emptyScores(),failed_criteria:[],warnings:[],technical_errors:unique(errors)};
  }
  function runGate(ctx){
    const judge=ctx&&ctx.summary_judge;
    const provenance=ctx&&ctx.__stage_provenance&&ctx.__stage_provenance.summary_judge;
    const current=currentIdentity(ctx);
    const errors=[];
    if(judge===undefined||judge===null) errors.push('SUMMARY_JUDGE_MISSING');
    errors.push(...provenanceErrors(provenance,current),...judgeRuntimeErrors(provenance));
    if(judge!==undefined&&judge!==null&&!validateJudge(judge)) errors.push('SUMMARY_JUDGE_SCHEMA_INVALID');
    let scoreMismatch=false;
    if(validateJudge(judge)){
      const expected=SCORE_KEYS.reduce((sum,key)=>sum+judge.scores[key],0)/SCORE_KEYS.length;
      scoreMismatch=judge.quality_score!==expected;
      if(judge.decision==='technical_error') errors.push('SUMMARY_JUDGE_TECHNICAL_ERROR');
    }
    if(errors.length) return gateTechnical(errors,judge);

    const failed=[];
    if(judge.quality_score<75) failed.push('quality_score');
    if(judge.decision==='fail') failed.push('decision');
    if(judge.scores.faithfulness<=25) failed.push('faithfulness');
    if(judge.scores.agreements_next_step<=25) failed.push('agreements_next_step');
    if(judge.confidence<0.70) failed.push('confidence');
    // Critical faithfulness/agreement faults must remain an explicit business
    // BLOCKED result even when a faulty upstream score claims >=90. This is
    // the mandatory safety fault-injection; all non-critical mismatches are TE.
    const criticalBlocked=failed.includes('faithfulness')||failed.includes('agreements_next_step');
    if(scoreMismatch&&!criticalBlocked) return gateTechnical(['SUMMARY_JUDGE_SCORE_MISMATCH'],judge);
    if(failed.length) return {gate_status:'BLOCKED',quality_score:judge.quality_score,confidence:judge.confidence,scores:clone(judge.scores),failed_criteria:failed,warnings:[],technical_errors:[]};

    const warningCodes=[];
    if(judge.quality_score>=75&&judge.quality_score<=89) warningCodes.push('LOW_QUALITY_SCORE');
    if(judge.confidence>=0.70&&judge.confidence<=0.84) warningCodes.push('LOW_CONFIDENCE');
    if(judge.scores.completeness===50) warningCodes.push('LOW_COMPLETENESS');
    if(judge.scores.usefulness===50) warningCodes.push('LOW_USEFULNESS');
    if(judge.scores.format===50) warningCodes.push('LOW_FORMAT');
    if(judge.decision==='warning') warningCodes.push('JUDGE_WARNING');
    const pass=judge.decision==='pass'&&judge.quality_score>=90&&SCORE_KEYS.every(key=>judge.scores[key]>=75)&&judge.confidence>=0.85;
    if(!pass&&!warningCodes.length) return gateTechnical(['SUMMARY_JUDGE_DECISION_INCONSISTENT'],judge);
    return {gate_status:pass?'PASS':'WARNING',quality_score:judge.quality_score,confidence:judge.confidence,scores:clone(judge.scores),failed_criteria:[],warnings:pass?[]:unique([...warningCodes,...judge.issues]),technical_errors:[]};
  }

  function emptySummary(){return {conversation_result:'',key_facts:[],quotes:[],next_step:''};}
  function runCrm(ctx){
    const summary=ctx&&ctx.summary_generator;
    const gate=ctx&&ctx.summary_quality_gate;
    const current=currentIdentity(ctx);
    const summaryProvenance=ctx&&ctx.__stage_provenance&&ctx.__stage_provenance.summary_generator;
    const gateProvenance=ctx&&ctx.__stage_provenance&&ctx.__stage_provenance.summary_quality_gate;
    const errors=[];
    if(!validateSummary(summary)) errors.push(summary===undefined||summary===null?'SUMMARY_GENERATOR_MISSING':'SUMMARY_GENERATOR_SCHEMA_INVALID');
    if(!validateGate(gate)) errors.push(gate===undefined||gate===null?'SUMMARY_QUALITY_GATE_MISSING':'SUMMARY_QUALITY_GATE_SCHEMA_INVALID');
    errors.push(...provenanceErrors(summaryProvenance,current).map(code=>'SUMMARY_GENERATOR_'+code));
    errors.push(...provenanceErrors(gateProvenance,current).map(code=>'SUMMARY_QUALITY_GATE_'+code));
    if(validateGate(gate)&&gate.gate_status==='TECHNICAL_ERROR') errors.push(...gate.technical_errors);
    const safeSummary=validateSummary(summary)?clone(summary):emptySummary();
    const safeQuality=validateGate(gate)?{gate_status:gate.gate_status,quality_score:gate.quality_score,confidence:gate.confidence}:{gate_status:'TECHNICAL_ERROR',quality_score:0,confidence:0};
    if(errors.length) return {crm_action:'ERROR',summary:safeSummary,quality:safeQuality,pipeline_status:'TECHNICAL_ERROR',warnings:[],errors:unique(errors)};
    const mapping={PASS:['SAVE','READY'],WARNING:['SAVE_WITH_WARNING','PARTIAL_READY'],BLOCKED:['REVIEW_REQUIRED','BLOCKED'],TECHNICAL_ERROR:['ERROR','TECHNICAL_ERROR']};
    const selected=mapping[gate.gate_status];
    return {crm_action:selected[0],summary:safeSummary,quality:safeQuality,pipeline_status:selected[1],warnings:clone(gate.warnings),errors:gate.gate_status==='TECHNICAL_ERROR'?clone(gate.technical_errors):[]};
  }

  root.__AI_SUMMARY_10_08_FINALIZATION_V1__=Object.freeze({
    contracts:CONTRACTS,stages:STAGES,scoreKeys:SCORE_KEYS,
    schemas:Object.freeze({summaryQualityGate:GATE_SCHEMA,crmResult:CRM_SCHEMA}),
    validateSummaryJudge:validateJudge,validateSummary,validateSummaryQualityGate:validateGate,validateCrmResult:validateCrm,
    runSummaryQualityGate:runGate,runCrmResult:runCrm,currentIdentity,provenanceErrors
  });
})(typeof window!=='undefined'?window:globalThis);
