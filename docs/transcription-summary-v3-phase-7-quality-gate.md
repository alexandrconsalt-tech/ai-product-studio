# Phase 7 — deterministic Summary Quality Gate v3

Статус: реализовано только в diagnostic runtime при
`TRANSCRIPTION_SUMMARY_V3_CONTRACT_REGISTRY=true`. Production flag не включён,
deploy и real-provider test не выполнялись.

## Назначение и границы

Quality Gate v3 — deterministic aggregator, а не шестой Judge. Он принимает
ровно пять typed verdicts, проверяет их техническую целостность и рассчитывает
одно решение. Gate не получает transcript, не вызывает LLM, не меняет Summary,
score, verdict или issues Judges и не использует legacy semantic logic.

Runtime v3:

```text
Conversation Store v3
→ Summary v3
→ 5 Summary Judges v3
→ Summary Quality Gate v3
→ Phase 7 boundary
→ CRM NOT_RUN
```

При выключенном feature flag legacy runtime и legacy Quality Gate работают без
изменений.

## Контракты

Typed input:

`summary.quality-gate.input.v3@3.0.0`

Input содержит immutable run/manifest/Store/Summary refs, полный
`summary.content.v3@3.1.0`, ровно пять
`summary.judge.verdict.v3@3.1.0` и versioned policy. Порядок verdicts не имеет
значения; каждый criterion обязан встретиться ровно один раз.

Текущий output:

`summary.quality-gate.v3@3.1.0`

Output содержит:

- `decision`;
- `qualityScore`;
- пять `criterionResults` в canonical order;
- typed `blockers` и `warnings`;
- run, Store, Summary, manifest, contract и policy metadata.

Draft `summary.quality-gate.v3@3.0.0` сохранён deprecated без автоматической
migration. Он не используется v3 runtime, потому что не содержит typed
criterion results и полной provenance metadata.

## Policy

Policy ID: `quality-gate-policy-v3.0.0`

Policy version: `3.0.0`

Policy фиксируется input contract, включённым в immutable run manifest. Веса и
thresholds не читаются из Local Storage, UI или runtime overrides.

Веса:

| Criterion | Weight |
|---|---:|
| `faithfulness` | 0.2 |
| `completeness` | 0.2 |
| `usefulness` | 0.2 |
| `agreements_next_step` | 0.2 |
| `format` | 0.2 |

Сумма весов равна 1. Confidence остаётся в diagnostics Judge и не участвует в
score.

Формула:

```text
qualityScore =
  faithfulness.score × 0.2
  + completeness.score × 0.2
  + usefulness.score × 0.2
  + agreements_next_step.score × 0.2
  + format.score × 0.2
```

При discrete Judge scale `0 | 25 | 50 | 75 | 100` итог всегда кратен 5.

Thresholds:

| Threshold | Value |
|---|---:|
| `autoSaveMinScore` | 95 |
| `warningMinScore` | 80 |
| `reviewMinScore` | 0 |

Decision policy:

- `AUTO_SAVE`: score не ниже 95, нет blocker, faithfulness равен 100,
  agreements/next step не ниже 75 и ни один criterion не ниже 75.
- `SAVE_WITH_WARNING`: score не ниже 80, нет blocker, faithfulness и
  agreements/next step не ниже 75 и ни один criterion не ниже 50.
- `REVIEW_REQUIRED`: любой другой технически валидный quality result.
- `TECHNICAL_ERROR`: technical Judge или любая ошибка input consistency.

Дополнительная граница `agreements_next_step >= 75` для
`SAVE_WITH_WARNING` фиксирует требование Phase 7: materially wrong agreement
или next step с score 50 не может быть автоматически сохранён.

## Blocker и warning policy

Gate не интерпретирует текст findings и не создаёт semantic issues.

- `issues[].severity === "critical"` переносится в `blockers`;
- `low | medium | high` переносится в `warnings`;
- code, criterion и message сохраняются без смысловой переработки;
- technical consistency errors оформляются отдельными technical blockers.

Таким образом, fabricated quote, role error, invented
deadline/channel/owner или missing critical next step блокирует auto-save
только когда Judge формально отметил finding как `critical`.

Blockers и warnings сортируются детерминированно: canonical criterion order,
затем severity, затем code. `criterionResults` всегда имеют порядок:

1. `faithfulness`;
2. `completeness`;
3. `usefulness`;
4. `agreements_next_step`;
5. `format`.

## Technical error policy

До расчёта проверяются:

- полный набор из пяти verdicts;
- uniqueness criterion;
- Store, Summary, manifest и Judge hashes;
- contract versions;
- discrete score и score/verdict relation;
- `technical_error → score=null`;
- quality verdict → score не `null`;
- policy ID/version, fixed weights, сумма весов и thresholds;
- исходные Zod-контракты.

