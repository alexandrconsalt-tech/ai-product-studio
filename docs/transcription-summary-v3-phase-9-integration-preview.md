# Transcription Summary v3 — Phase 9 integration and Preview

## Runtime flow

Typed orchestrator `executeTranscriptionSummaryV3Pipeline` выполняет:

Validation → Facts Agent → Facts Judge → Facts Verified → Needs Agent → Needs
Judge → Needs Verified → Outcome Agent → Outcome Judge → Outcome Verified →
Conversation Store v3 → Summary Agent v3 → пять Summary Judges → Quality Gate v3
→ CRM Publication v3 dry-run.

HTML Pipeline Lab отправляет один `execute_pipeline` request и отображает typed
Pipeline Report; основная orchestration logic находится в TypeScript.

## Feature flags

- `TRANSCRIPTION_SUMMARY_V3_ENABLED`
- `TRANSCRIPTION_SUMMARY_V3_CRM_DRY_RUN`

Оба значения должны быть строго `true`. Отсутствие значения означает `false`.
Vercel Preview допускается при `VERCEL_ENV=preview`; production deployment всегда
получает `v3Enabled=false`. Query parameters и Local Storage не могут включить v3.
Typed iframe config содержит effective enabled state, CRM dry-run и pipeline version.
Каждый Pipeline Report сохраняет snapshot флагов.

## Transport

Full Preview action принимает только `openai-direct`. Каждый LLM stage вызывает
Structured Output boundary с JSON Schema из immutable manifest. AI Tunnel, legacy
transport и text fallback отсутствуют. Недоступный direct provider возвращает
`STRUCTURED_OUTPUT_UNAVAILABLE`/technical error и блокирует зависимые стадии.

## Stop policy

- Agent или upstream Judge technical error: Verified boundary не создаётся,
  зависимые стадии `NOT_RUN`.
- Store technical error: Summary и ниже `NOT_RUN`.
- Summary technical error: Judges, Gate и CRM `NOT_RUN`.
- Один Summary Judge technical error: остальные Judges выполняются, Gate получает
  `TECHNICAL_ERROR`, score `null`, CRM возвращает `SKIPPED`.
- `REVIEW_REQUIRED`: CRM `SKIPPED`.
- `AUTO_SAVE`/`SAVE_WITH_WARNING`: Preview CRM только `DRY_RUN`.

Статусы унифицированы: `SUCCESS`, `SUCCESS_WITH_WARNING`, `BUSINESS_REJECTION`,
`TECHNICAL_ERROR`, `NOT_RUN`.

## Pipeline Report v3

`pipeline.report.v3@3.1.0` содержит 19 stage reports: contract/schema identity,
base/resolved prompt, prompt version/hash, provider/model, Structured Output,
attempts, normalization, validation, Judge score/confidence, error/blocking и
duration. Run-level блок содержит run/pipeline/manifest/transcript identity,
flags, start/end, final status, Quality score/decision и CRM status.

`pipeline.report.v3@3.0.0` помечен deprecated.

## Preview UI

Pipeline Lab показывает banner `AI Summary v3`, pipeline version и `CRM DRY_RUN`.
Stage cards отдельно показывают unified status, contract, attempts, Structured
Output и техническую ошибку. Typed outputs включают Summary, structured
attributes, пять Judge результатов, Gate и CRM result.

## Mocked E2E и golden pack

Full mocked E2E содержит 10 обязательных сценариев stop policy и решений Gate/CRM.
Golden Preview pack расположен в `tests/golden/transcription-summary-v3` и содержит
10 synthetic обезличенных звонков с ожидаемыми Facts/Needs/Outcome/Store/Summary,
диапазонами пяти Judge scores, Gate и CRM.

## TypeScript baseline

Baseline описан в `docs/typescript-baseline-errors.md`: 321 существующая ошибка
только в двух файлах вне v3 scope. Repository-wide typecheck не считается зелёным;
Preview допускается только при идентичном before/after списке и нулевом scoped v3
diff.

## Ручной Preview test plan

1. Открыть Preview URL и продукт «Модуль транскрибации и AI-саммари звонков».
2. Перейти в Pipeline Lab и проверить banner v3, version и CRM DRY_RUN.
3. Выбрать `openai-direct`, задать временный non-production ключ локально в UI.
4. По очереди вставить 10 сценариев из golden pack.
5. Запустить каждый сценарий и раскрыть все stage cards.
6. Проверить отсутствие schema/parse errors, перепутанных ролей и выдуманных фактов.
7. Проверить Store complete, Summary/attributes, пять score и объяснимый Gate.
8. Проверить CRM status: только `DRY_RUN` или policy-driven `SKIPPED`.
9. Повторить один запуск с тем же входом и сравнить deterministic results.
10. Не использовать персональные данные или production CRM credentials.

## Preview deployment

Preview URL:

<https://ai-product-studio-7008onz8y-alexandrconsalt-9822s-projects.vercel.app>

Vercel deployment `dpl_2f8Z6sJqEEaDmYcqLpqeWYckvtZw` завершён со статусом
`READY` как Preview (`target=null`), без production promotion и без изменения
production aliases.

В Vercel добавлены только Preview-scoped значения:

- `TRANSCRIPTION_SUMMARY_V3_ENABLED=true`;
- `TRANSCRIPTION_SUMMARY_V3_CRM_DRY_RUN=true`.

Runtime-config на опубликованном Preview подтверждает для
`project_transcription_summary_module`: v3 enabled, CRM dry-run enabled,
pipeline `3.0.0`. Для постороннего product ID v3 остаётся disabled, а CRM
dry-run — enabled. Production environment не изменялся.

Ручной provider E2E по десяти сценариям ещё должен выполнить пользователь; до
его подтверждения Phase 9 не считается принятой для production rollout.

## Rollback и blockers

Rollback Preview: удалить Preview deployment или снять два Preview-scoped флага.
Legacy runtime остаётся доступным при false flag.

Known blockers production:

- ручной acceptance ещё не выполнен пользователем;
- real-provider acceptance Phase 2A отложен;
- production CRM repository/client и provider atomicity attestation отсутствуют;
- repository-wide TypeScript baseline остаётся красным;
- production rollout требует отдельную Phase 10.

## Manual audit correction

Системные дефекты двух ручных запусков и их исправление описаны в
`docs/transcription-summary-v3-phase-9-manual-audit-fix.md`. Новый Preview
использует fail-closed config handshake и runtime attestation; прежний Preview
URL не следует использовать для повторной acceptance-проверки.

Актуальный Preview после исправления:

<https://ai-product-studio-ki41dsgw0-alexandrconsalt-9822s-projects.vercel.app>
