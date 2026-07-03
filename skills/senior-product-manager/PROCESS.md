# PROCESS.md

## Назначение

Документ описывает end-to-end процесс разработки AI-продукта в AI Product Studio: от идеи до готового AI Pipeline.

## Ответственность

Процесс отвечает за:

- последовательность этапов;
- входы и выходы каждого этапа;
- обязательные decision gates;
- связь Product Management и AI Engineering;
- критерии перехода между этапами.

Процесс не заменяет определения framework из `FRAMEWORKS.md`.

## Структура процесса

| Этап | Цель | Primary framework | Gate |
|---|---|---|---|
| 1. Idea Intake | Зафиксировать идею и assumptions | `customer-development` | Idea has explicit assumptions |
| 2. Product Discovery | Проверить problem и customer | `customer-discovery`, `jtbd` | Problem evidence exists |
| 3. Opportunity Definition | Связать outcome и opportunities | `opportunity-solution-tree` | Opportunity has evidence |
| 4. Value and Business Fit | Проверить value и business model | `value-proposition-canvas`, `business-model-canvas` | Value proposition is coherent |
| 5. AI Feasibility | Проверить AI-readiness | `ai-readiness-assessment`, `ai-capability-assessment` | AI is justified |
| 6. PRD | Зафиксировать требования | `prd` | PRD is ready |
| 7. AI Architecture Input | Подготовить вход для архитектуры | `context-engineering`, `model-selection` | Architecture constraints are clear |
| 8. Visual Pipeline Input | Подготовить pipeline requirements | `evaluation-strategy` | Pipeline can be evaluated |
| 9. Playground Readiness | Проверить AI quality | `ai-product-evaluation` | Release gates are measurable |
| 10. Product Review | Оценить качество решения | `review-system` | Decision is approved or revised |

`review-system` является внутренним названием review activity, а не framework. Правила review находятся в `REVIEW.md`.

## Этапы

### 1. Idea Intake

Цель: превратить сырую идею в проверяемые assumptions.

Inputs:

- исходная идея;
- предполагаемый customer;
- предполагаемая value;
- known constraints.

Actions:

- отделить facts от assumptions;
- определить riskiest assumptions;
- выбрать route через `FRAMEWORK_ROUTER.md`.

Outputs:

- idea brief;
- assumptions list;
- discovery questions;
- initial decision record.

Gate: идея не переходит дальше, если problem, customer и expected outcome не сформулированы явно.

### 2. Product Discovery

Цель: проверить, существует ли значимая customer problem.

Primary framework: `customer-discovery`, `jtbd`.

Actions:

- сформировать interview plan;
- собрать qualitative evidence;
- определить job, pains, gains, alternatives;
- отделить customer language от team interpretation.

Outputs:

- evidence map;
- problem statement;
- job statement;
- customer segment hypothesis.

Gate: должен существовать evidence-backed problem statement.

### 3. Opportunity Definition

Цель: связать desired outcome с opportunities и possible solutions.

Primary framework: `opportunity-solution-tree`.

Actions:

- определить desired outcome;
- сгруппировать opportunities;
- связать solution ideas с opportunities;
- определить experiments.

Outputs:

- opportunity map;
- solution candidates;
- experiment backlog.

Gate: каждая solution должна быть связана с opportunity и evidence.

### 4. Value and Business Fit

Цель: проверить value proposition и business model.

Primary framework: `value-proposition-canvas`, `business-model-canvas`.

Actions:

- сопоставить jobs/pains/gains с value map;
- определить business model assumptions;
- проверить alignment с strategy.

Outputs:

- value proposition;
- business assumptions;
- risk map.

Gate: value proposition не должна содержать unsupported claims.

### 5. AI Feasibility

Цель: определить, нужен ли AI и готова ли задача к AI-решению.

Primary framework: `ai-readiness-assessment`, `ai-capability-assessment`.

Actions:

- проверить task suitability;
- оценить data readiness;
- определить AI capabilities;
- оценить hallucination risk, safety, cost, quality, latency;
- определить need for human-in-the-loop.

