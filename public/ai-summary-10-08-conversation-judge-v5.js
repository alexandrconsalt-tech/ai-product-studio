(function(global){
  'use strict';

  const IMPLEMENTATION_VERSION='v5.3.0';
  const RECOVERY_REASON='RECOVERED_FROM_EXPLICIT_CONFIRMATION';
  const FIELD_NAMES=['agreement','next_step','responsible_party','deadline','channel'];
  const CONFIRMATION_RE=/^(?:ну\s+)?(?:да(?:[\s,.-]|$)|хорошо(?:[\s,.-]|$)|угу(?:[\s,.-]|$)|понял(?:а|и)?(?:[\s,.-]|$)|я\s+вас\s+понял(?:а|и)?(?:[\s,.-]|$)|договорились(?:[\s,.-]|$)|отлично(?:[\s,.-]|$)|конечно(?:[\s,.-]|$)|без\s+проблем(?:[\s,.-]|$)|соглас(?:ен|на|ны)(?:[\s,.-]|$)|подходит(?:[\s,.-]|$)|давайте(?:[\s,.-]|$))/i;
  const SCENARIO_ACCEPTANCE_RE=/(?:буду\s+ждать|жду(?:\s+(?:звонка|сообщени|письма|фотограф|вариант))?|тогда\s+жду)/i;
  const THANKS_RE=/^(?:вс[её][,\s.-]*)?(?:спасибо|благодарю)(?:[\s,.-]|$)/i;
  const DECLARED_CLIENT_ACTION_RE=/(?:в\s+любом(?:\s+\S+){0,2}\s+случае|я\s+сам[а]?|сам[а]?\s+(?:вам\s+)?(?:позвон|напиш|набер))/i;
  const CANCELLATION_RE=/(?:не\s+(?:надо|звон|пиши|получится|смогу)|отмен|передум|уже\s+не)/i;
  const CONDITIONAL_ACTION_RE=/(?:^|[.!?]\s*)если\b|может\s+быть|возможно\b|постараюсь/i;
  const DEADLINE_PATTERNS=[
    /сегодня\s*[,;]?\s*(?:или|либо)\s+завтра/i,
    /(?:сегодня|завтра|послезавтра)\s+(?:утром|дн[её]м|вечером|ночью)/i,
    /(?:сегодня|завтра|послезавтра)/i,
    /(?:утром|дн[её]м|вечером|ночью)/i,
    /(?:в|во)\s+(?:понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье)/i,
    /(?:в\s+течение|через)\s+[^,.!?;]{1,40}/i,
    /(?:к|до)\s+\d{1,2}(?::\d{2})?/i,
  ];
  const CHANNEL_PATTERNS=[
    ['WhatsApp',/whats\s*app|ватсап|вотсап/i],
    ['Telegram',/telegram|телеграм/i],
    ['MAX',/(?:^|[^a-zа-яё])max(?:[^a-zа-яё]|$)|(?:^|[^а-яё])макс(?:е|а|ом)?(?:[^а-яё]|$)/i],
    ['email',/e-?mail|электронн[а-яё]*\s+почт/i],
  ];
  const ACTION_PATTERNS=[
    ['clarify',/уточн(?:ю|ит|им|ят|ите|ишь|ить|ил(?:а|и)?|яет|яют|яю|яем)(?![а-яё])/i],
    ['check',/провер[а-яё]*/i],
    ['coordinate',/согласу[а-яё]*/i],
    ['select',/подбер[а-яё]*/i],
    ['request',/(?:запрос[а-яё]*|запрош[а-яё]*)/i],
    ['send',/(?:отправ[а-яё]*|пришл[а-яё]*|направ[а-яё]*)/i],
    ['call',/(?:позвон[а-яё]*|перезвон[а-яё]*|набер[а-яё]*)/i],
    ['write',/(?:напиш[а-яё]*|напис[а-яё]*|сообщ(?:у|ит|им|ат|ите|ишь))/i],
    ['show',/(?:покаж[а-яё]*|показ(?:ать|ыва[а-яё]*)|провед(?:у|ёт|ет|ём|ем|ут)\s+(?:показ|просмотр)[а-яё]*|организ(?:ую|ует|уем|уют)\s+(?:показ|просмотр)[а-яё]*|назнач(?:у|ит|им|ат)\s+(?:показ|просмотр)[а-яё]*|запис[а-яё]*[^.!?]{0,40}\s+на\s+просмотр)/i],
    ['other',/(?:свяж[а-яё]*|обратн[а-яё]*\s+связ[а-яё]*)/i],
  ];
  const COMMUNICATION_ACTIONS=['call','write','send'];

  const CONVERSATION_JUDGE_MARKER='AI_SUMMARY_JUDGE_OUTCOME_EVIDENCE_V5';
  const CONVERSATION_JUDGE_MARKER_PREFIX='AI_SUMMARY_JUDGE_OUTCOME_EVIDENCE_V';
  const SUMMARY_JUDGE_MARKER='AI_SUMMARY_SUMMARY_JUDGE_EVIDENCE_V2';
  const SUMMARY_GENERATOR_MARKER='AI_SUMMARY_GENERATOR_OUTCOME_CHANNEL_V1';
  const NEEDS_REQUIREMENT_PREFERENCE_MARKER='AI_SUMMARY_NEEDS_REQUIREMENT_PREFERENCE_V1';
  const JUDGE_REQUIREMENT_PREFERENCE_MARKER='AI_SUMMARY_JUDGE_REQUIREMENT_PREFERENCE_V1';
  const SUMMARY_REQUIREMENT_PREFERENCE_MARKER='AI_SUMMARY_SUMMARY_REQUIREMENT_PREFERENCE_V1';
  const conversationJudgeAppendix=`

==================================================
17. DETERMINISTIC OUTCOME EVIDENCE CONTRACT
==================================================

[${CONVERSATION_JUDGE_MARKER}]

Ты не являешься повторным Outcome Extractor. Для agreement, next_step,
responsible_party, deadline и channel классифицируй доказанность как
SUPPORTED, NOT_SUPPORTED или AMBIGUOUS.

Outcome проверяется как связанная структура. Если конкретные agreement или
next_step подтверждены второй стороной, разрешено наследовать из того же
evidence однозначно выраженные responsible_party, deadline и channel. Для
таких полей не требуется отдельная самостоятельная подтверждающая реплика.
Перед возвратом проверь consistency: подтверждённый next_step не должен явно
содержать исполнителя, срок или канал, очищенный как NOT_SUPPORTED, если нет
доказанной неоднозначности, условности, отмены или замены договорённости.

Agreement/call_result и next_step могут относиться к двум разным, но обоим
подтверждённым событиям одного разговора. Например, уже согласованный просмотр
остаётся agreement/call_result, а более поздний подтверждающий звонок —
next_step. Не удаляй первое событие только потому, что последнее событие иного
типа. responsible_party, deadline и channel проверяй по событию next_step.

При приблизительном или STT-повреждённом сроке сохраняй безопасную точность
evidence. Не сужай диапазон «примерно 30–40 минут» до точных 30 минут.

Восстановление пустого outcome допустимо только если одновременно есть:
конкретное действие, явное подтверждение второй стороны, однозначный
responsible_party, однозначный next_step, прямая привязка deadline/channel и
нет более поздней отмены или замены. Предложение, намерение, односторонний
план, оборванная или STT-повреждённая реплика не являются договорённостью.

При NOT_SUPPORTED или AMBIGUOUS очищай соответствующее поле. Если исходный
Outcome Extractor вернул пустые agreement/next_step и явного подтверждения
нет, сохрани все пять action-полей пустыми. Если outcome восстановлен только
из явного подтверждения, добавь issue ${RECOVERY_REASON}. Не используй иные
recovery reasons для implicit agreement или догадки.
`;
  const summaryJudgeAppendix=`

==================================================
AGREEMENTS_NEXT_STEP — EVIDENCE OVERRIDE
==================================================

[${SUMMARY_JUDGE_MARKER}]

Только для agreements_next_step недостаточно совпадения Summary с Clean
Store. Проверь доказанность agreement, next_step, responsible_party,
deadline и channel по Outcome Extractor, verified outcome и транскрибации
ниже. Неподтверждённое поле — CRITICAL ERROR, agreements_next_step <= 25.
Добавь machine-readable reason: UNSUPPORTED_AGREEMENT,
UNSUPPORTED_NEXT_STEP, UNSUPPORTED_DEADLINE, UNSUPPORTED_CHANNEL или
UNSUPPORTED_RESPONSIBLE_PARTY. Остальные четыре критерия не меняй.

OUTCOME EXTRACTOR:
{{ctx.outcome_extractor}}

VERIFIED OUTCOME:
{{ctx.conversation_judge}}

TRANSCRIPT EVIDENCE:
{{transcript}}
`;
  const summaryGeneratorAppendix=`

==================================================
19. OUTCOME CHANNEL ISOLATION
==================================================

[${SUMMARY_GENERATOR_MARKER}]

Канал следующего шага бери только из
clean_conversation_store.outcome.channel. Не восстанавливай WhatsApp,
Telegram, MAX, телефон или email из facts, needs, preferences, quotes либо
других полей Store. Если outcome.channel пуст, в next_step не указывай канал,
но сохрани подтверждённые действие, исполнителя и срок.
`;
  const needsRequirementPreferenceAppendix=`

==================================================
REQUIREMENT VS PREFERENCE — EVIDENCE CONTRACT
==================================================

[${NEEDS_REQUIREMENT_PREFERENCE_MARKER}]

requirements содержит только критерии, обязательность которых прямо доказана
речью клиента. Маркеры «обязательно», «только», «не больше/не меньше»,
«не выше/не ниже», «выше/ниже X не рассматриваю», «без этого не рассматриваю»
и эквивалентный жёсткий смысл подтверждают requirement.

«Желательно», «хотелось бы», «предпочтительно», «было бы хорошо»,
«по возможности» и эквивалентный мягкий смысл всегда относятся к preferences.
Формулировка критерия без доказанной обязательности также не должна
усиливаться до requirement. Сохраняй исходную модальность клиента.
`;
  const judgeRequirementPreferenceAppendix=`

==================================================
REQUIREMENT VS PREFERENCE — VERIFICATION
==================================================

[${JUDGE_REQUIREMENT_PREFERENCE_MARKER}]

Не утверждай Needs Extractor автоматически. Для каждого элемента requirements
найди клиентскую реплику, которая доказывает не только сам критерий, но и его
обязательность. Если доказан критерий, но не жёсткая модальность, перенеси его
в preferences. Мягкие маркеры нельзя переписывать как «не выше», «обязательно»
или другой жёсткий смысл.
`;
  const summaryRequirementPreferenceAppendix=`

==================================================
20. REQUIREMENT VS PREFERENCE
==================================================

[${SUMMARY_REQUIREMENT_PREFERENCE_MARKER}]

Элементы clean_conversation_store.needs.preferences описывай только как
желательные или предпочтительные. Не называй их обязательным требованием,
лимитом, максимумом или условием отказа. Обязательную формулировку разрешено
использовать только для элементов needs.requirements.
`;

  function text(value){return typeof value==='string'?value.trim().replace(/\s+/g,' '):'';}
  function normalized(value){return text(value).toLocaleLowerCase('ru-RU').replace(/ё/g,'е');}
  function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
  function speakerRole(value){
    const key=normalized(value);
    if(key.includes('агент')) return 'agent';
    if(key.includes('клиент')) return 'client';
    if(key.includes('оператор')) return 'operator';
    return '';
  }
  function oppositeRole(role){return role==='agent'?'client':role==='client'?'agent':'';}
  function parseTurns(transcript){
    const turns=[];let speaker='',lines=[];
    const flush=()=>{const value=text(lines.join(' '));if(value) turns.push({speaker,role:speakerRole(speaker),text:value});lines=[];};
    String(transcript||'').split(/\r?\n/).forEach(line=>{
      const match=line.trim().match(/^([^—–-][^:]{0,60}):\s*$/);
      if(match){flush();speaker=match[1].trim();return;}
      const value=line.trim().replace(/^[—–-]\s*/,'');if(value) lines.push(value);
    });
    flush();return turns;
  }
  const HARD_REQUIREMENT_RE=/(?:обязательн[а-яё]*|(?:^|[^а-яё])(?:только|максимум|минимум|предел)(?:[^а-яё]|$)|принципиальн[а-яё]*|критичн[а-яё]*|не\s+(?:больше|меньше|выше|ниже|дороже|дешевле)(?:[^а-яё]|$)|(?:выше|ниже|дороже|дешевле)[^.!?;]{0,35}не\s+рассматрива[а-яё]*|без[^.!?;]{0,35}не\s+рассматрива[а-яё]*|иначе[^.!?;]{0,30}не\s+(?:подходит|рассматрива[а-яё]*))/i;
  const SOFT_PREFERENCE_RE=/(?:желательн[а-яё]*|хотелось\s+бы|предпочтительн[а-яё]*|было\s+бы\s+хорошо|по\s+возможности|если\s+получится|неплохо\s+бы|лучше\s+бы)/i;
  const CRITERION_STOP_WORDS=new Set(['клиент','клиента','требование','требования','обязательное','обязательно','предпочтительно','желательно','важно','нужно','должно','должен','быть','чтобы','чтоб','только','бюджет','стоимость','цена','вариант','наличие','возможность','рассматривает','рассматривать','покупка']);
  function criterionTokens(value){
    return normalized(value).replace(/[^a-zа-яё0-9]+/g,' ').split(/\s+/).filter(Boolean).filter(token=>(/^\d/.test(token)||token.length>2)&&!CRITERION_STOP_WORDS.has(token)).map(token=>/^\d/.test(token)?token:token.length>6?token.slice(0,6):token);
  }
  function criterionScore(criterion,evidence){
    const left=criterionTokens(criterion),right=new Set(criterionTokens(evidence));
    if(!left.length||!right.size) return 0;
    const leftNumbers=left.filter(token=>/^\d/.test(token));
    const numberScore=leftNumbers.length&&leftNumbers.some(token=>right.has(token))?8:0;
    return numberScore+left.filter(token=>!/^\d/.test(token)&&right.has(token)).length;
  }
  function clientEvidenceForCriterion(criterion,transcript){
    let best=null,bestScore=0;
    const tokens=criterionTokens(criterion),minimumScore=tokens.some(token=>/^\d/.test(token))?8:tokens.length>=4?2:1;
    parseTurns(transcript).filter(turn=>turn.role==='client').forEach(turn=>{
      const clauses=turn.text.split(/(?<=[.!?;])\s+|\s+[—–]\s+/).filter(Boolean);
      clauses.forEach(clause=>{
        const score=criterionScore(criterion,clause);
        if(score>bestScore){best={text:clause,turn:turn.text,score};bestScore=score;}
      });
    });
    return bestScore>=minimumScore?best:null;
  }
  function preferenceForRequirement(requirement,existingPreferences=[]){
    const existing=existingPreferences.find(item=>criterionScore(requirement,item)>=Math.max(1,Math.min(2,criterionTokens(requirement).length)));
    if(existing) return text(existing);
    const source=text(requirement);
    const amount=source.match(/(?:не\s+(?:выше|больше|дороже)|до)?\s*(\d+(?:[.,]\d+)?)\s*(млн|миллион[а-яё]*|тыс(?:яч[а-яё]*)?)?\s*(₽|руб(?:лей|ля|ль)?)?/i);
    if(amount&&/(?:бюджет|стоимост|цен|₽|руб|млн|миллион|тыс)/i.test(source)){
      const unit=/^млн|миллион/i.test(amount[2]||'')?'млн':/^тыс/i.test(amount[2]||'')?'тыс.':'';
      return `Желательный бюджет — до ${amount[1]}${unit?' '+unit:''} ₽`;
    }
    const cleaned=text(source.replace(/^(?:обязательн[а-яё]*\s+требован[а-яё]*|требован[а-яё]*|обязательно)\s*[-—:]?\s*/i,'').replace(/^(?:не\s+(?:выше|больше|ниже|меньше)\s+)/i,''));
    if(/метро/i.test(cleaned)&&/рядом|близ|недалеко/i.test(cleaned)) return 'Предпочтительно рядом с метро';
    return `Предпочтительно: ${cleaned.charAt(0).toLocaleLowerCase('ru-RU')}${cleaned.slice(1)}`;
  }
  function validateRequirementPreferences(output,input){
    const result=clone(output)||{},needs=result.verified_needs&&typeof result.verified_needs==='object'?result.verified_needs:null;
    if(!needs) return {output:result,audit:{version:'v1.0.0',changed:false,reclassified:[]}};
    const transcript=String(input&&input.transcript||''),extractor=input&&input.needsExtractor&&typeof input.needsExtractor==='object'?input.needsExtractor:{};
    const requirements=Array.isArray(needs.requirements)?needs.requirements.map(text).filter(Boolean):[];
    const preferences=Array.isArray(needs.preferences)?needs.preferences.map(text).filter(Boolean):[];
    const extractorPreferences=Array.isArray(extractor.preferences)?extractor.preferences.map(text).filter(Boolean):[];
    const kept=[],moved=[],removedRequirements=[];
    requirements.forEach(requirement=>{
      const evidence=clientEvidenceForCriterion(requirement,transcript);
      const evidenceText=text(evidence&&evidence.text),turnText=text(evidence&&evidence.turn);
      const hard=Boolean(evidenceText&&HARD_REQUIREMENT_RE.test(evidenceText));
      const soft=Boolean((evidenceText&&SOFT_PREFERENCE_RE.test(evidenceText))||(!hard&&turnText&&SOFT_PREFERENCE_RE.test(turnText)));
      if(!evidence){removedRequirements.push({requirement,reason:'CLIENT_CRITERION_EVIDENCE_NOT_FOUND'});return;}
      if(hard){kept.push(requirement);return;}
      const preference=preferenceForRequirement(requirement,[...preferences,...extractorPreferences]);
      moved.push({requirement,preference,evidence:evidenceText,modality:soft?'SOFT':'NOT_PROVEN'});
      preferences.push(preference);
    });
    const removedPreferences=[],normalizedPreferences=[];
    const verifiedPreferences=preferences.flatMap(preference=>{
      const evidence=clientEvidenceForCriterion(preference,transcript);
      if(!evidence){removedPreferences.push({preference,reason:'CLIENT_CRITERION_EVIDENCE_NOT_FOUND'});return [];}
      const evidenceText=text(evidence.text),turnText=text(evidence.turn),soft=SOFT_PREFERENCE_RE.test(evidenceText)||SOFT_PREFERENCE_RE.test(turnText);
      const transactionPlan=/(?:покупк[а-яё]*\s+(?:планируется|будет)|планирует\s+(?:покупать|использовать)|нужн[а-яё]*\s+[^.!?;]{0,30}консультац)/i.test(preference)
        ||/(?:ипотек|рассроч)/i.test(preference)&&/(?:клиент\s+будет\s+брать|покупк[а-яё]*\s+(?:через|с\s+использованием)|оформ[а-яё]*\s+(?:через|с\s+использованием)|планир[а-яё]*)/i.test(preference);
      if(!soft&&transactionPlan){
        removedPreferences.push({preference,reason:'TRANSACTION_PLAN_IS_NOT_PREFERENCE'});return [];
      }
      const normalizedPreference=preferenceForRequirement(preference);
      if(normalizedPreference!==preference&&(/(?:бюджет|стоимост|цен|₽|руб|млн|миллион|тыс)/i.test(preference)||/метро/i.test(preference))){
        normalizedPreferences.push({from:preference,to:normalizedPreference});return [normalizedPreference];
      }
      return [preference];
    });
    const uniquePreferences=verifiedPreferences.filter((item,index,array)=>array.findIndex(candidate=>normalized(candidate)===normalized(item)||criterionScore(candidate,item)>=Math.max(2,Math.min(3,criterionTokens(item).length)))===index);
    needs.requirements=kept;needs.preferences=uniquePreferences;
    const changed=moved.length>0||removedRequirements.length>0||removedPreferences.length>0||normalizedPreferences.length>0;
    if(changed){
      result.decisions=result.decisions&&typeof result.decisions==='object'?result.decisions:{facts:'approve',needs:'approve',outcome:'approve'};
      result.decisions.needs='correct';
    }
    return {output:result,audit:{version:'v1.0.0',changed,reclassified:moved,removed_requirements:removedRequirements,removed_preferences:removedPreferences,normalized_preferences:normalizedPreferences}};
  }
  function cleanActionObject(value){
    const cleaned=text(value).replace(/^[,;:—–-]+\s*/,'').replace(/\s*(?:,|;|\sи|\sа|\sили)+\s*$/i,'').replace(/^(?:сейчас|тогда)\s+/i,'').trim();
    if(/^(?:и|а|или)$/.test(cleaned)) return '';
    return cleaned.replace(/^у\s+у\s+/i,'у ');
  }
  function actionDescriptors(value){
    const source=text(value),matches=[];
    ACTION_PATTERNS.forEach(([action,pattern])=>{
      const flags=pattern.flags.includes('g')?pattern.flags:pattern.flags+'g';
      for(const match of source.matchAll(new RegExp(pattern.source,flags))) matches.push({action,start:match.index,end:match.index+match[0].length,verb:match[0]});
    });
    matches.sort((left,right)=>left.start-right.start||right.end-left.end);
    const unique=matches.filter((item,index)=>index===0||item.start>=matches[index-1].end);
    return unique.map((item,index)=>({...item,object:cleanActionObject(source.slice(item.end,index+1<unique.length?unique[index+1].start:source.length))}));
  }
  function actionProfile(value){
    const actions=actionDescriptors(value);
    if(!actions.length) return {actions:[],primary_action:'',primary_object:'',communication_action:'none'};
    const primary=actions.find(item=>!COMMUNICATION_ACTIONS.includes(item.action))||actions[0];
    const communication=actions.slice().reverse().find(item=>COMMUNICATION_ACTIONS.includes(item.action));
    return {actions,primary_action:primary.action,primary_object:primary.object,communication_action:communication?communication.action:'none'};
  }
  function actionKind(value){
    const profile=actionProfile(value);
    if(profile.communication_action==='call') return 'phone';
    if(['write','send'].includes(profile.communication_action)) return 'message';
    if(profile.primary_action==='show') return 'meeting';
    if(profile.primary_action) return profile.primary_action==='other'?'contact':profile.primary_action;
    if(/(?:созвон)/.test(normalized(value))) return 'phone';
    if(/(?:встрет)/.test(normalized(value))) return 'meeting';
    return '';
  }
  function responsibleForTurn(turn){
    const key=normalized(turn.text);
    if(/(?:созвонимся|встретимся)/.test(key)) return 'both';
    if(/^\s*(?:клиент|покупатель)\b/.test(key)) return 'client';
    if(/^\s*(?:агент|менеджер)\b/.test(key)) return 'agent';
    if(/(?:\bвы\s+сам[аи]?\b|сможете|можете|могли\s+бы)/.test(key)) return oppositeRole(turn.role);
    return turn.role;
  }
  function confirmedResponsible(turn,candidate,responsible){
    if(responsible===candidate.role&&SCENARIO_ACCEPTANCE_RE.test(candidate.text)) return turn.role;
    return responsible;
  }
  function extractDeadline(value){
    const source=text(value);
    const range=source.match(/(?:в\s+течение\s+|через\s+)(\d{1,3})\s*[—–-]\s*(\dк|\d{1,3})(?:\s*(минут[а-яё]*|час[а-яё]*))?/i);
    if(range){
      const start=Number(range[1]),rawEnd=normalized(range[2]),end=/^\dк$/.test(rawEnd)?Number(rawEnd[0])*10:Number(rawEnd);
      const nearbyUnit=normalized(range[3]||source.slice(Math.max(0,range.index-28),range.index+range[0].length));
      const unit=/час/.test(nearbyUnit)?'часов':'минут';
      if(Number.isFinite(start)&&Number.isFinite(end)&&start>0&&end>=start) return `примерно через ${start}–${end} ${unit}`;
    }
    for(const pattern of DEADLINE_PATTERNS){const match=text(value).match(pattern);if(match){const result=text(match[0]).toLocaleLowerCase('ru-RU');return /сегодня/.test(result)&&/завтра/.test(result)?'сегодня или завтра':result;}}
    return '';
  }
  function channelEvidence(value,kind){
    const labels=CHANNEL_PATTERNS.filter(([,pattern])=>pattern.test(value)).map(([label])=>label);
    const unique=[...new Set(labels)];
    if(unique.length>1) return {value:'',status:'AMBIGUOUS',labels:unique};
    if(unique.length===1) return {value:unique[0],status:'SUPPORTED',labels:unique};
    if(kind==='phone') return {value:'телефон',status:'SUPPORTED',labels:['телефон']};
    return {value:'',status:'NOT_APPLICABLE',labels:[]};
  }
  function sameActionFamily(left,right){
    if(left===right) return true;
    return ['phone','message','contact','clarify'].includes(left)&&['phone','message','contact','clarify'].includes(right);
  }
  function repeatedCommitment(turns,index,kind,responsible){
    for(let priorIndex=index-1;priorIndex>=Math.max(0,index-8);priorIndex-=1){
      const prior=turns[priorIndex];if(prior.role==='operator') break;
      if(responsibleForTurn(prior)===responsible&&sameActionFamily(actionKind(prior.text),kind)) return true;
    }
    return false;
  }
  function acceptsScenario(candidate,turns,actionIndex,kind,responsible){
    if(CONFIRMATION_RE.test(candidate.text)||SCENARIO_ACCEPTANCE_RE.test(candidate.text)) return true;
    if((extractDeadline(candidate.text)||channelEvidence(candidate.text,'').status!=='NOT_APPLICABLE')&&!CANCELLATION_RE.test(candidate.text)) return true;
    return THANKS_RE.test(candidate.text)&&repeatedCommitment(turns,actionIndex,kind,responsible);
  }
  function confirmedEvents(transcript){
    const turns=parseTurns(transcript),events=[];
    turns.forEach((turn,index)=>{
      const profile=actionProfile(turn.text),kind=actionKind(turn.text);if(!kind||!turn.role) return;
      if(CONDITIONAL_ACTION_RE.test(turn.text)) return;
      let responsible=responsibleForTurn(turn);if(!responsible) return;
      let confirmationIndex=-1;
      for(let offset=1;offset<=3&&index+offset<turns.length;offset+=1){
        const candidate=turns[index+offset];
        const expected=responsible==='both'?oppositeRole(turn.role):responsible===turn.role?oppositeRole(turn.role):responsible;
        if(candidate.role&&candidate.role===expected){
          if(acceptsScenario(candidate,turns,index,kind,responsible)) confirmationIndex=index+offset;
          break;
        }
      }
      if(confirmationIndex<0) return;
      responsible=confirmedResponsible(turn,turns[confirmationIndex],responsible);
      const later=turns.slice(confirmationIndex+1);
      if(later.some(item=>CANCELLATION_RE.test(item.text))) return;
      const windowText=[turn.text,turns[confirmationIndex].text].join(' ');
      let primaryObject=profile.primary_object,evidence=[turn.text,turns[confirmationIndex].text];
      if(!primaryObject&&profile.primary_action){
        for(let priorIndex=index-1;priorIndex>=Math.max(0,index-12);priorIndex-=1){
          const prior=turns[priorIndex];if(prior.role==='operator') break;
          if(prior.role!==responsible) continue;
          const priorProfile=actionProfile(prior.text);
          if(priorProfile.primary_action===profile.primary_action&&priorProfile.primary_object){primaryObject=priorProfile.primary_object;evidence=[prior.text,...evidence];break;}
        }
      }
      let deadline=extractDeadline(windowText);
      if(!deadline){
        for(let trailingIndex=confirmationIndex+1;trailingIndex<=Math.min(turns.length-1,confirmationIndex+2);trailingIndex+=1){
          const trailing=turns[trailingIndex];
          if(trailing.role===responsible&&extractDeadline(trailing.text)){deadline=extractDeadline(trailing.text);evidence.push(trailing.text);break;}
          if(trailing.role&&trailing.role!==responsible) break;
        }
      }
      const nearbyStart=Math.max(0,index-12),nearbyText=turns.slice(nearbyStart,confirmationIndex+1).map(item=>item.text).join(' ');
      const channel=channelEvidence(nearbyText,kind);
      events.push({index,confirmationIndex,kind,responsible,primary_action:profile.primary_action||'other',primary_object:primaryObject,communication_action:profile.communication_action,actions:profile.actions.map(item=>item.action),deadline,channel:channel.value,channel_status:channel.status,channel_labels:channel.labels,evidence});
    });
    if(!events.length) return [];
    return events.map(event=>{
      let enriched=event;
      const previousConfirmed=events.filter(candidate=>candidate.confirmationIndex<=event.index).slice(-1)[0];
      const samePlan=Boolean(previousConfirmed&&previousConfirmed.responsible===event.responsible&&sameActionFamily(previousConfirmed.kind,event.kind)&&(previousConfirmed.actions.some(action=>event.actions.includes(action))||event.channel_labels.length));
      if(samePlan){
        const previousPrimaryIsBusiness=previousConfirmed.primary_action&&!COMMUNICATION_ACTIONS.includes(previousConfirmed.primary_action)&&previousConfirmed.primary_action!=='other';
        const eventPrimaryIsCommunication=COMMUNICATION_ACTIONS.includes(enriched.primary_action)||enriched.primary_action==='other';
        const mergedChannelLabels=[...new Set([...previousConfirmed.channel_labels,...enriched.channel_labels])];
        enriched={
          ...enriched,
          primary_action:previousPrimaryIsBusiness&&eventPrimaryIsCommunication?previousConfirmed.primary_action:enriched.primary_action,
          primary_object:previousPrimaryIsBusiness&&eventPrimaryIsCommunication?previousConfirmed.primary_object:enriched.primary_object,
          actions:[...new Set([...previousConfirmed.actions,...enriched.actions])],
          deadline:enriched.deadline||previousConfirmed.deadline,
          channel:mergedChannelLabels.length===1?mergedChannelLabels[0]:'',
          channel_status:mergedChannelLabels.length>1?'AMBIGUOUS':mergedChannelLabels.length===1?'SUPPORTED':'NOT_APPLICABLE',
          channel_labels:mergedChannelLabels,
          evidence:[...new Set([...previousConfirmed.evidence,...enriched.evidence])],
        };
      }
      const lowerBound=Math.max(previousConfirmed?previousConfirmed.confirmationIndex+1:0,event.index-12);
      for(let index=event.index-1;index>=lowerBound;index-=1){
        const prior=turns[index];if(prior.role==='operator') break;
        const kind=actionKind(prior.text);if(!kind) continue;
        const responsible=responsibleForTurn(prior),deadline=extractDeadline(prior.text);
        if(responsible!==event.responsible||!sameActionFamily(kind,event.kind)) continue;
        const priorProfile=actionProfile(prior.text),priorPrimaryIsBusiness=priorProfile.primary_action&&!COMMUNICATION_ACTIONS.includes(priorProfile.primary_action)&&priorProfile.primary_action!=='other';
        const eventPrimaryIsCommunication=COMMUNICATION_ACTIONS.includes(enriched.primary_action)||enriched.primary_action==='other';
        enriched={
          ...enriched,
          primary_action:priorPrimaryIsBusiness&&eventPrimaryIsCommunication?priorProfile.primary_action:enriched.primary_action,
          primary_object:priorPrimaryIsBusiness&&eventPrimaryIsCommunication?priorProfile.primary_object:enriched.primary_object,
          actions:[...new Set([...priorProfile.actions.map(item=>item.action),...enriched.actions])],
          deadline:enriched.deadline||deadline,
          evidence:enriched.evidence.includes(prior.text)?enriched.evidence:[prior.text,...enriched.evidence],
        };
        break;
      }
      return enriched;
    });
  }
  function declaredClientNextAction(transcript,events){
    const confirmedIndexes=new Set(events.filter(event=>event.responsible==='client').map(event=>event.index));
    return parseTurns(transcript).some((turn,index)=>turn.role==='client'&&DECLARED_CLIENT_ACTION_RE.test(turn.text)&&Boolean(actionKind(turn.text))&&!confirmedIndexes.has(index));
  }
  function canonicalAction(event){
    const party=event.responsible;
    const actor=party==='agent'?'Агент':party==='client'?'Клиент':'Клиент и агент';
    const target=party==='agent'?'клиенту':party==='client'?'агенту':'';
    const object=event.primary_object?' '+event.primary_object:'';
    const primaryVerbs={clarify:'уточнит',check:'проверит',coordinate:'согласует',select:'подберёт',request:'запросит',send:'отправит',call:'позвонит',write:'напишет',show:'покажет',other:'свяжется'};
    if(event.primary_action&&event.primary_action!==event.communication_action){
      const primary=actor+' '+(primaryVerbs[event.primary_action]||'выполнит действие')+object;
      if(event.communication_action==='call') return primary+' и '+(party==='both'?'стороны созвонятся':'перезвонит '+target);
      if(event.communication_action==='write') return primary+' и напишет '+target;
      if(event.communication_action==='send') return primary+' и отправит результат '+target;
      return primary;
    }
    if(event.kind==='phone') return party==='agent'?'Агент позвонит клиенту':party==='client'?'Клиент позвонит агенту':'Клиент и агент созвонятся';
    if(event.kind==='message') return party==='agent'?'Агент напишет клиенту':party==='client'?'Клиент напишет агенту':'Клиент и агент обменяются сообщениями';
    if(event.kind==='meeting') return party==='both'?'Клиент и агент встретятся':party==='agent'?'Агент проведёт встречу с клиентом':'Клиент встретится с агентом';
    return party==='agent'?'Агент свяжется с клиентом':party==='client'?'Клиент свяжется с агентом':'Клиент и агент свяжутся';
  }
  function canonicalOutcome(event,sourceCallResult){
    if(!event){
      const agreementClaim=/(?:согласован|договорил|договорен)/i.test(sourceCallResult||'')&&!/(?:не\s+(?:согласован|договорил|договорен)|договор[её]нност[а-яё]*\s+нет)/i.test(sourceCallResult||'');
      const unsupportedActionClaim=Boolean(actionKind(sourceCallResult))||agreementClaim;
      const callResult=unsupportedActionClaim
        ?'Просмотр не назначен; подтверждённой договорённости о следующем шаге нет'
        :text(sourceCallResult);
      return {call_result:callResult,agreement:'',next_step:'',responsible_party:'',deadline:'',channel:''};
    }
    const action=canonicalAction(event);
    return {
      call_result:'Согласовано дальнейшее действие: '+action.toLocaleLowerCase('ru-RU'),
      agreement:action,
      next_step:action,
      responsible_party:event.responsible,
      deadline:event.deadline,
      channel:event.channel,
    };
  }
  function sameCommunicationAction(left,right){return left===right||['write','send'].includes(left)&&['write','send'].includes(right);}
  function actionSupported(action,event){
    if(!event) return false;
    if(event.actions.includes(action)) return true;
    if(COMMUNICATION_ACTIONS.includes(action)&&sameCommunicationAction(action,event.communication_action)) return true;
    if(action==='other'&&['phone','message','contact'].includes(event.kind)) return true;
    return false;
  }
  function supportedActionClaim(value,event){
    const source=text(value),actions=actionDescriptors(source);
    if(!source) return {status:'NOT_APPLICABLE',value:'',changed:false,removed_actions:[]};
    if(!actions.length) return {status:'NOT_SUPPORTED',value:'',changed:true,removed_actions:[]};
    const supported=actions.filter(item=>actionSupported(item.action,event));
    const unsupported=actions.filter(item=>!actionSupported(item.action,event));
    if(!supported.length) return {status:'NOT_SUPPORTED',value:'',changed:true,removed_actions:unsupported.map(item=>item.action)};
    if(!unsupported.length) return {status:'SUPPORTED',value:source,changed:false,removed_actions:[]};
    const prefix=text(source.slice(0,actions[0].start));
    const phrases=supported.map(item=>{
      const index=actions.indexOf(item),next=actions[index+1];
      let phrase=text(source.slice(item.start,next?next.start:source.length)).replace(/[\s,;]+(?:и|а)?\s*$/i,'').replace(/[.!?]+$/,'');
      if(item.action==='call'&&event&&event.responsible!=='both'&&!/(?:клиент|агент|вам|вас|тебе)/i.test(phrase)) phrase+=' '+(event.responsible==='agent'?'клиенту':'агенту');
      return phrase;
    }).filter(Boolean);
    const filtered=text((prefix?prefix+' ':'')+phrases.join(' и '));
    return {status:'SUPPORTED',value:filtered,changed:true,removed_actions:unsupported.map(item=>item.action)};
  }
  function supportStatus(value,supported){return text(value)?(supported?'SUPPORTED':'NOT_SUPPORTED'):'NOT_APPLICABLE';}
  function deadlineCompatible(left,right){
    const first=normalized(left),second=normalized(right);
    if(!first||!second) return false;
    if(first===second) return true;
    if(first.replace(/^(?:в|во)\s+/,'')===second.replace(/^(?:в|во)\s+/,'')) return true;
    const weekday=value=>{
      const match=value.match(/(?:понедельник|вторник|сред[ау]|четверг|пятниц[ау]|суббот[ау]|воскресенье)/);
      return match?match[0].replace(/среду/,'среда').replace(/пятницу/,'пятница').replace(/субботу/,'суббота'):'';
    };
    if(weekday(first)&&weekday(first)===weekday(second)) return true;
    const firstNumbers=first.match(/\d+/g)||[],secondNumbers=second.match(/\d+/g)||[];
    const elapsedFirst=/(?:через|в течение)/.test(first),elapsedSecond=/(?:через|в течение)/.test(second);
    return elapsedFirst&&elapsedSecond&&firstNumbers.some(value=>secondNumbers.includes(value));
  }
  function safeDeadlineValue(claim,eventDeadline){
    const claimed=text(claim),evidence=text(eventDeadline);
    if(!claimed||!evidence||!deadlineCompatible(claimed,evidence)) return claimed;
    const evidenceNumbers=evidence.match(/\d+/g)||[],claimNumbers=claimed.match(/\d+/g)||[];
    const evidenceApproximate=/примерно|около|приблизительно|\d\s*[—–-]\s*\d/i.test(evidence);
    const claimNarrowsEvidence=evidenceApproximate&&(claimNumbers.length<evidenceNumbers.length||!/примерно|около|приблизительно|\d\s*[—–-]\s*\d/i.test(claimed));
    return claimNarrowsEvidence?evidence:claimed;
  }
  function applySafeDeadlinePrecision(value,event){
    const source=text(value),evidence=text(event&&event.deadline),claim=extractDeadline(source);
    if(!source||!evidence||!claim||safeDeadlineValue(claim,evidence)===claim) return source;
    return text(source.replace(/(?:в\s+течение|через)\s+\d{1,3}(?:\s*[—–-]\s*\d{1,3})?\s*(?:минут[а-яё]*|час[а-яё]*)?/i,evidence));
  }
  function sameChannel(left,right){
    const canonical=value=>{const key=normalized(value);if(/whats\s*app|ватсап|вотсап/.test(key)) return 'whatsapp';if(/telegram|телеграм/.test(key)) return 'telegram';if(/(?:^|\s)(?:max|макс(?:е|а|ом)?)(?:\s|$)/.test(key)) return 'max';if(/телефон|звон|phone/.test(key)) return 'телефон';if(/e-?mail|почт/.test(key)) return 'email';return key;};
    return Boolean(canonical(left)&&canonical(left)===canonical(right));
  }
  function preferredNextStep(verified,extracted,deadline,events){
    const judgeValue=text(verified),sourceValue=text(extracted);
    if(!judgeValue) return sourceValue;
    if(!sourceValue) return judgeValue;
    const judgeEvent=eventForClaim(judgeValue,events||[],null),sourceEvent=eventForClaim(sourceValue,events||[],null);
    if(judgeEvent&&sourceEvent&&judgeEvent.index>sourceEvent.index) return judgeValue;
    if(judgeEvent&&!sourceEvent) return judgeValue;
    if(text(deadline)&&deadlineCompatible(sourceValue,deadline)&&!deadlineCompatible(judgeValue,deadline)) return sourceValue;
    const judgeActions=actionDescriptors(judgeValue).map(item=>item.action),sourceActions=actionDescriptors(sourceValue).map(item=>item.action);
    if(sourceActions.some(action=>!judgeActions.some(candidate=>candidate===action||COMMUNICATION_ACTIONS.includes(action)&&sameCommunicationAction(action,candidate)))) return sourceValue;
    return judgeValue;
  }
  function eventScoreForClaim(value,event){
    const actions=actionDescriptors(value).map(item=>item.action);
    if(!actions.length) return 0;
    const supported=actions.filter(action=>actionSupported(action,event)).length;
    if(!supported) return 0;
    const deadline=extractDeadline(value);
    return supported*10+(deadline&&event.deadline&&deadlineCompatible(deadline,event.deadline)?3:0);
  }
  function eventForClaim(value,events,fallback){
    let selected=null,best=0;
    events.forEach(event=>{const score=eventScoreForClaim(value,event);if(score>=best&&score>0){selected=event;best=score;}});
    return selected||fallback||null;
  }
  function eventForAgreementClaim(value,events,fallback){
    const actions=actionDescriptors(value),firstAction=actions[0];
    if(actions.length>1&&firstAction){
      const firstEvent=events.find(event=>actionSupported(firstAction.action,event));
      if(firstEvent) return firstEvent;
    }
    return eventForClaim(value,events,fallback);
  }
  function supportedAgreementClaim(value,events,fallback){
    const source=text(value),actions=actionDescriptors(source);
    if(!source||actions.length<2) return supportedActionClaim(source,eventForClaim(source,events,fallback));
    const allSupported=actions.every(item=>events.some(event=>actionSupported(item.action,event)));
    return allSupported?{status:'SUPPORTED',value:source,changed:false,removed_actions:[]}:supportedActionClaim(source,eventForClaim(source,events,fallback));
  }
  function preferredClaim(verified,extracted,events){
    const judgeValue=text(verified),sourceValue=text(extracted);
    if(!judgeValue) return sourceValue;
    if(!sourceValue) return judgeValue;
    const coverage=value=>new Set(actionDescriptors(value).map(item=>item.action).filter(action=>events.some(event=>actionSupported(action,event)))).size;
    const judgeCoverage=coverage(judgeValue),sourceCoverage=coverage(sourceValue);
    if(sourceCoverage>judgeCoverage) return sourceValue;
    if(judgeCoverage>sourceCoverage) return judgeValue;
    const bestScore=value=>events.reduce((score,event)=>Math.max(score,eventScoreForClaim(value,event)),0);
    const judgeScore=bestScore(judgeValue),sourceScore=bestScore(sourceValue);
    if(sourceScore>judgeScore||sourceScore===judgeScore&&sourceValue.length>judgeValue.length) return sourceValue;
    return judgeValue;
  }
  function validateConversationJudge(output,input){
    const result=clone(output)||{},source=clone(input&&input.outcomeExtractor)||{},transcript=String(input&&input.transcript||'');
    const events=confirmedEvents(transcript),lastEvent=events.length?events[events.length-1]:null;
    const sourceCore=FIELD_NAMES.some(field=>text(source[field]));
    const before=clone(result.verified_outcome)||{};
    const agreementValue=preferredClaim(before.agreement,source.agreement,events);
    const nextStepValue=preferredNextStep(before.next_step,source.next_step,before.deadline||source.deadline,events);
    const agreementEvent=eventForAgreementClaim(agreementValue,events,lastEvent);
    const nextStepEvent=eventForClaim(nextStepValue,events,lastEvent);
    const event=nextStepEvent||agreementEvent||lastEvent;
    const agreementClaim=supportedAgreementClaim(agreementValue,events,agreementEvent);
    const nextStepClaim=supportedActionClaim(nextStepValue,nextStepEvent);
    const hasClaim=Boolean(agreementValue||nextStepValue);
    const agreementSupported=Boolean(agreementEvent&&agreementClaim.status==='SUPPORTED');
    const nextStepSupported=Boolean(nextStepEvent&&nextStepClaim.status==='SUPPORTED');
    const eventSupportsClaim=Boolean(event&&(!hasClaim||agreementSupported||nextStepSupported));
    const responsibleClaimValue=text(before.responsible_party||source.responsible_party);
    const deadlineClaimValue=text(before.deadline||source.deadline);
    const channelClaimValue=text(before.channel||source.channel);
    const responsibleValue=responsibleClaimValue||eventSupportsClaim&&event&&event.responsible||'';
    const deadlineValue=safeDeadlineValue(deadlineClaimValue||eventSupportsClaim&&event&&event.deadline||'',event&&event.deadline);
    const channelValue=channelClaimValue||eventSupportsClaim&&event&&event.channel||'';
    const channelStatus=!channelValue?'NOT_APPLICABLE':!eventSupportsClaim||!event?'NOT_SUPPORTED':event.channel_status==='AMBIGUOUS'?'AMBIGUOUS':event.channel&&sameChannel(event.channel,channelValue)?'SUPPORTED':'NOT_SUPPORTED';
    const statuses={
      agreement:agreementClaim.status,
      next_step:nextStepClaim.status,
      responsible_party:supportStatus(responsibleValue,eventSupportsClaim&&Boolean(event&&event.responsible===responsibleValue)),
      deadline:supportStatus(deadlineValue,eventSupportsClaim&&Boolean(event&&event.deadline&&deadlineCompatible(event.deadline,deadlineValue))),
      channel:channelStatus,
    };
    if(eventSupportsClaim){
      const recovered=!hasClaim;
      const recoveryOutcome=recovered?canonicalOutcome(event,before.call_result||source.call_result):null;
      const beforeCallResult=text(before.call_result),sourceCallResult=text(source.call_result);
      const beforeDeniesAgreement=/(?:не\s+(?:назначен|согласован)|договор[её]нност[а-яё]*\s+нет|нет\s+договор)/i.test(beforeCallResult);
      const sourceAffirmsAgreement=/(?:согласован|договорил|договорен)/i.test(sourceCallResult)&&!/(?:не\s+(?:назначен|согласован)|договор[её]нност[а-яё]*\s+нет|нет\s+договор)/i.test(sourceCallResult);
      const callResultSource=text(agreementSupported&&beforeDeniesAgreement&&sourceAffirmsAgreement?sourceCallResult:beforeCallResult||sourceCallResult);
      const callResultClaim=actionDescriptors(callResultSource).length?supportedActionClaim(callResultSource,event):{status:'SUPPORTED',value:callResultSource,changed:false,removed_actions:[]};
      result.verified_outcome={
        call_result:callResultClaim.status==='SUPPORTED'?callResultClaim.value:recoveryOutcome&&recoveryOutcome.call_result||canonicalOutcome(null,callResultSource).call_result,
        agreement:recovered?recoveryOutcome.agreement:applySafeDeadlinePrecision(agreementClaim.value,agreementEvent),
        next_step:recovered?recoveryOutcome.next_step:applySafeDeadlinePrecision(nextStepClaim.value,nextStepEvent),
        responsible_party:recovered?recoveryOutcome.responsible_party:statuses.responsible_party==='SUPPORTED'?responsibleValue:'',
        deadline:recovered?recoveryOutcome.deadline:statuses.deadline==='SUPPORTED'?deadlineValue:'',
        channel:recovered?recoveryOutcome.channel:statuses.channel==='SUPPORTED'&&event&&event.channel?event.channel:statuses.channel==='SUPPORTED'?channelValue:'',
      };
    }else result.verified_outcome=canonicalOutcome(null,source.call_result||before.call_result);
    result.decisions=result.decisions&&typeof result.decisions==='object'?result.decisions:{facts:'approve',needs:'approve',outcome:'approve'};
    const changed=JSON.stringify(before)!==JSON.stringify(result.verified_outcome);
    if(changed) result.decisions.outcome='correct';
    const declaredClientAction=declaredClientNextAction(transcript,events);
    const issues=Array.isArray(result.issues)?result.issues.filter(item=>typeof item==='string'&&!item.includes(RECOVERY_REASON)&&!/^OUTCOME_(?:AGREEMENT|NEXT_STEP|RESPONSIBLE_PARTY|DEADLINE|CHANNEL)\s*:/i.test(item)&&item!== 'CLIENT_DECLARED_NEXT_ACTION'):[];
    FIELD_NAMES.forEach(field=>{if((text(before[field])||text(source[field]))&&['NOT_SUPPORTED','AMBIGUOUS'].includes(statuses[field])) issues.push('OUTCOME_'+field.toUpperCase()+': '+statuses[field]);});
    const recovered=Boolean(eventSupportsClaim&&!sourceCore);
    if(recovered) issues.push(RECOVERY_REASON);
    if(declaredClientAction&&!event) issues.push('CLIENT_DECLARED_NEXT_ACTION');
    result.issues=[...new Set(issues)];
    const needsChecked=validateRequirementPreferences(result,{transcript,needsExtractor:input&&input.needsExtractor});
    Object.assign(result,needsChecked.output);
    const eventAudit=value=>value?{primary_action:value.primary_action,primary_object:value.primary_object,communication_action:value.communication_action,responsible_party:value.responsible,deadline:value.deadline,channel:value.channel,channel_status:value.channel_status,channel_labels:value.channel_labels,evidence:value.evidence}:null;
    return {output:result,audit:{implementation_version:IMPLEMENTATION_VERSION,fields:statuses,reasons:declaredClientAction&&!event?['CLIENT_DECLARED_NEXT_ACTION']:[],recovery_reason:recovered?RECOVERY_REASON:null,event:eventAudit(event),agreement_event:eventAudit(agreementEvent),next_step_event:eventAudit(nextStepEvent),removed_actions:{agreement:agreementClaim.removed_actions,next_step:nextStepClaim.removed_actions},changed,requirement_preference:needsChecked.audit}};
  }
  function summaryText(summary){return [summary&&summary.conversation_result,...(Array.isArray(summary&&summary.key_facts)?summary.key_facts:[]),...(Array.isArray(summary&&summary.quotes)?summary.quotes:[]),summary&&summary.next_step].map(item=>typeof item==='string'?item:item&&item.value||item&&item.text||'').join(' ');}
  function hasAffirmativeAgreement(value){
    const key=normalized(value);
    if(!/(?:согласован|договорил|договорен)/.test(key)) return false;
    return !/(?:не[^.!?]{0,40}(?:согласован|договорил|договорен)|(?:договоренност|договорен)[^.!?]{0,24}(?:нет|отсутств)|нет[^.!?]{0,24}(?:договор|согласован))/.test(key);
  }
  function applySummaryJudgeEvidence(output,input){
    const result=clone(output)||{},summary=clone(input&&input.summary)||{},cleanOutcome=clone(input&&input.cleanOutcome)||{},judge={verified_outcome:cleanOutcome,verified_facts:[],verified_quotes:[],verified_needs:{primary_need:'',requirements:[],preferences:[],objections:[],unresolved_questions:[]},decisions:{facts:'approve',needs:'approve',outcome:'approve'},issues:[]};
    const checked=validateConversationJudge(judge,{transcript:input&&input.transcript,outcomeExtractor:input&&input.outcomeExtractor});
    const supported=checked.output.verified_outcome,visible=summaryText(summary),next=text(summary.next_step),reasons=[];
    const supportedActions=actionDescriptors(supported.next_step).map(item=>item.action);
    const summaryActions=actionDescriptors(next).map(item=>item.action);
    const actionInList=(action,list)=>list.some(candidate=>candidate===action||COMMUNICATION_ACTIONS.includes(action)&&sameCommunicationAction(action,candidate));
    const extraActions=summaryActions.filter(action=>!actionInList(action,supportedActions));
    const missingActions=supportedActions.filter(action=>!actionInList(action,summaryActions));
    let severity=100;

    if(next&&!text(supported.next_step)){reasons.push('UNSUPPORTED_NEXT_STEP');severity=25;}
    if((hasAffirmativeAgreement(visible)||text(cleanOutcome.agreement))&&!text(supported.agreement)&&next){reasons.push('UNSUPPORTED_AGREEMENT');severity=25;}
    if(extraActions.length){reasons.push('UNSUPPORTED_NEXT_STEP');severity=25;}
    if(text(supported.next_step)&&(!next||missingActions.length)){reasons.push('MISSING_CONFIRMED_NEXT_STEP');severity=Math.min(severity,50);}
    if(text(supported.agreement)&&!next&&!hasAffirmativeAgreement(visible)){reasons.push('MISSING_CONFIRMED_AGREEMENT');severity=Math.min(severity,50);}

    const summaryDeadline=extractDeadline(next);
    if(summaryDeadline&&!text(supported.deadline)){reasons.push('UNSUPPORTED_DEADLINE');severity=Math.min(severity,75);}
    else if(text(supported.deadline)&&!summaryDeadline){reasons.push('MISSING_DEADLINE');severity=Math.min(severity,75);}
    else if(summaryDeadline&&text(supported.deadline)&&!deadlineCompatible(summaryDeadline,supported.deadline)){reasons.push('UNSUPPORTED_DEADLINE');severity=Math.min(severity,75);}

    const summaryChannel=channelEvidence(next,actionKind(next));
    if(summaryChannel.status==='AMBIGUOUS'){reasons.push('UNSUPPORTED_CHANNEL');severity=Math.min(severity,75);}
    else if(summaryChannel.value&&!text(supported.channel)){reasons.push('UNSUPPORTED_CHANNEL');severity=Math.min(severity,75);}
    else if(text(supported.channel)&&!summaryChannel.value){reasons.push('MISSING_CHANNEL');severity=Math.min(severity,75);}
    else if(summaryChannel.value&&text(supported.channel)&&!sameChannel(summaryChannel.value,supported.channel)){reasons.push('UNSUPPORTED_CHANNEL');severity=Math.min(severity,75);}

    const summaryResponsible=/^агент(?:\s|$)/i.test(next)?'agent':/^клиент(?:\s|$)/i.test(next)?'client':'';
    if(summaryResponsible&&!text(supported.responsible_party)){reasons.push('UNSUPPORTED_RESPONSIBLE_PARTY');severity=Math.min(severity,75);}
    else if(text(supported.responsible_party)&&!summaryResponsible){reasons.push('MISSING_RESPONSIBLE_PARTY');severity=Math.min(severity,75);}
    else if(summaryResponsible&&summaryResponsible!==supported.responsible_party){reasons.push('UNSUPPORTED_RESPONSIBLE_PARTY');severity=Math.min(severity,75);}

    const unique=[...new Set(reasons)];
    if(result.scores&&typeof result.scores==='object'){
      result.scores.agreements_next_step=severity;
      const values=['faithfulness','completeness','usefulness','agreements_next_step','format'].map(key=>Number(result.scores[key])||0);
      result.quality_score=values.reduce((sum,value)=>sum+value,0)/values.length;
      const otherCritical=Number(result.scores.faithfulness)<=25||result.quality_score<75;
      result.decision=otherCritical||severity<=25?'fail':severity<100||result.quality_score<90||values.some(value=>value===50)?'warning':'pass';
      const evidenceCodes=/^(?:UNSUPPORTED|MISSING)_(?:AGREEMENT|NEXT_STEP|CONFIRMED_AGREEMENT|CONFIRMED_NEXT_STEP|RESPONSIBLE_PARTY|DEADLINE|CHANNEL)\b/;
      const existing=Array.isArray(result.issues)?result.issues.filter(item=>typeof item==='string'&&!evidenceCodes.test(item)):[];
      result.issues=[...new Set([...existing,...unique.map(code=>code+': agreements_next_step evidence severity '+severity)])];
    }
    return {output:result,audit:{implementation_version:IMPLEMENTATION_VERSION,reasons:unique,severity,validated_outcome:supported,field_statuses:checked.audit.fields,critical:severity<=25}};
  }

  const SUMMARY_CHANNEL_PATTERNS=[
    ['WhatsApp',/(?:\s+(?:в|через|по)\s+)?(?:whats\s*app|ватсап|вотсап)/gi],
    ['Telegram',/(?:\s+(?:в|через|по)\s+)?(?:telegram|телеграм)/gi],
    ['MAX',/(?:\s+(?:в|через|по)\s+)?(?:max|макс(?:е|а|ом)?)(?=$|[\s,.;:!?])/gi],
    ['email',/(?:\s+(?:на|через|по)\s+)?(?:e-?mail|электронн[а-яё]*\s+почт[а-яё]*)/gi],
    ['телефон',/(?:\s+по\s+)?телефон(?:у|ом)?(?=$|[\s,.;:!?])/gi],
  ];
  function sanitizeSummaryGenerator(output,input){
    const result=clone(output)||{},outcome=clone(input&&input.cleanOutcome)||{},cleanNeeds=clone(input&&input.cleanNeeds)||{},supportedChannel=text(outcome.channel),source=text(result.next_step);
    const removed=[];let next=source;
    SUMMARY_CHANNEL_PATTERNS.forEach(([channel,pattern])=>{
      pattern.lastIndex=0;
      if(supportedChannel&&sameChannel(channel,supportedChannel)||!pattern.test(next)) return;
      removed.push(channel);pattern.lastIndex=0;next=next.replace(pattern,'');
    });
    next=text(next.replace(/\s+(?:или|либо)\s*([,.;:!?]|$)/gi,'$1').replace(/\s+([,.;:!?])/g,'$1').replace(/([,;:])(?=[.!?]|$)/g,'').replace(/\(\s*\)/g,'')).replace(/\s+([.?!])$/,'$1');
    if(source&&!text(outcome.next_step)) next='';
    result.next_step=next;
    const preferences=Array.isArray(cleanNeeds.preferences)?cleanNeeds.preferences.map(text).filter(Boolean):[];
    const requirementRewrites=[];
    const sanitizePreferenceClaim=value=>{
      const sourceValue=text(value);
      if(!sourceValue||!/(?:обязательн[а-яё]*|ж[её]стк[а-яё]*\s+требован[а-яё]*|критичн[а-яё]*\s+требован[а-яё]*)/i.test(sourceValue)) return sourceValue;
      const preference=preferences.find(item=>criterionScore(item,sourceValue)>=Math.max(1,Math.min(2,criterionTokens(item).length)));
      if(!preference) return sourceValue;
      const replacement=/^(?:обязательн[а-яё]*|ж[её]стк[а-яё]*|критичн[а-яё]*)\s+требован[а-яё]*\s*[-—:]?/i.test(sourceValue)
        ?preference
        :text(sourceValue.replace(/обязательн[а-яё]*\s+требован[а-яё]*\s*[-—:]?/i,'предпочтительно'));
      requirementRewrites.push({from:sourceValue,to:replacement});return replacement;
    };
    result.conversation_result=sanitizePreferenceClaim(result.conversation_result);
    if(Array.isArray(result.key_facts)) result.key_facts=result.key_facts.map(sanitizePreferenceClaim);
    const changed=source!==next||requirementRewrites.length>0;
    return {output:result,audit:{implementation_version:IMPLEMENTATION_VERSION,policy:'OUTCOME_CHANNEL_AND_REQUIREMENT_PREFERENCE_ISOLATION',supported_channel:supportedChannel,removed_channels:[...new Set(removed)],requirement_preference_version:'v1.0.0',requirement_rewrites:requirementRewrites,changed}};
  }

  global.__AI_SUMMARY_10_08_CONVERSATION_JUDGE_V5__=Object.freeze({
    implementationVersion:IMPLEMENTATION_VERSION,
    recoveryReason:RECOVERY_REASON,
    conversationJudgeMarker:CONVERSATION_JUDGE_MARKER,
    conversationJudgeMarkerPrefix:CONVERSATION_JUDGE_MARKER_PREFIX,
    summaryJudgeMarker:SUMMARY_JUDGE_MARKER,
    summaryGeneratorMarker:SUMMARY_GENERATOR_MARKER,
    needsRequirementPreferenceMarker:NEEDS_REQUIREMENT_PREFERENCE_MARKER,
    judgeRequirementPreferenceMarker:JUDGE_REQUIREMENT_PREFERENCE_MARKER,
    summaryRequirementPreferenceMarker:SUMMARY_REQUIREMENT_PREFERENCE_MARKER,
    conversationJudgeAppendix,
    summaryJudgeAppendix,
    summaryGeneratorAppendix,
    needsRequirementPreferenceAppendix,
    judgeRequirementPreferenceAppendix,
    summaryRequirementPreferenceAppendix,
    parseTurns,
    confirmedEvents,
    validateRequirementPreferences,
    validateConversationJudge,
    applySummaryJudgeEvidence,
    sanitizeSummaryGenerator,
  });
})(typeof window!=='undefined'?window:globalThis);
