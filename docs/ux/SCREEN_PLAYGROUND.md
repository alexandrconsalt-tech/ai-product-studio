# Playground Workspace

## Назначение

Playground позволяет запускать Pipeline, сравнивать результаты и проверять latency, cost, logs и output quality.

## Layout

```text
Input Panel | Output Panel
Bottom: Logs / Metrics / Compare Runs
```

## Input

Цель: подготовить input для Pipeline Run.

Компоненты:

- input editor;
- run configuration;
- selected pipeline version;
- validation status.

Состояния:

- empty input;
- invalid input;
- ready to run;
- running.

## Output

Цель: показать результат Run.

Компоненты:

- structured output viewer;
- raw output optional;
- validation result;
- review markers.

Состояния:

- no run;
- running;
- succeeded;
- failed.

## Logs

Цель: показать runtime trace.

Компоненты:

- log list;
- severity filter;
- timestamp;
- node reference.

## Latency

Показывает:

- total latency;
- latency by node;
- p50/p95 later in analytics, not MVP.

## Cost

Показывает:

- total cost;
- cost by node/model;
- warning if cost exceeds budget.

## Compare Runs

Цель: сравнить несколько Run.

Сравнивает:

- input;
- output;
- latency;
- cost;
- metrics;
- errors.

## Export

MVP export:

- JSON artifact;
- run summary.

Не входит в MVP:

- PDF report;
- external integrations.

## Ошибки

- Pipeline not ready;
- invalid input;
- run failed;
- timeout;
- model/provider error;
- validation failed.

## Связь с Domain Model

Использует:

- `Run`;
- `Pipeline`;
- `Node`;
- `Review`;
- `Model`.

