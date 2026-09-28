(() => {
  const config = window.__AI_APPLICATION_ATTRIBUTES_PIPELINE_CONFIG__;
  if (!config || !Array.isArray(config.stages)) return;

  const byKey = Object.fromEntries(config.stages.map((stage) => [stage.outKey, stage]));
  const interest = byKey.interest_extractor;
  const nextContact = byKey.next_contact_date_extractor;
  const judge = byKey.attributes_judge;
  const insertBefore = (source, marker, addition) => {
    if (!source || source.includes(addition.trim())) return source;
    return source.includes(marker)
      ? source.replace(marker, `${addition}\n\n${marker}`)
      : `${source}\n\n${addition}`;
  };

  const safetyRule = `БЕЗОПАСНОСТЬ СДЕЛОК — ОТДЕЛЬНАЯ ПОТРЕБНОСТЬ

Не выбирай «Безопасность сделок» только потому, что клиент задаёт стандартные вопросы о юридическом состоянии конкретного приобретаемого объекта: обременении, собственниках, прописанных лицах, документах, истории или юридической чистоте этой квартиры/дома.

Выбирай «Безопасность сделок» только при отдельной подтверждённой потребности клиента в услуге или консультации по безопасному проведению сделки, рискам сделки, безопасным расчётам, защите от мошенничества либо отдельной проверке безопасности сделки.

Negative: «Есть обременение?», «Сколько собственников?», «Квартира юридически чистая?», «Кто прописан?» → не «Безопасность сделок».
Positive: «Нужна отдельная проверка безопасности сделки, чтобы исключить риски», «Проверьте схему расчётов и риски мошенничества» → «Безопасность сделок».`;

  const judgeSafetyRule = `HARD-NEGATIVE ДЛЯ «БЕЗОПАСНОСТЬ СДЕЛОК»

Стандартный вопрос о юридическом состоянии конкретного приобретаемого объекта — об обременении, собственниках, прописанных, документах, истории или юридической чистоте объекта — сам по себе не является отдельной потребностью «Безопасность сделок». Если Extractor выбрал это значение только по такому evidence, удали его, верни decision=correct/reject относительно результата Extractor и добавь reason code object_legal_question_not_safety_service.

Сохраняй «Безопасность сделок», если клиент отдельно просит услугу/консультацию по безопасному проведению сделки, рискам, безопасным расчётам, защите от мошенничества или отдельной проверке безопасности сделки.`;

  const nextContactRule = `ПОРЯДОК ВЫБОРА ДОГОВОРЁННОСТИ

Если агент подтвердил, что сам свяжется с клиентом, верни detected=true даже для разговорного или условного времени: «сейчас», «позже», «как освобожусь», «как узнаю». Конкретный datetime рассчитает deterministic normalizer.

При нескольких договорённостях выбери последнюю актуальную подтверждённую договорённость. Более точная поздняя формулировка заменяет общую: «позже» → «сегодня вечером» → «в 18:30». Если финальная договорённость передаёт инициативу клиенту, верни detected=false, action=none, actor=none.

Не создавай Next Contact по просмотру или встрече без отдельного обещания агента связаться, по предположению либо по неподтверждённому предложению.`;

  if (interest) {
    interest.prompt = insertBefore(interest.prompt, "ПЕРЕД ОТВЕТОМ ПРОВЕРЬ", safetyRule);
    interest.promptVersion = 26;
  }
  if (nextContact && nextContact.promptSource === "system_default") {
    nextContact.prompt = String(nextContact.prompt || "")
      .replace("Если клиент должен связаться сам, договорённости нет или время не определено, верни detected=false.", "Если клиент должен связаться сам или подтверждённой договорённости нет, верни detected=false.")
      .replace("Извлекай семантику, не выполняй календарную арифметику.", `${nextContactRule}\n\nИзвлекай семантику, не выполняй календарную арифметику.`);
    nextContact.promptVersion = 27;
    nextContact.promptEdited = false;
  }
  if (judge) {
    judge.prompt = insertBefore(judge.prompt, "CROSS-ATTRIBUTE", judgeSafetyRule);
    judge.promptVersion = 26;
  }

  config.revision = 26;
})();
