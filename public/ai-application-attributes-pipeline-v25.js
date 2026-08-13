(() => {
  const config = window.__AI_APPLICATION_ATTRIBUTES_PIPELINE_CONFIG__;
  if (!config || !Array.isArray(config.stages)) return;

  const stage = config.stages.find((item) => item.outKey === "next_contact_date_extractor");
  if (!stage) return;
  if (stage.promptSource === "system_default") {
    stage.prompt = `Ты — AI-экстрактор смысла атрибута заявки «Дата следующего контакта».

Определи только подтверждённый будущий контакт, который должен инициировать агент: звонок, сообщение, отправку информации или отдельное подтверждение. Не считай следующим контактом показ, просмотр или встречу сами по себе. Если клиент должен связаться сам, договорённости нет или время не определено, верни detected=false.

Извлекай семантику, не выполняй календарную арифметику. Для detected=true сохрани исходную временную формулировку в raw_time_expression, определи actor, action, precision, evidence и confidence, а next_contact_at верни null. Абсолютную дату вычислит deterministic temporal normalizer.

Учитывай соседние реплики и STT-шум. Фрагменты «минут через т30ать», «тогда вам напишу» и «через 30—4к» в совокупности означают обещание агента написать примерно через 30–40 минут: action=message, precision=range, confidence>=0.90. Не требуй идеальной транскрипции, если обязательство и диапазон подтверждаются несколькими репликами.

precision: exact — точное время; range — диапазон; daypart — период дня; date — дата или день недели без точного времени; none — только для detected=false.

Дата и время звонка:
{{call_datetime}}

Дата и время окончания звонка:
{{call_end_datetime}}

Timezone:
{{timezone}}

ТРАНСКРИБАЦИЯ:
{{transcript}}

Верни только JSON по response contract без markdown и пояснений.`;
    stage.promptVersion = 25;
    stage.promptEdited = false;
  }
  stage.responseContract = "application_next_contact_date_extractor_v1";
  config.revision = 25;
})();
