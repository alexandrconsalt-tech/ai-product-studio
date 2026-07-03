# AI Orchestrator v1.0

## Назначение

AI Orchestrator — центральный координатор AI Product Studio. Он управляет движением проекта от идеи до Playground и финального review.

Orchestrator не является AI Agent, Workflow Engine или Knowledge System. Он не содержит собственных Product Management или AI Architecture знаний. Он выбирает, какой интеллектуальный модуль использовать, передает контекст, проверяет Quality Gates и решает, можно ли перейти к следующему этапу.

## Ответственность

AI Orchestrator отвечает за:

- управление lifecycle проекта;
- запуск интеллектуальных модулей;
- передачу Context Object между модулями;
- контроль полноты обязательных артефактов;
- применение Quality Gates;
- возврат проекта на предыдущий этап при низком качестве;
- объяснение причин перехода, остановки или возврата.

AI Orchestrator не отвечает за:

- создание PRD вместо Senior Product Manager;
- проектирование AI Architecture вместо Senior AI Solution Architect;
- генерацию Visual Pipeline вместо Pipeline Builder;
- экспертную оценку вместо Reviewer;
- хранение бизнес-логики внутри UI.

## Структура

| Документ | Назначение |
|---|---|
| `WORKFLOW.md` | Полный workflow проекта |
| `STATE_MACHINE.md` | Конечный автомат и допустимые переходы |
| `CONTEXT.md` | Context Object и правила передачи контекста |
| `MODULES.md` | Контракты взаимодействия модулей |
| `DECISION_ENGINE.md` | Правила принятия orchestration decisions |
| `QUALITY_GATES.md` | Обязательные gates и критерии прохождения |
| `ERROR_HANDLING.md` | Обработка ошибок и возвратов |
| `OUTPUT_SCHEMA.md` | Единый машинно-читаемый формат результата |

## Принципы

### Simplicity

Orchestrator должен быть простым coordinator layer. Он не должен превращаться в микросервисную архитектуру или универсальный workflow engine.

### Knowledge Delegation

Orchestrator использует знания модулей:

1. Senior Product Manager Knowledge System.
2. Senior AI Solution Architect Knowledge System.
3. Pipeline Builder.
4. Reviewer.

Он не дублирует их методологии.

### Explicit State

Каждый проект имеет одно текущее состояние, историю переходов и причины решений.

### Quality Gates

Переходы между ключевыми этапами невозможны без прохождения gate.

### Machine Executability

Все решения должны быть представлены в структуре, пригодной для дальнейшей реализации в коде.

## Базовый lifecycle

```text
Idea -> PRD -> Architecture -> Pipeline -> Playground -> Final Review
```

## Взаимосвязь документов

- `WORKFLOW.md` определяет этапы.
- `STATE_MACHINE.md` определяет состояния и transitions.
- `CONTEXT.md` определяет данные между этапами.
- `MODULES.md` определяет module contracts.
- `DECISION_ENGINE.md` принимает решение о переходе.
- `QUALITY_GATES.md` задает проверочные условия.
- `ERROR_HANDLING.md` обрабатывает невозможность перехода.
- `OUTPUT_SCHEMA.md` задает формат результата Orchestrator.

## Критерии качества Orchestrator

- Нет дублирования знаний Product Manager и AI Architect.
- Каждый переход объясним.
- Каждый этап имеет вход, выход и ответственный модуль.
- Каждый Quality Gate проверяем.
- Нет циклических зависимостей между модулями.
- Процесс соответствует MVP и не перегружен.

