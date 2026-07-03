# WORKFLOW.md

## Назначение

Документ описывает полный workflow проекта AI Product Studio под управлением AI Orchestrator.

## Workflow Overview

```text
Create Project
  -> Idea Analysis
  -> Discovery
  -> Product Design
  -> Product Review
  -> Architecture Design
  -> Architecture Review
  -> Pipeline Generation
  -> Pipeline Review
  -> Playground
  -> Final Review
```

## Этапы

### `create-project`

Цель: создать проект и зафиксировать исходную идею.

Входные данные: название проекта, идея, пользовательский контекст, optional constraints.

Ответственный модуль: Orchestrator.

Выходные артефакты: Project Record, Initial Context Object.

Критерии перехода: есть project_id, idea statement, owner, created_at.

Причины возврата: идея отсутствует или не сформулирована даже на базовом уровне.

### `idea-analysis`

Цель: определить, какие данные нужны для Product Discovery и Product Design.

Входные данные: Initial Context Object.

Ответственный модуль: Senior Product Manager.

Выходные артефакты: Idea Analysis, assumptions, discovery questions, initial risk list.

Критерии перехода: problem hypothesis, target user hypothesis и expected outcome сформулированы.

Причины возврата: идея является только technology proposal без customer problem; нет target user.

### `discovery`

Цель: проверить problem, customer, context и opportunity.

Входные данные: Idea Analysis, assumptions, user answers, existing evidence.

Ответственный модуль: Senior Product Manager.

Выходные артефакты: Product Analysis, evidence map, JTBD, opportunity map.

Критерии перехода: Product Discovery содержит evidence или явно зафиксированный evidence gap с планом проверки.

Причины возврата: недостаточно данных; противоречивые сегменты; problem не подтвержден.

### `product-design`

Цель: сформировать PRD и AI Capabilities на основе discovery.

Входные данные: Product Analysis, evidence, assumptions, constraints.

Ответственный модуль: Senior Product Manager.

Выходные артефакты: PRD, AI Capabilities, Product Requirements, success metrics.

Критерии перехода: PRD проходит Definition of Ready из Senior Product Manager Knowledge System.

Причины возврата: нет success metrics; requirements не связаны с evidence; AI capabilities не обоснованы.

### `product-review`

Цель: проверить качество продуктового решения.

Входные данные: PRD, Product Analysis, AI Capabilities.

Ответственный модуль: Reviewer с использованием Senior Product Manager Knowledge System.

Выходные артефакты: Product Review, Product Score, required changes.

Критерии перехода: Product Review score >= 85 и нет blocking issues.

Причины возврата: Product Review < 85; blocking issues; AI Readiness = Low.

### `architecture-design`

Цель: преобразовать PRD и AI Capabilities в AI Architecture.

Входные данные: PRD, Product Review, Architecture Brief, AI Capabilities.

Ответственный модуль: Senior AI Solution Architect.

Выходные артефакты: Architecture Decision, AI Pattern Selection, Model Selection, Data Architecture, Evaluation Strategy.

Критерии перехода: Architecture artifact содержит AI necessity decision, pipeline requirements, quality layer и evaluation.

Причины возврата: AI не нужен, но PRD требует AI без обоснования; отсутствуют architecture constraints; AI Readiness недостаточен.

### `architecture-review`

Цель: проверить production-readiness архитектуры.

Входные данные: Architecture artifacts.

Ответственный модуль: Reviewer с использованием Senior AI Solution Architect Knowledge System.

Выходные артефакты: Architecture Review, Architecture Score, required changes.

Критерии перехода: Architecture Review score >= 90 и нет blocking issues.

Причины возврата: Architecture Review < 90; нет evaluation strategy; нет fallback; model selection не объяснен.

### `pipeline-generation`

Цель: сформировать Visual Pipeline Specification на основе архитектуры.

Входные данные: Architecture Decision, Pipeline Requirements, Data Flow, Quality Layer, Evaluation Strategy.

Ответственный модуль: Pipeline Builder.

Выходные артефакты: Pipeline Specification, Node/Edge model, validation rules, runtime plan.

Критерии перехода: каждый pipeline step имеет input, output, owner component, validation, retry/fallback и telemetry.

Причины возврата: architecture artifact неполный; отсутствуют step contracts; невозможно построить pipeline без уточнений.

### `pipeline-review`

Цель: проверить корректность Pipeline Specification.

Входные данные: Pipeline Specification, Architecture Review.

Ответственный модуль: Reviewer.

Выходные артефакты: Pipeline Review, Pipeline Validation Result.

Критерии перехода: Pipeline Validation Passed и нет blocking issues.

Причины возврата: validation failed; отсутствуют fallback/retry; нарушены data flow или quality rules.

### `playground`

Цель: подготовить проект к тестированию AI Pipeline в Playground.

Входные данные: Pipeline Specification, Evaluation Strategy, test scenarios.

Ответственный модуль: Orchestrator + Pipeline Builder.

Выходные артефакты: Playground Session Plan, test dataset requirements, run configuration.

Критерии перехода: Ready For Testing gate пройден.

Причины возврата: нет evaluation dataset; нет test scenarios; runtime constraints не определены.

### `final-review`

Цель: определить готовность проекта к production или завершению проектирования.

Входные данные: все project artifacts, review history, playground results.

Ответственный модуль: Reviewer + Orchestrator.

Выходные артефакты: Final Review, Production Readiness Decision, next actions.

Критерии перехода: Ready For Production gate пройден или явно принято решение не запускать production.

Причины возврата: unresolved blocking issues; failed evaluation; unacceptable cost/latency/safety risk.

## Взаимосвязь

- Состояние этапов задается в `STATE_MACHINE.md`.
- Context Object задается в `CONTEXT.md`.
- Module contracts задаются в `MODULES.md`.
- Gates задаются в `QUALITY_GATES.md`.

## Критерии качества

- Каждый этап имеет цель, вход, ответственный модуль, выход, критерии перехода и причины возврата.
- Workflow не пропускает путь `Idea -> PRD -> Architecture -> Pipeline -> Playground`.
- Orchestrator не выполняет работу специализированных модулей.
- Возвраты имеют конкретную причину и целевой этап.
