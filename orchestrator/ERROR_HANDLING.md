# ERROR_HANDLING.md

## Назначение

Документ описывает правила обработки ошибок AI Orchestrator.

## Error Categories

| Error ID | Категория | Описание |
|---|---|---|
| `insufficient_data` | Недостаточно данных | Не хватает input для безопасного перехода |
| `contradictory_requirements` | Противоречивые требования | Artifacts содержат конфликтующие claims |
| `missing_artifact` | Отсутствует артефакт | Required artifact не создан |
| `low_product_quality` | Низкое качество продукта | Product Review ниже threshold |
| `low_architecture_quality` | Низкое качество архитектуры | Architecture Review ниже threshold |
| `pipeline_validation_failed` | Pipeline невалиден | Pipeline Builder output не проходит validation |
| `implementation_impossible` | Невозможность реализации | Constraints делают решение нереализуемым |
| `module_failure` | Ошибка модуля | Модуль не вернул валидный output |
| `invalid_transition` | Недопустимый переход | Transition нарушает state machine |

## Handling Rules

### `insufficient_data`

Действие:

1. определить missing fields;
2. сформировать user questions;
3. перевести проект в `blocked`, если без ответа продолжать рискованно.

Нельзя: придумывать недостающие данные.

### `contradictory_requirements`

Действие:

1. указать conflict source;
2. вернуть в модуль-владелец artifact;
3. запросить user decision, если conflict бизнесовый.

### `missing_artifact`

Действие:

1. определить required artifact;
2. запустить ответственный модуль;
3. если artifact невозможен, перевести в `blocked`.

### `low_product_quality`

Действие:

- если Product Review < 85, вернуть в `product_design`;
- если причина lack of evidence, вернуть в `discovery`.

### `low_architecture_quality`

Действие:

- если Architecture Review < 90, вернуть в `architecture_design`;
- если проблема в PRD, вернуть в `product_design`.

### `pipeline_validation_failed`

Действие:

- вернуть в `pipeline_generation`;
- если source issue architecture-level, вернуть в `architecture_design`.

### `implementation_impossible`

Действие:

1. сформировать невозможные constraints;
2. предложить варианты: reduce scope, change architecture, reject AI, ask user;
3. перевести в `blocked`, если нужен business decision.

### `module_failure`

Действие:

1. сохранить failure reason;
2. повторить один раз, если failure transient;
3. перевести в `blocked`, если output invalid повторно.

### `invalid_transition`

Действие:

1. отклонить transition;
2. сохранить error;
3. выбрать ближайший допустимый transition из `STATE_MACHINE.md`.

## Error Object

```json
{
  "error_id": "ERR-001",
  "error_type": "insufficient_data",
  "state": "product_design",
  "module": "senior-product-manager",
  "message": "Не указан target user.",
  "blocking": true,
  "resolution": {
    "action": "ask_user",
    "questions": ["Кто основной пользователь продукта?"]
  }
}
```

## Return Loop Handling

Если один и тот же error type вызывает возврат между одними и теми же состояниями больше двух раз:

- остановить автоматические возвраты;
- перевести проект в `blocked`;
- сформировать summary для пользователя;
- запросить решение или дополнительный контекст.

## Взаимосвязь

- Error handling использует transitions из `STATE_MACHINE.md`.
- Decision rules находятся в `DECISION_ENGINE.md`.
- Gate failures описаны в `QUALITY_GATES.md`.
- Error output входит в `OUTPUT_SCHEMA.md`.

## Критерии качества

- Каждая ошибка имеет owner и resolution.
- Orchestrator не маскирует blocking issue.
- Пользователь получает конкретный вопрос, если нужен input.
- Нет бесконечных циклов возврата.

