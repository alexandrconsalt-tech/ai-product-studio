# PIPELINE_DESIGN.md

## Назначение

Документ задает корпоративные стандарты проектирования AI Pipeline.

## Ответственность

PIPELINE_DESIGN отвечает за sequence, parallel execution, conditional routing, fallback, retry, validation, human review, orchestration и state management.

## Структура pipeline step

Каждый step должен иметь:

- step_id;
- purpose;
- input schema;
- output schema;
- owner component;
- model или rule dependency;
- validation;
- retry policy;
- fallback;
- failure modes;
- telemetry.

## Pipeline Types

### Sequential Pipeline

Использовать, когда каждый step зависит от результата предыдущего.

Quality criteria: явные contracts между steps, validation после каждого step.

### Parallel Pipeline

Использовать, когда steps независимы и могут выполняться одновременно.

Quality criteria: concurrency limits, aggregation logic, timeout budget.

### Conditional Routing

Использовать, когда route зависит от input type, risk, confidence, cost или user segment.

Quality criteria: deterministic routing where possible, route telemetry.

### Fallback

Fallback hierarchy:

1. retry same model for transient error;
2. alternative model/provider;
3. simplified output;
4. cached response if valid;
5. Human Review;
6. fail safely.

### Retry

Retry применять только для transient failures или schema repair. Нельзя retry бесконечно.

Quality criteria: max attempts, backoff, idempotency.

### Validation

Validation types:

- schema validation;
- business rule validation;
- safety validation;
- consistency validation;
- confidence threshold.

### Human Review

Triggers:

- high risk;
- low confidence;
- validation failure;
- policy uncertainty;
- high business impact.

### Orchestration

Workflow orchestration используется для predictable process. Agent orchestration используется только для dynamic planning.

### State Management

State должен быть explicit, versioned и recoverable. Нельзя хранить critical state только в prompt context.

## Взаимосвязь с другими документами

- `ARCHITECTURE_PATTERNS.md` задает system patterns.
- `AI_PATTERNS.md` задает AI mechanisms.
- `DATA_ARCHITECTURE.md` задает storage.
- `QUALITY_ENGINE.md` задает validation.

## Обязательные разделы pipeline spec

- pipeline overview;
- steps;
- routing;
- validation;
- retry/fallback;
- state;
- human review;
- observability;
- cost controls.

## Рекомендации

- Делать steps маленькими и testable.
- Не смешивать prompt, business rules и persistence.
- Для production всегда добавлять telemetry и failure handling.

## Пример

Pipeline: ingest document -> validate input -> retrieve context -> classify risk -> generate structured summary -> validate schema -> evaluate factuality -> route to auto-approve или Human Review.

## Критерии качества

- Каждый step имеет contract.
- Failure modes обработаны.
- Pipeline можно тестировать отдельно от UI.
- Cost и latency измеряются на step level.

## Ссылки на используемые практики

Workflow orchestration, event-driven architecture, retry/fallback reliability patterns, AI Observability.

