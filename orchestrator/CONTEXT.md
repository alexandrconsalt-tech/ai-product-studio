# CONTEXT.md

## Назначение

Документ задает правила Context Management и единый Context Object для AI Orchestrator.

## Принцип

Orchestrator передает модулям только необходимый контекст. Он не смешивает выводы разных модулей и не переписывает их знания.

## Context Object

```json
{
  "context_version": "1.0",
  "project": {
    "project_id": "string",
    "name": "string",
    "current_state": "draft",
    "created_at": "datetime",
    "updated_at": "datetime"
  },
  "user_input": {
    "idea": "string",
    "answers": [],
    "constraints": [],
    "preferences": []
  },
  "artifacts": {
    "idea_analysis": null,
    "product_analysis": null,
    "prd": null,
    "ai_capabilities": null,
    "product_review": null,
    "architecture_brief": null,
    "architecture_decision": null,
    "model_selection": null,
    "data_architecture": null,
    "evaluation_strategy": null,
    "pipeline_specification": null,
    "pipeline_review": null,
    "playground_results": null,
    "final_review": null
  },
  "quality": {
    "gates": [],
    "scores": {},
    "blocking_issues": []
  },
  "orchestration": {
    "last_module": null,
    "next_module": null,
    "transition_reason": null,
    "required_user_questions": [],
    "history": []
  }
}
```

## Данные для Senior Product Manager

Передаются:

- project idea;
- user answers;
- business constraints;
- existing evidence;
- previous Product Review issues;
- current state;
- required output type.

Не передаются:

- internal architecture decisions как руководство к PRD;
- pipeline implementation details;
- скрытые scoring rules, если они могут исказить Product Discovery.

## Данные для Senior AI Solution Architect

Передаются:

- PRD;
- Product Analysis;
- AI Capabilities;
- Product Review;
- Architecture Brief;
- constraints;
- quality requirements;
- open questions.

Не передаются:

- непроверенные UI decisions;
- pipeline graph, если architecture еще не создана;
- reviewer recommendations без исходных artifacts.

## Данные для Pipeline Builder

Передаются:

- Architecture Decision;
- AI Pattern Selection;
- Model Selection;
- Data Architecture;
- Evaluation Strategy;
- Quality Layer;
- runtime constraints.

Не передаются:

- сырая идея без architecture;
- PRD как единственный источник pipeline;
- product assumptions, не прошедшие review.

## Данные для Reviewer

Передаются:

- artifact under review;
- relevant previous artifacts;
- applicable Quality Gate;
- scoring thresholds;
- blocking issues history;
- selected Knowledge System.

Не передаются:

- нерелевантные черновики;
- скрытые user preferences, не влияющие на review;
- данные без provenance.

## Контекстные правила

### C-001. Minimal Context

Передавать только контекст, необходимый модулю для текущей задачи.

### C-002. Artifact Provenance

Каждый artifact должен иметь source module, created_at, version и review status.

### C-003. No Silent Overwrite

Модуль не может перезаписать artifact другого модуля без новой версии и transition reason.

### C-004. Questions Before Guessing

Если обязательного input нет и нельзя безопасно продолжить, Orchestrator формирует вопрос пользователю.

### C-005. Reviewed Context Only

Следующий major stage получает только artifacts, прошедшие соответствующий Quality Gate, если нет explicit exception.

## Взаимосвязь

- Module input/output contracts описаны в `MODULES.md`.
- State transitions описаны в `STATE_MACHINE.md`.
- Gate requirements описаны в `QUALITY_GATES.md`.
- Output format описан в `OUTPUT_SCHEMA.md`.

## Критерии качества

- Context Object serializable.
- Каждый artifact traceable.
- Модуль получает enough context, но не получает лишнее.
- User questions формируются только при реальном блокере.

