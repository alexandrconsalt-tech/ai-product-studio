# Phase 5 — Summary Agent v3

Статус: реализовано только в diagnostic runtime при
`TRANSCRIPTION_SUMMARY_V3_CONTRACT_REGISTRY=true`. Production flag не включён,
deploy и реальный provider test не выполнялись.

Примечание: после реализации Phase 6 успешный Summary передаётся пяти
Summary Judges v3. Описанная ниже остановка непосредственно после Summary
фиксирует границу при приёмке Phase 5; текущая runtime-граница находится после
Format Judge.

## Контракт входа

`summary.agent.input.v3@3.0.0` содержит:

- immutable provenance: run ID, Store ID/version, manifest/transcript hashes и
  prompt version;
- полный `conversation.store.v3@3.1.0`;
- transcript projection с turn ID, speaker role и text;
- фиксированную output policy: максимум 4 facts, 2 quotes, запрет
  автоматического дублирования attributes и CRM-card data.

Input Builder принимает unknown boundary, валидирует Store и transcript
исходными Zod-схемами, пересчитывает Store content hash и transcript SHA-256,
сверяет manifest и точное покрытие Store sources. Store v1, raw Agent outputs,
rejected/provisional objects и Local Storage не читаются.

## Контракт выхода

Существующий draft `summary.content.v3@3.0.0` не содержал quote provenance и
Store metadata. Он сохранён в Registry как deprecated; текущий manifest
ссылается на `summary.content.v3@3.1.0`:

```ts
type SummaryContentV3 = {
  conversationResult: string;
  keyFacts: string[]; // max 4
  importantQuotes: Array<{
    text: string;
    sourceTurnIds: string[];
  }>; // max 2
  agreementNextStep: string | null;
  structuredAttributes: {
    interests: CanonicalInterest[];
    fundingSource: CanonicalFundingSource;
    purchaseTerm: CanonicalPurchaseTerm;
  };
  metadata: {
    sourceStoreId: string;
    sourceStoreHash: string;
    contractVersion: "3.1.0";
    promptVersion: string;
  };
};
```

Автоматическая migration `3.0.0 → 3.1.0` запрещена: старый output не содержит
доказуемых quote source IDs и Store hash.

## Source priority

Resolved prompt фиксирует:

1. Conversation Store v3 — единственный источник фактов.
2. Transcript — только для точности цитат, языкового контекста и формулировки
   уже существующего verified факта.
3. Отсутствующие в Store сведения запрещено добавлять.

Transcript не становится самостоятельным business source.

## Visible Prompt Builder

Prompt детерминированно собирается из:

1. System role.
2. Business rules.
3. Output contract ID/version, schema hash и полной JSON Schema.
4. Store v3 payload.
5. Auxiliary transcript context.
6. Source priority.
7. Output constraints.

Сохраняются base/resolved prompt, prompt version/hash, Store ID/content hash и
output contract metadata. Hidden appendices, prompt overrides после hash,
legacy prompt и Local Storage contract overrides отсутствуют.

## Structured Output

Summary использует adapter Phase 2:

- provider получает Registry JSON Schema через `response_format`;
- та же Zod-схема валидирует результат;
- допускается максимум одна repair-попытка с той же schema;
- markdown/manual JSON extraction/parser fallback отсутствуют;
- Structured Output attestation failure является technical error;
- provider/schema error не преобразуется в score.

Provider acceptance остаётся отложенным до отдельного controlled теста
владельцем продукта.

## Structured attributes

Attributes не классифицируются Summary Agent повторно. Ожидаемые значения
строятся напрямую из:

`conversationStore.needs.verified_structured_crm_attributes`.

Отсутствующие funding source или purchase term преобразуются в canonical
`не определено` только в structured output. Source validator требует точного
совпадения всего блока со Store.

## Source validation

После Zod validation выполняются только технические проверки:

- source Store ID/hash, contract/prompt versions;
- exact structured attributes;
- существование quote turn IDs и точное совпадение quote text;
- непустые key facts при наличии verified business data;
- отсутствие выдуманных/изменённых owner, recipient, deadline или channel в
  next step;
- отсутствие technical fields в пользовательском тексте.

