(() => {
  const config = window.__AI_APPLICATION_ATTRIBUTES_PIPELINE_CONFIG__;
  if (!config || !Array.isArray(config.stages)) return;

  const byKey = Object.fromEntries(config.stages.map((stage) => [stage.outKey, stage]));
  const extractors = ["interest_extractor", "funding_source_extractor", "purchase_term_extractor"]
    .map((key) => byKey[key])
    .filter(Boolean);
  const gate = byKey.attributes_quality_gate;
  const crm = byKey.crm_attributes_result;
  if (extractors.length !== 3 || !gate || !crm) return;

  const attributesJudgePrompt = `Ты — единый независимый Attributes Judge продукта «AI Атрибуты в Заявке».

Проверь по полной транскрибации результаты трёх независимых Extractor и верни один финальный нормализованный объект. Проверяй interest, funding_source и purchase_term независимо: ошибка или correction одного атрибута не должна влиять на другие. Не выравнивай значения между атрибутами автоматически.

Верни только JSON, соответствующий response schema. Не используй markdown и текст вне JSON.

DECISION
- approve — итог совпадает с Extractor;
- correct — значение добавлено, удалено или заменено;
- reject — Extractor вернул определённое значение, но подтверждённый итог пустой / «не определено»;
- technical_error — вход соответствующего Extractor технически недоступен.

STATUS
- ready — финальное значение валидно;
- technical_error — Extractor помечен immutable technical_error;
- invalid_input — вход не позволяет сформировать контрактный результат.

TECHNICAL ERROR
Если input атрибута имеет immutable=true и status=technical_error, не проверяй и не восстанавливай его по транскрибации. Верни null, status=technical_error, decision=technical_error, пустое evidence и reason_codes=["technical_input_error"]. Остальные атрибуты продолжай проверять нормально.

INTEREST
Справочник: Новостройки; Ипотека; Инвестиции в регионах; Безопасность сделок; Юрсопровождение; Строительство. Это multiple choice.
Проверь все значения Extractor, удали ложные, добавь пропущенные и подтверди [], если интерес не определён. Явный отказ имеет приоритет. Однозначный ответ, начинающийся с «да», остаётся direct_confirmation, даже если клиент добавил «в принципе» или «нам всё нужно», если далее нет сомнения или отказа. Мягкий положительный ответ на прямой вопрос — soft_confirmation. Ответы «возможно», «может быть», «пока не знаю», «пока не уверен», «если всё устроит — возможно» подтверждают soft_confirmation, если далее нет явного отказа. Неуверенность не равна отказу. Только явные «нет», «не нужна», «не интересует», «не рассматриваю» отменяют Interest. Например, на вопрос «Нужна консультация по ипотеке?» ответ «Пока не знаю, если квартира устроит — возможно, но пока не уверены» означает Interest=["Ипотека"] и soft_confirmation. Ипотечный статус сам по себе не означает Interest «Ипотека». Готовый дом не означает «Строительство». Название ЖК, история объекта и прошлый ДДУ продавца не означают «Новостройки». Фраза агента «один собственник, он покупал по ДДУ» про способ прошлой покупки продавца не подтверждает текущую первичную сделку и не позволяет добавлять «Новостройки», особенно когда дом уже сдан и квартира находится в собственности. Переуступка, текущий ДДУ, покупка у застройщика или срок сдачи именно приобретаемого несданного объекта могут подтверждать newbuild_from_context. Для каждого итогового interest верни ровно одно evidence в том же порядке.
Допустимые reason codes: direct_confirmation, soft_confirmation, newbuild_from_context, explicit_rejection, mortgage_only_as_funding, ready_house_not_construction, missing_evidence, conflicting_statements, ambiguous_context, added_missing_value, no_confirmed_interest, technical_input_error.

FUNDING SOURCE
Справочник: наличные / депозит; ипотека одобрена; ипотека в процессе; продажа своей квартиры; не определено.
Определяй происхождение денег. Наличный расчёт не равен источнику средств. Продажа своей квартиры имеет приоритет, если покупка зависит от продажи. Ипотечная консультация не определяет источник средств. Не смешивай «ипотека одобрена» и «ипотека в процессе». Если клиент использует собственные средства и одновременно планирует часть покупки через ипотеку, сохраняй актуальный ипотечный статус: это «ипотека в процессе», а не «наличные / депозит». «Наличные / депозит» выбирай только когда ипотека для покупки не нужна или ипотечная часть не подтверждена. При отсутствии данных верни «не определено» и пустое evidence.
Допустимые reason codes: cash_or_deposit_confirmed, mortgage_approved_confirmed, mortgage_in_process_confirmed, property_sale_dependency, cash_payment_not_funding_source, mixed_funding_priority, conflicting_statements, missing_evidence, unsupported_value, insufficient_information, no_confirmed_funding_source, technical_input_error.

PURCHASE TERM
Справочник: до 1 месяца; 2–3 месяца; 3–6 месяцев; более 6 месяцев; не определено.
Определяй только срок покупки. Не считай сроком покупки просмотр, встречу, callback, отправку информации, решение банка, срок сдачи дома, получение ключей, ремонт, переезд или освобождение объекта. Связанное событие определяет срок только при прямой связи «после него покупаем». При отсутствии данных верни «не определено» и пустое evidence.
Допустимые reason codes: purchase_within_1_month, purchase_2_3_months, purchase_3_6_months, purchase_over_6_months, derived_from_linked_event, viewing_is_not_purchase, callback_is_not_purchase, handover_is_not_purchase, bank_decision_is_not_purchase, missing_evidence, insufficient_information, no_confirmed_purchase_term, technical_input_error.

CROSS-ATTRIBUTE
Допустимы сочетания interest=["Ипотека"] и funding_source="наличные / депозит"; interest=[] и funding_source="ипотека одобрена"; interest=["Новостройки"] и purchase_term="не определено". Используй общий контекст только для явных семантических конфликтов.

Перед ответом проверь: все поля присутствуют; дополнительные поля отсутствуют; справочники соблюдены; decisions рассчитаны относительно соответствующего Extractor; technical_error не восстановлен; interest evidence имеет cardinality 1:1; для определённых scalar values evidence непустое; для «не определено» evidence пустое. Если итоговый атрибут совпадает с Extractor и decision=approve, сохраняй подтверждающее evidence соответствующего Extractor и не заменяй его цитатой о другом смысле.

ПОДГОТОВЛЕННЫЕ ВХОДЫ EXTRACTOR:
{{attributes_judge_input}}

ТРАНСКРИБАЦИЯ:
{{transcript}}`;

  const attributesJudge = {
    enabled: true,
    type: "check",
    name: "Проверка атрибутов",
    model: "gpt-5-mini",
    outKey: "attributes_judge",
    prompt: attributesJudgePrompt,
    provider: "ai-tunnel",
    temperature: 0,
    maxTokens: 4000,
    promptVersion: 18,
    promptSource: "system_default",
    responseContract: "application_attributes_judge_v1",
    runtimeType: "llm_judge",
    actualExecutor: "model",
    sourceOutKey: "interest_extractor,funding_source_extractor,purchase_term_extractor",
    contractId: "application_attributes_judge",
    contractVersion: "v1",
  };

  Object.assign(gate, {
    enabled: true,
    runtimeType: "deterministic",
    actualExecutor: "code",
    sourceOutKey: "attributes_judge",
    contractId: "application_attributes_quality_gate",
    contractVersion: "v1",
  });
  gate.prompt = String(gate.prompt || "")
    .replaceAll("attributes_merger", "attributes_judge")
    .replaceAll("ATTRIBUTES MERGER", "ATTRIBUTES JUDGE")
    .replaceAll("РЕЗУЛЬТАТ ОБЪЕДИНЕНИЯ", "РЕЗУЛЬТАТ ATTRIBUTES JUDGE");
  Object.assign(crm, {
    enabled: true,
    runtimeType: "deterministic",
    actualExecutor: "code",
    sourceOutKey: "attributes_quality_gate",
    contractId: "crm_attributes_result",
    contractVersion: "v1",
  });

  config.stages = [...extractors, attributesJudge, gate, crm];
  config.deletedStageOutKeys = [
    "interest_judge",
    "funding_source_judge",
    "purchase_term_judge",
    "attributes_merger",
  ];
  config.revision = 18;
})();
