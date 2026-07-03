# MATURITY_MODEL.md

## Назначение

Документ описывает модель зрелости AI Product Studio product work. Модель помогает оценивать, насколько продуктовая работа готова к переходу от идеи к AI Pipeline.

## Ответственность

MATURITY_MODEL отвечает за:

- уровни зрелости;
- критерии перехода между уровнями;
- диагностику gaps;
- roadmap улучшения product practice.

## Уровни зрелости

### Level 0. Unstructured Idea

Описание: есть идея или stakeholder request, но нет problem evidence.

Признаки:

- solution сформулирована раньше problem;
- customer segment размыт;
- assumptions не выделены.

Следующий шаг: `customer-discovery`, `jtbd`.

### Level 1. Problem Framed

Описание: problem и customer segment сформулированы, но evidence ограничен.

Признаки:

- есть problem statement;
- есть initial customer evidence;
- есть assumptions и discovery plan.

Следующий шаг: углубить Product Discovery и opportunity mapping.

### Level 2. Opportunity Validated

Описание: opportunities связаны с desired outcome и evidence.

Признаки:

- есть opportunity map;
- solution candidates связаны с opportunities;
- есть experiment plan.

Следующий шаг: value proposition и business model validation.

### Level 3. Product Direction Ready

Описание: product direction готов к PRD.

Признаки:

- value proposition coherent;
- success metrics определены;
- priority rationale есть;
- risks известны.

Следующий шаг: создать PRD и проверить Definition of Ready.

### Level 4. AI Feasibility Ready

Описание: AI capability обоснована и проверена на readiness.

Признаки:

- AI justification есть;
- capability map определена;
- data/context readiness оценены;
- hallucination, safety, cost, quality, latency рассмотрены.

Следующий шаг: AI Architecture input.

### Level 5. AI Pipeline Ready for Playground

Описание: AI Pipeline requirements готовы к Playground.

Признаки:

- evaluation strategy есть;
- output schema есть;
- human-in-the-loop policy есть при необходимости;
- release gates измеримы.

Следующий шаг: Playground и product review.

### Level 6. Production-Ready Product Knowledge

Описание: знания и решения готовы для долгосрочного сопровождения.

Признаки:

- decision records актуальны;
- review approved;
- metrics и monitoring определены;
- safety и evaluation process встроены.

Следующий шаг: continuous improvement.

## Взаимосвязь с другими документами

- `PROCESS.md` описывает путь между уровнями.
- `CHECKLIST.md` задает gates.
- `REVIEW.md` оценивает готовность.
- `FRAMEWORK_ROUTER.md` рекомендует framework для перехода.

## Обязательные разделы maturity assessment

- current_level;
- evidence;
- missing_capabilities;
- blocking_gaps;
- recommended_frameworks;
- next_actions;

## Рекомендации

- Не перескакивать с Level 0 к PRD.
- Для AI-продуктов Level 4 обязателен перед AI Architecture.
- Level 6 требует decision records и review approval.

## Пример

Если есть problem statement и 5 interviews, но нет opportunity map и AI readiness, зрелость: Level 1 или Level 2, но не Level 4.

## Критерии качества

- Уровень определяется по evidence, а не оптимизму команды.
- Gaps actionable.
- Recommended framework указываются через `framework_id`.

## Ссылки на framework

`customer-discovery`, `jtbd`, `opportunity-solution-tree`, `value-proposition-canvas`, `business-model-canvas`, `prd`, `ai-readiness-assessment`, `ai-capability-assessment`, `evaluation-strategy`, `ai-product-evaluation`.

