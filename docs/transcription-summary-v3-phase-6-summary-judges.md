# Phase 6 — пять Summary Judges v3

Статус: реализовано только в diagnostic runtime при
`TRANSCRIPTION_SUMMARY_V3_CONTRACT_REGISTRY=true`. Production flag не включён,
deploy и real-provider test не выполнялись.

## Контракты

Typed input одного Judge:

`summary.judge.input.v3@3.0.0`

Он содержит immutable run/manifest/Store/transcript/Summary refs, полный
`conversation.store.v3@3.1.0`, `summary.content.v3@3.1.0`, точный transcript
context и policy `{ criterion, weight: 0.2 }`. Input Builder пересчитывает
Store, transcript и Summary hashes, проверяет complete Store, Summary
provenance и точное покрытие Store sources.

Текущий общий output:

`summary.judge.verdict.v3@3.1.0`

Draft 3.0.0 сохранён deprecated без автоматической migration: в нём нет source
metadata, новой severity scale и полного criterion-specific payload.

Envelope содержит criterion, verdict, дискретный score, confidence, issues,
evidence, discriminated payload и metadata с Store/Summary hashes.

## Пять criteria и payload

1. `faithfulness`: `unsupportedClaims`, `distortedFacts`, `roleErrors`,
   `quoteErrors`, `attributeMismatches`.
2. `completeness`: `missingGoal`, `missingRequirements`,
   `missingConstraints`, `missingFinancialContext`, `missingOutcome`,
   `missingNextStep`, `missingCriticalQuestions`.
3. `usefulness`: `agentBlockingOmissions`, `unclearStatements`,
   `missingOperationalContext`, `unnecessaryDetails`,
   `usabilityAssessment`.
4. `agreements_next_step`: `missingAction`, `incorrectOwner`,
   `incorrectRecipient`, `incorrectDeadline`, `incorrectChannel`,
   `incorrectStatus`, `missingNextStep`, `inventedDetails`.
5. `format`: `semanticRepetitions`, `crmCardDuplications`,
   `verbosityIssues`, `structureIssues`, `readabilityIssues`,
   `technicalFieldLeaks`.

Каждый finding может содержать только существующие transcript turn IDs и Store
item IDs.

## Score и verdict policy

Допустимы только:

| Score | Verdict |
|---:|---|
| 100 | `pass` |
| 75 | `warning` |
| 50 | `fail` |
| 25 | `fail` |
| 0 | `fail` |
| null | `technical_error` |

`technical_error` требует `confidence=null`. Другие verdict требуют confidence.
Judge не возвращает weighted/aggregate score.

## Prompt isolation

Используются пять отдельных fully visible prompt:

| Criterion | Prompt ID | Version |
|---|---|---|
| faithfulness | `summary-judge-faithfulness` | `summary-judge-faithfulness-v3.0.0` |
| completeness | `summary-judge-completeness` | `summary-judge-completeness-v3.0.0` |
| usefulness | `summary-judge-usefulness` | `summary-judge-usefulness-v3.0.0` |
| agreements_next_step | `summary-judge-agreements-next-step` | `summary-judge-agreements-next-step-v3.0.0` |
| format | `summary-judge-format` | `summary-judge-format-v3.0.0` |

Каждый resolved prompt содержит только одну роль/criterion, собственные
check/exclusion rules, общую дискретную шкалу, Store, Summary, transcript
context и output JSON Schema. Prompt ID/version/hash фиксируются до provider
call. Hidden appendix, Local Storage override и post-hash instructions
отсутствуют.

## Structured Output

Каждый Judge отдельно использует Phase 2 adapter:

- Registry JSON Schema передаётся через `response_format`;
- результат валидируется той же Zod-схемой;
- разрешена одна repair-попытка с той же schema;
- markdown parser, manual JSON extraction и text fallback отсутствуют;
- schema/provider error становится technical error без score.

Provider acceptance остаётся отложенным до отдельного controlled preview-теста
владельцем продукта.

## Formal post-validation

Единая typed boundary проверяет только:

- criterion stage/envelope/payload;
- score enum и score/verdict/confidence relation;
- source Store ID/hash и Summary hash;
- prompt/contract versions;
- существование source turn и Store item IDs;
- допустимый issue code для criterion;
- criterion-specific payload schema.

Boundary не меняет score/verdict/issues, не добавляет и не удаляет findings, не
пересчитывает semantic quality и не использует legacy specialized validators.

## Независимость и stop policy

Runtime выполняет пять отдельных stages последовательно:

```text
Summary v3 SUCCESS
→ Faithfulness
→ Completeness
→ Usefulness
→ Agreements/Next Step
→ Format
→ Phase 6 boundary
```

Каждый stage получает только Store, Summary, transcript context и собственный
criterion. Он не получает результаты других Judges.

- Summary отсутствует/technical: все Judges `NOT_RUN`.
- Один Judge technical: он получает null score; остальные продолжают работу.
- Invalid output после repair: `SUMMARY_JUDGE_OUTPUT_INVALID`.
- После Format Quality Gate и CRM остаются `NOT_RUN`.
- При выключенном feature flag legacy runtime не меняется.

## Diagnostics

Для каждого Judge сохраняются stage/criterion, input/output contract refs,
manifest/Store/Summary refs, prompt/schema hashes, Structured Output
attestation, attempts/repair, score/confidence/verdict, validation status,
error type/code и duration. Chain-of-thought и raw transcript в diagnostic не
записываются.

## Tests

Покрыты input provenance, пять payload, prompt isolation/determinism,
score/verdict policy, technical error, source refs, issue codes, no mutation,
Structured Output, one repair, markdown rejection, provider error,
independence, warning/fail, отсутствующий agreement, допустимое тематическое
пересечение, semantic repetition, invented deadline, omission, useless
Summary, technical field leak и Phase 6 runtime boundary.

Real provider вызов не выполняется.

## Результаты проверок

Локально, без `OPENAI_API_KEY` и provider-вызовов:

- добавлено 40 unit/integration/mocked E2E tests Phase 6;
- целевые contracts/store/summary/Judges tests: 201 passed;
- полный `npm test`: 628 passed, 1 skipped;
- `npm run lint`: passed;
- `npm run build`: passed;
- `npm run test:smoke`: 338 passed на desktop и mobile Chromium;
- scoped ESLint: passed;
- `npx tsc --noEmit`: 0 ошибок Phase 6; остаются только известные baseline
  errors в `src/shared/stores/playground-test-run-store.test.ts` и
  `tests/smoke/pipeline-summary-audit.spec.ts`;
- `git diff --check`: passed.

## Rollback

Оставить `TRANSCRIPTION_SUMMARY_V3_CONTRACT_REGISTRY` unset/false. Deprecated
Judge 3.0.0 и legacy compatibility adapter остаются доступны старому runtime,
но Phase 6 v3 path их не импортирует.

## Known limitations и следующий scope

Phase 6 не агрегирует verdicts и не принимает publication decision. Semantic
оценка зависит от модели; реальный provider acceptance не выполнен.

Следующая фаза должна быть отдельно авторизована как Phase 7 — deterministic
Summary Quality Gate v3, который принимает ровно пять typed verdicts, проверяет
их completeness/hashes и возвращает null aggregate score при любом technical
error. CRM, production flag и deploy в этот scope автоматически не входят.
