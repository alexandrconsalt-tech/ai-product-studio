# Run

Run описывает один запуск Pipeline в Playground.

Validation rules:

- `pipelineId` обязателен;
- `status` отражает lifecycle запуска;
- `metrics`, `evidence`, `latencyMs`, `costUsd` и `logs` используются для анализа качества;
- `evidence` — дословные цитаты/фрагменты, на которые опирался результат (CLAUDE.md §14.3/§24), добавлено 2026-07-03 вместе с Production Pipeline Runtime;
- `input` и `output` сериализуются как JSON-compatible значения на уровне persistence.

