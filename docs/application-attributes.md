# AI Атрибуты в Заявке

Канонический runtime продукта восстановлен из фактически работающей локальной копии `attributes-september-backup`.

Источник эталона:

- Git snapshot `3a57752`;
- сохранённая конфигурация Local Storage `before-v27`;
- SHA-256 конфигурации `aa348189a75a6ed5884a5969643ca5780f0c7bf8e6a9fb11da526a93241f3bc9`;
- кодовая версия: **v26, последний локально сохранившийся вариант до v27**.

Файлы `v27–v33` и соответствующие локальные отчёты сохранены как история разработки. Playground продукта их не исполняет.

## Исполняемые файлы

- `public/pipeline-lab-v26.html` — канонический runtime и UI данного продукта.
- `public/ai-application-attributes-pipeline-v14.js` … `v26.js` — исходная цепочка миграций, промпты и настройки локального эталона.
- `src/features/mvp/screens/playground-screen.tsx` — выбирает восстановленный runtime только для проекта «AI Атрибуты в Заявке».

Общий `public/pipeline-lab-v3.html` продолжает обслуживать остальные продукты и не является runtime Application Attributes.

## Архитектура: 7 этапов

| № | `outKey` | Исполнитель | Модель |
|---:|---|---|---|
| 1 | `interest_extractor` | LLM | AI Tunnel / `gpt-5-mini`, temperature 0, maxTokens 2000 |
| 2 | `funding_source_extractor` | LLM | AI Tunnel / `gpt-5-mini`, temperature 0, maxTokens 2000 |
| 3 | `purchase_term_extractor` | LLM | AI Tunnel / `gpt-5-mini`, temperature 0, maxTokens 2000 |
| 4 | `next_contact_date_extractor` | LLM + локальная deterministic temporal normalization | AI Tunnel / `gpt-5-mini`, temperature 0, maxTokens 2000 |
| 5 | `attributes_judge` | единый LLM Judge | AI Tunnel / `gpt-5-mini`, temperature 0, maxTokens 5000 |
| 6 | `attributes_quality_gate` | deterministic code | модель не вызывается |
| 7 | `crm_attributes_result` | deterministic code | модель не вызывается |

Response schemas, parsing, Judge, temporal normalization, error handling и связи пяти AI-этапов соответствуют локальному v26. Поздние v33-слои context validation, actor normalization и повторная schema validation в этот путь не входят.

## Временная опора Next Contact

Runtime принимает:

- `communication_created_at`;
- `audio_created_at` как совместимый alias;
- `timezone`;
- время окончания аудио, если оно известно и нужно для выражений вида «через два часа».

Внутри восстановленного алгоритма эта опора передаётся как legacy `call_datetime`, чтобы не менять его семантику. В Playground есть редактируемое поле времени создания коммуникации. Относительные даты вычисляются только относительно этой опоры и выбранной timezone.

Неточная формулировка вроде «перезвоню попозже» не превращается в придуманную дату и не становится technical error. Если точный следующий datetime не подтверждён, CRM получает `SKIP`.

## Граница AI и CRM

Сначала полностью выполняются четыре Extractor и Judge. Quality Gate и CRM Result не меняют бизнес-значения AI.

CRM Result описывает только атомарные операции:

- новое подтверждённое scalar-значение → `SET`;
- значение не определено → `SKIP`;
- technical error → `ERROR`, существующее значение не меняется;
- подтверждённый Interest → `ADD`;
- отсутствие операции Interest → `KEEP`;
- `interest_operations.add/remove` содержит только конкретные изменения;
- `apply_mode=ATOMIC_OPERATIONS_ON_LATEST_CRM_STATE` фиксирует применение к актуальному состоянию заявки на момент записи.

Неопределённое scalar-значение не превращается в операцию записи, а полный снимок заявки для замены не формируется. Production CRM adapter в этом репозитории не реализован.

## Известный кейс «Небесная»

Ожидаемый бизнес-результат восстановленного AI pipeline:

- Interest: `Новостройки`;
- Funding Source: `продажа своей квартиры`;
- Purchase Term: определяется исходными Extractor/Judge v26 без специальных правил для этой транскрибации;
- Next Contact Date: точная дата не записывается, если выражение не даёт однозначный datetime; правильный ответ модели об инициаторе не переписывается поздним actor normalizer.

## Проверки

- `src/features/mvp/screens/playground-screen.test.tsx`
- `tests/smoke/application-attributes-restored-v26.spec.ts`
- существующие реальные fixtures в `tests/smoke/fixtures/application-attributes-*.json`
