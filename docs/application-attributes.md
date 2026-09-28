# AI Атрибуты в Заявке

Это каноническое описание текущей исполняемой реализации. Версия pipeline и промптов — **33**. Версионные отчёты `application-attributes-local-v*.md` и RTF-файлы являются историческими материалами.

## Исполняемые файлы

- `public/ai-application-attributes-pipeline-v14.js` … `v33.js` — последовательные совместимые миграции конфигурации. Финальная политика и промпты задаются `v32` и `v33`.
- `public/ai-application-attributes-contract-v2.js` — справочники, response schemas, проверки, Judge adapter, Quality Gate и CRM result. Имя файла сохранено для совместимости; актуальные response contracts имеют версии v3/v4, Gate и CRM — v5.
- `public/ai-application-attributes-runtime-v29.js` и `public/ai-application-attributes-runtime.json` — temporal helpers и контроль ревизии 33.
- `public/pipeline-lab-v3.html` — orchestration, передача context, детерминированная нормализация дат, отчёт и UI.

## Вход pipeline

Обязательный вход каждого LLM-этапа — текущая `transcript`.

Metadata pipeline:

| Поле | Назначение |
|---|---|
| `communication_created_at` | ISO datetime создания аудио/коммуникации; календарная опора относительных дат. Может быть передано как `audio_created_at` или `communication.created_at`. |
| `timezone` | IANA timezone, по умолчанию `Europe/Moscow`. |
| `current_attributes` | Текущие CRM-значения четырёх атрибутов. Нужны для безопасного обновления и сохранения старых значений. |
| `next_contact_fallback_at` | Уже рассчитанная сервером fallback-дата. Pipeline не создаёт новый таймер и не называет fallback фактом разговора. |

Если календарной опоры недостаточно, договорённость может быть сохранена как `unresolved` или `missing_reference`, но `next_contact_date` не записывается. Слова «позже», «попозже», «как освобожусь» и другие неточные выражения не превращаются в дату.

## Архитектура: 7 этапов

| № | `outKey` | Исполнитель | Модель / настройки | Вход | Выход |
|---:|---|---|---|---|---|
| 1 | `interest_extractor` | LLM | AI Tunnel, `gpt-5-mini`, temperature 0, maxTokens 4000 | transcript | `application_interest_extractor_v3` |
| 2 | `funding_source_extractor` | LLM | AI Tunnel, `gpt-5-mini`, temperature 0, maxTokens 2000 | transcript | `application_funding_source_extractor_v3` |
| 3 | `purchase_term_extractor` | LLM | AI Tunnel, `gpt-5-mini`, temperature 0, maxTokens 2000 | transcript | `application_purchase_term_extractor_v3` |
| 4 | `next_contact_date_extractor` | LLM + deterministic temporal normalization | AI Tunnel, `gpt-5-mini`, temperature 0, maxTokens 2000 | transcript, communication metadata | `application_next_contact_date_extractor_v4` |
| 5 | `attributes_judge` | LLM | AI Tunnel, `gpt-5-mini`, temperature 0, maxTokens 5000 | результаты четырёх Extractor + transcript + temporal audit | `application_attributes_judge_v4` |
| 6 | `attributes_quality_gate` | deterministic code | `actualExecutor=code` | результат Judge | Gate v5 |
| 7 | `crm_attributes_result` | deterministic code | `actualExecutor=code` | результат Gate + `current_attributes` | CRM result v5 |

Четыре Extractor запускаются независимо. Ошибка одного атрибута не блокирует Judge, Gate или сохранение остальных корректных атрибутов. Judge проверяет каждый атрибут отдельно. Gate и CRM result не вызывают модель.

## Справочники

`interest` поддерживает множественный выбор:

- Новостройки
- Ипотека
- Инвестиции в регионах
- Безопасность сделок
- Юридическое сопровождение
- Строительство

`funding_source`:

- наличные / депозит
- ипотека одобрена
- ипотека в процессе
- продажа своей квартиры

