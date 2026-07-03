# ANTI_PATTERNS.md

## Назначение

Документ описывает типичные ошибки AI Solution Architect.

## Ответственность

ANTI_PATTERNS отвечает за диагностику architecture risks и корректирующие действия.

## Anti-patterns

### AP-001. LLM Everywhere

Описание: LLM используется для задач, которые решаются Rules Engine или Workflow.

Риск: лишние cost, latency и uncertainty.

Исправление: применить `rules-engine` или `workflow-orchestration`.

### AP-002. Agent by Default

Описание: Agent выбирается для predictable workflow.

Риск: низкая надежность, сложный debugging, высокий cost.

Исправление: использовать Workflow, Agent только при dynamic planning need.

### AP-003. No Evaluation

Описание: AI step считается готовым после demo.

Риск: качество не воспроизводимо.

Исправление: создать Evaluation Strategy.

### AP-004. Free-form Output for System Handoff

Описание: downstream system получает natural language вместо structured output.

Риск: parsing failures и unpredictable behavior.

Исправление: использовать `structured-outputs`.

### AP-005. RAG Without Retrieval Evaluation

Описание: RAG добавлен, но retrieval quality не измеряется.

Риск: grounded-looking hallucination.

Исправление: оценивать retrieval recall, citation precision и factuality.

### AP-006. No Fallback

Описание: provider/model failure ломает workflow.

Риск: production incidents.

Исправление: fallback hierarchy и circuit breaker.

### AP-007. Hidden State in Prompt

Описание: critical workflow state хранится только в prompt/context.

Риск: потеря state, audit failure.

Исправление: explicit state store.

### AP-008. Cost Blind Architecture

Описание: architecture не считает cost per step.

Риск: unit economics не сходится.

Исправление: cost attribution, routing, caching, budget alerts.

### AP-009. Human Review Without Policy

Описание: Human Review есть, но нет thresholds, SLA и rubric.

Риск: inconsistent decisions и bottlenecks.

Исправление: review policy, sampling, calibration.

### AP-010. Observability After Launch

Описание: telemetry добавляется после production.

Риск: невозможно расследовать failures.

Исправление: AI Observability как baseline.

## Взаимосвязь с другими документами

- `REVIEW.md` использует anti-patterns как warning signals.
- `QUALITY_ENGINE.md` проверяет related controls.
- `DECISION_ENGINE.md` задает corrective decisions.

## Обязательные разделы anti-pattern

- ID;
- описание;
- риск;
- исправление;
- related pattern.

## Рекомендации

- Использовать anti-patterns в review до scoring.
- Всегда предлагать corrective architecture.
- Не считать anti-pattern ошибкой, если есть explicit rationale и controls.

## Пример

Если PRD требует predictable approval flow, а architecture предлагает multi-agent system без eval и observability, это AP-002, AP-003 и AP-010.

## Критерии качества

- Anti-pattern обнаружим по architecture artifact.
- Есть corrective action.
- Риск объяснен.

## Ссылки на используемые практики

LLM System Design, Workflow orchestration, Evaluation, AI Observability, Cost Optimization.

