(() => {
  const config = window.__AI_APPLICATION_ATTRIBUTES_PIPELINE_CONFIG__;
  if (!config || !Array.isArray(config.stages)) return;

  const byKey = Object.fromEntries(config.stages.map((stage) => [stage.outKey, stage]));
  const nextContact = byKey.next_contact_date_extractor;
  const judge = byKey.attributes_judge;
  if (!nextContact || !judge) return;

  const nextContactPrompt = `Ты — AI-экстрактор атрибута заявки «Дата следующего контакта».

Определи только подтверждённый будущий контакт, который должен инициировать агент: звонок, сообщение, отправку информации или отдельное подтверждение договорённости. Не считай датой следующего контакта показ, просмотр или встречу сами по себе. Если клиент должен связаться сам либо календарное время нельзя надёжно определить, верни detected=false и next_contact_at=null.

Нормализуй относительные даты только относительно фактических metadata звонка. Для «через N минут» используй call_end_datetime. Не используй время запуска pipeline.

Дата и время звонка:
{{call_datetime}}

Дата и время окончания звонка:
{{call_end_datetime}}

Timezone:
{{timezone}}

ТРАНСКРИБАЦИЯ:
{{transcript}}

Верни только JSON по настроенному response contract без markdown и пояснений.`;

  const placeholder = String(nextContact.prompt || "").startsWith("Настройте инструкции для определения даты следующего контакта.");
  if (nextContact.promptSource === "system_default" || placeholder) {
    nextContact.prompt = nextContactPrompt;
    nextContact.promptVersion = 21;
    nextContact.promptSource = "system_default";
    nextContact.promptEdited = false;
  }
  nextContact.responseContract = "application_next_contact_date_extractor_v1";

  if (!judge.prompt.includes("NEXT CONTACT DATE")) {
    judge.prompt = judge.prompt
      .replace("результаты трёх независимых Extractor", "результаты четырёх независимых Extractor")
      .replace("Проверяй interest, funding_source и purchase_term независимо", "Проверяй interest, funding_source, purchase_term и next_contact_date независимо")
      .replace("CROSS-ATTRIBUTE", `NEXT CONTACT DATE
Проверяй только подтверждённый контакт, который инициирует агент. Значение — объект Extractor без поля evidence либо null. Для detected=true обязательны actor=agent, валидный ISO next_contact_at, непустое evidence из transcript и confidence >= 0.90. Проверяй нормализацию относительно call_datetime/call_end_datetime и timezone. Показ или встреча сами по себе не являются следующим контактом. Если договорённости нет, время неоднозначно или клиент связывается сам — верни null с status=ready. Ошибка этого атрибута не должна менять остальные три.
Допустимые reason codes: next_contact_confirmed, next_contact_not_confirmed, client_initiates_contact, viewing_is_not_next_contact, insufficient_time_precision, invalid_datetime, missing_evidence, incorrect_relative_date, technical_input_error.

CROSS-ATTRIBUTE`);
    judge.promptVersion = 21;
  }
  judge.sourceOutKey = "interest_extractor,funding_source_extractor,purchase_term_extractor,next_contact_date_extractor";
  judge.maxTokens = Math.max(Number(judge.maxTokens) || 0, 5000);

  config.revision = 21;
})();
