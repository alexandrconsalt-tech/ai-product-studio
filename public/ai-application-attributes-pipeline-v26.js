(() => {
  const config = window.__AI_APPLICATION_ATTRIBUTES_PIPELINE_CONFIG__;
  if (!config || !Array.isArray(config.stages)) return;

  const byKey = Object.fromEntries(config.stages.map((stage) => [stage.outKey, stage]));
  const interest = byKey.interest_extractor;
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

  if (interest) {
    interest.prompt = insertBefore(interest.prompt, "ПЕРЕД ОТВЕТОМ ПРОВЕРЬ", safetyRule);
    interest.promptVersion = 26;
  }
  if (judge) {
    judge.prompt = insertBefore(judge.prompt, "CROSS-ATTRIBUTE", judgeSafetyRule);
    judge.promptVersion = 26;
  }

  config.revision = 26;
})();
