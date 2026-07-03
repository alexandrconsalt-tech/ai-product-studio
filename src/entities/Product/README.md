# Product

Product хранит результат работы Senior Product Manager.

Включает Idea, Discovery, Problem, Users, JTBD, Features, MVP, Metrics и PRD.

Storage:

- Product является дочерним агрегатом Project;
- Framework хранится отдельно и подключается через `frameworkIds`;
- Review хранится отдельно и ссылается на Product.

Lifecycle:

`draft -> in_progress -> review -> ready -> completed -> archived`

