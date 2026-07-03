# ARCHITECTURE_PATTERNS.md

## Назначение

Документ является Single Source of Truth для architecture patterns, применяемых Senior AI Solution Architect.

## Ответственность

Документ отвечает за уникальные `architecture_pattern_id`, назначение, применимость, trade-offs и quality criteria.

## Структура pattern

- `architecture_pattern_id`
- название;
- назначение;
- когда применять;
- когда избегать;
- компоненты;
- trade-offs;
- критерии качества.

## Patterns

### `rules-engine`

Назначение: deterministic decision logic для стабильных правил.

Когда применять: правила ясны, регулируемы, объяснимы и редко требуют semantic reasoning.

Когда избегать: правила многочисленны, неустойчивы или зависят от естественного языка.

Компоненты: rule store, rule evaluator, versioning, audit log.

Trade-offs: высокая explainability и низкая cost; низкая гибкость при fuzzy inputs.

Критерии качества: versioned rules, test coverage, auditability.

### `workflow-orchestration`

Назначение: управлять последовательностью шагов, dependencies, retries и state.

Когда применять: процесс состоит из predictable steps.

Когда избегать: задача требует open-ended autonomy без заранее заданного route.

Компоненты: orchestrator, task queue, state store, retry policy, compensation actions.

Trade-offs: надежность и управляемость выше, flexibility ниже agent systems.

Критерии качества: idempotency, retry, observability, state recovery.

### `llm-service`

Назначение: использовать LLM для generation, transformation, extraction или reasoning.

Когда применять: inputs неструктурированы, требуется language understanding или synthesis.

Когда избегать: deterministic rule достаточно точен и дешевле.

Компоненты: prompt/context builder, model client, structured output validator, safety checks.

Trade-offs: высокая capability, но uncertainty, cost и latency.

Критерии качества: evals, schema validation, grounding, fallback.

### `rag-system`

Назначение: grounded generation или answer synthesis на основе knowledge sources.

Когда применять: модель должна отвечать по внешним документам или enterprise knowledge.

Когда избегать: knowledge мал, статичен и может быть встроен как rules/reference.

Компоненты: ingestion, chunking, embeddings, vector store, retriever, reranker, generator, citation layer.

Trade-offs: повышает factual grounding, но добавляет retrieval errors и data freshness requirements.

Критерии качества: retrieval precision/recall, citation coverage, freshness, access control.

### `agent-system`

Назначение: AI выполняет multi-step task с tool use и runtime planning.

Когда применять: workflow variable, требует выбора tools и адаптации к intermediate results.

Когда избегать: workflow predictable и может быть orchestration.

Компоненты: planner, tool registry, memory/state, executor, guardrails, evaluator.

Trade-offs: высокая flexibility, но ниже predictability и выше cost.

Критерии качества: tool permissions, step limits, audit trail, eval scenarios, fallback.

### `multi-agent-system`

Назначение: несколько specialized agents решают разные subtasks.

Когда применять: есть независимые expertise domains и clear coordination protocol.

Когда избегать: один workflow или один agent достаточен.

Компоненты: agents, coordinator, message protocol, shared state, arbitration, evaluation.

Trade-offs: specialization выше, complexity и latency выше.

Критерии качества: role boundaries, conflict resolution, observability, cost controls.

### `ai-gateway`

Назначение: единая точка доступа к models/providers с routing, policy, logging и cost controls.

Когда применять: несколько models, providers, environments или teams.

Когда избегать: single low-risk prototype без production constraints.

Компоненты: gateway API, auth, rate limits, routing, telemetry, policy checks.

Trade-offs: governance выше, operational component добавляет complexity.

Критерии качества: central observability, policy enforcement, fallback routing.

### `event-driven-ai`

Назначение: запуск AI processing по events.

Когда применять: async workloads, document processing, background analysis.

Когда избегать: strict synchronous UX без async tolerance.

Компоненты: event bus, consumers, state store, retry/dead-letter queue, monitoring.

Trade-offs: scalability выше, debugging сложнее.

Критерии качества: idempotency, exactly-once или at-least-once semantics documented, DLQ.

### `human-review-queue`

Назначение: направлять uncertain или high-risk AI outputs на human review.

Когда применять: high impact, low confidence, regulated или safety-sensitive decisions.

Когда избегать: low-risk workflow с доказанной quality и low error cost.

Компоненты: review queue, reviewer UI requirements, SLA, audit log, feedback loop.

Trade-offs: trust и safety выше, latency и operating cost выше.

Критерии качества: thresholds, ownership, auditability, feedback ingestion.

## Взаимосвязь с другими документами

- `AI_PATTERNS.md` описывает AI-specific mechanisms.
- `DECISION_ENGINE.md` выбирает pattern.
- `PIPELINE_DESIGN.md` собирает patterns в pipeline.
- `REVIEW.md` проверяет architecture quality.

## Обязательные разделы

Каждый новый pattern должен иметь ID, применимость, ограничения, trade-offs и quality criteria.

## Рекомендации

- Default: выбирать simplest viable pattern.
- Agent использовать только при доказанной необходимости dynamic planning.
- RAG использовать только при external knowledge need.

## Пример

Для обработки заявки: `workflow-orchestration` + `rules-engine` для routing + `llm-service` для summary + `human-review-queue` для low-confidence outputs.

## Критерии качества

- Pattern selection traceable к PRD.
- Компоненты независимы.
- Failure modes описаны.

## Ссылки на используемые практики

Well-Architected reliability, event-driven architecture, LLM System Design, RAG architecture, NIST AI RMF.

