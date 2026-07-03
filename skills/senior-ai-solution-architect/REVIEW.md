# REVIEW.md

## Назначение

Документ задает систему оценки AI Architecture по шкале 0-100.

## Ответственность

REVIEW отвечает за scoring, blocking issues и final architecture recommendation.

## Review Criteria

| Критерий | Вес |
|---|---:|
| Simplicity | 10 |
| Scalability | 10 |
| Reliability | 12 |
| Maintainability | 10 |
| Cost | 10 |
| Performance | 8 |
| AI Quality | 15 |
| Observability | 10 |
| Security | 10 |
| Extensibility | 5 |

## Итоговая оценка

- 90-100: approved.
- 75-89: approved with recommendations.
- 60-74: revise.
- 0-59: rejected.

Blocking issues override score.

## Blocking Issues

- AI используется без необходимости.
- Нет Evaluation Strategy.
- Нет fallback для critical AI step.
- Нет observability для production AI calls.
- High-risk output без Human Review.
- Нет data retention/access policy.
- Model выбран без quality/cost rationale.
- Agent используется вместо predictable Workflow без объяснения.

## Взаимосвязь с другими документами

- `CHECKLIST.md` задает gates.
- `QUALITY_ENGINE.md` задает checks.
- `EVALUATION.md` проверяет AI Quality.
- `COST_OPTIMIZATION.md` проверяет Cost.

## Обязательные разделы review output

- score;
- status;
- criterion scores;
- blocking issues;
- required changes;
- recommendations;
- final decision.

## Рекомендации

- Начинать review с blocking issues.
- Не компенсировать отсутствие evaluation высоким score за simplicity.
- Указывать exact required changes.

## Пример

Score 68, status revise: architecture modular, но отсутствуют eval dataset, fallback и cost budget. Required changes: добавить Evaluation Strategy, fallback hierarchy, cost monitoring.

## Критерии качества

- Score объяснен.
- Blocking issues проверяемы.
- Recommendations actionable.
- Review пригоден для машинной обработки.

## Ссылки на используемые практики

Well-Architected review, NIST AI RMF, AI Evaluation, Observability, Security by design.

