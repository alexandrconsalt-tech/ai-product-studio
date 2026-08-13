(() => {
  const config = window.__AI_APPLICATION_ATTRIBUTES_PIPELINE_CONFIG__;
  if (!config || !Array.isArray(config.stages)) return;

  const schema = Object.freeze({
    type: "object",
    additionalProperties: false,
    required: ["detected", "next_contact_at", "precision", "action", "actor", "raw_time_expression", "evidence", "confidence"],
    properties: {
      detected: { type: "boolean" },
      next_contact_at: { type: ["string", "null"] },
      precision: { type: "string", enum: ["exact", "range", "daypart", "date", "none"] },
      action: { type: "string", enum: ["callback", "message", "send_information", "confirm", "other", "none"] },
      actor: { type: "string", enum: ["agent", "none"] },
      raw_time_expression: { type: ["string", "null"] },
      evidence: { type: ["string", "null"] },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
  });
  window.__AI_APPLICATION_ATTRIBUTES_NEXT_CONTACT_DATE_SCHEMA_V1__ = schema;

  const stage = config.stages.find((item) => item.outKey === "next_contact_date_extractor");
  if (!stage) return;
  if (stage.promptSource === "system_default") {
    stage.prompt = `Ты — AI-экстрактор смысла атрибута заявки «Дата следующего контакта».

Определи только подтверждённый будущий контакт, который должен инициировать агент: звонок, сообщение, отправку информации или отдельное подтверждение договорённости. Не считай следующим контактом показ, просмотр или встречу сами по себе. Если клиент должен связаться сам, договорённости нет или время не определено, верни detected=false.

Твоя задача — извлечь семантику, а не выполнять календарную арифметику. Для detected=true:
- дословно сохрани временную формулировку в raw_time_expression;
- определи actor, action, precision, evidence и confidence;
- next_contact_at верни null: абсолютную дату после ответа вычислит deterministic temporal normalizer.

precision: exact — точное время; range — диапазон; daypart — период дня; date — дата или день недели без точного времени; none — только для detected=false.

Если агент однозначно обещает связаться, а клиент подтверждает или завершает разговор фразой «до пятницы/до завтра», это подтверждённая договорённость: confidence не ниже 0.90. Показ в субботу в 10:30 без отдельного обещания агента связаться — не следующий контакт.

Дата и время звонка:
{{call_datetime}}

Дата и время окончания звонка:
{{call_end_datetime}}

Timezone:
{{timezone}}

ТРАНСКРИБАЦИЯ:
{{transcript}}

Верни только JSON по настроенному response contract без markdown и пояснений.`;
    stage.promptVersion = 24;
    stage.promptEdited = false;
  }
  stage.responseContract = "application_next_contact_date_extractor_v1";
  config.revision = 24;
})();
