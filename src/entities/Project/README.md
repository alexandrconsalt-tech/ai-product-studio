# Project

Project — главная сущность AI Product Studio.

Поля:

- id
- name
- description
- status
- createdAt
- updatedAt
- version

Связи:

- Product через `productId`;
- Architecture через `architectureId`;
- Pipeline через `pipelineId`;
- Playground через `playgroundRunIds`;
- Review через `reviewIds`.

Lifecycle:

`draft -> discovery -> product_ready -> architecture_ready -> pipeline_ready -> testing -> completed -> archived`

Storage:

Project хранится отдельно и содержит ссылки на дочерние агрегаты, а не встраивает их целиком.