Коды consistency errors:

- `QUALITY_GATE_VERDICT_MISSING`;
- `QUALITY_GATE_DUPLICATE_CRITERION`;
- `QUALITY_GATE_HASH_MISMATCH`;
- `QUALITY_GATE_VERSION_MISMATCH`;
- `QUALITY_GATE_INVALID_SCORE`;
- `QUALITY_GATE_INVALID_POLICY`;
- `QUALITY_GATE_INPUT_INVALID`.

Judge technical error получает
`QUALITY_GATE_JUDGE_TECHNICAL_ERROR`.

При любой такой ошибке:

```text
decision = TECHNICAL_ERROR
qualityScore = null
```

Успешные criterion results сохраняются, но partial score не рассчитывается.
`null` не заменяется нулём, успешные criteria не переусредняются, recovery и
fallback score отсутствуют.

Если Summary отсутствует или завершился technical error, Gate имеет
`NOT_RUN`. Если Summary существует, но один Judge отсутствует, Gate выполняется
и возвращает `TECHNICAL_ERROR / QUALITY_GATE_VERDICT_MISSING`.

## Diagnostics

Stage ID: `summary_quality_gate_v3`.

Диагностика содержит:

- input/output contract ID и version;
- manifest hash;
- Store ID/content hash;
- Summary hash;
- policy version и полный набор weights;
- пять criterion scores;
- quality score и decision;
- blockers/warnings count;
- validation status;
- error type/code;
- duration.

Chain-of-thought, raw provider request, transcript, API keys и другие секреты
не сохраняются.

## Runtime integration

Diagnostic API action `quality_gate_summary` вызывает только
`executeSummaryQualityGateV3`. Существующая runtime stage
`summary_quality_gate` в v3-ветке маршрутизируется в
`summary_quality_gate_v3`; legacy `CODE_FUNCS.summaryQualityGate` не вызывается.

После любого typed Gate result устанавливается Phase 7 boundary. Следующий CRM
stage получает `NOT_RUN`. Реализация CRM, Store v1, production flag и
provider transport не менялись.

## Tests

Unit, integration и mocked E2E покрывают:

- exact weighted score и canonical order;
- order independence;
- AUTO_SAVE 100 и boundary 95;
- SAVE_WITH_WARNING boundary 80;
- REVIEW_REQUIRED для low score, faithfulness 50 и agreements 50;
- policy result для format 50;
- один и два technical errors;
- missing/duplicate criterion;
- invalid score и score/verdict relation;
- hash/version mismatch;
- invalid weights/thresholds;
- critical blocker;
- deterministic blockers/warnings;
- no mutation;
- отсутствие влияния confidence;
- typed input/output и diagnostics;
- Summary missing → NOT_RUN;
- v3 runtime boundary, отсутствие legacy Gate и CRM call.

Все tests используют fixtures/mocks; реальный provider не вызывается.

## Результаты проверок

Локально, без provider-вызовов:

- Phase 7 unit/integration/mocked E2E/runtime-boundary: 43 passed;
- полный `npm test`: 676 passed, 1 skipped;
- `npm run lint`: passed;
- `npm run build`: passed;
- `npm run test:smoke`: 338 passed на desktop и mobile Chromium;
- scoped strict TypeScript check Phase 7: passed;
- `npx tsc --noEmit`: нет ошибок Phase 7; остаются только известные baseline
  errors в `src/shared/stores/playground-test-run-store.test.ts` и
  `tests/smoke/pipeline-summary-audit.spec.ts`;
- `git diff --check`: passed;
- локальная desktop/mobile проверка: runtime overlay и console errors
  отсутствуют.

## Known limitations

- Semantic корректность исходных пяти verdicts остаётся ответственностью
  Judges; Gate проверяет только typed formal signals.
- Provider acceptance Phase 2A остаётся отложенным.
- Gate пока не создаёт CRM command и не публикует данные.
- Feature flag остаётся diagnostic-only и выключен в production.
- Полный визуальный прогон нового Gate result через LLM stages не выполнялся:
  real provider test прямо запрещён scope Phase 7; output path покрыт typed
  mocked E2E и runtime-boundary tests.

## Следующая фаза

Точный следующий scope — отдельно авторизованный deterministic CRM publication
adapter v3: versioned CRM input/output contracts, idempotency, разрешение write
только для `AUTO_SAVE`/`SAVE_WITH_WARNING`, review flow для
`REVIEW_REQUIRED`, запрет write при `TECHNICAL_ERROR` и audit diagnostics.

Следующая фаза не должна менять Judges, Summary Agent, Conversation Store,
Quality Gate policy, production flag или выполнять deploy без отдельного
разрешения.
