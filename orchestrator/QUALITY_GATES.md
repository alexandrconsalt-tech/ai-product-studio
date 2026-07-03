# QUALITY_GATES.md

## Назначение

Документ описывает обязательные Quality Gates проекта.

## Gate Overview

| Gate ID | Название | Где применяется |
|---|---|---|
| `gate_product_complete` | Product Complete | перед Architecture Design |
| `gate_architecture_complete` | Architecture Complete | перед Pipeline Generation |
| `gate_pipeline_complete` | Pipeline Complete | перед Playground |
| `gate_ready_for_testing` | Ready For Testing | перед запуском Playground |
| `gate_ready_for_production` | Ready For Production | перед Completed |

## `gate_product_complete`

Цель: убедиться, что продуктовая часть готова для AI Architecture.

Критерии прохождения:

- PRD существует;
- Product Analysis существует;
- AI Capabilities существуют или явно указано, что AI не нужен;
- Product Review score >= 85;
- нет Product blocking issues;
- success metrics определены;
- requirements traceable к problem/evidence;
- AI Readiness не Low, если AI требуется.

Fail action:

- вернуть в `product_design`;
- вернуть в `discovery`, если evidence недостаточен;
- задать user questions, если нет обязательного контекста.

## `gate_architecture_complete`

Цель: убедиться, что architecture готова для Pipeline Builder.

Критерии прохождения:

- Architecture Decision существует;
- AI Necessity Decision зафиксирован;
- AI/non-AI boundaries определены;
- Model Selection существует, если AI используется;
- Data Architecture существует;
- Evaluation Strategy существует, если AI используется;
- Architecture Review score >= 90;
- нет Architecture blocking issues.

Fail action:

- вернуть в `architecture_design`;
- вернуть в `product_design`, если issue вызван PRD contradiction.

## `gate_pipeline_complete`

Цель: убедиться, что Pipeline Specification полная и валидная.

Критерии прохождения:

- Pipeline Specification существует;
- все nodes имеют input/output contracts;
- все edges валидны;
- нет orphan nodes;
- AI nodes имеют validation и evaluation link;
- retry/fallback определены;
- telemetry определена;
- Pipeline Validation Passed.

Fail action:

- вернуть в `pipeline_generation`;
- вернуть в `architecture_design`, если pipeline невозможно построить из architecture.

## `gate_ready_for_testing`

Цель: убедиться, что проект можно открыть в Playground.

Критерии прохождения:

- Pipeline Complete gate passed;
- Evaluation Strategy содержит test scenarios;
- test dataset requirements определены;
- runtime configuration draft существует;
- safety и human review triggers определены, если применимо;
- cost и latency limits определены.

Fail action:

- вернуть в `pipeline_generation` или `architecture_design`;
- запросить данные пользователя, если нужны testing constraints.

## `gate_ready_for_production`

Цель: определить готовность проекта к production или завершению проектирования.

Критерии прохождения:

- Playground results доступны;
- Final Review существует;
- unresolved blocking issues отсутствуют;
- evaluation thresholds достигнуты;
- cost/latency/safety risks допустимы;
- production decision зафиксирован.

Fail action:

- вернуть в `architecture_design`, если проблема архитектурная;
- вернуть в `pipeline_generation`, если проблема pipeline-level;
- перевести в `blocked`, если требуется external decision.

## Gate Result Schema

```json
{
  "gate_id": "gate_product_complete",
  "status": "passed",
  "checked_at": "datetime",
  "criteria": [],
  "blocking_issues": [],
  "recommended_transition": "product_ready"
}
```

## Взаимосвязь

- Gates используются `DECISION_ENGINE.md`.
- State transitions определены в `STATE_MACHINE.md`.
- Ошибки gates обрабатываются через `ERROR_HANDLING.md`.

## Критерии качества

- Gate criteria проверяемы.
- Gate не дублирует domain review, а использует его результат.
- Fail action всегда указывает следующий шаг.

