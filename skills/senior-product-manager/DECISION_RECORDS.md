# DECISION_RECORDS.md

## Назначение

Документ задает шаблон фиксации продуктовых решений.

## Ответственность

DECISION_RECORDS отвечает за:

- сохранение rationale;
- traceability;
- review history;
- long-term maintainability;
- auditability.

## Когда создавать Decision Record

Decision Record обязателен, если решение:

- меняет product strategy;
- меняет target segment;
- меняет scope;
- выбирает или отклоняет AI capability;
- влияет на architecture;
- меняет model selection;
- меняет release gate;
- принимает high-risk trade-off.

## Шаблон

```markdown
# DEC-000. Название решения

## Status

Proposed | Accepted | Rejected | Superseded

## Date

YYYY-MM-DD

## Context

Краткое описание ситуации и ограничения.

## Decision Type

problem | opportunity | prioritization | scope | ai-feasibility | model-selection | release

## Frameworks Used

- `framework_id`

## Options Considered

| Option | Pros | Cons | Risks |
|---|---|---|---|

## Evidence

| Evidence ID | Grade | Summary | Linked Claim |
|---|---|---|---|

## Assumptions

| Assumption ID | Statement | Risk | Validation |
|---|---|---|---|

## Decision

Выбранное решение.

## Rationale

Почему выбран именно этот вариант.

## Trade-offs

Какие компромиссы приняты.

## Consequences

Что станет проще, сложнее или рискованнее.

## What Would Change This Decision

Какие новые данные могут изменить решение.

## Review

Status, score, blocking issues.
```

## Взаимосвязь с другими документами

- `DECISION_ENGINE.md` задает логику решения.
- `OUTPUT_SCHEMA.md` задает машинно-читаемые поля.
- `REVIEW.md` проверяет decision quality.
- `PROCESS.md` требует records на gates.

## Обязательные разделы

- Status
- Context
- Decision Type
- Frameworks Used
- Options Considered
- Evidence
- Assumptions
- Decision
- Rationale
- Consequences
- Review

## Рекомендации

- Писать decision record в момент решения, а не постфактум.
- Не удалять устаревшие решения; использовать `Superseded`.
- Ссылаться на `framework_id`, а не копировать framework definitions.

## Пример

DEC-001: выбрать AI-assisted PRD draft вместо full generation.

Rationale: AI полезен для ускорения draft, но full generation нарушает accountability и повышает hallucination risk. Требуется human-in-the-loop.

## Критерии качества

- По record можно понять, почему решение было принято.
- Есть alternatives.
- Evidence и assumptions разделены.
- Есть condition для пересмотра.

## Ссылки на framework

`prd`, `ai-readiness-assessment`, `model-selection`, `evaluation-strategy`, `human-in-the-loop`.
