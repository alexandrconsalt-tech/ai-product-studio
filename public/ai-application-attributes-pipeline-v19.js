(() => {
  const config = window.__AI_APPLICATION_ATTRIBUTES_PIPELINE_CONFIG__;
  if (!config || !Array.isArray(config.stages)) return;

  const purchaseTermIndex = config.stages.findIndex((stage) => stage.outKey === "purchase_term_extractor");
  if (purchaseTermIndex < 0) return;

  const nextContactDate = {
    enabled: true,
    type: "llm",
    name: "Определение даты следующего контакта",
    model: "gpt-5-mini",
    outKey: "next_contact_date_extractor",
    prompt: `Настройте инструкции для определения даты следующего контакта.

Доступные входные переменные:

Транскрибация:
{{transcript}}

Верните результат в формате JSON.`,
    provider: "ai-tunnel",
    temperature: 0,
    maxTokens: 2000,
    promptVersion: 1,
    promptSource: "system_default",
  };

  const existingIndex = config.stages.findIndex((stage) => stage.outKey === nextContactDate.outKey);
  if (existingIndex >= 0) config.stages.splice(existingIndex, 1);
  config.stages.splice(purchaseTermIndex + 1, 0, nextContactDate);
  config.revision = 19;
})();
