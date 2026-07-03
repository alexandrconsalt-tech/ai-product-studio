# FRAMEWORK_ROUTER.md

## Назначение

Документ задает правила выбора framework в зависимости от типа задачи. Он использует только `framework_id`, определенные в `FRAMEWORKS.md`.

## Ответственность

Router отвечает за:

- выбор минимально достаточного набора framework;
- объяснение why and when;
- предотвращение framework overload;
- воспроизводимость выбора для AI-модулей.

Router не определяет сами framework. Определения находятся только в `FRAMEWORKS.md`.

## Структура routing rule

Каждое правило содержит:

- `task_type`
- `primary_frameworks`
- `supporting_frameworks`
- `use_when`
- `avoid_when`
- `decision_rationale`
- `expected_outputs`

## Routing Rules

### `new-product-idea`

Primary frameworks: `customer-discovery`, `customer-development`, `jtbd`.

Supporting frameworks: `lean-startup`, `business-model-canvas`, `ai-readiness-assessment`.

Use when: идея новая, problem и customer segment не подтверждены.

Avoid when: уже есть validated problem и требуется только delivery planning.

Decision rationale: сначала нужно доказать problem и customer context, иначе PRD будет фиксировать assumptions как facts.

Expected outputs: problem hypotheses, customer segment hypotheses, discovery plan, riskiest assumptions.

### `problem-framing`

Primary frameworks: `jtbd`, `customer-discovery`.

Supporting frameworks: `user-personas`, `value-proposition-canvas`.

Use when: задача описана как feature request или vague need.

Avoid when: problem уже подтвержден качественным и количественным evidence.

Decision rationale: JTBD помогает описать desired progress без преждевременной привязки к solution.

Expected outputs: job statement, context, pains, gains, alternatives.

### `opportunity-mapping`

Primary frameworks: `opportunity-solution-tree`.

Supporting frameworks: `north-star-metric`, `okr`, `customer-discovery`.

Use when: есть desired outcome и много possible solutions.

Avoid when: desired outcome не определен.

Decision rationale: OST сохраняет traceability от outcome к opportunities, solutions и experiments.

Expected outputs: opportunity map, solution candidates, experiment backlog.

### `solution-validation`

Primary frameworks: `lean-startup`, `design-thinking`.

Supporting frameworks: `opportunity-solution-tree`, `heart`, `ai-product-evaluation`.

Use when: нужно проверить solution concept, prototype или MVP.

Avoid when: не подтверждена customer problem.

Decision rationale: Lean Startup проверяет assumptions, Design Thinking проверяет usability и human fit.

Expected outputs: experiment design, prototype test, learning report, pivot/persevere recommendation.

### `value-proposition`

Primary frameworks: `value-proposition-canvas`.

Supporting frameworks: `jtbd`, `business-model-canvas`, `product-market-fit`.

Use when: нужно сформулировать value proposition и связать solution с customer pains/gains.

Avoid when: customer profile не подтвержден.

Decision rationale: VPC делает явной связь между customer profile и value map.

Expected outputs: value proposition, fit gaps, validation plan.

### `business-model`

Primary frameworks: `business-model-canvas`.

Supporting frameworks: `product-market-fit`, `north-star-metric`, `okr`.

Use when: требуется оценить коммерческую и операционную жизнеспособность.

Avoid when: задача ограничена UX-level improvement без business model impact.

Decision rationale: BMC показывает взаимосвязь value, channels, revenue, cost и partners.

Expected outputs: business assumptions, risk map, validation priorities.

### `prioritization`

Primary frameworks: `rice`.

Supporting frameworks: `ice`, `moscow`, `wsjf`, `kano-model`.

Use when: нужно сравнить initiatives или features.

Avoid when: отсутствует strategy или desired outcome.

Decision rationale: RICE является default, потому что учитывает reach, impact, confidence и effort. ICE используется для быстрого triage. WSJF используется при program-level economic prioritization. MoSCoW используется для release scope. Kano используется для satisfaction impact.

Expected outputs: ranked initiatives, confidence gaps, decision rationale.

