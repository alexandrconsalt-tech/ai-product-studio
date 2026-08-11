# TypeScript repository baseline

## Зафиксированный baseline до Phase 9

Команда:

```bash
npx tsc --noEmit --pretty false
```

Результат до интеграционных изменений Phase 9:

- exit code: `1`;
- всего diagnostic строк `error TS`: `321`;
- `src/shared/stores/playground-test-run-store.test.ts`: `1`;
- `tests/smoke/pipeline-summary-audit.spec.ts`: `320`;
- файлы `src/features/transcription-summary/**`: `0`;
- API `src/app/api/transcription-summary-v3/**`: `0`.

Обе группы ошибок существовали до Phase 9 и находятся вне v3 scope. Phase 9 не
исправляет и не подавляет их.

## Проверка после изменений

После Phase 9 выполняются:

```bash
npx tsc --noEmit --pretty false
rg '^src/features/transcription-summary/|^src/app/api/transcription-summary-v3/' /tmp/phase9-tsc-after.log
```

Допуск Preview требует:

- итоговый список repository-wide ошибок полностью совпадает с baseline;
- scoped grep не возвращает новых v3 errors;
- `npm run build` проходит встроенную проверку production build;
- unit, mocked E2E, lint и smoke проходят.

Repository-wide typecheck не объявляется успешным. Перед production rollout
baseline должен быть либо исправлен отдельной задачей, либо формально принят как
технический долг с повторным доказательством отсутствия новых v3 errors.

Фактический результат Phase 9:

- exit code: `2`;
- всего diagnostic строк `error TS`: `321`;
- `cmp /tmp/phase9-tsc-before.log /tmp/phase9-tsc-after.log`: идентичны;
- scoped v3 errors: `0`.
