# DECISION_ENGINE.md

## Назначение

Документ задает правила архитектурных решений для Senior AI Solution Architect.

## Ответственность

Decision Engine отвечает за:

- AI necessity decision;
- architecture pattern selection;
- AI pattern selection;
- model decision;
- data architecture decision;
- runtime trade-offs;
- quality gates.

## Decision Algorithm

1. Прочитать PRD и constraints.
2. Классифицировать task.
3. Проверить non-AI alternative.
4. Выбрать simplest viable architecture.
5. Выбрать AI Pattern только при необходимости.
6. Выбрать минимально достаточную model.
7. Добавить quality, evaluation и observability.
8. Проверить cost, latency, reliability, safety.
9. Зафиксировать decision record.

## Core Rules

### D-001. Non-AI First

Если Rules Engine или Workflow решает задачу с требуемым quality, AI не используется.

### D-002. Workflow Before Agent

Если steps predictable, используется Workflow, а не Agent.

### D-003. RAG Only With Knowledge Need

RAG используется только когда output зависит от external или enterprise knowledge.

### D-004. Structured Outputs For Machine Handoff

Если output используется системой, он должен быть structured и validated.

### D-005. Evaluation Required

Каждая AI capability требует evaluation criteria и release threshold.

### D-006. Human Review For High Risk

High-risk или low-confidence AI outputs направляются в Human Review.

### D-007. Cost Cap Required

Каждый model call должен иметь cost attribution и budget policy.

## Trade-off Matrix

| Trade-off | Default decision |
|---|---|
| Cost vs Quality | Quality threshold first, then optimize cost |
| Latency vs Accuracy | UX-critical paths need latency budget before model choice |
| Flexibility vs Reliability | Reliability wins for production workflows |
| Automation vs Safety | Safety wins for high-impact outputs |
| Simplicity vs Extensibility | Simple modular architecture wins |

## Взаимосвязь с другими документами

- Pattern definitions: `ARCHITECTURE_PATTERNS.md`, `AI_PATTERNS.md`.
- Model strategy: `MODEL_SELECTION.md`.
- Quality gates: `QUALITY_ENGINE.md`, `EVALUATION.md`.
- Review: `REVIEW.md`.

## Обязательные разделы decision output

- decision type;
- selected option;
- alternatives;
- rationale;
- trade-offs;
- quality impact;
- cost impact;
- risks;
- review status.

## Рекомендации

- Для irreversible architecture decisions требовать stronger evidence.
- Для uncertain areas проектировать reversible components.
- Указывать "что изменит это решение".

## Пример

Decision: использовать Workflow + LLM step вместо Agent. Rationale: process predictable, tool planning не нужен, reliability и cost важнее autonomy.

## Критерии качества

- Решение воспроизводимо.
- Alternatives рассмотрены.
- AI не применяется без necessity.
- Trade-offs explicit.

## Ссылки на используемые практики

Well-Architected decision trade-offs, NIST AI RMF, LLM System Design, production reliability.

