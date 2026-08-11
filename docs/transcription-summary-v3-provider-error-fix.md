# v3 Direct OpenAI provider remediation

Дата: 2026-07-30
Область: только `product_transcription_summary_module`, только v3 Preview runtime.

## Корневая причина

Два ручных Preview-запуска не достигали OpenAI. Активный v3 клиент передавал
`apiKey` из браузерного Local Storage, а server route использовал это значение
вместо Preview-scoped `OPENAI_API_KEY`. В браузере значение было пустым, поэтому
transport завершался до `fetch`.

Подтверждённые признаки:

- `request_dispatched=false` по фактическому пути исполнения;
- отсутствовал provider request ID;
- `duration_ms=0`, tokens/cost равны нулю;
- в Vercel Preview были заданы только
  `TRANSCRIPTION_SUMMARY_V3_ENABLED` и
  `TRANSCRIPTION_SUMMARY_V3_CRM_DRY_RUN`;
- фактической OpenAI HTTP-ошибки до исправления не существовало: запрос не был
  отправлен.

## Исправление

- Preview UI больше не принимает и не передаёт OpenAI API key в v3 requests.
- Direct OpenAI transport читает только server-side `process.env.OPENAI_API_KEY`.
- Missing/empty/unavailable/auth/model/schema/quota/rate-limit/timeout/network
  ошибки имеют отдельные typed codes.
- Endpoint: `POST https://api.openai.com/v1/chat/completions`.
- Request shape: `model`, один `messages[]` user item и
  `response_format.type=json_schema` с `strict=true` и Registry schema.
- Перед dispatch выполняется
  `validateOpenAIStructuredOutputSchema(schema)`.
- `requested=true` выставляется только после реального dispatch.
- Pipeline Report contract обновлён до `pipeline.report.v3@3.2.0` и содержит
  безопасный `provider_diagnostic`; `3.1.0` сохранён как deprecated.

## Безопасность диагностики

Provider block содержит только безопасные метаданные: HTTP status, typed OpenAI
error fields, обезличенный request ID, endpoint, model, contract/schema identity,
environment scope, dispatch/timing/serialization state и token usage.

В provider block не включаются:

- API key и Authorization header;
- request body и prompt;
- транскрипция;
- PII.

Сообщения проходят редактирование API-key, bearer-token, email и телефонных
паттернов и ограничиваются 500 символами.

## Schema preflight

Проверяются все реальные v3 LLM stages:

1. Facts Agent;
2. Facts Judge;
3. Needs Agent;
4. Needs Judge;
5. Outcome Agent;
6. Outcome Judge;
7. Summary Agent;
8. Summary Judge — faithfulness;
9. Summary Judge — completeness;
10. Summary Judge — usefulness;
11. Summary Judge — agreements/next step;
12. Summary Judge — format.

Registry transport schema канонизируется в поддерживаемый OpenAI subset:
служебный `$schema` и неподдерживаемые ограничения не отправляются, optional
provider fields исключаются, `oneOf` преобразуется в поддерживаемый nested
`anyOf`. Summary Judge использует object-root transport schema; исходная
criterion-specific Zod schema остаётся финальной обязательной валидацией.

## Verification

Локальные результаты:

- scoped v3 tests: 465 passed, 1 gated provider-test skipped;
- full `npm test`: 767 passed, 1 gated provider-test skipped;
- `npm run lint`: passed;
- `npm run build`: passed;
- `npm run test:smoke`: 338 passed (desktop + mobile);
- `npx tsc --noEmit`: 321 repository baseline errors, ровно как до изменения;
  ошибок в изменённом v3 scope нет;
- `git diff --check`: passed;
- schema preflight: 12/12 v3 LLM stage-вариантов passed.

Локальный fail-closed integration run с намеренно пустым server key подтвердил:

- Facts Agent: `OPENAI_API_KEY_EMPTY`;
- `request_dispatched=false`;
- `structured_output.required=true`;
- `structured_output.requested=false`;
- `structured_output.applied=false`;
- `duration_ms=3`;
- Facts Judge и весь downstream: `NOT_RUN`;
- CRM: `NOT_RUN`.

Статус реального Preview provider smoke-test: **BLOCKED** — Preview-scoped
`OPENAI_API_KEY` отсутствует. Новый Preview deployment намеренно не создавался:
Vercel применяет новые environment variables только к последующим deployments,
поэтому deploy до добавления секрета не позволит выполнить acceptance test и
потребует лишнего повторного deployment.

CRM policy не менялась: только `DRY_RUN`. Production и legacy runtime не
изменялись.