Outputs:

- AI readiness assessment;
- capability map;
- AI risk register;
- go/no-go recommendation.

Gate: AI не допускается как solution, если не обоснован превосходящий value over non-AI alternatives.

### 6. PRD

Цель: зафиксировать product requirements.

Primary framework: `prd`.

Actions:

- описать problem, goals, non-goals;
- определить scope;
- описать requirements;
- определить success metrics;
- зафиксировать risks и open questions.

Outputs:

- PRD;
- requirement traceability;
- decision records.

Gate: PRD должен пройти `CHECKLIST.md`.

### 7. AI Architecture Input

Цель: подготовить требования для Senior AI Solution Architect.

Primary framework: `context-engineering`, `model-selection`, `evaluation-strategy`.

Actions:

- определить expected inputs/outputs;
- описать context sources;
- задать output schema;
- определить model selection criteria;
- определить evaluation gates.

Outputs:

- AI architecture brief;
- context requirements;
- model decision criteria;
- evaluation requirements.

Gate: architecture input должен быть проверяемым и не зависеть от конкретного vendor без причины.

### 8. Visual Pipeline Input

Цель: подготовить требования к Visual Pipeline.

Primary framework: `evaluation-strategy`, `human-in-the-loop`.

Actions:

- описать pipeline steps;
- определить handoff points;
- задать review и escalation rules;
- указать observability points.

Outputs:

- pipeline requirements;
- human review policy;
- monitoring requirements.

Gate: каждый pipeline step должен иметь purpose, input, output и failure mode.

### 9. Playground Readiness

Цель: определить, можно ли проверять AI Pipeline в Playground.

Primary framework: `ai-product-evaluation`.

Actions:

- подготовить eval dataset;
- определить test scenarios;
- запустить qualitative и quantitative review;
- сравнить с thresholds.

Outputs:

- evaluation report;
- failure taxonomy;
- release recommendation.

Gate: Playground запрещен без measurable evaluation criteria.

### 10. Product Review

Цель: проверить качество решения перед передачей дальше.

Primary documents: `REVIEW.md`, `CHECKLIST.md`, `DECISION_RECORDS.md`.

Actions:

- проверить completeness;
- проверить framework fit;
- проверить decision rationale;
- проверить AI risks;
- зафиксировать approve/revise/reject.

Outputs:

- review report;
- required changes;
- final decision record.

## Взаимосвязь с другими документами

- `FRAMEWORK_ROUTER.md` выбирает framework.
- `FRAMEWORKS.md` определяет framework.
- `DECISION_ENGINE.md` принимает решения на gates.
- `OUTPUT_SCHEMA.md` задает output format.
- `CHECKLIST.md` проверяет readiness и done.
- `REVIEW.md` оценивает quality.

## Обязательные разделы process output

- `stage`
- `input_summary`
- `selected_frameworks`
- `evidence`
- `assumptions`
- `decision`
- `risks`
- `next_actions`
- `gate_status`

## Рекомендации

- Не переходить к PRD до подтверждения problem.
- Не переходить к AI Architecture до AI readiness.
- Не переходить к Playground без evaluation strategy.
- Любой skip этапа должен быть зафиксирован в `DECISION_RECORDS.md`.

## Пример

Если идея: "AI Pipeline для автоматического анализа feedback", процесс начинается с `Idea Intake`, затем `Product Discovery`, затем `AI Feasibility`. PRD создается только после evidence-backed problem и AI justification.

## Критерии качества

- У каждого этапа есть clear input и output.
- Gate conditions измеримы.
- Решения воспроизводимы.
- AI-specific risks не отложены на конец процесса.

## Ссылки на framework

Используются `customer-discovery`, `customer-development`, `jtbd`, `opportunity-solution-tree`, `value-proposition-canvas`, `business-model-canvas`, `ai-readiness-assessment`, `ai-capability-assessment`, `prd`, `context-engineering`, `model-selection`, `evaluation-strategy`, `ai-product-evaluation`, `human-in-the-loop`.

