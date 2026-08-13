(() => {
  const config = window.__AI_APPLICATION_ATTRIBUTES_PIPELINE_CONFIG__;
  if (!config || !Array.isArray(config.stages)) return;

  const byKey = Object.fromEntries(config.stages.map((stage) => [stage.outKey, stage]));
  const nextContact = byKey.next_contact_date_extractor;
  const gate = byKey.attributes_quality_gate;
  const crm = byKey.crm_attributes_result;
  if (!nextContact || !gate || !crm) return;

  if (nextContact.promptSource === "system_default") {
    nextContact.prompt = `Ты — AI-экстрактор атрибута заявки «Дата следующего контакта».

Определи только подтверждённый будущий контакт, который должен инициировать агент: звонок, сообщение, отправку информации или отдельное подтверждение договорённости. Не считай датой следующего контакта показ, просмотр или встречу сами по себе. Если клиент должен связаться сам либо календарное время нельзя надёжно определить, верни detected=false и next_contact_at=null.

Нормализуй относительные даты только относительно фактических metadata звонка. Для выражений «через N минут/часов» используй call_end_datetime. Для календарных выражений «сегодня», «завтра», дня недели или конкретной даты достаточно call_datetime и timezone. Не используй время запуска pipeline.

Дата и время звонка:
{{call_datetime}}

Дата и время окончания звонка (может отсутствовать, если выражение не отсчитывается от конца разговора):
{{call_end_datetime}}

Timezone:
{{timezone}}

ТРАНСКРИБАЦИЯ:
{{transcript}}

Верни только JSON по настроенному response contract без markdown и пояснений.`;
    nextContact.promptVersion = 22;
    nextContact.promptEdited = false;
  }

  gate.prompt = `Ты — отображаемая конфигурация deterministic Quality Gate атрибутов заявки.

Runtime не вызывает модель: он независимо переносит решения attributes_judge по четырём атрибутам без повторного анализа транскрибации:
- interest;
- funding_source;
- purchase_term;
- next_contact_date.

Допустимые решения: AUTO_SAVE, SAVE_UNDETERMINED, DO_NOT_UPDATE, TECHNICAL_ERROR. Ошибка одного атрибута не блокирует остальные. READY означает, что все четыре решения допускают сохранение; PARTIAL_READY — допускается сохранение хотя бы одного атрибута и хотя бы один заблокирован; BLOCKED — заблокированы все четыре.

Документируемый JSON:
{
  "decisions": {"interest":"", "funding_source":"", "purchase_term":"", "next_contact_date":""},
  "values_for_save": {"interest":null, "funding_source":null, "purchase_term":null, "next_contact_date":null},
  "blocked_attributes": [],
  "technical_errors": [],
  "gate_status": ""
}

Источник deterministic runtime:
{{ctx.attributes_judge}}`;
  gate.promptVersion = 22;
  gate.runtimeType = "deterministic";
  gate.actualExecutor = "code";
  gate.sourceOutKey = "attributes_judge";
  gate.contractId = "application_attributes_quality_gate";
  gate.contractVersion = "v1";

  crm.prompt = `Ты — отображаемая конфигурация deterministic формирования результата для CRM.

Runtime не вызывает модель и использует только attributes_quality_gate. Он формирует attributes и update_actions для четырёх атрибутов: interest, funding_source, purchase_term, next_contact_date. Значения передаются без изменений только при AUTO_SAVE или SAVE_UNDETERMINED; DO_NOT_UPDATE даёт SKIP, TECHNICAL_ERROR даёт ERROR. Ошибка одного атрибута не изменяет остальные.

Документируемый JSON:
{
  "attributes": {"interest":[], "funding_source":"не определено", "purchase_term":"не определено", "next_contact_date":null},
  "update_actions": {"interest":"SET", "funding_source":"SET", "purchase_term":"SET", "next_contact_date":"SKIP"},
  "pipeline_status": "READY",
  "blocked_attributes": [],
  "technical_errors": []
}

Источник deterministic runtime:
{{attributes_quality_gate}}`;
  crm.promptVersion = 22;
  crm.runtimeType = "deterministic";
  crm.actualExecutor = "code";
  crm.sourceOutKey = "attributes_quality_gate";
  crm.contractId = "crm_attributes_result";
  crm.contractVersion = "v1";

  config.revision = 22;
})();
