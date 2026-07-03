# QUALITY_ENGINE.md

## Назначение

Документ задает правила проверки качества architecture, pipeline, models, cost, reliability, scalability и safety.

## Ответственность

QUALITY_ENGINE отвечает за quality gates до Playground и production.

## Quality Dimensions

### Architecture Quality

Проверки:

- minimal sufficient architecture;
- modular components;
- clear contracts;
- reversible decisions where possible;
- no unnecessary Agent.

### Pipeline Quality

Проверки:

- every step has input/output schema;
- validation after AI outputs;
- retry/fallback policy;
- human review triggers;
- state recovery.

### Model Quality

Проверки:

- model selected by eval;
- model version tracked;
- fallback exists;
- hallucination controls;
- structured output where needed.

### Cost Quality

Проверки:

- cost per step;
- budget thresholds;
- routing for cost reduction;
- caching where safe;
- no large model for simple task without justification.

### Reliability Quality

Проверки:

- timeouts;
- retries with backoff;
- circuit breaker;
- provider fallback;
- DLQ for async processing.

### Scalability Quality

Проверки:

- async processing where possible;
- queue-based workloads;
- rate limits;
- concurrency controls;
- stateless compute where suitable.

### Security and Safety

Проверки:

- access control;
- data redaction;
- prompt injection controls for RAG/tool use;
- guardrails;
- human review for high risk.

## Взаимосвязь с другими документами

- `EVALUATION.md` задает eval methods.
- `PIPELINE_DESIGN.md` задает pipeline contracts.
- `MODEL_SELECTION.md` задает model criteria.
- `REVIEW.md` использует quality dimensions for scoring.

## Обязательные разделы quality report

- dimension;
- check;
- status;
- evidence;
- blocking issue;
- mitigation;
- owner.

## Рекомендации

- Blocking quality issue должен останавливать release.
- Quality gates должны быть автоматизируемыми, где возможно.
- Human evaluation нужна для ambiguous semantic tasks.

## Пример

Если model возвращает JSON для downstream system, Quality Engine требует schema validation, retry repair и fallback path.

## Критерии качества

- Проверки покрывают architecture, pipeline, model, cost, reliability, scalability и safety.
- Quality report machine-readable.
- Blocking issues однозначны.

## Ссылки на используемые практики

NIST AI RMF, Well-Architected reliability/security/cost, ML evaluation, guardrails, observability.

