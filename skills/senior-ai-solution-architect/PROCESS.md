# PROCESS.md

## Назначение

Документ описывает полный workflow преобразования PRD в production-ready AI Architecture.

## Ответственность

PROCESS отвечает за этапы анализа, проектирования, проверки и review. Он не дублирует pattern definitions из `ARCHITECTURE_PATTERNS.md` и `AI_PATTERNS.md`.

## Структура workflow

1. Анализ PRD
2. Анализ AI Capabilities
3. AI Readiness Assessment
4. Выбор архитектурного подхода
5. Выбор AI Pattern
6. Выбор models
7. Проектирование Pipeline
8. Проектирование Data Flow
9. Проектирование Quality Layer
10. Проектирование Evaluation
11. Проектирование Runtime
12. Architecture Review

## Этапы

### 1. Анализ PRD

Цель: понять product outcome, requirements, constraints, success metrics и risk context.

Вход: PRD, Product Analysis, Product Review.

Действия: выделить user workflows, requirements, non-goals, quality attributes, open questions.

Критерии качества: requirements traceable к problem и metrics; unclear requirements помечены.

Выходные артефакты: PRD analysis, architecture questions, requirement map.

Типичные ошибки: читать PRD как список features; игнорировать non-goals.

### 2. Анализ AI Capabilities

Цель: определить tasks, которые потенциально требуют AI.

Вход: AI Capabilities, Architecture Brief.

Действия: классифицировать tasks: classification, extraction, generation, reasoning, retrieval, routing, tool use.

Критерии качества: каждая capability связана с user value и evaluation criteria.

Выходные артефакты: capability map, non-AI candidates.

Типичные ошибки: считать все неструктурированные задачи LLM-задачами.

### 3. AI Readiness Assessment

Цель: проверить готовность data, workflow, users, evaluation и operations.

Вход: capability map, constraints, data assumptions.

Действия: оценить task suitability, data availability, error tolerance, safety, human review.

Критерии качества: есть go/no-go для каждой capability.

Выходные артефакты: readiness report, blockers, mitigations.

Типичные ошибки: пропускать evaluation readiness.

### 4. Выбор архитектурного подхода

Цель: выбрать minimal sufficient architecture.

Вход: PRD analysis, capability map, readiness report.

Действия: сравнить `rules-engine`, `workflow-orchestration`, `llm-service`, `rag-system`, `agent-system`, `human-review-queue`.

Критерии качества: объяснено, где AI не нужен.

Выходные артефакты: architecture decision, pattern map.

Типичные ошибки: выбирать Agent вместо Workflow.

### 5. Выбор AI Pattern

Цель: определить AI mechanisms: structured outputs, RAG, function calling, guardrails, routing.

Вход: architecture decision.

Действия: выбрать `ai_pattern_id`, определить controls и eval criteria.

Критерии качества: каждый AI pattern имеет risk controls.

Выходные артефакты: AI pattern selection.

Типичные ошибки: использовать free-form text там, где нужен structured output.

### 6. Выбор models

Цель: выбрать model strategy по quality, cost, latency, context, safety.

Вход: task map, eval criteria, constraints.

Действия: определить small/large/multi-model/routing strategy.

Критерии качества: model выбран по task fit, а не popularity.

Выходные артефакты: model selection record.

Типичные ошибки: использовать большую model для simple classification.

### 7. Проектирование Pipeline

Цель: описать AI Pipeline как sequence, parallel branches, conditional routing и fallback.

Вход: pattern map, model strategy.

Действия: определить steps, inputs, outputs, validation, retry, fallback, state.

Критерии качества: каждый step имеет failure mode.

Выходные артефакты: pipeline specification.

Типичные ошибки: нет retry/fallback; смешана business logic и model call.

### 8. Проектирование Data Flow

Цель: определить хранение и движение данных.

Вход: pipeline specification, privacy/security constraints.

Действия: разделить input, intermediate, final, reference, knowledge, evaluation, telemetry data.

Критерии качества: есть retention, access control, lineage.

Выходные артефакты: data architecture.

Типичные ошибки: хранить prompts, outputs и telemetry без governance.

### 9. Проектирование Quality Layer

Цель: встроить validation, guardrails, confidence, policy checks.

Вход: pipeline и data flow.

Действия: определить validators, thresholds, human review triggers, safety checks.

Критерии качества: quality controls стоят до downstream actions.

Выходные артефакты: quality layer specification.

Типичные ошибки: проверять качество только после release.

### 10. Проектирование Evaluation

Цель: определить offline, online и human evaluation.

Вход: quality layer, success metrics.

Действия: создать eval datasets, metrics, regression gates, monitoring plan.

Критерии качества: eval покрывает happy path и failure modes.

Выходные артефакты: evaluation strategy.

Типичные ошибки: оценивать demo examples вместо representative dataset.

### 11. Проектирование Runtime

Цель: определить production runtime properties.

Вход: pipeline, data, quality, evaluation.

Действия: задать scalability, reliability, observability, security, cost controls.

Критерии качества: есть SLO/SLA, rate limits, circuit breaker, alerting, cost budgets.

Выходные артефакты: runtime architecture.

Типичные ошибки: не учитывать provider outage и rate limits.

### 12. Architecture Review

Цель: оценить architecture по score 0-100.

Вход: все architecture artifacts.

Действия: применить `REVIEW.md`, `CHECKLIST.md`, `QUALITY_ENGINE.md`.

Критерии качества: blocking issues устранены или явно приняты.

Выходные артефакты: architecture review report.

Типичные ошибки: approve без evaluation и observability.

## Взаимосвязь с другими документами

- `MODEL_SELECTION.md` используется на этапе 6.
- `PIPELINE_DESIGN.md` используется на этапе 7.
- `DATA_ARCHITECTURE.md` используется на этапе 8.
- `QUALITY_ENGINE.md` и `EVALUATION.md` используются на этапах 9-10.
- `REVIEW.md` используется на этапе 12.

## Обязательные разделы process output

- stage;
- inputs;
- selected patterns;
- decisions;
- quality gates;
- risks;
- output artifacts;
- next actions.

## Рекомендации

- Не начинать с model selection.
- Не переходить к runtime без evaluation.
- Не использовать Agent, если Workflow достаточен.

## Пример

Для PRD "анализировать интервью и выделять insights": extraction и summary используют LLM, matching known taxonomy может использовать Rules Engine, retrieval использует RAG, low-confidence insights идут в Human Review.

## Критерии качества

- Каждый этап имеет вход, действия, критерии и выход.
- Архитектура остается traceable к PRD.
- AI и non-AI задачи разделены.

## Ссылки на используемые практики

NIST AI RMF, Well-Architected, LLM System Design, AI Evaluation, Human-in-the-loop.

