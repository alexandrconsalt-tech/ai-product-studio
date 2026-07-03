# Architecture

Architecture хранит результат работы Senior AI Solution Architect.

Включает Capabilities, AI Components, Models, Data Flow, Quality и Evaluation.

Storage:

- Architecture является дочерним агрегатом Project;
- Model хранится отдельно и подключается через `modelIds`;
- Pipeline строится на основе Architecture, но хранится отдельно.

Lifecycle:

`draft -> in_progress -> review -> ready -> completed -> archived`

