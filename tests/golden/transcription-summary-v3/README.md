# Transcription Summary v3 Golden Dataset

Исходный Preview pack содержит двадцать synthetic обезличенных сценариев для
ручной проверки Phase 9 и semantic-quality regressions. Кейсы сохраняют
бизнес-смысл отчётов, но не содержат персональных данных исходных звонков.
Он не используется как основание для искусственного выставления score 95+.

Для каждого сценария проверяются:

- роли и отсутствие выдуманных фактов;
- типизированные Facts, Needs и Outcome;
- complete Store v3 без legacy fields;
- честный Summary и корректный next step;
- пять независимых Judge score в ожидаемых диапазонах;
- объяснимое решение Quality Gate;
- только `DRY_RUN` или policy-driven `SKIPPED` для CRM;
- отсутствие schema/parse/Structured Output technical errors в обычных сценариях.

Транскрипции не содержат телефонов, email, имён, адресов или CRM credentials.

## Production quality regression v1

Каталог `quality-regression` содержит отдельный обязательный набор из 40
обезличенных production-derived сценариев. Каждый сценарий связан только с
SHA-256 fingerprint исходного локального production report; путь, персональные
данные и исходный отчёт в Git не сохраняются. Реплики сокращены до
проверяемого бизнес-смысла и прошли ручную очистку контактов и точных адресов.

Для каждого кейса заданы:

- transcript;
- critical и forbidden meanings;
- forbidden agreements;
- expected `call_result` и `primary_next_step`;
- semantic Summary rubric;
- допустимые варианты формулировок;
- теги обязательного покрытия.

Статическая проверка Dataset:

```bash
npm run quality:summary-v3:validate
```

Production regression запускается через тот же server-side typed v3
orchestrator, который использует продукт. До production promotion следует
использовать URL candidate Preview deployment с тем же commit; после promotion
тот же набор повторно запускается против production URL. Требуется полный URL
endpoint:

```bash
QUALITY_REGRESSION_URL=https://<production-host>/api/transcription-summary-v3/structured \
  npm run quality:summary-v3:production
```

Runner отправляет только обезличенные транскрипции, требует 40 полных
13-stage reports, проверяет DRY_RUN и создаёт
`artifacts/transcription-summary-v3-quality-regression.json`. Отчёт содержит
before/after, delta метрик и критериев, улучшенные кейсы, регрессии и причины.

`predeploy` настроен fail-closed на production regression. Изменения prompt,
Summary Plan, schemas, normalization, Judges и Gate входят в code fingerprint.
Изменение Judge/Gate fingerprint при росте score блокируется до ручного
пересмотра baseline, чтобы рост нельзя было получить ослаблением оценки.

Первый успешный production run должен быть проверен человеком и сохранён как
новый `baseline.json`. До этого baseline имеет статус
`AWAITING_FIRST_ACCEPTED_PRODUCTION_RUN`; статическая валидация проходит, но
predeploy без реального production run не проходит.

После ручной проверки принятого отчёта baseline можно обновить только явной
командой с тем же production run:

```bash
node scripts/transcription-summary-v3-quality-regression.mjs --live \
  --url "$QUALITY_REGRESSION_URL" --accept-baseline
```

Runner запрещает сохранять baseline, если хотя бы один acceptance criterion
или Golden case не прошёл.

Production deployment этого проекта следует запускать через `npm run deploy`:
npm lifecycle автоматически выполнит `predeploy` и не запустит Vercel при
проваленной регрессии. Прямой вызов `vercel --prod` обходит эту гарантию и не
является разрешённым deployment workflow для Summary v3.

GitHub workflow выполняет статическую проверку на каждом релевантном PR и live
regression после успешного Vercel deployment status. Его также можно запустить
вручную с обязательным `endpoint`. Проверка текущего production URL до
развёртывания candidate commit не считается pre-deploy acceptance.
