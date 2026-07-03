# MODEL_SELECTION.md

## Назначение

Документ задает систему выбора models для AI Pipeline.

## Ответственность

MODEL_SELECTION отвечает за выбор small model, large model, multiple models, model routing и fallback strategy.

## Структура model decision

- task type;
- quality requirement;
- latency target;
- cost target;
- context length;
- safety risk;
- data sensitivity;
- evaluation result;
- selected model class;
- fallback model;
- review requirement.

## Правила выбора

### Когда использовать маленькую model

Использовать small model, если:

- task narrow и well-defined;
- output structured;
- risk low или medium;
- latency/cost critical;
- evaluation показывает достаточную quality.

Примеры: classification, simple extraction, routing, language normalization.

### Когда использовать большую model

Использовать large model, если:

- task требует complex reasoning;
- inputs длинные, неоднозначные или multi-document;
- качество small model ниже threshold;
- high-value workflow оправдывает cost;
- требуется robust instruction following.

Примеры: synthesis, nuanced review, complex PRD critique, multi-step reasoning.

### Когда использовать несколько models

Использовать multi-model design, если:

- разные steps имеют разные capability needs;
- можно снизить cost через small model for simple steps;
- нужен evaluator model отдельно от generator;
- нужен fallback на alternative provider/model.

### Когда использовать model routing

Использовать routing, если:

- request complexity varies;
- есть разные latency/cost tiers;
- confidence или risk определяют route;
- нужен provider fallback.

Routing signals: task type, input length, user tier, risk level, confidence, historical quality, cost budget.

## Decision Matrix

| Task | Default | Upgrade condition | Avoid |
|---|---|---|---|
| Classification | small model или Rules Engine | ambiguity high | large model без eval |
| Extraction | small/medium model + structured outputs | complex schema или long context | free-form output |
| Summarization | medium/large model | factuality threshold high | no citation/eval |
| Reasoning | large model | decomposition possible | agent by default |
| Retrieval QA | RAG + suitable generator | poor retrieval quality | LLM without grounding |
| Tool use | function calling capable model | unsafe action risk | tool access without validation |

## Взаимосвязь с другими документами

- `AI_PATTERNS.md` описывает `model-routing`, `structured-outputs`, `function-calling`.
- `EVALUATION.md` подтверждает model quality.
- `COST_OPTIMIZATION.md` задает cost constraints.
- `DECISION_ENGINE.md` фиксирует selection rationale.

## Обязательные разделы model selection output

- selected model class;
- alternatives;
- evaluation evidence;
- cost estimate;
- latency estimate;
- quality threshold;
- fallback;
- review triggers.

## Рекомендации

- Начинать с минимальной model, которая проходит eval.
- Не выбирать model только по benchmark.
- Проверять model на domain-specific eval dataset.
- Разделять generator и evaluator, если это снижает риск.

## Пример

Pipeline: small model классифицирует тип запроса, large model делает complex synthesis только для запросов высокого complexity, structured output validator проверяет результат, fallback отправляет low-confidence cases в Human Review.

## Критерии качества

- Selection объясняет why.
- Есть alternatives и fallback.
- Cost и latency измеримы.
- Model selection обновляем через eval results.

## Ссылки на используемые практики

LLM System Design, model routing, AI Gateway, evaluation-driven model selection, cost optimization.

