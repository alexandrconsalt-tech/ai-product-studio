(() => {
  const config = window.__AI_APPLICATION_ATTRIBUTES_PIPELINE_CONFIG__;
  if (!config || !Array.isArray(config.stages)) return;
  const stage = config.stages.find((item) => item.outKey === "next_contact_date_extractor");
  if (!stage) return;

  if (stage.promptSource === "system_default") {
    stage.prompt = String(stage.prompt || "").replace(
      "Не используй время запуска pipeline.",
      `Не используй время запуска pipeline.

Правила нормализации подтверждённой договорённости:
- «сегодня вечером» нормализуй в 18:00 календарной даты call_datetime в указанной timezone и верни полный ISO datetime с offset;
- диапазон «через 30–40 минут» нормализуй в середину диапазона: call_end_datetime + 35 минут;
- если агент предложил контакт в конкретный период, а клиент явно согласился или сообщил, что будет ждать, это подтверждённая договорённость: detected=true и confidence не ниже 0.90;
- precision=daypart не означает дату без времени: next_contact_at всё равно должен содержать нормализованное время начала периода.`
    );
    stage.promptVersion = 23;
    stage.promptEdited = false;
  }
  config.revision = 23;
})();
