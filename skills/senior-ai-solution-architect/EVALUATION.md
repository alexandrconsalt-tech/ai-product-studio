# EVALUATION.md

## Назначение

Документ описывает Evaluation Strategy для AI-систем.

## Ответственность

EVALUATION отвечает за offline eval, online monitoring, human evaluation, regression gates и release thresholds.

## Evaluation Types

### Offline Evaluation

Используется до release на versioned eval dataset.

Метрики: accuracy, precision/recall, factuality, completeness, schema validity, tool selection accuracy, retrieval quality.

### Online Monitoring

Используется после release.

Метрики: latency, cost, error rate, fallback rate, human correction rate, user feedback, drift signals.

### Human Evaluation

Используется для semantic quality, safety, usefulness, tone, nuanced reasoning.

Требования: rubric, reviewer calibration, disagreement handling.

### Regression Evaluation

Используется при изменении model, prompt, context, retrieval, schema или rules.

Gate: новая версия не должна ухудшать critical metrics ниже threshold.

## Evaluation Dataset

Должен включать:

- representative cases;
- edge cases;
- failure cases;
- adversarial или safety cases;
- high-risk cases;
- golden answers или rubric.

## Evaluation by Pattern

| Pattern | Metrics |
|---|---|
| `structured-outputs` | schema validity, field accuracy |
| `rag` | retrieval recall, citation precision, factuality |
| `function-calling` | tool selection accuracy, argument validity |
| `model-routing` | routing accuracy, cost-quality balance |
| `guardrails` | violation detection, false positives |
| `human-in-the-loop` | correction rate, SLA, agreement |

## Взаимосвязь с другими документами

- `MODEL_SELECTION.md` требует eval evidence.
- `QUALITY_ENGINE.md` использует eval gates.
- `PIPELINE_DESIGN.md` встраивает eval checkpoints.
- `REVIEW.md` проверяет AI Quality.

## Обязательные разделы evaluation plan

- task definition;
- eval dataset;
- metrics;
- thresholds;
- failure taxonomy;
- human evaluation rubric;
- regression policy;
- monitoring plan.

## Рекомендации

- Не оценивать только happy path.
- Разделять model eval и product eval.
- Версионировать dataset, prompt, model и context.
- Использовать production feedback для обновления eval set.

## Пример

Для RAG summary: retrieval recall >= threshold, citation precision, factuality human review, schema validity, latency p95 и cost per document.

## Критерии качества

- Evaluation воспроизводима.
- Метрики связаны с product risk.
- Есть release threshold.
- Есть regression process.

## Ссылки на используемые практики

AI Evaluation, OpenAI eval concepts, ML evaluation, NIST AI RMF monitoring and measurement.

