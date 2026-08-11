# Transcription Summary v3 — Phase 2 Structured Output

Дата: 2026-07-30
Статус: **Phase 2 code-complete, provider acceptance blocked**

## Scope

Под feature flag `TRANSCRIPTION_SUMMARY_V3_CONTRACT_REGISTRY` к единому Structured Output пути подключены роли:

- `facts`, `factJudge`;
- `needs`, `needJudge`;
- `outcome`, `outcomeJudge`;
- пять запусков `summaryJudges` с критериями `faithfulness`, `completeness`, `usefulness`, `agreements_next_step`, `format`.

Не изменены Summary generation, бизнес-логика Conversation Store v1, бизнес-логика Quality Gate v1, CRM и Pipeline Report UI. Production deployment и включение production-флага не выполнялись.

## Prerequisite expansion

В Registry добавлены draft-контракты версии `3.0.0`:

- `facts.verified.v3`;
- `needs.verified.v3`;
- `outcome.verified.v3`.

Manifest теперь содержит роли `factsVerified`, `needsVerified`, `outcomeVerified`. Manifest hash включает эти ссылки. Валидация требует одинаковую версию Agent, Judge и Verified контрактов внутри каждой цепочки.

`summary.judge.verdict.v3` заменён единым envelope с discriminated payload по пяти критериям. При `technical_error` запрещены обычные `score` и `confidence`.

## Transport architecture

Исполняемый путь под флагом:

```text
immutable manifest
→ Contract Registry definition
→ JSON Schema из той же definition
→ provider response_format
→ attestation requested/forwarded/accepted/structuredResponseReturned
→ строгий JSON.decode без markdown extraction
→ исходный Zod validator Registry
→ typed result
```

Standalone iframe получает флаг только typed-сообщением от React bridge. React получает read-only config с серверного endpoint. Значение по умолчанию и при любой ошибке — `false`. Query parameter и Local Storage не могут включить v3. В production endpoint принудительно возвращает `false`.

Manifest создаётся один раз в начале run и сохраняется в `ctx.__v3_manifest`. Каждый stage передаёт его hash серверному adapter; несовпадение блокирует запрос.

## Prompt builder

Resolved prompt полностью видим и состоит из:

1. system role;
2. business instruction;
3. contract ID/version/schema hash;
4. canonical dictionaries из `canonical-enums.ts`, если они указаны контрактом;
5. input data.

Сохраняются base/resolved prompt, prompt version/hash, contract ID/version и schema hash. После вычисления hash скрытые appendices не добавляются.

## No-fallback и repair policy

V3-путь:

- не извлекает JSON из Markdown или окружающего текста;
- не принимает legacy shape;
- не повторяет запрос без `response_format`;
- не переключает provider/model;
- допускает максимум одну repair-попытку;
- repair использует тот же contract и тот же JSON Schema;
- schema/provider/transport error становится `TECHNICAL_ERROR`.

Коды: `JSON_DECODE_ERROR`, `SCHEMA_VALIDATION_ERROR`, `PROVIDER_ERROR`, `PROVIDER_SCHEMA_ERROR`, `STRUCTURED_OUTPUT_UNAVAILABLE`, `STRUCTURED_OUTPUT_NOT_APPLIED`, `TIMEOUT`, `RATE_LIMIT`.

## Deterministic reconciliation

Новый слой реализует только:

- сопоставление Agent/Judge по ID;
- проверку source turn IDs;
- применение разрешённых correction fields;
- исключение `rejected` и `not_enough_evidence`;
- формальную дедупликацию внутри одного типа коллекции;
- проверку обязательных полей и canonical values итоговой Zod-схемой;
- verdict trail для каждого элемента.

Он не импортирует и не вызывает `mergeFactCheck`, `mergeNeedCheckV2`, `mergeOutcomeCheck`, `factCodeSemanticRejection`, LLM или legacy parser. Judge technical error не создаёт verified-объект.

Каждая запись trail содержит `item_id`, исходное `agent_value`, `judge_verdict`, применённую correction, результат invariant, финальный verdict и `rule_id`.

## Temporary compatibility adapters

Явные adapters существуют только на v3-ветке:

