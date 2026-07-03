# DECISION_ENGINE.md

## Назначение

Документ задает правила принятия продуктовых решений. Его цель — обеспечить одинаковый reasoning для человека и AI при одинаковых inputs.

## Ответственность

Decision Engine отвечает за:

- классификацию решения;
- выбор decision method;
- evidence grading;
- trade-off analysis;
- confidence level;
- final recommendation;
- фиксацию rationale.

## Структура decision

Каждое решение должно иметь:

- `decision_id`
- `decision_type`
- `context`
- `options`
- `selected_option`
- `frameworks_used`
- `evidence`
- `assumptions`
- `trade_offs`
- `risks`
- `confidence`
- `decision`
- `review_required`

## Decision Types

| Тип | Когда использовать | Framework |
|---|---|---|
| Problem decision | Есть ли problem | `customer-discovery`, `jtbd` |
| Opportunity decision | Какая opportunity важнее | `opportunity-solution-tree`, `north-star-metric` |
| Prioritization decision | Что делать раньше | `rice`, `wsjf`, `moscow`, `ice` |
| Scope decision | Что входит в release | `moscow`, `user-story-mapping` |
| AI feasibility decision | Нужен ли AI | `ai-readiness-assessment`, `ai-capability-assessment` |
| Model decision | Какой model class выбрать | `model-selection`, `cost-quality-latency` |
| Release decision | Можно ли запускать | `evaluation-strategy`, `ai-product-evaluation`, `safety` |

## Evidence Grading

| Grade | Описание | Использование |
|---|---|---|
| A | Behavioral data или production data | Можно принимать high-confidence decision |
| B | Direct customer evidence: interviews, usability tests, sales calls | Можно принимать discovery decision |
| C | Expert judgment или stakeholder input | Только как supporting evidence |
| D | Internal opinion без внешнего evidence | Нельзя использовать как единственное основание |

## Decision Algorithm

1. Определить `decision_type`.
2. Выбрать framework через `FRAMEWORK_ROUTER.md`.
3. Собрать options.
4. Оценить evidence grade.
5. Зафиксировать assumptions.
6. Оценить trade-offs.
7. Определить risks и mitigations.
8. Присвоить confidence.
9. Выдать recommendation.
10. Создать запись по `DECISION_RECORDS.md`.

## Confidence Rules

High confidence:

- evidence grade A или B;
- assumptions имеют validation plan;
- risks имеют mitigations;
- решение прошло review.

Medium confidence:

- есть evidence B/C;
- часть assumptions не проверена;
- риски управляемы.

Low confidence:

- evidence C/D;
- нет validation plan;
- decision reversible только частично или irreversibly costly.

## Trade-off Rules для AI-продуктов

### Quality vs Cost

Если quality ниже threshold, cost optimization запрещена.

### Latency vs Capability

Interactive workflows требуют latency threshold до model selection.

### Automation vs Human-in-the-loop

Full automation запрещена для high-risk outputs без доказанной quality и safety.

### AI vs Non-AI

AI выбирается только если он дает measurable advantage над deterministic или manual workflow.

### Model Popularity

Популярность model не является decision criterion.

## Взаимосвязь с другими документами

- Framework definitions: `FRAMEWORKS.md`.
- Framework selection: `FRAMEWORK_ROUTER.md`.
- Process gates: `PROCESS.md`.
- Output format: `OUTPUT_SCHEMA.md`.
- Decision persistence: `DECISION_RECORDS.md`.
- Quality review: `REVIEW.md`.

## Обязательные разделы

- Context
- Options
- Evidence
- Assumptions
- Trade-offs
- Risks
- Decision
- Confidence
- Review status

## Рекомендации

- Для irreversible decisions требовать evidence grade A/B.
- Для reversible decisions можно использовать lower confidence, если есть learning plan.
- Отдельно указывать "what would change this decision".

## Пример

Decision: использовать AI generation для PRD draft.

Options:

- non-AI structured template;
- AI-assisted draft;
- full AI generation.

Decision: AI-assisted draft.

Rationale: customer value есть в ускорении черновика, но full generation несет hallucination risk и снижает accountability. Требуется human-in-the-loop и evaluation strategy.

## Критерии качества

- Decision можно повторить по тем же inputs.
- Все options сравниваются по одинаковым критериям.
- Confidence соответствует evidence.
- Risks не скрыты в assumptions.

## Ссылки на framework

`customer-discovery`, `jtbd`, `opportunity-solution-tree`, `rice`, `wsjf`, `moscow`, `ai-readiness-assessment`, `ai-capability-assessment`, `model-selection`, `cost-quality-latency`, `evaluation-strategy`, `ai-product-evaluation`, `safety`, `human-in-the-loop`.

