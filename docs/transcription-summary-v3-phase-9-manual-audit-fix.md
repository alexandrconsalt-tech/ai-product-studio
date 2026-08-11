# Transcription Summary v3 — Phase 9 manual audit correction

## Evidence and root cause

Два ручных отчёта от 2026-07-30 показали один и тот же фактический runtime:
`AI Tunnel`, `transcription_summary_v1`, `stage_version=v1`, prompts v2,
parser fallback и legacy Outcome shape.

Корневая причина находилась на UI boundary:

1. React получал Preview config асинхронно.
2. До config handshake iframe использовал default `v3Enabled=false`.
3. Кнопка запуска в этом состоянии переходила в legacy `runPipeline`.
4. При ошибке config fetch также отправлялся permissive false-config.
5. v3 routing дополнительно зависел от изменяемого `productName`.

Сохранённая пользовательская v1-конфигурация поэтому могла стать исполняемой
до получения Preview config.

## Routing correction

- v3 определяется только по стабильному product ID.
- React не отправляет config до успешной typed validation.
- embedded Preview целевого продукта не запускается до config handshake.
- Preview config содержит `transcriptionSummaryV3Required=true`.
- required Preview с disabled/missing config возвращает
  `TECHNICAL_ERROR / V3_RUNTIME_CONFIGURATION_MISMATCH`.
- server request содержит literal runtime attestation: pipeline/stage `3.0.0`,
  `openai-direct`, contract family `v3`, Structured Output required, parser
  fallback disabled.
- server и runtime executor повторно запрещают AI Tunnel и legacy markers.
- сохранённые provider/model/prompt настройки legacy pipeline не читаются
  full v3 orchestrator.
- standalone legacy runtime и production false-flag branch сохранены.

## Need and funding correction

SSOT: `funding-source-policy-v3@3.1.0`.

Детерминированные cash mappings:

- `деньги на счету`;
- `деньги на счёте`;
- `свои деньги`;
- `наличные`;
- `депозит`;

→ `наличные / депозит`.

Policy применяется к transport normalization и после Need Agent к
`facts.verified.v3`; Need Agent и Need Judge получают один и тот же visible
policy payload. Need Judge не может менять canonical value по своей Zod-схеме.
Store, Summary и CRM используют тот же canonical enum через v3 contracts.
Фраза про покупку родителями без денежного evidence не классифицируется как
funding source. Просмотр не считается missing need.

## Outcome correction

Outcome contract остаётся `outcome.agent.output.v3@3.0.0`; parser и schema не
расширялись. Prompt version поднят до `outcome_agent-v3.1.0`.

Outcome Agent/Judge теперь получают `facts.verified.v3`, `needs.verified.v3` и
source transcript references. Видимая инструкция запрещает считать условное
предложение показа назначенным показом. Явное обещание связаться вечером и
сообщить статус имеет приоритет как primary next step.

## Regression coverage

Golden pack расширен с 10 до 12 обезличенных synthetic scenarios. Два новых
кейса проверяют:

1. деньги на счету + контекст покупки родителями + условный показ;
2. запрос информации, отказ от просмотра и обещанный follow-up.

Оба full mocked pipeline regression проходят 19 stages до complete Store,
Summary, пяти Judges, AUTO_SAVE Gate и CRM `DRY_RUN`. Дополнительно покрыты
runtime guard, config handshake, funding mapping, запрет семейного inference и
видимые Need/Outcome prompts.

## Verification

- `npm test`: 742 passed, 1 skipped;
- `npm run lint`: passed;
- `npm run build`: passed;
- `npm run test:smoke`: 338 passed;
- repository TypeScript baseline: прежние 321 errors, список идентичен;
- scoped v3 TypeScript errors: 0;
- visual desktop/mobile QA: v3 badge присутствует, console errors отсутствуют.

## Deployment

Новый Preview:

<https://ai-product-studio-ki41dsgw0-alexandrconsalt-9822s-projects.vercel.app>

Deployment `dpl_2n9qCjcz1ezux1xKHgmTnztXEzsA`: target `preview`, status `Ready`.

Live config целевого продукта: v3 enabled, CRM dry-run enabled, v3 required,
pipeline `3.0.0`. Live API fault injection с `ai-tunnel`,
`transcription_summary_v1`, `stage_version=v1` и parser fallback возвращает
`TECHNICAL_ERROR / V3_RUNTIME_CONFIGURATION_MISMATCH` до запуска pipeline.

Production environment и production aliases не изменялись. CRM остаётся
dry-run only.
