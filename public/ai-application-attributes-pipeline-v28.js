/* Local revision: event-relative contact and explicit unresolved temporal state. */
(() => {
  const config=window.__AI_APPLICATION_ATTRIBUTES_PIPELINE_CONFIG__;
  const additions={
    next_contact_date_extractor:`КОНТАКТ ОТНОСИТЕЛЬНО СОБЫТИЯ (v3)
Всегда возвращай event_anchor: null для самостоятельной даты контакта, иначе {raw_time_expression, evidence, offset_minutes}.
Если обещание контакта привязано к показу, встрече или другому событию, сохрани в event_anchor.raw_time_expression последнюю согласованную дату И время этого события. Для этого соедини сведения соседних реплик без календарной арифметики. Например: показ «завтра», сначала в 14:00, затем перенесён и подтверждён на 15:00; «за час позвоню» → event_anchor.raw_time_expression="завтра в 15:00", offset_minutes=-60. Следующий контакт — звонок, а не показ. Не вычисляй next_contact_at.
Отрицательное offset_minutes означает до события; положительное — после. В event_anchor.evidence сохрани цитаты с днём, финальным временем и связью обещанного контакта с событием. Сохраняй цитату самого обещания в evidence, а «за час» — в raw_time_expression. При переносе события используй последнее согласованное время. Если время события неизвестно, не дополняй его вымышленным часом.
Если communication_created_at отсутствует, всё равно сохрани найденную договорённость со status=determined, detected=true и next_contact_at=null: нехватка метки — ограничение календарного расчёта, а не отсутствие обещания. При отказе или отсутствии договорённости event_anchor=null.
Верни только JSON по response contract application_next_contact_date_extractor_v3.`,
    attributes_judge:`ПРОВЕРКА ВРЕМЕНИ v28
Для next_contact_date проверяй event_anchor: день, ПОСЛЕДНЕЕ согласованное время события, offset_minutes и цитаты. Перенос показа отменяет предыдущий час. «За час» — минус 60 минут от события, не плюс час от создания коммуникации.
normalization_status=missing_reference или unresolved — договорённость найдена, но календарная дата пока не рассчитана. Это не technical_error и не not_determined. Если смысл и event_anchor подтверждены, верни accepted со status=determined даже при next_contact_at=null; deterministic Gate сохранит ограничение и не запишет AI-дату. Если опора или смещение выдуманы — rejected. Не исправляй значения.`,
    attributes_quality_gate:'Версия v3: проверенная договорённость без рассчитанной даты → pending_attributes=["next_contact_date"], next_contact_resolution с причиной и цитатой, PARTIAL_READY, без записи AI-даты. Остальные атрибуты независимы. Сохрани существующий серверный fallback.',
    crm_attributes_result:'Версия v3: передай next_contact_resolution и pending_attributes. Для нерассчитанной AI-даты update_actions.next_contact_date=SKIP; готовый серверный fallback → KEEP_FALLBACK. Отказ → NO_CONTACT. Не теряй найденную договорённость.'
  };
  window.__AI_APPLICATION_ATTRIBUTES_V28_ADDITIONS__=additions;
  for(const stage of config.stages){
    if(additions[stage.outKey]) stage.prompt+='\n\n'+additions[stage.outKey];
    stage.promptVersion=28;
    if(stage.outKey==='next_contact_date_extractor'){stage.responseContract='application_next_contact_date_extractor_v3';stage.prompt=stage.prompt.replace('response contract v2','response contract v3');}
    if(stage.actualExecutor==='code') stage.contractVersion='v3';
  }
  config.revision=28;
})();
