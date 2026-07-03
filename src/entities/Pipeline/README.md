# Pipeline

Pipeline описывает AI Pipeline независимо от React Flow.

Содержит Nodes, Edges, optional Layout и Version.

Storage:

- Pipeline является дочерним агрегатом Project;
- Node и Edge вложены в Pipeline;
- Run хранится отдельно и ссылается на Pipeline.

Lifecycle:

`draft -> in_progress -> review -> ready -> completed -> archived`

Validation rules:

- каждый Edge должен ссылаться на существующие Node;
- orphan nodes допустимы только в draft;
- self-loop запрещается для production-ready Pipeline.

