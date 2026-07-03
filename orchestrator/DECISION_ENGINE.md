# DECISION_ENGINE.md

## Назначение

Документ описывает правила принятия решений AI Orchestrator.

## Принцип

Orchestrator принимает только orchestration decisions: какой модуль запускать, можно ли перейти дальше, нужно ли вернуть проект назад, нужно ли задать вопрос пользователю.

Он не принимает Product и AI Architecture решения вместо Knowledge Systems.

## Decision Types

| Decision ID | Название | Ответственность |
|---|---|---|
| `select_next_module` | Выбрать следующий модуль | Orchestrator |
| `advance_state` | Перейти вперед | Orchestrator + Quality Gate |
| `return_to_previous_stage` | Вернуть на доработку | Orchestrator |
| `ask_user` | Запросить данные | Orchestrator |
| `block_project` | Остановить проект до resolution | Orchestrator |
| `complete_project` | Завершить проект | Orchestrator + Final Review |

## Core Rules

### D-001. Product Review Threshold

Если Product Review < 85, проект возвращается в `product_design`.

Если причина score связана с lack of evidence, проект возвращается в `discovery`.

### D-002. AI Readiness

Если AI Readiness = Low, проект не переходит к `architecture_design`.

Orchestrator должен:

1. вернуть проект в `product_design`, если AI capability не обоснована;
2. вернуть в `discovery`, если проблема не подтверждена;
3. спросить пользователя, если не хватает operational constraints.

### D-003. Architecture Review Threshold

Если Architecture Review < 90, проект возвращается в `architecture_design`.

Если issue связан с PRD contradiction, проект возвращается в `product_design`.

### D-004. Pipeline Validation

Если Pipeline Validation Failed, проект возвращается в `pipeline_generation`.

Если failure вызван неполной architecture, проект возвращается в `architecture_design`.

### D-005. Mandatory User Question

Если отсутствуют обязательные данные, которые нельзя вывести из artifacts, Orchestrator должен задать вопрос пользователю вместо генерации предположения.

### D-006. No Forward Skip

Запрещено переходить к Architecture без Product Complete, к Pipeline без Architecture Complete, к Playground без Pipeline Complete.

### D-007. No Knowledge Duplication

Если решение требует Product Management знания, Orchestrator запускает Senior Product Manager. Если решение требует AI Architecture знания, запускает Senior AI Solution Architect.

### D-008. Return Loop Limit

Если проект возвращается между двумя состояниями больше двух раз по одной причине, Orchestrator переводит проект в `blocked` и формирует user questions или escalation summary.

## Decision Algorithm

1. Прочитать current state.
2. Проверить required artifacts.
3. Проверить applicable Quality Gate.
4. Проверить module output validation.
5. Определить blocking issues.
6. Если blocking issues есть, выбрать return state или `blocked`.
7. Если данных пользователя не хватает, создать questions.
8. Если gate passed, выполнить allowed transition.
9. Записать transition reason.

## Decision Output

```json
{
  "decision_type": "advance_state",
  "from_state": "product_review",
  "to_state": "product_ready",
  "next_module": "senior-ai-solution-architect",
  "reason": "Product Review score is 91 and Product Complete gate passed.",
  "blocking_issues": [],
  "required_user_questions": [],
  "confidence": "high"
}
```

## Взаимосвязь

- Пороговые gates описаны в `QUALITY_GATES.md`.
- Допустимые переходы описаны в `STATE_MACHINE.md`.
- Ошибки описаны в `ERROR_HANDLING.md`.
- Формат результата описан в `OUTPUT_SCHEMA.md`.

## Критерии качества

- Decision объясним.
- Decision не нарушает state machine.
- Decision не содержит domain knowledge, принадлежащее модулям.
- Decision имеет traceable reason.

