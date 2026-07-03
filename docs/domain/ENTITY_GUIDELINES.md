# Entity Guidelines

## Назначение

Документ задает правила развития Domain Model.

## Основное правило

Любой новый экран, AI-модуль или функция сначала обязаны использовать существующие доменные сущности. Создание новых сущностей допускается только после обновления Domain Model и документации.

## Naming

- Entity directories используют PascalCase: `Project`, `Pipeline`, `KnowledgeModule`.
- TypeScript-типы используют PascalCase.
- Поля используют camelCase.
- Enum values используют snake_case.
- Factory имеет формат `createEntityName`.

## File Structure

Каждая сущность обязана иметь:

```text
Entity/
├── README.md
└── model
    ├── factory.ts
    ├── schema.ts
    └── types.ts
```

## Dependency Rules

- Entity может импортировать shared primitives.
- Aggregate может импортировать дочерние value types, если они вложены.
- Entity не должна импортировать UI, React, Zustand, API clients или feature modules.
- Избегать циклических импортов.

## Versioning

- Каждая сущность имеет `version`.
- Breaking change в schema требует изменения версии сущности.
- Связанные сущности не должны менять версию автоматически.

## Validation

- Все внешние данные проходят через Zod Schema.
- Factory создает минимально валидную сущность.
- Сложные transition rules принадлежат Orchestrator, а не factory.

## Extension Rules

Допустимо:

- добавлять optional field;
- добавлять новый enum value после обновления документации;
- добавлять новую сущность после описания relationships и lifecycle.

Недопустимо:

- создавать UI-specific поля в Domain Model;
- хранить React Flow объект как Pipeline;
- добавлять store или API logic в entities;
- дублировать одну сущность под разные экраны.