Validator не переписывает Summary, не добавляет facts и не рассчитывает
semantic quality. Сложный grounding, полезность и необходимость повторения
CRM-card параметров остаются задачами Phase 6 Judges.

Error codes:

- `SUMMARY_SOURCE_MISMATCH`;
- `SUMMARY_ATTRIBUTE_MISMATCH`;
- `SUMMARY_QUOTE_SOURCE_INVALID`;
- `SUMMARY_STORE_REFERENCE_INVALID`;
- `SUMMARY_OUTPUT_SCHEMA_INVALID`.

## Exact repetition guard

Guard удаляет только:

- exact/normalized-full duplicate key fact;
- key fact, полностью совпавший с `conversationResult`;
- key fact, полностью совпавший с точной цитатой.

Каждое удаление записывается как deterministic transformation. После guard
output повторно проходит `SummaryV3Schema`. Семантические повторы не
оцениваются до Format Judge.

## Stop policy и runtime

При feature flag:

```text
Conversation Store v3 SUCCESS
→ Summary Input Builder
→ Visible Prompt
→ Structured Output
→ Source validation
→ Summary v3 SUCCESS или TECHNICAL_ERROR
→ Phase 5 boundary
```

- Store отсутствует: Summary `NOT_RUN`, `SUMMARY_STORE_MISSING`.
- Store incomplete: Summary `NOT_RUN`, `SUMMARY_STORE_INCOMPLETE`.
- Manifest mismatch: `TECHNICAL_ERROR`, `SUMMARY_MANIFEST_MISMATCH`.
- Structured Output unavailable: `TECHNICAL_ERROR`.
- Schema invalid после repair: `SUMMARY_OUTPUT_SCHEMA_INVALID`.
- Source validation error: `TECHNICAL_ERROR`.

После любого результата Summary Phase 5 не запускает пять Judges, Quality Gate
или CRM. При выключенном flag прежние Store v1 и legacy Summary работают без
изменений.

## Diagnostics

Stage diagnostic содержит input/output contract IDs/versions, manifest и Store
refs, prompt/schema hashes, Structured Output requested/applied, attempts,
repair, source/repetition/schema statuses, transformations, error type/code и
duration. Raw transcript и персональные данные в diagnostic не записываются.

## Fixtures и tests

Покрыты:

- полный звонок;
- отсутствие needs/attributes, agreement, next step и quotes;
- objection и два объекта;
- client question без подтверждённого факта;
- invalid quote, Store ref и attribute mismatch;
- invented deadline/channel;
- exact repetition audit;
- incomplete/missing Store;
- provider technical error;
- repair success/failure;
- legacy markdown rejection;
- отсутствие Store v1/raw outputs/legacy parser/Local Storage override;
- feature-flagged runtime boundary до Phase 6.

Real OpenAI вызов не выполняется.

## Результаты проверок

Локальная проверка выполнена без `OPENAI_API_KEY` и без provider-вызовов:

- целевые contracts/store/summary tests: 160 passed;
- полный `npm test`: 588 passed, 1 skipped;
- `npm run lint`: passed;
- `npm run build`: passed;
- `npm run test:smoke`: 338 passed на desktop и mobile Chromium;
- scoped ESLint для Phase 5: passed;
- `npx tsc --noEmit`: новых ошибок Phase 5 нет; команда остаётся красной только
  из-за существующих baseline-ошибок в
  `src/shared/stores/playground-test-run-store.test.ts` и
  `tests/smoke/pipeline-summary-audit.spec.ts`;
- `git diff --check`: passed.

## Rollback

Оставить `TRANSCRIPTION_SUMMARY_V3_CONTRACT_REGISTRY` unset/false. Это
возвращает legacy Summary/Store v1 path без migration и без изменения
production persistence.

## Known limitations и точный scope Phase 6

Phase 5 не рассчитывает Summary Quality Score и не выполняет сложную semantic
оценку. Phase 6 должна подключить ровно пять criterion-specific Summary Judges
к immutable `summary.content.v3@3.1.0` и Store v3:

- faithfulness;
- completeness;
- usefulness;
- agreements/next step;
- format/brevity.

Phase 6 не должна автоматически подключать Quality Gate, CRM, production flag
или deploy — это отдельный scope.
