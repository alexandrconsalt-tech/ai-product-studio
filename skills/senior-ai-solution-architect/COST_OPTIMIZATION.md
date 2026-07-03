# COST_OPTIMIZATION.md

## Назначение

Документ задает cost optimization для AI Architecture.

## Ответственность

COST_OPTIMIZATION отвечает за минимизацию cost без нарушения quality, safety и latency thresholds.

## Cost Drivers

- model price;
- token volume;
- context length;
- retries;
- parallel calls;
- embeddings;
- vector search;
- human review;
- telemetry storage;
- provider egress и infrastructure.

## Optimization Strategies

### Model Right-Sizing

Использовать smallest model that passes eval.

### Context Reduction

Передавать minimal sufficient context, удалять irrelevant chunks, применять summarization только при доказанной пользе.

### Caching

Использовать caching для deterministic или stable inputs, если это безопасно и не нарушает freshness.

### Routing

Simple tasks -> small model или Rules Engine. Complex/high-risk tasks -> stronger model или Human Review.

### Batch and Async

Фоновые задачи выполнять batch/async, если UX не требует sync response.

### Retry Control

Ограничивать retries, не повторять deterministic validation failures бесконечно.

### Human Review Sampling

Использовать risk-based review и sampling для low-risk cases.

## Взаимосвязь с другими документами

- `MODEL_SELECTION.md` выбирает model class.
- `PIPELINE_DESIGN.md` определяет calls и parallelism.
- `EVALUATION.md` подтверждает quality после optimization.
- `REVIEW.md` оценивает Cost.

## Обязательные разделы cost plan

- cost per pipeline step;
- expected volume;
- p50/p95 cost;
- budget threshold;
- optimization levers;
- quality impact;
- monitoring.

## Рекомендации

- Cost optimization не должна снижать quality ниже threshold.
- Измерять cost на unit-of-value, а не только total spend.
- Добавлять alerts на cost anomaly.

## Пример

Classification выполняется small model, только ambiguous cases идут в large model. Summary кэшируется для неизменных документов. Long context сокращается через retrieval.

## Критерии качества

- Cost attributable по step и customer/workspace.
- Есть budget policy.
- Оптимизации проверены eval.

## Ссылки на используемые практики

Well-Architected cost optimization, AI Gateway, model routing, caching, latency/cost trade-off.

