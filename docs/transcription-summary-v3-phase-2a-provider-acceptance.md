# Transcription Summary v3 — Phase 2A Provider Acceptance

Дата: 2026-07-30
Статус: **provider acceptance postponed by product-owner decision**

Provider acceptance postponed by product-owner decision until complete pipeline preview testing.

Phase 2A не закрыта и не считается успешно пройденной. По решению владельца продукта отсутствие real-provider acceptance больше не блокирует реализацию следующих v3-фаз. Предыдущая controlled попытка Direct OpenAI завершилась отклонением credentials на первом вызове до генерации structured response; остальные четыре вызова не запускались. Валидный mock-ответ не считается доказательством provider acceptance.

До финального deployment v3 разрешён только через Direct OpenAI transport. AI Tunnel остаётся заблокированным для v3, пока не реализована проверяемая attestation полного Structured Output chain. Fail-closed, exact Registry schema, запрет text fallback и возможность позднее повторить controlled test сохраняются.

## Выбранный transport path

Выбран вариант A: отдельный controlled direct OpenAI adapter, не подключённый к production pipeline.

- Endpoint: `POST https://api.openai.com/v1/chat/completions`.
- Модель по умолчанию: `gpt-5-mini-2025-08-07`.
- Формат: `response_format.type = "json_schema"`.
- `json_schema.strict = true`.
- Schema: непосредственно `contract.schema` из Versioned Contract Registry, сформированная `z.toJSONSchema` в `defineContract`.
- Post-response validation: исходный `contract.validator`.

Выбран pinned snapshot, чтобы acceptance оставался воспроизводимым. Официальная страница модели подтверждает поддержку Chat Completions и Structured Outputs:

- <https://developers.openai.com/api/docs/models/gpt-5-mini>
- <https://platform.openai.com/docs/api-reference/chat/create>

## Diagnostic adapter

Test-only adapter:

`src/features/transcription-summary/provider-acceptance/openai-controlled-adapter.ts`

Adapter:

- не импортируется production runtime;
- не читает production pipeline data;
- не сохраняет API key или Authorization header;
- не извлекает JSON из Markdown/окружающего текста;
- не переключается на обычный completion;
- не меняет schema или model между попытками;
- допускает не более initial + одной repair-попытки;
- возвращает только безопасный diagnostic record.

Diagnostic record:

```json
{
  "provider": "openai",
  "model": "gpt-5-mini-2025-08-07",
  "providerRequestId": "<redacted: 36 chars>",
  "contractId": "facts.agent.output.v3",
  "contractVersion": "3.0.0",
  "schemaHash": "<sha256>",
  "responseFormatRequested": true,
  "providerAcceptedRequest": false,
  "responseType": null,
  "zodValidationPassed": false,
  "validationIssues": [],
  "repairAttempted": false,
  "attemptCount": 1,
  "durationMs": 1054
}
```

Schema hash первого вызова: `a2329512a7076626524944a5fc5f46ff4bff4b301ec19648d59c845c2c7b840e`.

Значения выше показывают реальный отклонённый provider request, а не успешный provider result. Ключ, Authorization header, полный request и provider response в diagnostics и отчёт не включены.

## Результат controlled acceptance

Модель: `gpt-5-mini-2025-08-07`.

| Вызов | Contract | Version | Schema hash | Structured Output requested | Provider accepted | Provider request ID | Zod | Attempts | Repair | Duration | Итог |
|---|---|---|---|---:|---:|---|---:|---:|---:|---:|---|
| 1 | `facts.agent.output.v3` | `3.0.0` | `a2329512a7076626524944a5fc5f46ff4bff4b301ec19648d59c845c2c7b840e` | да | нет | `<redacted: 36 chars>` | не выполнялась | 1 | нет | 1054 ms | provider отклонил credentials |
| 2 | `needs.agent.output.v3` | `3.0.0` | не фиксировался | не отправлялся | нет | отсутствует | не выполнялась | 0 | нет | — | не запущен после ошибки вызова 1 |
| 3 | `outcome.agent.output.v3` | `3.0.0` | не фиксировался | не отправлялся | нет | отсутствует | не выполнялась | 0 | нет | — | не запущен после ошибки вызова 1 |
| 4 | `summary.judge.verdict.v3` — `faithfulness` | `3.0.0` | не фиксировался | не отправлялся | нет | отсутствует | не выполнялась | 0 | нет | — | не запущен после ошибки вызова 1 |
| 5 | `summary.judge.verdict.v3` — `format` | `3.0.0` | не фиксировался | не отправлялся | нет | отсутствует | не выполнялась | 0 | нет | — | не запущен после ошибки вызова 1 |

Для первого вызова JSON Schema и schema hash получены из `FactsV3Contract` в Versioned Contract Registry; `response_format.type = "json_schema"` и `strict = true` были переданы Direct OpenAI transport. Legacy parser и text fallback не использовались. Provider acceptance, structured response и Zod validation не подтверждены.

## Controlled fixtures

Gated real-provider test подготовлен для:

1. `facts.agent.output.v3` — синтетический вопрос «Там переуступка?» должен остаться `client_questions`, не confirmed fact.
2. `needs.agent.output.v3` — «Покупаю за наличные» должно дать `funding_source = "наличные / депозит"`.
3. `outcome.agent.output.v3` — «Сегодня отправлю планировку клиенту по электронной почте» должно вернуть полный v3 object.
4. `summary.judge.verdict.v3` — отдельные вызовы для `faithfulness` и `format`.

Fixtures не содержат персональных или production-данных.

Outcome assertions отклоняют:

- `call_results`;
- `agreement_id`;
- legacy `text`;
- любой объект, не прошедший `OutcomeV3Contract.validator`.

## Доказательства transport chain

| Проверка | Unit/mock | Real OpenAI |
|---|---:|---:|
| Schema взята из Registry | подтверждено identity/assertion | подтверждено для первого request |
| `response_format` содержит ту же schema | подтверждено request-body assertion | отправлено для первого request |
| `strict=true` | подтверждено | отправлено для первого request |
| Provider принял request | только simulated HTTP 200, не acceptance | нет, credentials отклонены |
| Provider request ID | simulated `req_test` | получен и обезличен |
| Structured response type | simulated `chat.completion` | отсутствует |
| Исходный Zod validator прошёл | подтверждено на mock fixture | не выполнено |
| Text fallback отсутствует | подтверждено | подтверждено для отклонённого request |

Следовательно, transport chain пока не доказана end-to-end.

## Repair

Unit test подтверждает:

- максимум две попытки;
- во второй попытке используется тот же contract;
- `response_format` и schema побайтно эквивалентны первой попытке;
- Structured Output не отключается;
- text fallback отсутствует.

Реальный repair искусственно не провоцировался. При гарантированном schema-compliant ответе OpenAI это ожидаемо; реальный acceptance должен лишь зафиксировать фактическое значение `repairAttempted`.

## Error tests

Mock transport tests проходят для:

- invalid schema → `STRUCTURED_OUTPUT_SCHEMA_REJECTED`;
- unsupported model → `STRUCTURED_OUTPUT_UNAVAILABLE`;
- provider HTTP error → `PROVIDER_ERROR`;
- abort timeout → `TIMEOUT`;
- invalid JSON → `JSON_DECODE_ERROR`;
- Zod mismatch после исчерпания repair → `SCHEMA_VALIDATION_ERROR`.

Ни один error result не содержит quality score.

## AI Tunnel comparison

Реальный AI Tunnel diagnostic не выполнялся: проверяемая attestation отсутствует.

| Проверка | Direct OpenAI harness | AI Tunnel v3 |
|---|---:|---:|
| Schema формируется из Registry | да | да до transport boundary |
| Schema forwarding подтверждён | request сформирован, provider отклонил credentials | нет |
| Provider acceptance подтверждён | нет | нет |
| Provider request ID доступен | да, обезличен | нет |
| Structured response подтверждён | нет | нет |
| Text fallback отсутствует | да | да, fail-closed до вызова |

AI Tunnel остаётся исключённым из успешного v3 path и возвращает `STRUCTURED_OUTPUT_UNAVAILABLE`.

## Как выполнить controlled acceptance

Ключ передаётся только через environment текущего процесса:

```bash
OPENAI_API_KEY="<temporary non-production key>" \
  npx vitest run \
  src/features/transcription-summary/provider-acceptance/openai-controlled.integration.test.ts
```

Опционально:

```bash
PHASE2A_OPENAI_MODEL="gpt-5-mini-2025-08-07"
PHASE2A_DIAGNOSTIC_OUTPUT="/tmp/transcription-summary-phase2a-provider-acceptance.json"
```

Файл diagnostics создаётся с mode `0600`, не содержит ключ, headers, raw prompts или raw provider response. Default path находится вне репозитория.

## Transport decision

Текущее решение: **C — provider acceptance не подтверждён**.

После успешного controlled test решение может стать:

- **B**: отдельный проверяемый direct OpenAI transport для v3;
- **A** только если AI Tunnel начнёт возвращать проверяемую attestation и пройдёт отдельный реальный тест.

## Отложенные условия provider acceptance

Эти условия не блокируют Phase 3–8, но должны быть выполнены до финального production deployment:

1. Предоставить процессу integration test действительный временный non-production OpenAI API key.
2. Получить реальные provider request IDs и schema-compliant ответы для пяти controlled calls.
3. Подтвердить Direct OpenAI transport для v3 Structured Output.
4. Не разблокировать AI Tunnel без проверяемой attestation и отдельного controlled test.

Store blocker остаётся без изменений: `outcome.verified.v3 → Conversation Store v1` возвращает `LOSSY_COMPATIBILITY_MAPPING`. Его устранение относится к Conversation Store v3, а не к Phase 2A.

## Production и Store

- Production feature flag не включён.
- Production deployment не выполнялся.
- Production pipeline не изменён Phase 2A.
- Conversation Store v1 и его бизнес-логика не изменялись.
- `agreement_ids` не генерируются и approximate mapping не добавлен.
