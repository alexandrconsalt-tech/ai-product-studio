# DATA_ARCHITECTURE.md

## Назначение

Документ описывает лучшие практики хранения данных и Data Flow для AI Architecture.

## Ответственность

DATA_ARCHITECTURE отвечает за разделение input, intermediate, final, reference, knowledge, evaluation и telemetry data.

## Data Classes

### Входные данные

Назначение: raw user inputs, files, events, product context.

Практики: validate on ingest, assign data classification, store source metadata, preserve lineage.

### Промежуточные данные

Назначение: outputs между pipeline steps.

Практики: version schemas, set TTL, avoid unnecessary sensitive retention.

### Итоговые результаты

Назначение: approved AI outputs, user-visible artifacts, system decisions.

Практики: immutable versioning, audit log, link to inputs and model version.

### Справочники

Назначение: deterministic reference data, taxonomies, business rules.

Практики: controlled updates, versioning, tests, owner.

### Knowledge

Назначение: documents, embeddings, chunks, metadata для RAG/context.

Практики: ingestion pipeline, chunking policy, freshness, access control, deletion propagation.

### Evaluation

Назначение: eval datasets, labels, expected outputs, rubrics, results.

Практики: separate from production data, versioned, representative, privacy-reviewed.

### Telemetry

Назначение: traces, prompts, context hashes, latency, cost, errors, quality signals.

Практики: redact sensitive data, trace IDs, retention policy, cost attribution.

## Storage Principles

- Separate operational data and evaluation data.
- Do not store sensitive prompt/context without governance.
- Link every AI output to model, prompt/context version и input lineage.
- Use least privilege access.
- Use retention and deletion policies.

## Взаимосвязь с другими документами

- `PIPELINE_DESIGN.md` определяет data movement.
- `EVALUATION.md` использует evaluation data.
- `QUALITY_ENGINE.md` проверяет data quality.
- `REVIEW.md` оценивает security и maintainability.

## Обязательные разделы data architecture output

- data inventory;
- classification;
- storage location;
- retention;
- lineage;
- access control;
- evaluation dataset plan;
- telemetry plan.

## Рекомендации

- Для RAG хранить source document, chunk, embedding version и metadata.
- Для AI outputs хранить confidence и validation status.
- Для telemetry использовать redaction и sampling.

## Пример

Summary output хранится как final result с ссылками на source document, model version, prompt version, validation result и reviewer decision.

## Критерии качества

- Data lineage восстановим.
- Sensitive data защищены.
- Evaluation reproducible.
- Telemetry достаточна для debugging и cost analysis.

## Ссылки на используемые практики

Data governance, ML data lineage, RAG ingestion practice, privacy-by-design, AI Observability.