### `metric-system`

Primary frameworks: `north-star-metric`, `okr`.

Supporting frameworks: `heart`, `aarrr`.

Use when: нужно определить outcome metrics, product health или growth funnel.

Avoid when: продукт еще не имеет validated value proposition.

Decision rationale: North Star задает главный value metric, OKR связывает strategy и execution, HEART измеряет UX quality, AARRR диагностирует growth funnel.

Expected outputs: metric tree, OKR draft, measurement plan.

### `prd-creation`

Primary frameworks: `prd`.

Supporting frameworks: `jtbd`, `opportunity-solution-tree`, `user-story-mapping`, `heart`, `ai-readiness-assessment`.

Use when: discovery дал достаточно evidence для product specification.

Avoid when: ключевые assumptions не проверены.

Decision rationale: PRD должен фиксировать validated direction, а не заменять discovery.

Expected outputs: PRD, requirements, scope, non-goals, success metrics, open questions.

### `release-planning`

Primary frameworks: `user-story-mapping`, `moscow`.

Supporting frameworks: `rice`, `wsjf`.

Use when: нужно определить release slices и scope.

Avoid when: не согласован target workflow.

Decision rationale: story mapping сохраняет user journey, MoSCoW фиксирует scope commitments.

Expected outputs: story map, release slice, scope categories.

### `ai-product-feasibility`

Primary frameworks: `ai-readiness-assessment`, `ai-capability-assessment`.

Supporting frameworks: `cost-quality-latency`, `safety`, `hallucination-risk`.

Use when: proposed solution содержит AI capability.

Avoid when: задача может быть решена deterministic workflow без AI uncertainty.

Decision rationale: AI должен быть оправдан task suitability, data readiness, evaluation ability и risk tolerance.

Expected outputs: AI readiness score, capability map, feasibility recommendation.

### `ai-architecture-input`

Primary frameworks: `ai-capability-assessment`, `context-engineering`, `model-selection`.

Supporting frameworks: `evaluation-strategy`, `human-in-the-loop`, `cost-quality-latency`.

Use when: PRD переходит в AI Architecture.

Avoid when: не определены expected outputs и quality thresholds.

Decision rationale: архитектура должна следовать из capabilities, context и evaluation, а не из выбранного заранее model.

Expected outputs: capability requirements, context requirements, model selection criteria, eval gates.

### `ai-quality-and-release`

Primary frameworks: `evaluation-strategy`, `ai-product-evaluation`.

Supporting frameworks: `human-in-the-loop`, `safety`, `hallucination-risk`, `cost-quality-latency`.

Use when: AI Pipeline готовится к Playground или release.

Avoid when: нет test dataset или failure taxonomy.

Decision rationale: AI quality должна быть воспроизводимо измерима до и после release.

Expected outputs: evaluation plan, release gates, monitoring plan, review policy.

## Взаимосвязь с другими документами

- Берет framework definitions из `FRAMEWORKS.md`.
- Используется в `PROCESS.md` для выбора framework по этапам.
- Используется в `DECISION_ENGINE.md` при выборе decision method.
- Проверяется через `REVIEW.md`.

## Обязательные разделы

Каждый новый route должен иметь `task_type`, `primary_frameworks`, `supporting_frameworks`, `use_when`, `avoid_when`, `decision_rationale`, `expected_outputs`.

## Рекомендации

- Выбирать 1-3 primary framework, не больше.
- Supporting framework подключать только при явной необходимости.
- Если задача содержит AI capability, всегда добавлять AI-specific framework.

## Пример

Input: "Нужно понять, стоит ли делать AI assistant для подготовки PRD".

Route: `new-product-idea` + `ai-product-feasibility`.

Primary frameworks: `customer-discovery`, `jtbd`, `ai-readiness-assessment`, `ai-capability-assessment`.

## Критерии качества

- Выбор объяснен через task type и uncertainty.
- Нет framework без причины.
- Нет пропуска AI risk framework для AI features.
- Output route воспроизводим другим AI.

## Ссылки на framework

Используются все `framework_id` из `FRAMEWORKS.md`.

