# ANTI_PATTERNS.md

## Назначение

Документ описывает типичные ошибки Product Manager и AI Product Manager, которые Knowledge System должна предотвращать.

## Ответственность

ANTI_PATTERNS отвечает за:

- выявление вредных практик;
- объяснение риска;
- рекомендацию корректного framework;
- поддержку review и coaching.

## Anti-patterns

### AP-001. Solution First

Описание: команда начинает с feature или AI capability вместо customer problem.

Почему опасно: высокий риск building unused product.

Исправление: применить `customer-discovery`, `jtbd`, `opportunity-solution-tree`.

### AP-002. PRD Without Discovery

Описание: PRD создается на основании stakeholder request без evidence.

Почему опасно: assumptions превращаются в requirements.

Исправление: вернуться к `customer-discovery` и `DECISION_ENGINE.md`.

### AP-003. AI Because AI

Описание: AI добавляется ради perceived innovation, без task suitability.

Почему опасно: растут cost, latency, risk и complexity без value.

Исправление: применить `ai-readiness-assessment`, `ai-capability-assessment`, сравнить non-AI alternatives.

### AP-004. Metric Theater

Описание: используются красивые metrics без связи с customer value или decision.

Почему опасно: команда оптимизирует dashboard вместо outcome.

Исправление: применить `north-star-metric`, `okr`, `heart`.

### AP-005. Framework Overload

Описание: используется слишком много framework без причины.

Почему опасно: процесс становится бюрократией и теряет focus.

Исправление: использовать `FRAMEWORK_ROUTER.md` и выбирать минимально достаточный набор.

### AP-006. Confidence Inflation

Описание: confidence высокий, хотя evidence слабый.

Почему опасно: decisions выглядят надежнее, чем есть на самом деле.

Исправление: применить evidence grading из `DECISION_ENGINE.md`.

### AP-007. Ignoring AI Evaluation

Описание: AI feature считается готовой после demo, без eval dataset и thresholds.

Почему опасно: качество не воспроизводимо, regressions не контролируются.

Исправление: применить `evaluation-strategy`, `ai-product-evaluation`.

### AP-008. Full Automation Too Early

Описание: AI output автоматически влияет на high-risk workflow без human review.

Почему опасно: возможен harm и loss of trust.

Исправление: применить `human-in-the-loop`, `safety`, `hallucination-risk`.

### AP-009. Backlog as Strategy

Описание: roadmap является списком features без outcome и priority rationale.

Почему опасно: команда delivery-oriented, но не outcome-oriented.

Исправление: применить `north-star-metric`, `okr`, `rice`, `opportunity-solution-tree`.

### AP-010. Personas Without Evidence

Описание: personas придуманы командой без research.

Почему опасно: decisions основываются на stereotypes.

Исправление: применить `user-personas` только после research.

## Взаимосвязь с другими документами

- `REVIEW.md` использует anti-patterns как warning signals.
- `FRAMEWORK_ROUTER.md` предлагает corrective framework.
- `RULES.md` задает обязательные запреты.

## Обязательные разделы anti-pattern

- ID
- Описание
- Почему опасно
- Исправление
- Related framework

## Рекомендации

- Не использовать anti-pattern как blame.
- Использовать anti-pattern как диагностический сигнал.
- Всегда давать corrective action.

## Пример

Если stakeholder просит "сразу сделать AI Pipeline", а problem и evaluation не описаны, это AP-001, AP-003 и AP-007.

## Критерии качества

- Anti-pattern имеет clear corrective framework.
- Риск объяснен.
- Можно обнаружить в review.

## Ссылки на framework

`customer-discovery`, `jtbd`, `opportunity-solution-tree`, `prd`, `ai-readiness-assessment`, `ai-product-evaluation`, `evaluation-strategy`, `human-in-the-loop`, `north-star-metric`, `okr`.

