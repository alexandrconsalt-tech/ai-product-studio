(function(global){
  'use strict';

  const CONTRACT_ID='ai_summary_10_08_clean_conversation_store';
  const CONTRACT_VERSION='v1';
  const SCHEMA_ID='ai_summary_10_08_clean_conversation_store_v1';
  const IMPLEMENTATION_VERSION='v4';
  const DECISIONS=['approve','correct','reject','technical_error'];
  const RESPONSIBLE_PARTIES=['agent','client','operator','both',''];
  const OUTPUT_SCHEMA={
    type:'object',additionalProperties:false,
    required:['facts','quotes','needs','outcome','cleaning','source_decisions','status'],
    properties:{
      facts:{type:'array',items:{type:'object',additionalProperties:false,required:['fact','evidence'],properties:{fact:{type:'string'},evidence:{type:'string'}}}},
      quotes:{type:'array',items:{type:'string'}},
      needs:{type:'object',additionalProperties:false,required:['primary_need','requirements','preferences','objections','unresolved_questions'],properties:{
        primary_need:{type:'string'},requirements:{type:'array',items:{type:'string'}},preferences:{type:'array',items:{type:'string'}},objections:{type:'array',items:{type:'string'}},unresolved_questions:{type:'array',items:{type:'string'}}
      }},
      outcome:{type:'object',additionalProperties:false,required:['call_result','agreement','next_step','responsible_party','deadline','channel'],properties:{
        call_result:{type:'string'},agreement:{type:'string'},next_step:{type:'string'},responsible_party:{type:'string',enum:RESPONSIBLE_PARTIES},deadline:{type:'string'},channel:{type:'string'}
      }},
      cleaning:{type:'object',additionalProperties:false,required:['removed_items','deduplicated_items','normalizations','warnings'],properties:{
        removed_items:{type:'array',items:{type:'string'}},deduplicated_items:{type:'array',items:{type:'string'}},normalizations:{type:'array',items:{type:'string'}},warnings:{type:'array',items:{type:'string'}}
      }},
      source_decisions:{type:'object',additionalProperties:false,required:['facts','needs','outcome'],properties:{
        facts:{type:'string',enum:DECISIONS},needs:{type:'string',enum:DECISIONS},outcome:{type:'string',enum:DECISIONS}
      }},
      status:{type:'string',enum:['READY','PARTIAL_READY','TECHNICAL_ERROR']}
    }
  };

  function text(value){return typeof value==='string'?value.trim().replace(/\s+/g,' '):'';}
  function normalizedText(value,path,audit){
    const normalized=text(value);
    if(typeof value==='string'&&value!==normalized) audit.normalizations.push(path+': WHITESPACE_NORMALIZED');
    return normalized;
  }
  function compareKey(value){return text(value).toLocaleLowerCase('ru-RU');}
  function technicalOutput(reason){
    return {
      facts:[],quotes:[],
      needs:{primary_need:'',requirements:[],preferences:[],objections:[],unresolved_questions:[]},
      outcome:{call_result:'',agreement:'',next_step:'',responsible_party:'',deadline:'',channel:''},
      cleaning:{removed_items:[],deduplicated_items:[],normalizations:[],warnings:[reason]},
      source_decisions:{facts:'technical_error',needs:'technical_error',outcome:'technical_error'},
      status:'TECHNICAL_ERROR'
    };
  }

  function validateProvenance(input){
    const current=input&&input.current||{};
    const provenance=input&&input.provenance||{};
    const outputPresent=Boolean(input&&input.conversationJudge&&typeof input.conversationJudge==='object');
    const fields=['run_id','transcript_hash','pipeline_configuration_hash'];
    const mismatches=fields.filter(field=>!String(current[field]||'')||String(provenance[field]||'')!==String(current[field]||''));
    return {
      valid:outputPresent&&mismatches.length===0,
      source:'conversation_judge',
      output_present:outputPresent,
      expected:Object.fromEntries(fields.map(field=>[field,String(current[field]||'')])),
      actual:Object.fromEntries(fields.map(field=>[field,provenance[field]||null])),
      issues:[...(!outputPresent?['conversation_judge: OUTPUT_REQUIRED']:[]),...mismatches.map(field=>'conversation_judge: '+field.toUpperCase()+'_MISMATCH')]
    };
  }

  const PHONE_RE=/(?:\+?7|8)[\s(.-]*\d{3}[\s).-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}/i;
  const URL_RE=/(?:https?:\/\/|www\.)\S+|\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)+(?:\/\S*)?/i;
  const EMAIL_RE=/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const OBJECT_CODE_RE=/^(?:код|id|номер)\s+(?:объекта|объявления|лота)\s*[:№#-]?\s*[a-zа-я0-9_-]+$/i;
  const OBJECT_CODE_CONTEXT_RE=/(?:код(?:\s*\/\s*идентификатор)?|идентификатор|id|номер)\s+(?:объекта|объявления|лота)/i;
  const ADDRESS_SIGNAL_RE=/(?:(?:улица|ул\.?|проспект|пр\.?|проезд|переулок|пер\.?|набережная|наб\.?|шоссе|дом|д\.?|корпус|корп\.?|строение|стр\.?)|\d+[\/-]\d+)/i;
  const STRONG_ADDRESS_RE=/(?:(?:улица|ул\.?|проспект|пр\.?|проезд|переулок|пер\.?|набережная|наб\.?|шоссе)[^,;]*,?\s*\d+(?:[\/-]\d+)?|\d+[\/-]\d+)/i;
  const ADDRESS_PREFIX_RE=/^(?:клиент(?:а|у)?\s+(?:заинтересован|интересует|интересуется)\s+(?:(?:в\s+)?(?:объект(?:ом|е)?|квартир[а-яё]*)\s+по\s+адресу|конкретным\s+объектом)|квартир[а-яё]*\s+находится\s+по\s+адресу|адрес\s+(?:объекта|квартиры)|объект\s+по\s+адресу)\s*:?\s*/i;
  const OBJECT_INTEREST_PREFIX_RE=/^клиент(?:а|у)?\s+(?:заинтересован|интересует|интересуется)\s+(?:в\s+)?(?:конкретн(?:ым|ом)\s+)?объект(?:ом|е)?(?:\s+(?:по\s+адресу|в))?(?=\s|:|,|—|$)/i;
  const BUSINESS_MEANING_RE=/(?:готов|бюджет|услови|снижени|покуп|ипотек|рассроч|требован|предпоч|возраж|вопрос|срок|необходим|нужен|нужна|нужно)/i;
  const LISTING_SOURCE_RE=/^(?:клиент\s+(?:увидел|наш[её]л)\s+объявление\s+(?:на|в)\s+(?:сайте\s+)?|источник\s+объявления\s*[—:-]?\s*|клиент\s+звонит\s+(?:с|из)\s+(?:сайта\s+)?)/i;
  const STT_META_RE=/(?:транскрипц[а-яё]*\s+поврежд[её]н[а-яё]*|stt\s+поврежд[её]н[а-яё]*|(?:сумм|цен|числ)[а-яё]*[^.]{0,80}поврежд[её]н[а-яё]*|значени[а-яё]*\s+(?:в\s+(?:транскрипц|запис)[а-яё]*\s+)?(?:неоднознач|нечитабельн)[а-яё]*|запис[а-яё]*[^.]{0,40}нечитабельн[а-яё]*|числ[а-яё]*\s+не\s+распознан[а-яё]*|значени[а-яё]*\s+не\s+нормализован[а-яё]*|невозможн[а-яё]*\s+восстановить\s+(?:цен|числ))/i;
  const OBJECT_PRICE_RE=/(?:цен[ауы]|стоимост[ьи]?|за)\s*(?:текущ[а-яё]*\s+)?(?:объект[а-яё]*|квартир[а-яё]*|дом[а-яё]*|лот[а-яё]*|объявлен[а-яё]*)?\s*(?:составляет|указан[а-яё]*|объявлен[а-яё]*|—|:|как)?\s*[«"]?\d[\d\s.,]{2,}(?:₽|руб|млн|тыс)?/i;
  const OBJECT_PRICE_CONTEXT_RE=/(?:текущ[а-яё]*\s+объект|объект[а-яё]*|квартир[а-яё]*|дом[а-яё]*|лот[а-яё]*|объявлен[а-яё]*|выставлен[а-яё]*|агент\s+назвал|оператор\s+назвал)/i;
  const OBJECT_PRICE_WITHOUT_VALUE_RE=/(?:уточн[а-яё]*[^.]{0,60}(?:объявлен[а-яё]*[^.]{0,30})?(?:цен[уы]|стоимост[ьи])|(?:цен[ауы]|стоимост[ьи])[^.]{0,50}(?:объект|квартир|объявлен))/i;
  const PRIMARY_OBJECT_PRICE_RE=/(?:конкретн[а-яё]*\s+объект[а-яё]*[^.]{0,60}(?:цен[ауы]|стоимост[ьи])|(?:цен[ауы]|стоимост[ьи])[^.]{0,60}конкретн[а-яё]*\s+объект)/i;
  const CLIENT_FINANCE_RE=/(?:бюджет|первоначальн[а-яё]*\s+взнос|собственн[а-яё]*\s+средств|располагает|готов[а-яё]*\s+(?:потратить|вложить)|максимальн[а-яё]*\s+сумм|финансов[а-яё]*\s+огранич)/i;
  const OBJECT_LOCATION_RE=/^(?:(?:текущ[а-яё]*\s+)?(?:объект|квартир[а-яё]*|дом|лот)\s*(?:находится|расположен[а-яё]*|выставлен[а-яё]*|:|—)|локаци[яи]\s+(?:объекта|квартиры)|(?:клиент[а-яё]*\s+)?интересует\s+(?:объект|квартир[а-яё]*)\s+в)\s*[^.]{0,120}(?:жк\s+|пос[её]лок|район|область|город|санкт-петербург|москва)/i;
  const CURRENT_OBJECT_LOCATION_FACT_RE=/(?:клиент[а-яё]*\s+)?(?:заинтересован[а-яё]*|интересуется)[^.]{0,80}(?:конкретн[а-яё]*\s+)?(?:выставлен[а-яё]*\s+)?(?:квартир[а-яё]*|объект[а-яё]*)\s+в\s+[А-ЯЁ][а-яё-]+/;
  const AGENT_NAME_RE=/(?:объект\s+(?:курирует|вед[её]т|сопровождает)\s+(?:агент|риелтор)|занимается\s+(?:данным\s+)?объектом|имя\s+агента|агент[а-яё]*\s+(?:по\s+объекту\s+)?[А-ЯЁ][а-яё-]{2,})/;
  const CURRENT_OBJECT_CHARACTERISTIC_RE=/(?:двухкомнатн|тр[её]хкомнатн|однокомнатн|комнатност|\d+\s*[-–]?\s*комнат|студи[яю]|площад[ьи]|\d+(?:[.,]\d+)?\s*кв\.?\s*м|этаж[ае]?|\d+\s*[-–]?\s*этаж)/i;
  const CURRENT_OBJECT_CONTEXT_RE=/(?:текущ[а-яё]*\s+объект|объект[а-яё]*|квартир[а-яё]*|дом[а-яё]*|лот[а-яё]*|объявлен[а-яё]*|выставлен[а-яё]*|характеристик[а-яё]*)/i;
  const REQUIREMENT_SIGNAL_RE=/(?:нужен|нужна|нужно|должен|должна|должно|ищет|требован|обязатель|принципиаль|только|исключительно|не\s+более|не\s+менее|не\s+выше|не\s+ниже)/i;
  const MOTIVATION_SIGNAL_RE=/(?:тяжело|сложно|неудобно|поэтому|из[-‑–— ]за|по\s+причине|не\s+может|мотивац)/i;
  const ACTIONABLE_QUESTION_RE=/(?:налич|актуальн|уточнить|услови|доступн|юридическ|какие|вопрос)/i;
  const SELLER_SIDE_ACTION_RE=/(?:обновил[а]?\s+(?:фото|фотограф)|обновл[её]нн[а-яё]*\s+фотограф|фотографировал[а]?\s+(?:объект|квартир)|фоточки?\s+.*обнов|собственник[а-яё]*\s+.*(?:\d{2}\s+лет|нотариус|альтернативн[а-яё]*\s+жиль|выпис|прода[её]т|переезж|правов|основан|сведени|детал)|основани[ея]\s+прав[ао]|приватизац|отказник|ходил[а]?\s+к\s+нотариус|готов[а-яё]*\s+выписаться\s+к\s+сделке|персональн[а-яё]*\s+данн|предоставля[а-яё]*\s+документ)/i;
  const LOW_VALUE_QUOTE_RE=/(?:четыр(?!еста(?:\s|$|[.,]))[а-яё]{3,8}|четырн[a-яё]*|\d+\s*м\d{3,}|\d{4,}\s*\d{4,})/i;
  const STT_DERIVED_AMOUNT_RE=/(?:ориентир[а-яё]*[^.]{0,40}сумм|~\s*\d|около\s+\d+(?:[.,]\d+)?\s*(?:млн|миллион))/i;
  const ADDRESS_FRAGMENT_RE=/(?:[А-ЯЁа-яё-]+\s+){0,3}(?:проезд|проспект|переулок|шоссе)\s*,?\s*\d+(?:[\/-]\d+)?|(?:улица|ул\.?)\s+(?:[А-ЯЁа-яё-]+\s+){0,3}\d+(?:[\/-]\d+)?/gi;
  const CURRENT_OBJECT_LOCATION_FRAGMENT_RE=/\s+(?:на|в|по)\s+(?:[А-ЯЁа-яё-]+\s+){1,3}(?:проезд[еау]?|проспект[еау]?|переулк[еау]?|шоссе|район[еау]?|пос[её]лк[еау]?)/gi;
  const FINANCIAL_PRIORITY_RE=/(?:первоначальн[а-яё]*\s+взнос|собственн[а-яё]*\s+средств|бюджет[а-яё]*|максимальн[а-яё]*\s+сумм|одобрен[а-яё]*\s+ипотек|сумм[а-яё]*\s+ипотек|источник[а-яё]*\s+средств|финансов[а-яё]*\s+(?:огранич|услов)|располагает[^.]{0,100}(?:₽|руб|миллион|тысяч|процент|%))/i;
  const CONSTRAINT_PRIORITY_RE=/(?:не\s+более|не\s+менее|не\s+больше|не\s+меньше|обязательно|только\s+при|без\s+этого|исключительно)/i;
  const PURCHASE_PURPOSE_RE=/(?:для\s+себя|для\s+жизни|собственн[а-яё]*\s+прожив|назначени[а-яё]*\s+покуп)/i;
  const IMPORTANT_PRIORITY_RE=/(?:ипотек|рассроч|существенн[а-яё]*\s+вопрос|нужно\s+уточнить|требуется\s+уточнить|интересуется\s+(?:наличием|ценами|условиями))/i;
  const CRM_CLIENT_TYPE_RE=/(?:клиент[а-яё]*\s+(?:(?:является|работает|обращается|выступает)\s+(?:как\s+)?|[-—:]\s*)?(?:частн[а-яё]*\s+лиц|агент(?:ом)?(?![а-яё])|риелтор(?:ом)?(?![а-яё]))|(?:частн[а-яё]*\s+лиц|агент(?:ом)?(?![а-яё])|риелтор(?:ом)?(?![а-яё]))\s*[-—:]?\s+клиент)/i;
  const CRM_CLIENT_TYPE_RELEVANCE_RE=/(?:влияет|комисси|вознагражд|услови|сценари|сделк|договор|доверенн|от\s+имени|представля|покупател|продавц|юр(?:идическ[а-яё]*\s+)?лиц|налог|сотруднич)/i;
  const CRM_CONTACT_VALIDATION_RE=/(?:подтверд[а-яё]*|актуальн[а-яё]*|верн[а-яё]*|подходит)[^.]{0,60}(?:номер|телефон|контакт)|(?:номер|телефон|контакт)[^.]{0,60}(?:подтверд[а-яё]*|актуальн[а-яё]*|верн[а-яё]*|подходит)|последн[а-яё]*\s+(?:\d+\s+)?цифр[а-яё]*[^.]{0,30}(?:номер|телефон|контакт)/i;
  const CRM_OBJECT_PRICE_CONFIRMATION_RE=/(?:уточн[а-яё]*|провер[а-яё]*|подтверд[а-яё]*|верн[а-яё]*\s+ли|правильн[а-яё]*|актуальн[а-яё]*)[^.]{0,90}(?:цен[ауы]|стоимост[ьи])|(?:цен[ауы]|стоимост[ьи])[^.]{0,90}(?:уточн[а-яё]*|провер[а-яё]*|подтверд[а-яё]*|верн[а-яё]*|правильн[а-яё]*|актуальн[а-яё]*)/i;
  const ACTIONABLE_PRICE_RE=/(?:торг|скидк|сниж|бюджет|не\s+(?:выше|более|дороже)|максимальн[а-яё]*\s+(?:цен|сумм)|готов[а-яё]*[^.]{0,50}(?:если|при|за\s+\d)|если[^.]{0,90}(?:цен|стоимост|сниз)|услови[а-яё]*[^.]{0,50}(?:цен|покуп))/i;
  const CALL_ORIGIN_RE=/(?:звоню|звонит|позвонил[а-яё]*|обращаюсь|обращается|обратил[а-яё]*)[^.]{0,100}(?:по|из|с)\s+(?:этому\s+)?объявлен[а-яё]*|(?:по|из|с)\s+(?:этому\s+)?объявлен[а-яё]*[^.]{0,100}(?:звон|обращ)/i;
  const CONTACT_CENTER_SERVICE_RE=/(?:звонок[^.]{0,50}(?:соедин[а-яё]*|перевед[а-яё]*|передан[а-яё]*)|(?:оператор|контакт[- ]?центр|колл[- ]?центр)[^.]{0,80}(?:соединил[а-яё]*|перевел[а-яё]*|перевёл[а-яё]*|передал[а-яё]*|уточнил[а-яё]*\s+имя|проверил[а-яё]*\s+имя)|клиент[а-яё]*[^.]{0,50}(?:соединили|перевели|передали)[^.]{0,30}(?:агент|специалист|менеджер)|(?:агент|специалист|менеджер)[^.]{0,40}(?:представил[а-яё]*ся|назвал[а-яё]*\s+(?:сво[её]\s+)?имя)|(?:уточнил[а-яё]*|проверил[а-яё]*)[^.]{0,30}(?:имя\s+клиента|как\s+обращаться))/i;
  const DAILY_RENT_RE=/(?:посуточн|краткосрочн)[^.]{0,60}(?:сда|аренд)|(?:сда|аренд)[^.]{0,60}(?:посуточн|краткосрочн)/i;
  const PROPERTY_CONDITION_RE=/(?:состояни[а-яё]*|ремонт[а-яё]*|передел[а-яё]*|износ[а-яё]*|убит[а-яё]*)/i;
  const DAILY_RENT_DECISION_RELEVANCE_RE=/(?:важн[а-яё]*|принципиальн[а-яё]*|не\s+рассматрива[а-яё]*|не\s+готов[а-яё]*|только\s+если|повли[а-яё]*[^.]{0,60}(?:состояни|решени|выбор)|услови[а-яё]*\s+(?:покуп|просмотр))/i;
  const NEED_CONCEPTS=[
    ['viewing',/(?:просмотр|посмотр|показ)/i],['apartment',/апартамент/i],['flat',/квартир/i],['house',/(?:дом|коттедж)/i],['land',/участ/i],
    ['buy',/(?:покуп|купит|приобрет)/i],['sell',/(?:продаж|продат)/i],['rent',/(?:аренд|снять|сдач)/i],['consult',/(?:консультац|проконсульт)/i]
  ];

  function standalonePhone(value){
    if(!PHONE_RE.test(value)) return false;
    const rest=value.replace(PHONE_RE,' ').replace(/[«»"'.,:;!?()\-—]/g,' ').replace(/\b(?:мой|номер|телефон|контакт|для|связи|позвоните|клиента)\b/gi,' ').replace(/\s+/g,'').trim();
    return rest==='';
  }
  function standaloneAddress(value){
    const normalized=text(value).replace(/^[«"']+|[»"']+$/g,'').trim();
    if(!ADDRESS_SIGNAL_RE.test(normalized)||BUSINESS_MEANING_RE.test(normalized)) return false;
    if(ADDRESS_PREFIX_RE.test(normalized)) return true;
    if(OBJECT_INTEREST_PREFIX_RE.test(normalized)&&STRONG_ADDRESS_RE.test(normalized)) return true;
    if(STRONG_ADDRESS_RE.test(normalized)&&/(?:интерес[а-яё]*|конкретн[а-яё]*\s+(?:объект|объявлен)|объявлен[а-яё]*)/i.test(normalized)) return true;
    return /^(?:россия\s*,?\s*)?(?:санкт-петербург|москва|[а-яё-]+(?:ская|ский|ское)?\s+(?:область|район))\s*,/i.test(normalized);
  }
  function listingSourceNoise(value){return LISTING_SOURCE_RE.test(text(value))&&URL_RE.test(value)&&!BUSINESS_MEANING_RE.test(value);}
  function sttMetaNoise(value){return STT_META_RE.test(text(value));}
  function roleIssues(values){return (Array.isArray(values)?values:[]).map(text).filter(value=>/^ROLE_INCONSISTENCY\s*:/i.test(value));}
  function hasDamagedAmountIssue(values){return (Array.isArray(values)?values:[]).map(text).some(value=>/(?:поврежд[её]н[а-яё]*|нечитабельн[а-яё]*)[^.]{0,60}(?:сумм|цен|числ)|(?:сумм|цен|числ)[^.]{0,60}(?:поврежд[её]н[а-яё]*|нечитабельн[а-яё]*)/i.test(value));}
  function roleInconsistent(value,evidence,issues){
    if(!issues.length) return false;
    const combined=compareKey(value+' '+evidence);
    if(SELLER_SIDE_ACTION_RE.test(combined)) return true;
    return issues.some(issue=>{
      const detail=compareKey(issue.replace(/^ROLE_INCONSISTENCY\s*:\s*/i,''));
      if(detail.length>=12&&(combined.includes(detail)||detail.includes(compareKey(value)))) return true;
      const tokens=detail.split(/[^a-zа-яё0-9]+/i).filter(token=>token.length>=5);
      return tokens.length>=2&&tokens.filter(token=>combined.includes(token)).length>=Math.min(3,tokens.length);
    });
  }
  function usefulRequirementOrMotivation(value){return REQUIREMENT_SIGNAL_RE.test(value)||MOTIVATION_SIGNAL_RE.test(value);}
  function objectPriceNoise(value){return (OBJECT_PRICE_RE.test(value)&&OBJECT_PRICE_CONTEXT_RE.test(value)||OBJECT_PRICE_WITHOUT_VALUE_RE.test(value)||PRIMARY_OBJECT_PRICE_RE.test(value))&&!CLIENT_FINANCE_RE.test(value)&&!ACTIONABLE_PRICE_RE.test(value);}
  function lowValueCallContext(value,primaryNeed){
    if(!CALL_ORIGIN_RE.test(value)||!text(primaryNeed)) return false;
    const factConcepts=NEED_CONCEPTS.filter(([,pattern])=>pattern.test(value)).map(([concept])=>concept);
    const needConcepts=new Set(NEED_CONCEPTS.filter(([,pattern])=>pattern.test(primaryNeed)).map(([concept])=>concept));
    return factConcepts.filter(concept=>needConcepts.has(concept)).length>=2;
  }
  function objectCharacteristicNoise(value,kind){return CURRENT_OBJECT_CHARACTERISTIC_RE.test(value)&&CURRENT_OBJECT_CONTEXT_RE.test(value)&&!usefulRequirementOrMotivation(value)&&!(kind==='unresolved_question'&&ACTIONABLE_QUESTION_RE.test(value));}
  function objectLocationNoise(value){return (OBJECT_LOCATION_RE.test(text(value))||CURRENT_OBJECT_LOCATION_FACT_RE.test(text(value)))&&!usefulRequirementOrMotivation(value);}
  function stripEmbeddedAddress(value,path,audit,kind){
    if(kind==='fact'||kind==='quote'||kind==='requirement') return value;
    const cleaned=text(value.replace(ADDRESS_FRAGMENT_RE,' ').replace(CURRENT_OBJECT_LOCATION_FRAGMENT_RE,' ').replace(/\(\s*\)/g,' ').replace(/\s+([,.;:])/g,'$1').replace(/\(\s*(?:и|,|;)\s*/g,'('));
    if(cleaned&&cleaned!==value){audit.normalizations.push(path+': CRM_OBJECT_ADDRESS_REMOVED');return cleaned;}
    return value;
  }
  function factPriority(value){
    const normalized=text(value);
    if(FINANCIAL_PRIORITY_RE.test(normalized)||CONSTRAINT_PRIORITY_RE.test(normalized)||PURCHASE_PURPOSE_RE.test(normalized)) return 1;
    if(IMPORTANT_PRIORITY_RE.test(normalized)) return 2;
    return 3;
  }
  function noiseReason(value,kind,context){
    const factOrQuote=kind==='fact'||kind==='quote';
    const combined=text(value+' '+(context&&context.evidence||''));
    if(factOrQuote&&CRM_CONTACT_VALIDATION_RE.test(combined)) return 'CRM_CONTACT_VALIDATION';
    if(factOrQuote&&CRM_CLIENT_TYPE_RE.test(combined)&&!CRM_CLIENT_TYPE_RELEVANCE_RE.test(combined)) return 'CRM_CLIENT_TYPE';
    if(factOrQuote&&CRM_OBJECT_PRICE_CONFIRMATION_RE.test(combined)&&!CLIENT_FINANCE_RE.test(combined)&&!ACTIONABLE_PRICE_RE.test(combined)) return 'CRM_OBJECT_PRICE_CONFIRMATION';
    if(factOrQuote&&lowValueCallContext(value,context&&context.primaryNeed)) return 'LOW_VALUE_CALL_CONTEXT';
    if(factOrQuote&&(CONTACT_CENTER_SERVICE_RE.test(combined)||(CALL_ORIGIN_RE.test(value)&&!BUSINESS_MEANING_RE.test(value)))) return 'CONTACT_CENTER_SERVICE_FACT';
    if(standalonePhone(value)) return 'PHONE_NUMBER';
    if(EMAIL_RE.test(value)&&!BUSINESS_MEANING_RE.test(value)) return 'EMAIL';
    if(OBJECT_CODE_RE.test(text(value))) return 'OBJECT_CODE';
    if(OBJECT_CODE_CONTEXT_RE.test(value)&&!usefulRequirementOrMotivation(value)) return 'OBJECT_CODE';
    if(sttMetaNoise(value)) return kind==='quote'?'LOW_VALUE_QUOTE':'STT_META_NOISE';
    if(kind==='quote'&&STRONG_ADDRESS_RE.test(value)) return 'CRM_OBJECT_ADDRESS';
    if(kind==='quote'&&/(?:какая|указан[а-яё]*|точн[а-яё]*)\s+(?:цен[ауы]|стоимост[ьи])|(?:цен[ауы]|стоимост[ьи])\s*\?/i.test(value)&&!CLIENT_FINANCE_RE.test(value)) return 'CRM_OBJECT_PRICE';
    if(standaloneAddress(value)) return 'CRM_OBJECT_ADDRESS';
    if(objectPriceNoise(value)) return 'CRM_OBJECT_PRICE';
    if(AGENT_NAME_RE.test(value)&&!usefulRequirementOrMotivation(value)) return 'CRM_AGENT_NAME';
    if(objectLocationNoise(value)) return 'CRM_OBJECT_LOCATION';
    if(objectCharacteristicNoise(value,kind)) return 'CRM_OBJECT_CHARACTERISTIC';
    if(kind==='fact'&&listingSourceNoise(value)) return 'LISTING_SOURCE_NOISE';
    if(kind==='quote'&&URL_RE.test(value)&&!BUSINESS_MEANING_RE.test(value)) return 'URL';
    if(kind==='quote'&&LOW_VALUE_QUOTE_RE.test(value)) return 'LOW_VALUE_QUOTE';
    return '';
  }

  function cleanStringList(values,path,audit,kind,issues,damagedAmountIssue,context){
    const source=Array.isArray(values)?values:[];
    const seen=new Set();const result=[];
    source.forEach((item,index)=>{
      const normalized=normalizedText(item,path+'['+index+']',audit);
      if(!normalized){audit.removed_items.push(path+'['+index+']: EMPTY_VALUE');return;}
      if(roleInconsistent(normalized,'',issues||[])){audit.removed_items.push(path+'['+index+']: ROLE_INCONSISTENCY');return;}
      if(damagedAmountIssue&&STT_DERIVED_AMOUNT_RE.test(normalized)){audit.removed_items.push(path+'['+index+']: STT_META_NOISE');return;}
      const reason=noiseReason(normalized,kind||path,context);
      if(reason){audit.removed_items.push(path+'['+index+']: '+reason);return;}
      const sanitized=stripEmbeddedAddress(normalized,path+'['+index+']',audit,kind||path);
      const key=compareKey(sanitized);
      if(seen.has(key)){audit.deduplicated_items.push(path+'['+index+']: EXACT_DUPLICATE');return;}
      seen.add(key);result.push(sanitized);
    });
    return result;
  }

  function cleanScalar(value,path,audit,kind,issues){
    const normalized=normalizedText(value,path,audit);
    if(!normalized) return '';
    if(roleInconsistent(normalized,'',issues||[])){audit.removed_items.push(path+': ROLE_INCONSISTENCY');return '';}
    const reason=noiseReason(normalized,kind||path);
    if(reason){audit.removed_items.push(path+': '+reason);return '';}
    return stripEmbeddedAddress(normalized,path,audit,kind||path);
  }

  function cleanFacts(values,audit,issues,damagedAmountIssue,primaryNeed){
    const source=Array.isArray(values)?values:[];
    const hasIndependentConditionFact=source.some(item=>item&&typeof item==='object'&&!DAILY_RENT_RE.test(text(item.fact+' '+item.evidence))&&PROPERTY_CONDITION_RE.test(text(item.fact+' '+item.evidence)));
    const seen=new Set();const result=[];
    source.forEach((item,index)=>{
      if(!item||typeof item!=='object'){audit.removed_items.push('fact['+index+']: EMPTY_VALUE');return;}
      const fact=normalizedText(item.fact,'fact['+index+'].fact',audit),evidence=normalizedText(item.evidence,'fact['+index+'].evidence',audit);
      if(!fact){audit.removed_items.push('fact['+index+']: EMPTY_VALUE');return;}
      if(roleInconsistent(fact,evidence,issues)){audit.removed_items.push('fact['+index+']: ROLE_INCONSISTENCY');return;}
      if(damagedAmountIssue&&!FINANCIAL_PRIORITY_RE.test(fact)&&(STT_DERIVED_AMOUNT_RE.test(fact)||LOW_VALUE_QUOTE_RE.test(evidence))){audit.removed_items.push('fact['+index+']: STT_META_NOISE');return;}
      if(hasIndependentConditionFact&&DAILY_RENT_RE.test(fact+' '+evidence)&&!DAILY_RENT_DECISION_RELEVANCE_RE.test(fact+' '+evidence)){audit.removed_items.push('fact['+index+']: LOW_VALUE_CALL_CONTEXT');return;}
      const reason=noiseReason(fact,'fact',{evidence,primaryNeed});
      if(reason){audit.removed_items.push('fact['+index+']: '+reason);return;}
      const key=compareKey(fact)+'\u0000'+compareKey(evidence);
      if(seen.has(key)){audit.deduplicated_items.push('fact['+index+']: EXACT_DUPLICATE');return;}
      seen.add(key);result.push({fact,evidence,index,priority:factPriority(fact)});
    });
    if(result.length>7){
      audit.normalizations.push('facts: priority cap '+result.length+' → 7');
      return result.slice().sort((left,right)=>left.priority-right.priority||left.index-right.index).slice(0,7).map(({fact,evidence})=>({fact,evidence}));
    }
    return result.map(({fact,evidence})=>({fact,evidence}));
  }

  function validateOutput(value){
    const exact=(object,keys)=>Boolean(object&&typeof object==='object'&&!Array.isArray(object)&&Object.keys(object).length===keys.length&&keys.every(key=>Object.prototype.hasOwnProperty.call(object,key)));
    const strings=list=>Array.isArray(list)&&list.every(item=>typeof item==='string');
    if(!exact(value,['facts','quotes','needs','outcome','cleaning','source_decisions','status'])) return false;
    if(!Array.isArray(value.facts)||value.facts.length>7||value.facts.some(item=>!exact(item,['fact','evidence'])||typeof item.fact!=='string'||typeof item.evidence!=='string')) return false;
    if(!strings(value.quotes)||value.quotes.length>2) return false;
    if(!exact(value.needs,['primary_need','requirements','preferences','objections','unresolved_questions'])||typeof value.needs.primary_need!=='string'||!['requirements','preferences','objections','unresolved_questions'].every(key=>strings(value.needs[key]))) return false;
    if(!exact(value.outcome,['call_result','agreement','next_step','responsible_party','deadline','channel'])||!['call_result','agreement','next_step','responsible_party','deadline','channel'].every(key=>typeof value.outcome[key]==='string')||!RESPONSIBLE_PARTIES.includes(value.outcome.responsible_party)) return false;
    if(!exact(value.cleaning,['removed_items','deduplicated_items','normalizations','warnings'])||!['removed_items','deduplicated_items','normalizations','warnings'].every(key=>strings(value.cleaning[key]))) return false;
    if(!exact(value.source_decisions,['facts','needs','outcome'])||!['facts','needs','outcome'].every(key=>DECISIONS.includes(value.source_decisions[key]))) return false;
    return ['READY','PARTIAL_READY','TECHNICAL_ERROR'].includes(value.status);
  }

  function cleanOutcome(value,audit){
    const source=value&&typeof value==='object'?value:{};
    const outcome={
      call_result:normalizedText(source.call_result,'outcome.call_result',audit),agreement:normalizedText(source.agreement,'outcome.agreement',audit),next_step:normalizedText(source.next_step,'outcome.next_step',audit),
      responsible_party:RESPONSIBLE_PARTIES.includes(source.responsible_party)?source.responsible_party:'',
      deadline:normalizedText(source.deadline,'outcome.deadline',audit),channel:normalizedText(source.channel,'outcome.channel',audit)
    };
    if(!outcome.next_step){
      if(outcome.responsible_party){outcome.responsible_party='';audit.normalizations.push('responsible_party: removed because next_step empty');}
      if(outcome.deadline){outcome.deadline='';audit.normalizations.push('deadline: removed because next_step empty');}
      if(outcome.channel&&!compareKey(outcome.call_result+' '+outcome.agreement).includes(compareKey(outcome.channel))){outcome.channel='';audit.normalizations.push('channel: removed because next_step empty and channel is not an outcome');}
    }else{
      if(!outcome.responsible_party) audit.warnings.push('MISSING_RESPONSIBLE_PARTY');
      if(!outcome.agreement) audit.warnings.push('NEXT_STEP_WITHOUT_AGREEMENT');
    }
    return outcome;
  }

  function clean(input){
    const provenanceValidation=validateProvenance(input);
    if(!provenanceValidation.valid){
      const reason='CURRENT_RUN_PROVENANCE_VALIDATION_FAILED';
      return {output:technicalOutput(reason),provenanceValidation};
    }
    const judge=input.conversationJudge;
    const audit={removed_items:[],deduplicated_items:[],normalizations:[],warnings:[]};
    const judgeRoleIssues=roleIssues(judge.issues);
    const judgeDamagedAmountIssue=hasDamagedAmountIssue(judge.issues);
    const decisions=judge.decisions&&typeof judge.decisions==='object'?judge.decisions:{};
    const sourceDecisions={
      facts:DECISIONS.includes(decisions.facts)?decisions.facts:'technical_error',
      needs:DECISIONS.includes(decisions.needs)?decisions.needs:'technical_error',
      outcome:DECISIONS.includes(decisions.outcome)?decisions.outcome:'technical_error'
    };
    const sourceNeeds=judge.verified_needs&&typeof judge.verified_needs==='object'?judge.verified_needs:{};
    const sourcePrimaryNeed=text(sourceNeeds.primary_need);
    let quotes=cleanStringList(judge.verified_quotes,'quote',audit,'quote',judgeRoleIssues,judgeDamagedAmountIssue,{primaryNeed:sourcePrimaryNeed});
    if(quotes.length>2){audit.normalizations.push('quotes: capped '+quotes.length+' → 2');quotes=quotes.slice(0,2);}
    const output={
      facts:cleanFacts(judge.verified_facts,audit,judgeRoleIssues,judgeDamagedAmountIssue,sourcePrimaryNeed),quotes,
      needs:{
        primary_need:cleanScalar(sourceNeeds.primary_need,'needs.primary_need',audit,'primary_need',judgeRoleIssues),
        requirements:cleanStringList(sourceNeeds.requirements,'requirements',audit,'requirement',judgeRoleIssues,judgeDamagedAmountIssue),
        preferences:cleanStringList(sourceNeeds.preferences,'preferences',audit,'preference',judgeRoleIssues,judgeDamagedAmountIssue),
        objections:cleanStringList(sourceNeeds.objections,'objections',audit,'objection',judgeRoleIssues,judgeDamagedAmountIssue),
        unresolved_questions:cleanStringList(sourceNeeds.unresolved_questions,'unresolved_questions',audit,'unresolved_question',judgeRoleIssues,judgeDamagedAmountIssue)
      },
      outcome:cleanOutcome(judge.verified_outcome,audit),
      cleaning:audit,source_decisions:sourceDecisions,
      status:Object.values(sourceDecisions).includes('technical_error')?'PARTIAL_READY':'READY'
    };
    if(!validateOutput(output)) return {output:technicalOutput('OUTPUT_SCHEMA_VALIDATION_FAILED'),provenanceValidation};
    return {output,provenanceValidation};
  }

  global.__AI_SUMMARY_10_08_STORE_CLEANER__=Object.freeze({
    contractId:CONTRACT_ID,contractVersion:CONTRACT_VERSION,schemaId:SCHEMA_ID,implementationVersion:IMPLEMENTATION_VERSION,jsonSchema:OUTPUT_SCHEMA,validateOutput,clean,
    normalizeText:text
  });
})(typeof window!=='undefined'?window:globalThis);
