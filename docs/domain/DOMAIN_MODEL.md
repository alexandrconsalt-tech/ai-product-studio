# Domain Model

## Назначение

Документ описывает доменную модель AI Product Studio. Модель независима от React, UI, React Flow, Store и API.

## Основные сущности

| Entity | Назначение | Storage |
|---|---|---|
| Project | Главная сущность проекта | Отдельный агрегат |
| Product | Результат Senior Product Manager | Отдельный агрегат, ссылка из Project |
| Architecture | Результат Senior AI Solution Architect | Отдельный агрегат, ссылка из Project |
| Pipeline | Описание AI Pipeline | Отдельный агрегат, ссылка из Project |
| Node | Универсальный шаг Pipeline | Вложен в Pipeline |
| Edge | Связь между Node | Вложен в Pipeline |
| Run | Запуск Pipeline в Playground | Отдельная сущность |
| Review | Результат проверки качества | Отдельная сущность |
| KnowledgeModule | Модуль знаний | Отдельная справочная сущность |
| Framework | Product или AI framework | Отдельная справочная сущность |
| Prompt | Описание поведения AI | Отдельная сущность |
| Model | Описание AI-модели | Отдельная сущность |

## Главный поток

```text
Project
  -> Product
  -> Architecture
  -> Pipeline
  -> Run
  -> Review
```

## Versioning

Каждая сущность имеет собственное поле `version`.

Правило: изменение одной сущности не должно требовать изменения версии всех связанных сущностей. Связи через `id` используются там, где нужен независимый lifecycle.

## Serialization

Все сущности должны сериализоваться в JSON. Поля с типом `unknown` допустимы только для Run input/output, потому что Playground работает с разными payload.

## JSON Example

```json
{
  "project": {
    "id": "project_123",
    "name": "AI Product Studio",
    "status": "product_ready",
    "productId": "product_123",
    "architectureId": null,
    "pipelineId": null,
    "playgroundRunIds": [],
    "reviewIds": ["review_123"],
    "createdAt": "2026-06-29T10:00:00.000Z",
    "updatedAt": "2026-06-29T10:00:00.000Z",
    "version": "1.0.0"
  },
  "product": {
    "id": "product_123",
    "projectId": "project_123",
    "status": "ready",
    "idea": {
      "statement": "Создать IDE для AI Product Manager"
    },
    "users": [],
    "jtbd": [],
    "features": [],
    "metrics": [],
    "frameworkIds": [],
    "createdAt": "2026-06-29T10:00:00.000Z",
    "updatedAt": "2026-06-29T10:00:00.000Z",
    "version": "1.0.0"
  }
}
```

## Validation

Zod Schema находится в `src/entities/*/model/schema.ts`.

Factory находится в `src/entities/*/model/factory.ts`.

TypeScript-типы находятся в `src/entities/*/model/types.ts`.

## Ограничения

- Domain Layer не импортирует React.
- Domain Layer не импортирует Zustand.
- Domain Layer не импортирует React Flow.
- Domain Layer не вызывает API.
- Domain Layer не содержит UI business logic.