- `facts.verified.v3 → Conversation Store v1`;
- `needs.verified.v3 → Conversation Store v1`;
- `outcome.verified.v3 → Conversation Store v1`;
- `summary.judge.verdict.v3 → Quality Gate v1`.

Каждый mapping возвращает отдельный log с adapter ID, source contract, target, mapped paths и флагом lossless/lossy. Typed v3 source сохраняется отдельно и не передаётся в legacy merge.

Для `outcome.verified.v3` lossless mapping в Store v1 невозможен: Store требует `primary_next_step.agreement_ids`, а v3 Agent/Verified contract не содержит доказуемой связи. Adapter не угадывает её и возвращает `LOSSY_COMPATIBILITY_MAPPING`. Это намеренная fail-closed граница, а не semantic reconciliation.

## Provider capability matrix

| Path | Schema requested | Forwarding доказуем | Acceptance доказуем | Политика |
|---|---:|---:|---:|---|
| AI Tunnel | да | нет, tunnel не возвращает attestation | нет | `STRUCTURED_OUTPUT_UNAVAILABLE`, сетевой вызов не выполняется |
| OpenAI Direct server adapter | да | да, adapter формирует upstream body | да, только успешный upstream response | schema validation; один repair |
| Anthropic Direct | нет совместимого adapter в Phase 2 | нет | нет | `STRUCTURED_OUTPUT_UNAVAILABLE` |
| Mock provider standalone | не является provider acceptance | нет | нет | `STRUCTURED_OUTPUT_UNAVAILABLE` |

Старый `callAiTunnel` сохраняется только для legacy-пути при выключенном флаге. Его fallback без schema не используется v3-веткой.

## Stop behavior

Любая техническая ошибка extraction/Judge/reconciliation/compatibility блокирует зависимые этапы. Provisional данные не записываются в verified context. Старый pipeline path при выключенном флаге проходит прежний `runStage` без изменений бизнес-логики.

## Проверено

Mock/unit tests подтверждают:

- Registry schema передаётся transport без отдельной parser schema;
- Zod Registry валидирует ответ;
- одна repair-попытка сохраняет schema;
- второй invalid response даёт technical error;
- Markdown JSON не извлекается;
- AI Tunnel и неполная attestation закрываются fail-closed;
- verified contracts отклоняют provisional, legacy, duplicate и invalid-source данные;
- question не становится fact;
- canonical Need value не меняется reconciliation;
- technical error не создаёт verified Needs/Outcome;
- все пять Summary Judge payload валидируются;
- compatibility mapping детерминирован и логируется;
- lossy Outcome mapping даёт technical error;
- iframe config по умолчанию false, production false, invalid message отклоняется;
- полный unit suite проекта проходит.

## Не проверено с реальным provider

Реальный платный provider-вызов не выполнялся: секреты не запрашивались и production traffic не использовался. Для acceptance нужен отдельный controlled run с non-production OpenAI key и моделью, поддерживающей переданную JSON Schema. Условие приёмки: upstream принимает `response_format`, возвращает schema-compliant response, diagnostics фиксирует полный attestation chain, text fallback отсутствует.

AI Tunnel acceptance заблокирован до появления проверяемой tunnel metadata:

- schema действительно переслана конечному provider;
- provider принял schema;
- structured response получен именно в schema-enforced режиме;
- tunnel не выполнил скрытый retry без schema.

Валидный JSON сам по себе таким доказательством не считается.

## Rollback

Rollback не требует удаления кода: оставить `TRANSCRIPTION_SUMMARY_V3_CONTRACT_REGISTRY` unset/false. Iframe получает `false`, и весь run идёт по прежнему legacy path. Production endpoint независимо от env возвращает `false`.

## Remaining acceptance blockers и Phase 3

Открытые acceptance conditions:

1. controlled real-provider test для OpenAI Direct;
2. attestation support со стороны AI Tunnel либо подтверждённый отказ от этого transport;
3. устранение lossless mismatch `outcome.verified.v3 → Conversation Store v1` в разрешённой следующей фазе.

Phase 3 должна заниматься canonical normalization и alias policy до Agent/Judge contract boundary. Она не должна возвращать semantic overrides в reconciliation. Миграция Conversation Store на v3 и удаление temporary adapters остаются отдельной последующей фазой.
