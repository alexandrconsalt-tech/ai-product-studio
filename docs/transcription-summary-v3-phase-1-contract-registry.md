# AI Summary v3 — Phase 1 Contract Registry

Дата: 2026-07-30

Продукт: «Модуль транскрибации и AI-саммари звонков»

Статус: реализована diagnostic-only инфраструктура, runtime не переключён.

## Scope guard

- Product ID: `product_transcription_summary_module`
- Target pipeline ID: `pipeline.ai-summary.v3`
- Target pipeline version: `3.0.0`
- Feature flag: `TRANSCRIPTION_SUMMARY_V3_CONTRACT_REGISTRY`

Product ID взят из seed продукта в
`src/shared/repositories/local-storage-repository.ts`. Pipeline ID и version
зафиксированы утверждённой архитектурой
`docs/transcription-summary-v3-architecture.md`.

Активный standalone runtime `public/pipeline-lab-v3.html` и его React bridge не
импортируют Registry. Все v3 contracts имеют статус `draft`.

## Что реализовано

1. Один Versioned Contract Registry, ограниченный product scope.
2. Единый schema-definition API на Zod 4:
   - Zod schema выполняет runtime validation;
   - `z.toJSONSchema` создаёт JSON Schema Draft 2020-12;
   - `z.infer` выводит TypeScript domain type.
3. Двенадцать draft contracts v3 с metadata, hashes и fixtures.
4. Единственное объявление canonical enums.
5. Diagnostic immutable Pipeline Contract Manifest.
6. Детерминированные SHA-256 hashes canonical JSON.
7. Read-only dev/test comparison adapter.
8. Выключенный по умолчанию diagnostic feature flag.
9. Contract, manifest, fixture, type-inference и scope-isolation tests.

Никакой новый contract пока не передаётся модели и не участвует в active
pipeline execution.

## Структура Registry

```text
src/features/transcription-summary/contracts/
  canonical-enums.ts
  comparison-adapter.ts
  constants.ts
  contract-types.ts
  feature-flag.ts
  index.ts
  manifest.ts
  registry.ts
  schema-utils.ts
  shared-schemas.ts
  transcript/v3/contract.ts
  facts/v3/contract.ts
  fact-judge/v3/contract.ts
  needs/v3/contract.ts
  need-judge/v3/contract.ts
  outcome/v3/contract.ts
  outcome-judge/v3/contract.ts
  conversation-store/v3/contract.ts
  summary/v3/contract.ts
  summary-judges/v3/contract.ts
  quality-gate/v3/contract.ts
  pipeline-report/v3/contract.ts
  contracts.test.ts
  registry.test.ts
  diagnostics.test.ts
```

Каждый domain/version file содержит schema, contract definition, inferred type
и пять fixture classes. Несколько registry не создавались.

## Зарегистрированные контракты

| Role | Schema ID | Version | Stage ID | Status |
|---|---|---:|---|---|
| Transcript | `transcript.validated.v3` | `3.0.0` | `transcript_validate` | draft |
| Facts | `facts.agent.output.v3` | `3.0.0` | `facts_extract` | draft |
| Fact Judge | `facts.judge.verdict.v3` | `3.0.0` | `facts_judge` | draft |
| Needs | `needs.agent.output.v3` | `3.0.0` | `needs_extract` | draft |
| Need Judge | `needs.judge.verdict.v3` | `3.0.0` | `needs_judge` | draft |
| Outcome | `outcome.agent.output.v3` | `3.0.0` | `outcome_extract` | draft |
| Outcome Judge | `outcome.judge.verdict.v3` | `3.0.0` | `outcome_judge` | draft |
| Conversation Store | `conversation.store.v3` | `3.0.0` | `conversation_store_build` | draft |
| Summary | `summary.content.v3` | `3.0.0` | `summary_generate` | draft |
| Summary Judges | `summary.judge.verdict.v3` | `3.0.0` | `summary_judges` | draft |
| Quality Gate | `summary.quality-gate.v3` | `3.0.0` | `summary_quality_gate` | draft |
| Pipeline Report | `pipeline.report.v3` | `3.0.0` | `pipeline_report` | draft |

Каждый `ContractDefinition` содержит:

- `id`, `version`, `stageId`, `productId`;
- generated JSON Schema и `schemaHash`;
- `status`, `createdAt`, `description`;
- canonical enum references;
- normalization/repair policy IDs;
- provider capability requirements;
- compatibility/migration metadata;
- пять fixture classes.

Normalization и repair policies пока являются только ссылками на будущие
политики. Исполняемая normalization/repair логика не добавлялась.

## Canonical enums

Все canonical dictionaries объявлены только в:

`src/features/transcription-summary/contracts/canonical-enums.ts`

Там находятся:

- speaker roles;
- Judge verdicts;
- interests;
- funding sources;
- purchase terms;
- Outcome parties, recipients, results и statuses;
- пять Summary criteria;
- Quality Gate decisions.

Domain schemas импортируют эти readonly tuples и создают `z.enum` из них.
Независимых копий TypeScript unions и JSON enum нет.

## Schema и TypeScript types

Zod 4 выбран потому, что уже является schema library проекта и обеспечивает
один definition API:

```text
Zod schema
  ├─ validator.parse/safeParse
  ├─ z.toJSONSchema
  └─ z.infer<Type>
```

JSON Schema и TypeScript interface отдельно вручную не поддерживаются.
Compile-time tests сравнивают экспортированные types с `z.infer`.

## Hashes

`stableStringify` рекурсивно сортирует object keys, сохраняя array order.

```text
schemaHash = SHA-256(stableStringify(generated JSON Schema))
manifestHash = SHA-256(stableStringify(manifest without manifestHash))
```

