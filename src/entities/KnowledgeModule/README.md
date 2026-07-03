# KnowledgeModule

KnowledgeModule описывает модуль знаний, например Senior Product Manager или Senior AI Solution Architect.

Сущность хранится отдельно и подключается к Project/Review через ссылки.

Validation rules:

- `kind` должен быть известным типом модуля;
- `path` указывает расположение документации;
- `frameworkIds` содержит ссылки на Framework.

