# Phase 4 — Conversation Store v3

Статус: реализовано и проверяется только в diagnostic runtime при
`TRANSCRIPTION_SUMMARY_V3_CONTRACT_REGISTRY=true`. Production flag не включён,
deploy не выполнялся. Summary v3, пять Summary Judges, Quality Gate и CRM не
подключены к Store v3.

## Результат

V3 pipeline впервые строит `conversation.store.v3@3.1.0` непосредственно из:

- `facts.verified.v3@3.0.0`;
- `needs.verified.v3@3.0.0`;
- `outcome.verified.v3@3.0.0`;
- `transcript.validated.v3@3.0.0`;
- immutable Contract Manifest.

Рабочий v3-путь больше не вызывает Facts/Needs/Outcome adapters в Conversation
Store v1 и не создаёт `agreement_ids`. Исторический
`LOSSY_COMPATIBILITY_MAPPING` больше не является runtime-переходом Phase 4.
Summary Judge → Quality Gate v1 adapter оставлен без изменений: он относится к
будущей фазе, но после успешного Store Phase 4 до него выполнение не доходит.

## Контракт Store

Финальная схема:

```ts
type ConversationStoreV3 = {
  meta: {
    store_id: string;
    run_id: string;
    schema_id: "conversation.store.v3";
    contract_version: "3.1.0";
    publication_status: "published";
    manifest_hash: string; // sha256
    transcript_ref: { id: string; sha256: string };
    complete: true;
  };
  facts: {
    verified_facts: VerifiedFact[];
    verified_quotes: VerifiedQuote[];
    verified_client_questions: VerifiedFactQuestion[];
  };
  needs: {
    verified_business_needs: VerifiedNeed[];
    verified_property_requirements: VerifiedNeed[];
    verified_structured_crm_attributes: {
      interested_in: VerifiedInterest[];
      funding_source: VerifiedFunding | null;
      purchase_term: VerifiedPurchaseTerm | null;
    };
    verified_communication_preferences: VerifiedCommunicationPreference[];
    verified_client_questions: VerifiedNeedQuestion[];
  };
  outcome: {
    verified_call_result: VerifiedCallResult;
    verified_agreements: VerifiedAgreement[];
    verified_primary_next_step: VerifiedNextStep;
    verified_unresolved_questions: VerifiedOutcomeQuestion[];
    verified_communication_channel: VerifiedCommunicationChannel;
  };
  sources: SourceReference[];
  content_hash: string; // sha256
};
```

Store не содержит rejected/provisional candidates, verdict trail, prompts,
provider responses, parser output, UI metadata, raw errors или legacy fields.

## Версионирование и migration boundary

Исходный `conversation.store.v3@3.0.0` не позволял выразить все правила Phase 4:
в нём отсутствовали manifest/transcript provenance, business-empty attributes
и точные verified domain shapes. Поэтому он не был молча перезаписан:

- `3.0.0` сохранён в Registry со статусом `deprecated`;
- текущий manifest указывает роль `conversationStore` на `3.1.0`;
- `3.1.0` читает и пишет только `3.1.0`;
- автоматическая migration `3.0.0 → 3.1.0` запрещена политикой
  `migration.conversation-store-v3.0-to-v3.1.unsupported`;
- восстановление возможно только повторной сборкой из трёх verified outputs,
  валидированного transcript и совместимого manifest;
- repository отклоняет Store другой версии при чтении или записи.

Такой fail-closed план необходим: из старого Store нельзя доказуемо восстановить
manifest hash и полный source graph.

## Builder flow

`buildConversationStoreV3({ manifest, transcript, factsVerified,
needsVerified, outcomeVerified })`:

1. Валидирует manifest и его hash через Registry.
2. Проверяет точные ID/версии трёх verified contracts и Store `3.1.0`.
3. Валидирует каждый вход исходной Zod-схемой.
4. Сверяет `run_id` и transcript SHA-256 из metadata.
5. Сверяет каждый domain source reference с transcript turn по ID, speaker и
   точному text.