Поэтому перестановка object keys не меняет hash. Изменение contract reference
или version меняет manifest hash.

## Immutable manifest

`createContractManifest("3.0.0")` собирает ровно 12 explicit references. В этой
фазе manifest имеет `mode:"diagnostic"` и глубоко заморожен.

`validateContractManifest` проверяет:

- product/pipeline identity;
- наличие всех roles;
- explicit ID/version;
- Registry membership;
- stage ID и schema hash;
- manifest hash;
- запрет draft contract в `mode:"runtime"`.

Неизвестная/отсутствующая версия, отсутствующий role, другой product ID или
runtime manifest с draft contracts дают ошибку.

## Fixtures

Для каждого из 12 contracts есть:

1. `valid`;
2. `missing_required`;
3. `extra_legacy_field`;
4. `invalid_enum`;
5. `invalid_nested_type`.

Отдельно покрыты проблемы аудита:

- `funding_source="наличные / депозит"` valid;
- `funding_source="наличными"` invalid до будущего normalizer;
- Need Judge correction с `value` invalid;
- вопрос «Там переуступка?» находится в `client_questions`, а не facts;
- Outcome legacy `agreement_id/text` invalid;
- Outcome `call_results:string[]` invalid;
- v3 agreement object valid;
- provisional Store item
  `verification_status="unverified_due_to_technical_error"` invalid;
- Quality Gate `TECHNICAL_ERROR` требует `quality_score:null`.

## Contract Registry API

Реализованы:

- `getContract(id, version)`;
- `getActiveContract(stageId, productId)`;
- `listContracts(productId)`;
- `createContractManifest(pipelineVersion)`;
- `validateContractManifest(manifest)`;
- `calculateSchemaHash(schema)`;
- `calculateManifestHash(manifest)`.

Версия не выбирается автоматически. `getActiveContract` не возвращает draft.
Registry не читает Local Storage, не зависит от UI и не импортирует legacy
prompt/runtime code.

## Read-only comparison adapter

`compareRuntimeAndDraftContracts` доступен только в dev/test и возвращает
diagnostic differences:

- `missing_field`;
- `extra_field`;
- `enum_mismatch`;
- `type_mismatch`;
- `required_mismatch`;
- `legacy_field`;
- `version_conflict` зарезервирован для version-aware adapter Phase 2.

Adapter не мутирует schemas, не вызывает provider и не импортируется active
pipeline.

## Feature flag

`TRANSCRIPTION_SUMMARY_V3_CONTRACT_REGISTRY`:

- по умолчанию false;
- при false diagnostic loader возвращает `null`;
- при true разрешает только чтение draft Registry;
- не переключает stages, prompts, schema payload, parser или report;
- production environment не изменялся.

Флаг не добавлен в production settings или пользовательский UI.

## Ограничения Phase 1

Не подключены:

- active runtime;
- Prompt Builder;
- provider response schemas;
- parser/validator active stages;
- normalization;
- repair;
- Agents/Judges;
- Code Arbiter;
- Conversation Store builder;
- Summary/Quality Gate/CRM;
- iframe report boundary;
- Local Storage или migration.

Текущие hidden appendices и legacy behavior намеренно остаются без изменений до
соответствующих фаз.

## Тесты

Новые тестовые файлы:

- `contracts.test.ts`;
- `registry.test.ts`;
- `diagnostics.test.ts`.

Проверяются:

- все 60 contract fixtures;
- canonical audit regressions;
- type inference;
- explicit version lookup;
- registry/product isolation;
- ambiguous active guard;
- stable schema/manifest hashes;
- immutable manifest;
- complete roles;
- draft/runtime barrier;
- feature flag default-off;
- read-only comparison;
- отсутствие Registry imports в iframe, React bridge и других продуктах.

Фактические результаты:

- узкие contract tests: 3 test files, 86 tests passed;
- полный `npm test`: 55 test files, 388 tests passed;
- `npm run lint`: passed;
- `npm run build`: passed;
- строгий scoped TypeScript check нового Registry: passed;
- `npm run typecheck`: script отсутствует в текущем `package.json`;
- эквивалентный repository-wide `npx tsc --noEmit`: failed на существующих
  ошибках в `src/shared/stores/playground-test-run-store.test.ts` и
  `tests/smoke/pipeline-summary-audit.spec.ts`; ошибок из
  `src/features/transcription-summary/contracts` в выводе нет.

Существующие typecheck errors находятся вне Phase 1 scope и не исправлялись.
Production build при этом успешно выполнил собственную проверку типов.

## Риски

1. Draft schemas формализуют целевую, а не active runtime semantics; сравнение
   не должно восприниматься как migration.
2. Provider-specific JSON Schema compatibility ещё не проверяется.
3. Contract metadata пока хранит policy IDs без реализации policies.
4. Current repository typecheck содержит существующие ошибки вне Phase 1 scope;
   они не исправляются этим изменением.
5. Read-only adapter сравнивает schema structure и не доказывает semantic
   equivalence.

## Rollback

Registry не импортируется active runtime, поэтому rollback не требует data или
production migration. Достаточно удалить новый feature-scoped directory и этот
документ. Существующие reports, Local Storage и pipeline behavior не менялись.

## Точный scope следующей фазы

Phase 2 может:

- добавить provider capability preflight;
- формировать Structured Output из exact Registry schema;
- подключать v3 contracts только через целый versioned execution path;
- возвращать typed technical errors при unavailable/rejected schema;
- запрещать text fallback.

Phase 2 не должна начинаться до review этого Registry, fixtures и manifest.
Подключение active runtime требует отдельного явного задания.
