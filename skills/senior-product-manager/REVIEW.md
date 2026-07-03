# REVIEW.md

## Назначение

Документ описывает систему оценки качества продуктовой работы в AI Product Studio.

## Ответственность

REVIEW отвечает за:

- оценку completeness;
- проверку framework fit;
- проверку evidence quality;
- оценку AI risk readiness;
- итоговый статус approve/revise/reject.

## Review Dimensions

| Dimension | Вес | Что проверяется |
|---|---:|---|
| Problem clarity | 15 | Problem, customer, context |
| Evidence quality | 20 | Grade, traceability, assumptions |
| Framework fit | 10 | Правильный выбор framework |
| Strategic alignment | 10 | Outcome, OKR, North Star |
| Requirement quality | 15 | Requirements, scope, metrics |
| AI readiness | 15 | Capability, evaluation, safety |
| Decision quality | 10 | Rationale, trade-offs, confidence |
| Machine readability | 5 | Schema, IDs, consistency |

## Scoring

- 90-100: approved.
- 75-89: approved with minor recommendations.
- 60-74: revise.
- 0-59: rejected.

Blocking issues override score.

## Blocking Issues

- Нет problem statement.
- Нет evidence или evidence gap.
- PRD создан без discovery rationale.
- AI feature без AI justification.
- AI Pipeline без evaluation strategy.
- High-risk AI без human-in-the-loop.
- Нет decision rationale.
- Нарушен Single Source of Truth.

## Review Process

1. Проверить `OUTPUT_SCHEMA.md`.
2. Проверить selected frameworks через `FRAMEWORK_ROUTER.md`.
3. Оценить evidence grade через `DECISION_ENGINE.md`.
4. Проверить gates из `CHECKLIST.md`.
5. Проверить rules из `RULES.md`.
6. Присвоить score и status.
7. Зафиксировать review decision.

## Взаимосвязь с другими документами

- `CHECKLIST.md` задает gates.
- `RULES.md` задает mandatory rules.
- `DECISION_ENGINE.md` задает evidence и confidence.
- `OUTPUT_SCHEMA.md` задает review format.
- `DECISION_RECORDS.md` фиксирует итог.

## Обязательные разделы review output

- `review_status`
- `score`
- `blocking_issues`
- `dimension_scores`
- `required_changes`
- `recommendations`
- `final_decision`

## Рекомендации

- Сначала перечислять blocking issues.
- Не компенсировать critical AI safety gap высоким score в других dimensions.
- Отделять required changes от recommendations.

## Пример

Status: `revise`.

Reason: AI capability предложена, но отсутствуют evaluation strategy и hallucination mitigation. Score: 68. Required change: добавить `evaluation-strategy`, `human-in-the-loop`, `hallucination-risk`.

## Критерии качества

- Review воспроизводим.
- Blocking issues имеют ссылки на правила.
- Score объяснен.
- Recommendations actionable.

## Ссылки на framework

`customer-discovery`, `prd`, `ai-readiness-assessment`, `evaluation-strategy`, `ai-product-evaluation`, `human-in-the-loop`, `safety`.

