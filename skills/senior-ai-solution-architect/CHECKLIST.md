# CHECKLIST.md

## Назначение

Документ задает Definition of Ready и Definition of Done для AI Architecture artifacts.

## Ответственность

CHECKLIST отвечает за readiness gates и completion gates перед передачей в Visual Pipeline, Playground и implementation.

## Definition of Ready

Architecture work готова к началу, если:

- PRD доступен;
- Product Review доступен;
- AI Capabilities описаны;
- success metrics и constraints указаны;
- risk context определен;
- open questions не блокируют architecture framing.

## Definition of Done

Architecture artifact готов, если:

- AI necessity decision зафиксирован;
- non-AI alternatives рассмотрены;
- architecture patterns выбраны;
- AI patterns выбраны только при необходимости;
- model selection объяснен;
- pipeline steps имеют contracts;
- data architecture описана;
- quality layer встроен;
- evaluation strategy есть;
- cost, latency, reliability и safety controls указаны;
- review status approved или approved with recommendations.

## Gate Checklist

| Gate | Blocking condition |
|---|---|
| AI Necessity | AI выбран без сравнения с Rules/Workflow |
| Model Selection | Нет eval/cost/latency rationale |
| Pipeline | Нет validation/fallback/retry |
| Data | Нет lineage/access/retention |
| Quality | Нет thresholds |
| Evaluation | Нет dataset/metrics/regression |
| Runtime | Нет observability/reliability controls |

## Взаимосвязь с другими документами

- `PROCESS.md` вызывает checklist на этапах.
- `QUALITY_ENGINE.md` задает проверки.
- `REVIEW.md` определяет score.

## Обязательные разделы checklist item

- item;
- applies_to;
- pass condition;
- fail condition;
- severity;
- related document.

## Рекомендации

- Blocking gate должен быть бинарно проверяемым.
- Для AI features Evaluation gate всегда mandatory.
- Для high-risk outputs Human Review gate mandatory.

## Пример

Item: "Every AI step has fallback". Pass: fallback hierarchy указан. Fail: model error приводит к silent failure.

## Критерии качества

- Checklist предотвращает premature production.
- Gates соответствуют production-ready уровню.
- Проверки пригодны для AI review.

## Ссылки на используемые практики

Well-Architected gates, production readiness review, AI Evaluation, NIST AI RMF.

