# OUTPUT_SCHEMA.md

## Назначение

Документ задает единую структуру результата для AI Product Studio. Schema нужна для человеко-читаемого output и машинной обработки.

## Ответственность

OUTPUT_SCHEMA отвечает за:

- единый shape результата;
- обязательные поля;
- traceability;
- reviewability;
- AI-readability.

## Базовая структура результата

```json
{
  "artifact_type": "string",
  "artifact_version": "string",
  "language": "ru",
  "professional_terms_allowed": true,
  "context": {},
  "selected_frameworks": [],
  "problem": {},
  "customer": {},
  "evidence": [],
  "assumptions": [],
  "options": [],
  "decision": {},
  "requirements": [],
  "ai_considerations": {},
  "risks": [],
  "metrics": [],
  "open_questions": [],
  "next_actions": [],
  "review": {}
}
```

## Поля

### `artifact_type`

Тип артефакта: `idea_brief`, `discovery_report`, `prd`, `ai_architecture_brief`, `pipeline_requirements`, `evaluation_report`, `review_report`.

### `selected_frameworks`

Список `framework_id` из `FRAMEWORKS.md`.

### `evidence`

Каждая запись:

```json
{
  "evidence_id": "string",
  "source_type": "customer_interview | analytics | experiment | expert_review | stakeholder_input",
  "summary": "string",
  "grade": "A | B | C | D",
  "linked_claims": []
}
```

### `assumptions`

Каждая запись:

```json
{
  "assumption_id": "string",
  "statement": "string",
  "risk_level": "low | medium | high",
  "validation_method": "string",
  "status": "untested | testing | validated | invalidated"
}
```

### `decision`

```json
{
  "decision_id": "string",
  "decision_type": "string",
  "selected_option": "string",
  "rationale": "string",
  "confidence": "low | medium | high",
  "what_would_change_this_decision": "string"
}
```

### `ai_considerations`

```json
{
  "ai_required": "boolean",
  "ai_justification": "string",
  "capabilities": [],
  "evaluation_strategy_required": "boolean",
  "human_in_the_loop_required": "boolean",
  "hallucination_risk": "low | medium | high",
  "safety_risk": "low | medium | high",
  "cost_quality_latency_tradeoff": {}
}
```

### `review`

```json
{
  "status": "approved | revise | rejected",
  "score": "number",
  "blocking_issues": [],
  "recommendations": []
}
```

## Взаимосвязь с другими документами

- `FRAMEWORKS.md` задает допустимые `framework_id`.
- `DECISION_ENGINE.md` задает структуру `decision`.
- `CHECKLIST.md` проверяет required fields.
- `REVIEW.md` оценивает quality.
- `DECISION_RECORDS.md` сохраняет significant decisions.

## Обязательные разделы

Любой output должен содержать:

- context;
- selected frameworks;
- evidence или explicit evidence gap;
- assumptions;
- decision или reason why decision is not possible;
- risks;
- next actions;
- review status.

## Рекомендации

- Не использовать пустые массивы без объяснения, если поле критично.
- Указывать `evidence_gap`, если evidence отсутствует.
- Использовать стабильные IDs для traceability.

## Пример

```json
{
  "artifact_type": "ai_architecture_brief",
  "artifact_version": "1.0",
  "language": "ru",
  "selected_frameworks": ["ai-capability-assessment", "context-engineering", "evaluation-strategy"],
  "decision": {
    "decision_id": "DEC-001",
    "decision_type": "ai-feasibility",
    "selected_option": "AI-assisted workflow with human review",
    "rationale": "AI ускоряет черновую обработку, но human review нужен из-за hallucination risk.",
    "confidence": "medium",
    "what_would_change_this_decision": "Низкое качество на eval dataset или неприемлемая latency."
  }
}
```

## Критерии качества

- Schema пригодна для JSON serialization.
- Все framework references используют `framework_id`.
- Output можно проверить без чтения всей переписки.
- AI-specific поля присутствуют для AI features.

## Ссылки на framework

`prd`, `evaluation-strategy`, `ai-product-evaluation`, `human-in-the-loop`, `hallucination-risk`, `safety`, `cost-quality-latency`.