6. Проверяет глобальную уникальность verified item IDs.
7. Проверяет canonical communication channels финальной Store-схемой.
8. Сортирует collections по ID, transcript sources — по sequence и ID.
9. Вычисляет deterministic Store ID и content hash.
10. Валидирует полностью собранный объект `ConversationStoreV3Schema`.

Builder не вызывает LLM, не нормализует aliases, не выполняет semantic
inference, не читает Local Storage и не мутирует входы.

## Completeness policy

Опубликованный Store существует только как `complete: true`. Он строится, если
все три verified inputs и transcript валидны и source graph целостен.

Business-empty значения допустимы:

- `verified_business_needs=[]`;
- `verified_property_requirements=[]`;
- funding/purchase term равны `null`;
- `verified_agreements=[]`;
- next step имеет `status="not_defined"` и `action=null`.

Technical error, provisional object, отсутствующий verified input, несовместимый
manifest, duplicate ID или source mismatch приводят к `TECHNICAL_ERROR`; Store
не создаётся.

## Source integrity и cross-domain invariants

- Каждый source turn ID должен существовать в transcript.
- Domain source reference должен точно совпадать с transcript turn.
- Verified item IDs уникальны во всех facts/needs/outcome collections.
- Quote может ссылаться только на существующий verified fact.
- Communication channel принадлежит canonical enum.
- Legacy `agreement_id`, `agreement_ids`, `text`, `status:"agreed"` envelope и
  `call_results: string[]` не проходят boundary validation.
- Rejected/provisional item не может попасть в опубликованный Store.

## Persistence boundary

Добавлен `ConversationStoreV3Repository`:

```ts
interface ConversationStoreV3Repository {
  save(store: ConversationStoreV3): Promise<void>;
  getByRunId(runId: string): Promise<ConversationStoreV3 | null>;
}
```

Текущий diagnostic pipeline остаётся in-memory. Реализован
`InMemoryConversationStoreV3Repository`: на save/read выполняется runtime Zod
validation, данные клонируются, другой contract version не читается. Legacy
Store persistence format не используется.

## Diagnostics и runtime stop policy

Store diagnostic содержит `stageId`, contract ID/version, manifest hash,
store ID, complete, counts, primary-next-step flag, source/validation statuses,
error type/code и duration.

При feature flag:

- reconciliation возвращает verified v3 object без Store v1 adapter;
- code stage `conversation_store` перехватывается v3 builder;
- success сохраняет Store v3 в runtime context;
- pipeline останавливается на явной границе Phase 4;
- Summary, Judges, Quality Gate и CRM получают `NOT_RUN`.

При Store error downstream также получает `NOT_RUN`. При выключенном flag
прежний `runStage` и Conversation Store v1 работают без изменений.

## Fixtures и тесты

Покрыты:

- полный Store;
- Store без needs, agreement и next step;
- deterministic ID/hash/order и idempotency;
- manifest/version mismatch;
- transcript hash/source mismatch;
- duplicate ID;
- canonical enum;
- provisional и legacy objects;
- no mutation;
- repository validation/isolation;
- полный mocked Agent → normalization → Judge → reconciliation → Store path;
- runtime boundary без verified-to-Store-v1 adapters.

Реальный provider test не запускался.

## Результаты проверок

- Phase 4 Store suites: `19 passed`.
- `npm test`: `552 passed`, `1 gated provider test skipped`.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:smoke`: `338 passed` на desktop и mobile Chromium.
- `npx tsc --noEmit`: завершился с существующими baseline errors только в
  `src/shared/stores/playground-test-run-store.test.ts` и
  `tests/smoke/pipeline-summary-audit.spec.ts`; ошибок в Phase 4 scope нет.
- `git diff --check`: passed.

## Rollback

Оставить `TRANSCRIPTION_SUMMARY_V3_CONTRACT_REGISTRY` unset/false. Это полностью
возвращает legacy runtime без migration, Store v1 изменений или очистки
Local Storage.

## Ограничения и точный scope Phase 5

Phase 5 должна подключить только Summary Agent v3 к
`conversation.store.v3@3.1.0` как единственному business source, определить его
typed input projection и stop policy. Не входят автоматически: пять Summary
Judges, Quality Gate v3, CRM migration, Store v1 migration, production flag и
deploy — для них нужны отдельные фазы/разрешения.
