# Transcription Summary v3 — Phase 8 CRM publication

## Статус и область

Phase 8 добавляет versioned deterministic CRM publication adapter поверх готовых
`conversation.store.v3`, `summary.content.v3` и `summary.quality-gate.v3`.
Extraction, normalization, Store, Summary, Judges и Quality Gate policy не менялись.
Legacy CRM path сохранён. Production flag, deploy, реальные CRM и OpenAI-вызовы не
использовались.

Runtime Phase 8 работает только в диагностическом v3 path и принудительно использует
`dryRun=true`. Серверный API не принимает флаг записи от браузера и использует
CRM client, который аварийно завершится, если adapter ошибочно попытается вызвать
его в dry-run.

## Контракты

- `crm.publication.input.v3@3.0.0` — Store, Summary, Quality Gate, provenance,
  deterministic target и versioned publication policy.
- `crm.publication.result.v3@3.0.0` — статус, publication ID, idempotency key,
  записанные/пропущенные поля, reason code и техническая provenance.

Оба контракта зарегистрированы в едином Contract Registry и закреплены immutable
manifest ролями `crmPublicationInput` и `crmPublicationResult`. Policy зафиксирована
как `crm-publication-policy-v3.0.0`, version `3.0.0`.

До adapter валидируются:

- полнота и Zod-контракт Store v3;
- Zod-контракты Summary и Quality Gate;
- manifest и все Store/Summary/Gate hashes;
- run/store provenance;
- обязательный CRM system, entity type и entity ID;
- точное совпадение `summary.structuredAttributes` с ранее скопированными Store
  attributes.

Target формируется runtime-кодом, а не LLM. Transcript, raw LLM responses и Judges
не входят в CRM input boundary.

## Write policy

| Quality Gate decision | Результат policy |
| --- | --- |
| `AUTO_SAVE` | запись разрешена |
| `SAVE_WITH_WARNING` | запись разрешена; criterion warning metadata сохраняется |
| `REVIEW_REQUIRED` | `SKIPPED / REVIEW_REQUIRED_BLOCKED` |
| `TECHNICAL_ERROR` | `SKIPPED / TECHNICAL_ERROR_BLOCKED` |
| Quality Gate отсутствует | `NOT_RUN` |

Policy не пересчитывает score, не интерпретирует Judge text и не превращает
technical error в manual review.

## CRM payload

Пользовательская часть содержит только:

- `conversationResult`;
- `keyFacts`;
- `importantQuotes`;
- `agreementNextStep`.

Structured attributes копируются без классификации и исправления:

- `interests`;
- `fundingSource`;
- `purchaseTerm`.

Technical metadata отделена от пользовательского Summary и содержит run ID,
idempotency key, Store/Summary hashes, Quality Gate score/decision, policy version
и версии трёх source contracts. CRM client получает тот же key и обязан передать
его в provider idempotency boundary. Для `SAVE_WITH_WARNING` отдельно передаются
коды и критерии warning metadata без полных текстов.

## Idempotency и atomicity

Idempotency key — SHA-256 от стабильного массива:

`[crmSystem, entityType, entityId, runId, summaryHash, policyVersion]`.

Массив сериализуется canonical stable serializer, поэтому границы значений
однозначны, а порядок ключей произвольных JSON-объектов на hash не влияет.
Изменение Summary hash или entity ID создаёт новый key.

Typed repository реализует:

- `findByIdempotencyKey`;
- `reserve`;
- `markPublished`;
- `markFailed`.

Порядок операций: validate → reserve → CRM write → mark published. In-memory
adapter атомарно резервирует key до первого `await` CRM client. Подтверждённый
replay возвращает `ALREADY_PUBLISHED`; параллельная незавершённая попытка получает
`CRM_IDEMPOTENCY_CONFLICT`. Timeout и другие retryable unconfirmed failures
переходят в `FAILED` и могут безопасно резервироваться повторно. Publication ID
создаётся только после полного успешного CRM response.

Частичный или malformed success (нет publication ID/provider response ID либо
подтверждены не все разрешённые поля) считается `CRM_WRITE_REJECTED`.

## Dry-run

Dry-run выполняет полную входную валидацию, policy, построение payload и
idempotency key. Repository reserve и CRM client не вызываются. Допустимое решение
возвращает `DRY_RUN`; заблокированное policy решение остаётся `SKIPPED`.

Это единственный режим, подключённый к Phase 8 runtime. Реальная публикация
проверяется только unit/integration tests с typed mock client.

## Error taxonomy

- `CRM_INPUT_INVALID`
- `CRM_HASH_MISMATCH`
- `CRM_POLICY_BLOCKED`
- `CRM_IDEMPOTENCY_CONFLICT`
- `CRM_WRITE_TIMEOUT`
- `CRM_WRITE_REJECTED`
- `CRM_AUTH_ERROR`
- `CRM_RATE_LIMIT`
- `CRM_UNKNOWN_ERROR`

CRM technical failures возвращают `TECHNICAL_ERROR / CRM_WRITE_FAILED`; policy
blocks остаются `SKIPPED`.

## Diagnostics

Diagnostics содержат:

`stageId`, input/output contract IDs, `manifestHash`, `entityType`,
SHA-256 `entityIdHash`, `idempotencyKey`, Quality Gate decision/score,
publication policy version, dry-run, status/reason, written/skipped fields,
provider response ID, error type/code и duration.

Diagnostics не содержат entity ID, телефоны, email, Summary text, transcript,
credentials или HTTP authorization data.

## Тесты

Mocked suite покрывает:

1. AUTO_SAVE publication и replay.
2. SAVE_WITH_WARNING с warning metadata.
3. Blocks для REVIEW_REQUIRED и TECHNICAL_ERROR.
4. Dry-run без CRM call.
5. Timeout, безопасный retry и auth failure.
6. Store/Summary hash mismatch и missing entity ID.
7. Новый key для изменённого Summary и другого entity.
8. Invalid/reclassified structured attributes.
9. Malformed и partial CRM success.
10. Конкурентный duplicate reserve.
11. Детерминированные policy, payload и idempotency key.
12. Отсутствие мутации Summary, повторной классификации и legacy CRM imports.

## Rollback

Rollback Phase 8 состоит из удаления двух CRM contract roles, API action и
`crmPublication` v3 runtime role. При выключенном v3 feature flag существующий
legacy CRM path продолжает работать без изменений. In-memory test repository не
является production source of truth и не требует миграции данных.

## Следующая интеграционная фаза

До реальной CRM интеграции нужны отдельные явные решения: production repository,
проверенный provider-specific CRM client, server-side target resolution,
authentication/secret handling, provider idempotency/atomicity attestation,
observability и ручной preview acceptance. Phase 8 не разрешает production writes.
