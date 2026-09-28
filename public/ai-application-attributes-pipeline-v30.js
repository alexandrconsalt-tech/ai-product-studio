/* Preserve useful conversation context without fabricating a confirmed CRM value. */
(() => {
  const config=window.__AI_APPLICATION_ATTRIBUTES_PIPELINE_CONFIG__;
  const additions={
    funding_source_extractor:`КОНТЕКСТ ИСТОЧНИКА СРЕДСТВ v30
Справочник подтверждённых value остаётся прежним. Если способ финансирования обсуждается для текущей покупки, но ни одно значение справочника ещё не подтверждено, верни status=not_determined, value=null, evidence="" и context={summary,evidence,limitation}. summary — краткое полезное описание обсуждаемого способа (до 120 символов), evidence — массив дословных непрерывных цитат, limitation — одним коротким предложением чего не хватает для подтверждённого значения. Если клиент спрашивает, реально ли ему оформить семейную ипотеку, а одобрения нет и подача не подтверждена: summary="Рассматривает семейную ипотеку", limitation="Подача заявки и одобрение не подтверждены". Не называй эту ипотеку уже оформляемой. Это контекст для уточнения, а не определённое значение справочника.
Если информации нет вообще, она не относится к текущей покупке, является только отвергнутым предложением агента или клиент явно отказался обсуждать источник — context=null. При determined или explicitly_declined всегда context=null. Не добавляй сведения из текущей карточки или прошлых разговоров. Верни JSON по schema application_funding_source_extractor_v3, включая обязательный context.`,
    purchase_term_extractor:`КОНТЕКСТ СРОКА ПОКУПКИ v30
Если обсуждается конкретный срок связанного события (ипотечное одобрение, продажа своего объекта, переезд), но клиент не подтвердил срок покупки, сохрани status=not_determined, value=null, evidence="" и context={summary,evidence,limitation}. summary кратко называет событие и его срок (до 120 символов); evidence — массив дословных непрерывных цитат; limitation одним коротким предложением объясняет, что срок самой покупки не подтверждён. Например, агент говорит успеть получить ипотечные одобрения до 30 сентября, сегодня 25 сентября, клиент отвечает «поняла»: summary="Ипотечное одобрение — до 30 сентября", limitation="Дедлайн назвал агент; срок покупки клиент не подтвердил". Не присваивай «до 1 месяца» только из-за этого дедлайна. «Поняла» подтверждает получение информации, а не обещание купить. Не используй показ или звонок как контекст срока покупки: они обрабатываются отдельно.
При отсутствии полезного контекста, determined или explicitly_declined верни context=null. Если клиент явно согласовал покупку в срок, обычное определённое значение по-прежнему допустимо. Верни JSON по schema application_purchase_term_extractor_v3, включая обязательный context.`,
    attributes_judge:`ПРОВЕРКА КОНТЕКСТА v30
Используй schema application_attributes_judge_v3. Для funding_source и purchase_term дополнительно верни context_verdict=accepted/rejected/not_present и context_reason. Основной verdict/status проверяет подтверждённое значение как прежде. Отдельный context_verdict проверяет только переданный Extractor.context: summary, все цитаты и limitation. Контекст может быть полезным при основном verdict=not_determined. При context=null верни not_present. Не добавляй и не переписывай контекст. Если цитата, источник утверждения или связь с текущей покупкой неверны — rejected. Различай рассматриваемую ипотеку, поданную заявку и одобрение; различай дедлайн ипотечного одобрения от агента и срок покупки, подтверждённый клиентом. Краткое «поняла» не превращает дедлайн банка в обещание покупки. Проверяй цитаты по транскрибации; не требуй отсутствующих фактов для сохранения корректно обозначенного контекста.`,
    attributes_quality_gate:'Контракт v4: передай проверенный attribute_context отдельно от values_for_save; контекст не разрешает AUTO_SAVE значения. Передай next_contact_schedule с относительными временем события и контакта даже без календарной опоры. Источник и ограничения расписания должны сохраняться.',
    crm_attributes_result:'Контракт v4: attribute_context — контекст для уточнения, отдельно от attributes и update_actions. next_contact_schedule сохраняет относительное расписание; next_contact_date без календарной опоры остаётся null. Не выдавай контекст и относительное время за подтверждённые значения CRM.'
  };
  window.__AI_APPLICATION_ATTRIBUTES_V30_ADDITIONS__=additions;
  for(const stage of config.stages){
    if(additions[stage.outKey])stage.prompt+='\n\n'+additions[stage.outKey];
    stage.promptVersion=30;
    if(['funding_source_extractor','purchase_term_extractor','attributes_judge'].includes(stage.outKey))stage.responseContract='application_'+stage.outKey+'_v3';
    if(stage.actualExecutor==='code')stage.contractVersion='v4';
  }
  config.revision=30;
})();
