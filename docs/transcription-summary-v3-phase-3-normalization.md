# Transcription Summary v3 — Phase 3 Deterministic Normalization

Дата: 2026-07-30
Статус: **implemented under the v3 feature boundary**

## Scope

Единый deterministic normalization layer подключён только к:

- `facts.agent.output.v3@3.0.0`;
- `needs.agent.output.v3@3.0.0`;
- `outcome.agent.output.v3@3.0.0`.

Последовательность v3:

```text
Structured Output
→ transport schema validation
→ deterministic normalization
→ canonical domain schema validation
→ typed Agent output
→ Judge
→ reconciliation
```

Summary, пять Summary Judges, Quality Gate, CRM, Conversation Store и legacy runtime не нормализуются. Production flag не включён, deploy не выполнялся.

## Contract-owned transport и domain schemas

`ContractDefinition` остаётся единым источником истины и теперь содержит:

- `schema` и `schemaHash` — transport JSON Schema, передаваемая provider;
- `transportValidator` — canonical values плюс только зарегистрированные aliases;
- `validator` — строгая canonical domain Zod schema;
- `domainSchema` и `domainSchemaHash`;
- `normalizationPolicyId`.

Manifest фиксирует transport schema hash, domain schema hash и policy set ID. Transport schema не расширяется до произвольной строки для enum fields. Alias dictionaries формируются из тех же policy objects, которые исполняет normalizer.

## Normalization Registry

Реестр находится в:

```text
src/features/transcription-summary/normalization/
  index.ts
  normalize.ts
  registry.ts
  transport-schemas.ts
  types.ts
  policies/
    communication-channel.ts
    funding-source.ts
    need-types.ts
    numbers.ts
    outcome-status.ts
    purchase-term.ts
    speaker-role.ts
    text.ts
```

Contract policy sets:

| Contract | Policy set |
|---|---|
| `facts.agent.output.v3` | `normalization.facts.v3` |
| `needs.agent.output.v3` | `normalization.needs.v3` |
| `outcome.agent.output.v3` | `normalization.outcome.v3` |

Registry при загрузке отклоняет duplicate policy ID и конфликт, когда один alias одного field path ведёт к разным canonical outputs.

## Canonical enums

Canonical dictionaries не дублируются и импортируются только из:

`src/features/transcription-summary/contracts/canonical-enums.ts`

Используются:

- `SPEAKER_ROLES`;
- `INTEREST_VALUES`;
- `FUNDING_SOURCE_VALUES`;
- `PURCHASE_TERM_VALUES`;
- `COMMUNICATION_CHANNEL_VALUES`;
- `PARTY_VALUES`;
- `RECIPIENT_VALUES`;
- `OUTCOME_STATUS_VALUES`;
- `CALL_RESULT_VALUES`.

Canonical communication channels:

```text
whatsapp | email | phone | max | telegram
```

Канал хранится только в зарегистрированном channel field. Normalizer не переносит его в property requirements, не извлекает contact data и не создаёт способ отправки из произвольного текста.

## Registered aliases

### Funding source

К `наличные / депозит`:

```text
наличными
наличные
за наличные
свои деньги
собственные средства
депозит
деньги на депозите
```

Дополнительно зарегистрированы только прямые варианты:

```text
одобренная ипотека → ипотека одобрена
ипотека в процессе оформления → ипотека в процессе
продажа собственной квартиры → продажа своей квартиры
```

Не принимаются и не угадываются:

```text
деньги есть
будем решать
возможно ипотека
смешанная оплата
```

Policy применяется только к уже классифицированному полю
`structured_crm_attributes.funding_source.value`. Транскрипция не сканируется.

### Purchase term

```text
в течение месяца | 1 месяц | до месяца
  → до 1 месяца

два-три месяца | 2-3 месяца | 2 — 3 месяца
  → 2–3 месяца

3-6 месяцев | 3 — 6 месяцев
  → 3–6 месяцев

больше 6 месяцев | свыше 6 месяцев
  → более 6 месяцев
```

`скоро`, `не срочно` и `как получится` отклоняются как ambiguous. Даты и контекст не используются для вычисления срока.

### Needs

Для уже созданных `interested_in` candidates разрешены регистр, единственное/множественное число и прямой synonym:

```text
новостройки | новостройка → Новостройки
ипотека | ипотеки | ипотечное кредитование → Ипотека
строительство → Строительство
```

Normalizer не создаёт interest из вопроса клиента и не добавляет отсутствующий candidate.

### Communication channels

```text
ватсап | WhatsApp | whats app | Whats App → whatsapp
электронная почта | e-mail | EMAIL | почта → email
телефон | телефонный звонок → phone
макс | MAX | мессенджер MAX → max
телеграм | Telegram → telegram
```

### Roles и Outcome statuses

Зарегистрированы только русские/регистровые технические варианты ролей и регистровые варианты canonical Outcome statuses. `not defined` и `not-defined` приводятся к `not_defined`.

