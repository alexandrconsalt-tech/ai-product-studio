# GLOSSARY.md

## Назначение

Документ задает единый словарь терминов для Knowledge System.

## Ответственность

GLOSSARY отвечает за:

- единые определения;
- предотвращение терминологических противоречий;
- AI-readability;
- согласованность между Product Management и AI Engineering.

## Термины

### AI Pipeline

Последовательность шагов, в которой AI capabilities, данные, context, tools, human review и evaluation объединены для выполнения product workflow.

### AI Product

Продукт или feature, где AI capability является значимой частью user value, workflow или decision support.

### AI Readiness

Готовность problem, data, workflow, organization и risk controls к применению AI.

### Assumption

Утверждение, которое команда считает вероятным, но еще не доказала достаточным evidence.

### Decision Record

Структурированная запись о решении, alternatives, rationale, evidence, risks и consequences.

### Evidence

Проверяемое основание для claim или decision. Evidence может быть behavioral, qualitative, experimental или expert-based.

### Framework

Признанная структура мышления или работы, используемая для решения определенного класса product задач.

### Human-in-the-loop

Механизм, при котором человек review, approves, corrects или escalates AI output в определенных точках workflow.

### Opportunity

Customer need, pain, desire или unmet outcome, который может привести к product value.

### Outcome

Измеримое изменение в customer behavior, business result или product health.

### Output

Созданный артефакт, feature, экран, документ или pipeline step. Output не равен outcome.

### PRD

Product Requirements Document, фиксирующий problem, goals, scope, requirements, constraints, metrics и launch criteria.

### Product Discovery

Системная работа по снижению uncertainty вокруг customer, problem, value и solution.

### Product-Market Fit

Состояние, при котором продукт устойчиво удовлетворяет значимую потребность конкретного рынка и получает market pull.

### Requirement

Проверяемое требование к продукту, связанное с problem, evidence и success metric.

### Risk

Потенциальное событие или условие, способное ухудшить product, user, business, technical или safety outcome.

### Single Source of Truth

Принцип, при котором знание определяется только в одном месте и переиспользуется через ссылки.

### Success Metric

Метрика, по которой оценивается достижение desired outcome.

### Visual Pipeline

Визуальное представление AI Pipeline, показывающее steps, inputs, outputs, dependencies, review points и failure modes.

## Взаимосвязь с другими документами

- Все документы должны использовать определения из GLOSSARY.
- `FRAMEWORKS.md` задает framework IDs, но не заменяет GLOSSARY.
- `OUTPUT_SCHEMA.md` использует термины как поля и entity names.

## Обязательные разделы для нового термина

- Term
- Definition
- Related documents
- Do not confuse with

## Рекомендации

- Добавлять термин только если он используется минимум в двух документах или критичен для AI-readability.
- Не переводить устоявшиеся профессиональные аббревиатуры.
- Не создавать два термина для одной сущности.

## Пример

`Outcome` и `Output` должны различаться. "Создан PRD" — output. "Сократилось время согласования требований на 30%" — outcome.

## Критерии качества

- Термины не противоречат друг другу.
- Определения короткие и проверяемые.
- Термины пригодны для машинной обработки.

## Ссылки на framework

`prd`, `product-market-fit`, `human-in-the-loop`, `ai-readiness-assessment`, `evaluation-strategy`.

