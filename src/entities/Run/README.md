# Run

Run описывает один запуск Pipeline в Playground.

Validation rules:

- `pipelineId` обязателен;
- `status` отражает lifecycle запуска;
- `metrics`, `latencyMs`, `costUsd` и `logs` используются для анализа качества;
- `input` и `output` сериализуются как JSON-compatible значения на уровне persistence.

