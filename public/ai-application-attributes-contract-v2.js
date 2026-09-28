/* Shared by the attributes preset, browser runtime and regression tests. */
(() => {
  const keys = ['interest', 'funding_source', 'purchase_term', 'next_contact_date'];
  const states = ['determined', 'explicitly_declined', 'not_determined'];
  const interest = ['Новостройки', 'Ипотека', 'Инвестиции в регионах', 'Безопасность сделок', 'Юридическое сопровождение', 'Строительство'];
  const funding = ['наличные / депозит', 'ипотека одобрена', 'ипотека в процессе', 'продажа своей квартиры'];
  const purchase = ['до 1 месяца', '2–3 месяца', '3–6 месяцев', 'более 6 месяцев'];
  const object = properties => ({type:'object', additionalProperties:false, required:Object.keys(properties), properties});
  const enumeration = values => ({type:'string', enum:values});
  const text = {type:'string'};
  const nullableText = {type:['string','null']};
  const strings = {type:'array', items:text};
  const status = enumeration(states);
  const eventAnchor = {...object({raw_time_expression:text, evidence:text,
    offset_minutes:{type:'number',minimum:-10080,maximum:10080}}), type:['object','null']};
  const resolutionStates=['resolved','missing_reference','unresolved','not_applicable'];
  const resolutionSchema=object({status:enumeration(resolutionStates),reason:nullableText,action:enumeration(['callback','message','send_information','confirm','meeting','other','none']),
    raw_time_expression:nullableText,evidence:nullableText,event_anchor:eventAnchor});
  const emptyResolution=()=>({status:'not_applicable',reason:null,action:'none',raw_time_expression:null,evidence:null,event_anchor:null});
  // Context is useful information, never a replacement for a confirmed CRM value.
  const contextSchema={...object({summary:text,evidence:strings,limitation:text}),type:['object','null']};
  const contextualKeys=['funding_source','purchase_term'];
  const contextsSchema=object(Object.fromEntries(contextualKeys.map(key=>[key,contextSchema])));
  const emptyContexts=()=>({funding_source:null,purchase_term:null});
  const interestOperationsSchema=object({add:{type:'array',items:enumeration(interest)},remove:{type:'array',items:enumeration(interest)},keep:{type:'boolean'}});
  const emptyInterestOperations=()=>({add:[],remove:[],keep:true});
  const relativePoint={...object({day_offset:{type:'number'},time:text,label:text,reference:enumeration(['conversation_day']),calendar_date_known:{type:'boolean'}}),type:['object','null']};
  const relativeScheduleSchema=object({event:relativePoint,contact:relativePoint});
  const nextSchema = object({
    status, detected:{type:'boolean'}, next_contact_at:nullableText,
    precision:enumeration(['exact','range','daypart','date','none']),
    action:enumeration(['callback','message','send_information','confirm','meeting','other','none']),
    actor:enumeration(['agent','client','none']), raw_time_expression:nullableText, evidence:nullableText,
    confidence:{type:'number',minimum:0,maximum:1}, event_anchor:eventAnchor
  });
  const schemas = {
    interest_extractor:object({status, value:{type:['array','null'],items:enumeration(interest)}, evidence:strings,
      declined_values:{type:'array',items:enumeration(interest)}, decline_evidence:strings}),
    funding_source_extractor:object({status,value:{type:['string','null'],enum:[...funding,null]},evidence:text,context:contextSchema}),
    purchase_term_extractor:object({status,value:{type:['string','null'],enum:[...purchase,null]},evidence:text,context:contextSchema}),
    next_contact_date_extractor:nextSchema
  };
  const judgeSchema = object(Object.fromEntries(keys.map(key => [key, object({
    verdict:enumeration(key==='next_contact_date'?['accepted','corrected','rejected','not_determined','technical_error']:['accepted','rejected','not_determined','technical_error']),
    status, reason:text,
    ...(key==='next_contact_date'?{corrected_value:{...nextSchema,type:['object','null']}}:{}),
    ...(contextualKeys.includes(key)?{context_verdict:enumeration(['accepted','rejected','not_present']),context_reason:text}:{})
  })])));
  const perAttribute = schema => object(Object.fromEntries(keys.map(key=>[key,schema])));
  const savedValues = object({interest:{type:['array','null'],items:enumeration(interest)},
    funding_source:{type:['string','null'],enum:[...funding,null]},purchase_term:{type:['string','null'],enum:[...purchase,null]},next_contact_date:nullableText});
  const gateDecisions = object({
    interest:enumeration(['AUTO_SAVE','SAVE_DECLINED','DO_NOT_UPDATE','TECHNICAL_ERROR']),
    funding_source:enumeration(['AUTO_SAVE','DO_NOT_UPDATE','TECHNICAL_ERROR']),
    purchase_term:enumeration(['AUTO_SAVE','DO_NOT_UPDATE','TECHNICAL_ERROR']),
    next_contact_date:enumeration(['AUTO_SAVE','SAVE_DECLINED','DO_NOT_UPDATE','TECHNICAL_ERROR','USE_SYSTEM_FALLBACK'])
  });
  const updateActions = object({
    interest:enumeration(['ADD','REMOVE','ADD_REMOVE','KEEP','ERROR']),
    funding_source:enumeration(['SET','SKIP','ERROR']),
    purchase_term:enumeration(['SET','SKIP','ERROR']),
    next_contact_date:enumeration(['SET','SET_DECLINED','SKIP','ERROR','KEEP_FALLBACK'])
  });
  const gateSchema = object({decisions:gateDecisions,
    values_for_save:savedValues,attribute_states:perAttribute(status),sources:perAttribute(enumeration(['ai','none','fallback'])),
    blocked_attributes:strings,technical_errors:strings,gate_status:enumeration(['READY','PARTIAL_READY','BLOCKED']),declined_interest_values:strings,declined_interest_evidence:strings,interest_operations:interestOperationsSchema,pending_attributes:strings,next_contact_resolution:resolutionSchema,attribute_context:contextsSchema,next_contact_schedule:relativeScheduleSchema});
  const crmSchema = object({attributes:savedValues,attribute_states:perAttribute(status),
    update_actions:updateActions,sources:perAttribute(enumeration(['ai','none','fallback'])),
    pipeline_status:enumeration(['READY','PARTIAL_READY','BLOCKED']),blocked_attributes:strings,technical_errors:strings,declined_interest_values:strings,declined_interest_evidence:strings,interest_operations:interestOperationsSchema,
    pending_attributes:strings,next_contact_resolution:resolutionSchema,attribute_context:contextsSchema,next_contact_schedule:relativeScheduleSchema,
    next_contact_policy:enumeration(['NO_CONTACT','USE_AI','PRESERVE_SYSTEM_FALLBACK_24H'])});
  const fail = message => {const error=new Error(message); error.name='ApplicationAttributesSchemaError'; throw error;};
  function validateSchema(value, schema, path='result') {
    const types=Array.isArray(schema.type)?schema.type:[schema.type];
    const actual=value===null?'null':Array.isArray(value)?'array':typeof value;
    if (!types.includes(actual)) fail(`${path}: expected ${types.join('|')}`);
    if (schema.enum && !schema.enum.includes(value)) fail(`${path}: unsupported value`);
    if (actual==='number' && (!Number.isFinite(value) || value<schema.minimum || value>schema.maximum)) fail(`${path}: invalid number`);
    if (actual==='object') {
      for (const key of schema.required||[]) if (!Object.hasOwn(value,key)) fail(`${path}.${key}: required`);
      for (const key of Object.keys(value)) {
        if (!schema.properties[key]) fail(`${path}.${key}: additional property`);
        validateSchema(value[key],schema.properties[key],`${path}.${key}`);
      }
    }
    if (actual==='array') value.forEach((item,index)=>validateSchema(item,schema.items,`${path}[${index}]`));
    return value;
  }
  function validDate(value) {
    const match=typeof value==='string'&&value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/);
    if (!match || !Number.isFinite(Date.parse(value))) return false;
    const [,y,m,d,h,min,sec='0',offset]=match;
    const calendar=new Date(Date.UTC(+y,+m-1,+d));
    return calendar.getUTCFullYear()===+y && calendar.getUTCMonth()+1===+m && calendar.getUTCDate()===+d
      && +h<24 && +min<60 && +sec<60 && (offset==='Z'||(+offset.slice(1,3)<=14&&+offset.slice(4)<60));
  }
  const proofPresent = evidence => Array.isArray(evidence)?evidence.length>0&&evidence.every(item=>item.trim()):typeof evidence==='string'&&!!evidence.trim();
  function validateExtractor(key, value, semantic=false) {
    const normalized=key==='next_contact_date_extractor'&&!semantic;
    const {normalization_status:resolution,...candidate}=normalized?value||{}:{};
    // Historical v2 runtime objects can be read; live v3 model responses remain strict.
    const compatible=!semantic&&contextualKeys.includes(key.replace('_extractor',''))?{context:null,...value}:value;
    validateSchema(normalized?{event_anchor:null,...candidate}:compatible, schemas[key], key);
    if(compatible?.context&&compatible.status!=='not_determined') fail('Context requires undetermined attribute');
    if(normalized&&resolution!==undefined&&!resolutionStates.includes(resolution)) fail('Invalid normalization status');
    const determined=value.status==='determined', declined=value.status==='explicitly_declined';
    if (key==='next_contact_date_extractor') {
      if (value.detected!==determined) fail(`${key}: status/detected mismatch`);
      if (determined) {
        const withoutTime=value.precision==='none'&&['callback','message'].includes(value.action)
          &&value.next_contact_at===null&&value.raw_time_expression===null&&value.event_anchor===null;
        if (value.action==='none') fail(`${key}.action: contact action required`);
        if (value.precision==='none'&&!withoutTime) fail(`${key}.precision: incomplete contact without time`);
        if (!proofPresent(value.evidence)) fail(`${key}.evidence: contact evidence required`);
        if (!withoutTime&&!proofPresent(value.raw_time_expression)) fail(`${key}.raw_time_expression: time expression required`);
        const pending=normalized&&['missing_reference','unresolved'].includes(resolution);
        if (semantic||pending||withoutTime ? value.next_contact_at!==null : !validDate(value.next_contact_at)) fail(`${key}: invalid datetime`);
        if(value.event_anchor&&(!proofPresent(value.event_anchor.raw_time_expression)||!proofPresent(value.event_anchor.evidence)||!Number.isInteger(value.event_anchor.offset_minutes))) fail('Invalid event anchor');
      } else {
        if (value.next_contact_at!==null||value.actor!=='none'||value.action!=='none'||value.precision!=='none') fail(`${key}: absent contact must be null`);
        if (value.event_anchor!=null) fail('Absent contact cannot have event anchor');
        if (declined&&!proofPresent(value.evidence)) fail(`${key}: refusal evidence required`);
        if (!declined&&(value.evidence!==null||value.raw_time_expression!==null)) fail(`${key}: absent information requires empty evidence`);
      }
    } else {
      if (determined) {
        if (value.value===null||!proofPresent(value.evidence)) fail(`${key}: determined value/evidence required`);
        if (key==='interest_extractor' && (!value.value.length||new Set(value.value).size!==value.value.length)) fail(`${key}: invalid value array`);
      } else {
        if (value.value!==null) fail(`${key}: absent value must be null`);
        if (value.event_anchor!=null) fail('Absent contact cannot have event anchor');
        if (declined&&!proofPresent(value.evidence)) fail(`${key}: refusal evidence required`);
        if (!declined&&proofPresent(value.evidence)) fail(`${key}: undetermined evidence must be empty`);
      }
      if (key==='interest_extractor') {
        if (new Set(value.declined_values).size!==value.declined_values.length||value.decline_evidence.some(item=>!item.trim())||value.declined_values.some(item=>value.value?.includes(item))) fail(`${key}: invalid declined values/evidence`);
        if (value.status==='not_determined'&&value.declined_values.length) fail(`${key}: refusal must have explicit status`);
      }
    }
    return value;
  }
  const normalizeProof=value=>String(value||'').toLowerCase().replace(/ё/g,'е').replace(/[^а-яa-z0-9]+/g,' ').trim();
  function normalizeExistingAttributes(value) {
    const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
    const normalized={};
    if(Array.isArray(source.interest)) normalized.interest=[...new Set(source.interest.filter(item=>interest.includes(item)))];
    if(funding.includes(source.funding_source)) normalized.funding_source=source.funding_source;
    if(purchase.includes(source.purchase_term)) normalized.purchase_term=source.purchase_term;
    if(validDate(source.next_contact_date)) normalized.next_contact_date=source.next_contact_date;
    return normalized;
  }
  function normalizeNextContactActor(value,transcript){
    if(value?.status!=='determined'||value.detected!==true||!proofPresent(value.evidence)) return value;
    const quote=normalizeProof(value.evidence.replace(/^\s*(?:Агент|Менеджер|Клиент|Клиентка)\s*:\s*/i,''));
    if(quote.length<20) return value;
    const turns=[];let current=null;
    for(const line of String(transcript||'').split(/\r?\n/)){
      const match=line.match(/^\s*(Агент|Менеджер|Клиент|Клиентка)\s*:\s*(.*)$/i);
      if(match){current={actor:/^клиент/i.test(match[1])?'client':'agent',text:match[2]};turns.push(current);}
      else if(current)current.text+=' '+line;
    }
    const actionPattern=value.action==='callback'
      ? /(?:^|\s)(?:я\s+)?(?:сейчас\s+|тогда\s+)?(?:пере?звоню|позвоню|наберу|свяжусь)(?:\s+вам|\s+с\s+вами)?/i
      :['message','send_information','confirm'].includes(value.action)
      ? /(?:^|\s)(?:я\s+)?(?:сейчас\s+|тогда\s+)?(?:напишу|отправлю|пришлю|скину|сообщу|дам\s+знать)(?:\s+вам)?/i
      :null;
    if(actionPattern){
      const commitments=turns.map(turn=>({turn,match:turn.text.match(actionPattern)})).filter(item=>item.match);
      const evidenced=commitments.filter(item=>quote.includes(normalizeProof(item.match[0])));
      const latest=(evidenced.length?evidenced:commitments).at(-1);
      if(latest&&(evidenced.length||value.actor==='none')) return {...value,actor:latest.turn.actor};
    }
    if(value.actor!=='none') return value;
    const matches=turns.filter(turn=>normalizeProof(turn.text).includes(quote));
    return matches.length&&matches.every(turn=>turn.actor===matches[0].actor)?{...value,actor:matches[0].actor}:value;
  }
  function judgeResult(verdicts, inputs) {
    const result={attributes:{},attribute_statuses:{},attribute_states:{},decisions:{},evidence:{},reason_codes:{},judge_verdicts:{},declined_interest_values:[],declined_interest_evidence:[],validation_errors:{},attribute_context:emptyContexts(),context_validation_errors:{},next_contact_resolution:emptyResolution()};
    for (const key of keys) {
      const input=inputs[key], source=input?.result;
      result.attributes[key]=null; result.attribute_states[key]='not_determined';
      result.attribute_statuses[key]='technical_error'; result.decisions[key]='technical_error';
      result.evidence[key]=key==='interest'?[]:''; result.reason_codes[key]=['technical_input_error'];
      result.judge_verdicts[key]='technical_error';
      if (!input||input.status==='technical_error') continue;
      try {
        validateExtractor(key+'_extractor', source);
        const raw=verdicts?.[key];
        const compatible=raw&&contextualKeys.includes(key)&&!source.context?{context_verdict:'not_present',context_reason:'',...raw}:raw;
        const verdict=validateSchema(compatible,judgeSchema.properties[key],`judge.${key}`);
        if (verdict.status!==source.status) fail('Judge cannot change extractor status');
        if (verdict.verdict==='technical_error') fail(verdict.reason||'Judge technical error');
        let judgedSource=source;
        if(key==='next_contact_date') {
          if(verdict.verdict==='corrected') {
            if(!verdict.corrected_value) fail('Corrected Next Contact value required');
            validateExtractor('next_contact_date_extractor',verdict.corrected_value);
            if(verdict.corrected_value.status!==source.status) fail('Judge cannot change extractor status');
            if(JSON.stringify(verdict.corrected_value)===JSON.stringify(Object.fromEntries(Object.entries(source).filter(([field])=>field!=='normalization_status')))) fail('Corrected Next Contact must differ from extractor result');
            judgedSource={...verdict.corrected_value,normalization_status:verdict.corrected_value.next_contact_at?'resolved':source.normalization_status};
          } else if(verdict.corrected_value!==null) fail('Corrected Next Contact is allowed only for corrected verdict');
        }
        const effectiveVerdict=source.status==='not_determined'&&verdict.verdict==='accepted'?'not_determined':verdict.verdict;
        if ((effectiveVerdict==='not_determined')!==(source.status==='not_determined') && effectiveVerdict!=='rejected') fail('Judge verdict/status mismatch');
        result.judge_verdicts[key]=effectiveVerdict;
        result.reason_codes[key]=[verdict.reason];
        result.attribute_statuses[key]='ready';
        result.decisions[key]=effectiveVerdict==='rejected'?'reject':'approve';
        if (effectiveVerdict==='rejected') continue;
        result.attribute_states[key]=judgedSource.status;
        result.attributes[key]=key==='next_contact_date'?(judgedSource.detected?Object.fromEntries(Object.entries(judgedSource).filter(([field])=>!['evidence','status'].includes(field))):null):judgedSource.value;
        result.evidence[key]=judgedSource.evidence??'';
        if(contextualKeys.includes(key)&&judgedSource.context&&verdict.context_verdict==='accepted') result.attribute_context[key]=JSON.parse(JSON.stringify(judgedSource.context));
        if(key==='next_contact_date') {
          const resolution=judgedSource.normalization_status||(judgedSource.detected?'resolved':'not_applicable');
          result.next_contact_resolution={status:resolution,action:judgedSource.action,
            reason:resolution==='missing_reference'?'COMMUNICATION_CREATED_AT_MISSING':resolution==='unresolved'?'TEMPORAL_EXPRESSION_UNRESOLVED':null,
            raw_time_expression:judgedSource.raw_time_expression,evidence:judgedSource.evidence,event_anchor:judgedSource.event_anchor||null};
        }
        if (key==='interest') {
          result.declined_interest_values=[...source.declined_values];
          result.declined_interest_evidence=[...source.decline_evidence];
        }
      } catch (error) { result.validation_errors[key]=error.message; }
    }
    return result;
  }
  function gate(judge) {
    const result={decisions:{},values_for_save:{},attribute_states:{},sources:{},blocked_attributes:[],technical_errors:[],gate_status:'BLOCKED',declined_interest_values:[],declined_interest_evidence:[],interest_operations:emptyInterestOperations(),pending_attributes:[],next_contact_resolution:emptyResolution(),attribute_context:emptyContexts(),next_contact_schedule:{event:null,contact:null}};
    for (const key of keys) {
      const state=judge?.attribute_states?.[key];
      result.attribute_states[key]='not_determined'; result.values_for_save[key]=null; result.sources[key]='none';
      result.decisions[key]='DO_NOT_UPDATE';
      if (judge?.attribute_statuses?.[key]==='technical_error') {result.decisions[key]='TECHNICAL_ERROR';result.technical_errors.push(key);continue;}
      if (judge?.attribute_statuses?.[key]!=='ready'||!states.includes(state)||judge.decisions[key]!=='approve') {result.blocked_attributes.push(key);continue;}
      const value=judge.attributes[key], evidence=judge.evidence[key];
      if(key==='next_contact_date') result.next_contact_resolution=judge.next_contact_resolution||emptyResolution();
      if(key==='next_contact_date'&&state==='determined'&&(['missing_reference','unresolved'].includes(result.next_contact_resolution.status)||value?.precision!=='exact')) {
        if(!['missing_reference','unresolved'].includes(result.next_contact_resolution.status))result.next_contact_resolution={...result.next_contact_resolution,status:'unresolved',reason:'EXACT_CONTACT_TIME_REQUIRED'};
        // Agreement is approved, but no calendar date may be written yet.
        result.attribute_states[key]=state;
        result.pending_attributes.push(key);
        continue;
      }
      if (state==='determined') {
        const allowed=key==='funding_source'?funding:purchase;
        const valid=key==='interest'?Array.isArray(value)&&value.length&&new Set(value).size===value.length&&value.every(v=>interest.includes(v))&&Array.isArray(evidence)
          :key==='next_contact_date'?value?.detected===true&&value.precision==='exact'&&validDate(value.next_contact_at)&&['agent','client'].includes(value.actor)&&value.confidence>=.9:allowed.includes(value);
        if (!valid||!proofPresent(evidence)) {result.blocked_attributes.push(key);continue;}
        result.decisions[key]='AUTO_SAVE'; result.values_for_save[key]=key==='next_contact_date'?value.next_contact_at:value;
      } else if (state==='explicitly_declined') {
        if (value!==null||!proofPresent(evidence)) {result.blocked_attributes.push(key);continue;}
        result.decisions[key]=contextualKeys.includes(key)?'DO_NOT_UPDATE':'SAVE_DECLINED';
      } else if (value!==null) {result.blocked_attributes.push(key);continue;}
      if(state==='not_determined'&&contextualKeys.includes(key)&&judge.attribute_context?.[key]){
        try { validateSchema(judge.attribute_context[key],contextSchema);result.attribute_context[key]=JSON.parse(JSON.stringify(judge.attribute_context[key])); } catch { /* Invalid context must not affect another attribute. */ }
      }
      result.attribute_states[key]=state;
      result.sources[key]=state==='not_determined'||(state==='explicitly_declined'&&contextualKeys.includes(key))?'none':'ai';
      if (key==='interest') {
        result.declined_interest_values=[...(judge.declined_interest_values||[])];
        result.declined_interest_evidence=[...(judge.declined_interest_evidence||[])];
        result.interest_operations={add:state==='determined'?[...value]:[],remove:[...result.declined_interest_values],keep:state!=='determined'&&!result.declined_interest_values.length};
        if(state==='explicitly_declined'&&!result.declined_interest_values.length){result.decisions[key]='DO_NOT_UPDATE';result.sources[key]='none';}
      }
    }
    result.next_contact_schedule=window.ApplicationAttributesRuntime?.relativeSchedule(result.next_contact_resolution)||{event:null,contact:null};
    const errors=result.blocked_attributes.length+result.technical_errors.length+result.pending_attributes.length;
    result.gate_status=errors===0?'READY':errors<keys.length?'PARTIAL_READY':'BLOCKED';
    return validateSchema(result,gateSchema,'gate');
  }
  function crm(gateResult) {
    validateSchema(gateResult,gateSchema,'gate');
    const result={attributes:{},attribute_states:{},update_actions:{},sources:{},pipeline_status:gateResult.gate_status,
      blocked_attributes:[...(gateResult.blocked_attributes||[])],technical_errors:[...(gateResult.technical_errors||[])],
      declined_interest_values:[...(gateResult.declined_interest_values||[])],declined_interest_evidence:[...(gateResult.declined_interest_evidence||[])],interest_operations:{...gateResult.interest_operations,add:[...gateResult.interest_operations.add],remove:[...gateResult.interest_operations.remove]},pending_attributes:[...gateResult.pending_attributes],next_contact_resolution:gateResult.next_contact_resolution,attribute_context:gateResult.attribute_context,next_contact_schedule:gateResult.next_contact_schedule};
    for (const key of keys) {
      const decision=gateResult.decisions[key];
      if(key==='interest'){
        result.attributes[key]=null;
      }else result.attributes[key]=decision==='AUTO_SAVE'||decision==='USE_SYSTEM_FALLBACK'?gateResult.values_for_save[key]:null;
      result.attribute_states[key]=gateResult.attribute_states[key];
      result.update_actions[key]=key==='interest'
        ? decision==='TECHNICAL_ERROR'?'ERROR':result.interest_operations.add.length&&result.interest_operations.remove.length?'ADD_REMOVE':result.interest_operations.add.length?'ADD':result.interest_operations.remove.length?'REMOVE':'KEEP'
        : decision==='AUTO_SAVE'?'SET':decision==='USE_SYSTEM_FALLBACK'?'KEEP_FALLBACK':decision==='SAVE_DECLINED'?'SET_DECLINED':decision==='TECHNICAL_ERROR'?'ERROR':'SKIP';
      result.sources[key]=gateResult.sources[key];
    }
    result.next_contact_policy=result.attribute_states.next_contact_date==='explicitly_declined'?'NO_CONTACT':result.sources.next_contact_date==='ai'?'USE_AI':'PRESERVE_SYSTEM_FALLBACK_24H';
    return validateSchema(result,crmSchema,'crm');
  }
  function applySystemFallback(gateResult, value, existingAttributes) {
    // This is an already calculated server value, not an LLM date or a new timer.
    const existing=normalizeExistingAttributes(existingAttributes);
    if (validDate(value)&&!existing.next_contact_date&&gateResult.attribute_states.next_contact_date!=='explicitly_declined'&&gateResult.sources.next_contact_date!=='ai') {
      gateResult.values_for_save.next_contact_date=value;
      gateResult.attribute_states.next_contact_date='not_determined';
      gateResult.sources.next_contact_date='fallback';
      gateResult.decisions.next_contact_date='USE_SYSTEM_FALLBACK';
    }
    return validateSchema(gateResult,gateSchema,'gate');
  }
  function renderPrompt(template, context, transcript, judgeInput) {
    let included=false;
    let output=String(template||'').replace(/\{\{\s*([^}]+?)\s*\}\}/g,(_,variable)=>{
      if (['transcript','ctx.transcript','ctx.__transcript'].includes(variable)) {if(included)return ''; included=true;return transcript;}
      if (variable==='attributes_judge_input') return JSON.stringify(judgeInput||{});
      if (variable==='attributes') return JSON.stringify(context.current_attributes||{});
      const path=variable.replace(/^ctx\./,'').split('.');
      const value=path.reduce((o,key)=>o?.[key],context);
      return value==null?'':typeof value==='object'?JSON.stringify(value):String(value);
    });
    if (!included) output+='\n\nТРАНСКРИБАЦИЯ:\n'+transcript;
    return output;
  }
  window.ApplicationAttributesV2={keys,states,interest,funding,purchase,schemas,judgeSchema,gateSchema,crmSchema,validateSchema,validateExtractor,normalizeExistingAttributes,normalizeNextContactActor,validDate,judgeResult,gate,crm,applySystemFallback,renderPrompt};
})();
