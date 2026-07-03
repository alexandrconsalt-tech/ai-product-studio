# OUTPUT_SCHEMA.md

## Назначение

Документ задает единый машинно-читаемый формат результата AI Orchestrator.

## Orchestrator Output

```json
{
  "orchestrator_version": "1.0",
  "project_id": "string",
  "current_state": "draft",
  "previous_state": null,
  "next_state": "idea_analyzed",
  "current_stage": "idea-analysis",
  "next_module": "senior-product-manager",
  "decision": {
    "decision_type": "advance_state",
    "reason": "Idea Analysis completed.",
    "confidence": "high"
  },
  "context_updates": [],
  "artifacts_required": [],
  "artifacts_created": [],
  "quality_gate": {
    "gate_id": null,
    "status": "not_applicable",
    "blocking_issues": []
  },
  "user_questions": [],
  "errors": [],
  "history_entry": {
    "timestamp": "datetime",
    "actor": "orchestrator",
    "action": "state_transition"
  }
}
```

## Project Artifact Reference

```json
{
  "artifact_id": "string",
  "artifact_type": "prd",
  "version": "1.0",
  "source_module": "senior-product-manager",
  "review_status": "approved",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

## User Question

```json
{
  "question_id": "string",
  "reason": "insufficient_data",
  "question": "Кто основной пользователь продукта?",
  "required": true,
  "blocks_state": true,
  "target_stage": "discovery"
}
```

## Transition History Entry

```json
{
  "from_state": "product_review",
  "to_state": "product_ready",
  "trigger": "quality_gate_passed",
  "gate_id": "gate_product_complete",
  "reason": "Product Review score is 91.",
  "timestamp": "datetime"
}
```

## Обязательные поля

- orchestrator_version;
- project_id;
- current_state;
- decision;
- next_module или user_questions;
- quality_gate status;
- history_entry.

## Validation Rules

- `next_state` должен быть допустимым transition из `STATE_MACHINE.md`.
- `next_module` должен быть описан в `MODULES.md`.
- `quality_gate.gate_id` должен быть описан в `QUALITY_GATES.md`, если gate применим.
- `errors.error_type` должен быть описан в `ERROR_HANDLING.md`.
- Forward transition невозможен при blocking issues.

## Взаимосвязь

- Context Object описан в `CONTEXT.md`.
- State IDs описаны в `STATE_MACHINE.md`.
- Module IDs описаны в `MODULES.md`.
- Error IDs описаны в `ERROR_HANDLING.md`.

## Критерии качества

- Schema пригодна для сериализации.
- Все IDs стабильны.
- Decision explainable.
- Output можно использовать будущим Next.js-приложением без дополнительной интерпретации.

