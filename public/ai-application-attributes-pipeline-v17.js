(() => {
  const config = window.__AI_APPLICATION_ATTRIBUTES_PIPELINE_CONFIG__;
  if (!config || !Array.isArray(config.stages)) return;

  const byKey = Object.fromEntries(config.stages.map((stage) => [stage.outKey, stage]));
  const insertBefore = (source, marker, addition) => {
    if (!source || source.includes(addition.trim())) return source;
    return source.includes(marker)
      ? source.replace(marker, `${addition}\n\n${marker}`)
      : `${source}\n\n${addition}`;
  };

  const interestEvidenceContract = `ТОЧНАЯ СЕМАНТИКА REASON CODES И EVIDENCE

Название ЖК, проекта или объекта само по себе не является подтверждением «Новостройки» и не может быть единственным evidence.

direct_confirmation используй только когда клиент прямо говорит, что его интересуют или он рассматривает новостройки, либо положительно отвечает на прямой вопрос сотрудника о новостройках. Название объекта вроде «Новые Ватутинки, кварталы Реки» не является direct_confirmation.

Условный положительный ответ, например «Если в пешей доступности от метро, в центре города, то да», классифицируй как soft_confirmation. Он подтверждает «Новостройки», если позднее клиент не отказался.

newbuild_from_context используй только по evidence, содержащему признак текущей первичной сделки: будущий срок сдачи приобретаемого объекта, переуступку, текущий ДДУ, покупку у застройщика либо строящийся/несданный объект. Evidence должно содержать сам этот признак, а не только название проекта.

Для каждого значения из value верни ровно одно evidence в том же порядке. Всегда соблюдай value.length === evidence.length.`;

  const judgeEvidenceContract = `КОНТРАКТ REASON CODES И EVIDENCE

Название ЖК, проекта или объекта не является direct_confirmation и само по себе не доказывает «Новостройки».

direct_confirmation разрешён только для прямой фразы клиента об интересе к новостройкам или положительного ответа клиента на прямой вопрос сотрудника. Условный положительный ответ классифицируй как soft_confirmation.

Если первичный рынок определяется по контексту, используй только newbuild_from_context, а evidence должно содержать признак текущей сделки: будущий срок сдачи приобретаемого объекта, переуступку, текущий ДДУ, покупку у застройщика либо строящийся/несданный объект.

Пример: «Меня интересует объект Новые Ватутинки, кварталы Реки» не является direct_confirmation. Обсуждение, что приобретаемый объект будет сдан примерно через полтора года, является newbuild_from_context.

Для каждого approved value верни ровно одно evidence в том же порядке: approved_values.length === evidence.length. Не добавляй вторую цитату для одного значения.`;

  if (byKey.interest_extractor) {
    byKey.interest_extractor.prompt = insertBefore(
      byKey.interest_extractor.prompt,
      "ПЕРЕД ОТВЕТОМ ПРОВЕРЬ",
      interestEvidenceContract,
    );
    byKey.interest_extractor.promptVersion = 17;
    byKey.interest_extractor.maxTokens = Math.max(Number(byKey.interest_extractor.maxTokens) || 0, 4000);
    byKey.interest_extractor.responseContract = "application_interest_extractor_v1";
  }

  if (byKey.interest_judge) {
    byKey.interest_judge.prompt = insertBefore(
      byKey.interest_judge.prompt,
      "ФОРМАТ",
      judgeEvidenceContract,
    );
    byKey.interest_judge.promptVersion = 17;
  }

  for (const key of ["funding_source_extractor", "purchase_term_extractor"]) {
    if (!byKey[key]) continue;
    byKey[key].maxTokens = Math.max(Number(byKey[key].maxTokens) || 0, 2000);
    byKey[key].responseContract = `application_${key}_v1`;
  }

  const deterministicStages = {
    attributes_merger: {
      sourceOutKey: "interest_judge,funding_source_judge,purchase_term_judge",
      contractId: "application_attributes_merger",
    },
    attributes_quality_gate: {
      sourceOutKey: "attributes_merger",
      contractId: "application_attributes_quality_gate",
    },
  };
  for (const [key, metadata] of Object.entries(deterministicStages)) {
    if (!byKey[key]) continue;
    Object.assign(byKey[key], {
      runtimeType: "deterministic",
      actualExecutor: "code",
      contractVersion: "v1",
      ...metadata,
    });
  }

  config.revision = 17;
})();