`purchase_term`:

- до 1 месяца
- 2–3 месяца
- 3–6 месяцев
- более 6 месяцев

`next_contact_date` сохраняет только валидный ISO datetime с точностью `exact`. Вид взаимодействия передаётся отдельно: `callback`, `message`, `send_information`, `confirm`, `meeting`.

## Quality Gate и CRM

Текущий deterministic Gate использует следующие решения:

| Gate decision | CRM action | Поведение |
|---|---|---|
| `AUTO_SAVE` | `SET` | Записать новое подтверждённое значение, заменив существующее scalar-значение. |
| `DO_NOT_UPDATE` | `SKIP` | Сохранить существующее значение без изменения. |
| `TECHNICAL_ERROR` | `ERROR` | Сохранить существующее значение проблемного атрибута; остальные обрабатываются независимо. |
| `SAVE_DECLINED` | `SET_DECLINED` | Для scalar-поля записать явный отказ как очистку; для Interest применить только явно подтверждённые удаления. |
| `USE_SYSTEM_FALLBACK` | `KEEP_FALLBACK` | Использовать переданный серверный fallback только при отсутствии существующей и подтверждённой AI-даты. |

`SAVE_UNDETERMINED` и `SET_UNDETERMINED` встречаются в исторических промптах ранних версий, но актуальный Gate v5 их не выдаёт. `not_determined` преобразуется в `DO_NOT_UPDATE/SKIP`, поэтому отсутствие информации в новом звонке не очищает CRM.

### Scalar attributes

Для `funding_source`, `purchase_term` и `next_contact_date` подтверждённое новое значение имеет приоритет над `current_attributes`. При `not_determined`, отклонении Judge или технической ошибке старое значение сохраняется.

Подтверждённая AI-дата контакта заменяет существующую или default/fallback дату. Неточная договорённость не меняет CRM-дату.

### Interest

Interest не заменяется полным массивом текущего звонка. Gate формирует `interest_operations`:

- `add` — подтверждённые новые направления;
- `remove` — направления с явным подтверждённым отказом;
- `keep` — отсутствие операций.

CRM result объединяет `add` с существующим массивом и удаляет только элементы из `remove`. Неупомянутые направления сохраняются.

## Фактическое поведение

| Ситуация | Действие |
|---|---|
| Новое достоверное scalar-значение | Обновить (`SET`) |
| В новом звонке значение не определено | Старое не трогать (`SKIP`) |
| Technical error | Старое не трогать (`ERROR`) |
| Новый Interest | Добавить через `interest_operations.add` |
| Старый Interest не упомянут | Оставить |
| Явный отказ от Interest | Снять только конкретное значение через `interest_operations.remove` |
| Новая подтверждённая дата контакта | Обновить (`SET`) |
| Дата контакта не определяется | Старую дату не трогать; новый fallback не придумывать |

## Интеграционная граница

Репозиторий формирует и проверяет `crm_attributes_result`, включая `update_actions`, `interest_operations`, итоговые значения и сохранение `current_attributes`. Отдельного production-адаптера, отправляющего этот payload во внешнюю CRM, в репозитории нет.

Минимальная интеграция backend должна:

1. передать в запуск `current_attributes` и server-generated `next_contact_fallback_at`, если он существует;
2. применить `SET`, пропустить `SKIP/ERROR`, обработать `SET_DECLINED` и `KEEP_FALLBACK`;
3. для Interest применять `add/remove`, не заменяя поле только массивом значений текущего звонка.

Realtime-обновление открытой карточки и provenance вида `updated_by=AI/user` в текущий контракт не входят.

## Связанные тесты

- `src/shared/repositories/application-attributes-contract.test.ts`
- `src/shared/repositories/application-attributes-recovery.test.ts`
- `src/shared/repositories/application-next-contact-contract.test.ts`
- `tests/smoke/application-attributes-pipeline.spec.ts`
