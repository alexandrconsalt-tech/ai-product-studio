# AI Атрибуты в Заявке

Это каноническое описание текущей исполняемой реализации. **v33 — единственная текущая каноническая версия Application Attributes Pipeline.** Версионные отчёты `application-attributes-local-v*.md`, RTF-файлы и миграции до v33 являются историческими материалами и не должны использоваться для выбора актуального контракта.

## Исполняемые файлы

- `public/ai-application-attributes-pipeline-v14.js` … `v33.js` — последовательные совместимые миграции конфигурации. Только итоговая конфигурация после применения v33 является актуальной; финальная политика и промпты задаются v33 поверх предыдущих миграций.
- `public/ai-application-attributes-contract-v2.js` — справочники, response schemas, проверки, Judge adapter, Quality Gate и атомарный CRM result. Имя файла сохранено для совместимости; актуальные response contracts имеют версии v3/v4, Gate и CRM — v5.
- `public/ai-application-attributes-runtime-v29.js` и `public/ai-application-attributes-runtime.json` — temporal helpers и контроль ревизии 33.
- `public/pipeline-lab-v3.html` — orchestration, передача context, детерминированная нормализация дат, отчёт и UI.

## Вход pipeline

Обязательный вход каждого LLM-этапа — текущая `transcript`.

Metadata pipeline:

| Поле | Назначение |
|---|---|
| `communication_created_at` | ISO datetime создания аудио/коммуникации; календарная опора относительных дат. Может быть передано как `audio_created_at` или `communication.created_at`. |
| `timezone` | IANA timezone, по умолчанию `Europe/Moscow`. |
| `current_attributes` | Снимок CRM на момент запуска. Используется только для проверки допустимости server fallback. Не включается в результат как состояние для последующей полной замены заявки. |
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
| `SAVE_DECLINED` | `REMOVE` для Interest или `SET_DECLINED` для Next Contact | Для Interest удалить только явно отклонённые значения. Для Next Contact сохранить отдельную семантику отказа от контакта. Для `funding_source` и `purchase_term` это решение недопустимо. |
| `USE_SYSTEM_FALLBACK` | `KEEP_FALLBACK` | Использовать переданный серверный fallback только при отсутствии существующей и подтверждённой AI-даты. |

`SAVE_UNDETERMINED` и `SET_UNDETERMINED` относятся только к историческим миграциям до v33. Они отсутствуют в актуальном runtime/UI и не входят в текущий контракт. `not_determined` преобразуется в `DO_NOT_UPDATE/SKIP`, поэтому отсутствие информации в новом звонке не очищает CRM.

### Scalar attributes

Для `funding_source`, `purchase_term` и `next_contact_date` подтверждённое новое значение формирует операцию `SET`. При `not_determined`, отклонении Judge или технической ошибке pipeline возвращает `SKIP` или `ERROR`, не передаёт старое значение обратно как payload и не меняет CRM.

`explicit_declined` для `funding_source` и `purchase_term` также формирует `DO_NOT_UPDATE/SKIP`. Отказ отвечать или обсуждать способ оплаты либо срок покупки не очищает существующее подтверждённое значение. Новый подтверждённый факт по этим атрибутам по-прежнему формирует `AUTO_SAVE/SET`.

Подтверждённая AI-дата контакта заменяет существующую или default/fallback дату. Неточная договорённость не меняет CRM-дату.

### Interest

Interest не заменяется полным массивом текущего звонка. Gate формирует `interest_operations`:

- `add` — подтверждённые новые направления;
- `remove` — направления с явным подтверждённым отказом;
- `keep` — отсутствие операций.

CRM result не объединяет массив со снимком `current_attributes`. Он передаёт только атомарные операции: `ADD`, `REMOVE`, их сочетание `ADD_REMOVE` или `KEEP`, а также конкретные списки `interest_operations.add/remove`. Backend применяет их к актуальному массиву CRM на момент записи. Неупомянутые направления сохраняются.

## Фактическое поведение

| Ситуация | Действие |
|---|---|
| Новое достоверное scalar-значение | Обновить (`SET`) |
| В новом звонке значение не определено | Старое не трогать (`SKIP`) |
| Отказ обсуждать Funding Source или Purchase Term | Старое не трогать (`SKIP`) |
| Technical error | Старое не трогать (`ERROR`) |
| Новый Interest | Добавить через `interest_operations.add` |
| Старый Interest не упомянут | Оставить |
| Явный отказ от Interest | Снять только конкретное значение через `interest_operations.remove` |
| Новая подтверждённая дата контакта | Обновить (`SET`) |
| Дата контакта не определяется | Старую дату не трогать; новый fallback не придумывать |

## Интеграционная граница

Репозиторий формирует и проверяет `crm_attributes_result`, включая `update_actions`, `interest_operations` и только новые значения для операций `SET`. Поле `attributes` является payload изменений: при `SKIP`, `ERROR` и для Interest оно содержит `null`; оно не является итоговым снимком заявки. Отдельного production-адаптера, отправляющего этот payload во внешнюю CRM, в репозитории нет.

Минимальная интеграция backend должна:

1. передать в запуск `current_attributes` и server-generated `next_contact_fallback_at`, если он существует;
2. непосредственно перед записью прочитать актуальное состояние заявки;
3. применить scalar `SET` к конкретному полю, пропустить `SKIP/ERROR`, отдельно обработать `SET_DECLINED` для Next Contact и `KEEP_FALLBACK`;
4. для Interest атомарно применить `interest_operations.add/remove` к актуальному массиву: добавить отсутствующие значения, удалить только явно перечисленные и сохранить все неупомянутые;
5. не заменять заявку или Interest состоянием из `current_attributes`, полученным до начала анализа.

Пример: если во время анализа оператор изменил заявку, backend применяет полученный `SET` или `ADD/REMOVE` поверх этого нового состояния. Pipeline не возвращает старые значения как инструкцию восстановить прежний снимок.

Realtime-обновление открытой карточки и provenance вида `updated_by=AI/user` в текущий контракт не входят.

## Связанные тесты

- `src/shared/repositories/application-attributes-contract.test.ts`
- `src/shared/repositories/application-attributes-recovery.test.ts`
- `src/shared/repositories/application-next-contact-contract.test.ts`
- `tests/smoke/application-attributes-pipeline.spec.ts`