Normalizer меняет только значение status field. Legacy structure с `agreement_id`, `text` или `call_results:string[]` не проходит transport schema и не мигрируется.

### Text и numbers

Разрешены:

- Unicode NFC;
- trim;
- схлопывание повторных горизонтальных пробелов в явно зарегистрированных free-text fields;
- для quote text — только Unicode NFC и edge trim;
- confidence `"0.85" → 0.85`;
- confidence `"85%" → 0.85`.

Evidence и source IDs не нормализуются. Если canonical Zod transform попытался бы скрыто изменить незарегистрированное поле, normalizer возвращает `NORMALIZATION_INVARIANT_VIOLATION`.

## Запрещённые transformations

Normalizer не:

- анализирует transcript или context;
- создаёт отсутствующие values/candidates;
- классифицирует упоминание или вопрос как факт/потребность;
- заменяет ambiguous value ближайшим enum;
- меняет evidence или source IDs;
- перефразирует или дополняет текст;
- переводит денежные единицы, площадь или валюту;
- мигрирует legacy object structure;
- меняет Judge verdict;
- вызывает LLM;
- использует parser/text fallback.

## Audit trail

Каждое фактическое изменение создаёт deterministic
`NormalizationTransformation`:

```ts
type NormalizationTransformation = {
  transformationId: string
  policyId: string
  policyVersion: string
  ruleId: string
  contractId: string
  contractVersion: string
  itemId?: string
  fieldPath: string
  originalValue: unknown
  normalizedValue: unknown
  result: 'applied' | 'unchanged' | 'rejected_ambiguous'
}
```

`transformationId` вычисляется детерминированно из содержимого операции.
Порядок — policy registry order, затем array index, затем rule order.
Canonical unchanged input не создаёт operation. Повторная normalization
canonical результата возвращает тот же value и пустой список новых
transformations.

Structured diagnostic содержит:

- `normalizationStatus`;
- `normalizationTransformations`.

Поэтому Judge получает только canonical typed value, а применённые rules
остаются доступны в stage contract audit.

## Error taxonomy и stop behavior

Определены:

- `NORMALIZATION_POLICY_NOT_FOUND`;
- `NORMALIZATION_ALIAS_UNKNOWN`;
- `NORMALIZATION_AMBIGUOUS`;
- `NORMALIZATION_OUTPUT_INVALID`;
- `NORMALIZATION_INVARIANT_VIOLATION`.

Normalization error:

- возвращается как `TECHNICAL_ERROR`;
- имеет `errorType="normalization_error"`;
- не становится quality score;
- не создаёт verified data;
- не скрывается LLM repair;
- блокирует зависимый v3 path.

Неизвестный alias не включается в transport enum. Если он достигает
normalizer через внутренний typed boundary, normalizer также fail-closed.
Phase 3 не вводит element-level partial recovery: invalid optional candidate
блокирует весь Agent output, что сохраняет atomic transport contract.

## Tests

Добавлены:

- unit coverage каждого зарегистрированного alias rule;
- canonical unchanged;
- unknown и ambiguous inputs;
- policy conflict;
- deterministic IDs и порядок;
- idempotency;
- audit completeness;
- numeric и whitespace transformations;
- hidden domain transformation invariant;
- invalid normalized output;
- transport → normalizer → canonical schema;
- Facts/Needs/Outcome Agent → normalization → Judge → reconciliation;
- `наличными` до Need Judge;
- вопрос «Там переуступка?» не становится fact;
- channel не попадает в property requirements;
- Judge не получает `corrections.value`;
- legacy Outcome остаётся invalid;
- normalization error не запускает repair.

## Feature flag и rollback

Normalization исполняется только внутри server-side v3 Structured Output path.
Endpoint уже закрыт условиями:

```text
NODE_ENV !== production
TRANSCRIPTION_SUMMARY_V3_CONTRACT_REGISTRY === true
```

При выключенном flag iframe продолжает прежний `runStage`; legacy normalizers,
Local Storage и query parameters не изменены.

Rollback: оставить `TRANSCRIPTION_SUMMARY_V3_CONTRACT_REGISTRY` unset/false.
Никакой migration или очистки legacy data не требуется.

## Ограничения

- Real-provider acceptance остаётся отложенным и не объявлен пройденным.
- AI Tunnel остаётся fail-closed для v3.
- Store v1 compatibility blocker `LOSSY_COMPATIBILITY_MAPPING` не исправлялся.
- Summary, Summary Judges, Quality Gate, CRM и UI report не изменялись.
- Production flag и deployment не изменялись.

## Scope Phase 4

Следующая фаза — `Conversation Store v3`:

- убрать `LOSSY_COMPATIBILITY_MAPPING` без угадывания связей;
- принимать только verified v3 domain objects;
- сохранить source graph и typed references;
- публиковать Store атомарно;
- не менять Summary Agent до отдельной Phase 5.
