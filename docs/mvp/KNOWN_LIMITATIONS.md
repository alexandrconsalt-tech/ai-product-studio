# Known Limitations

## Не реализовано в MVP

- настоящий AI Runtime;
- OpenAI API;
- Backend;
- Authentication;
- Multi-user;
- Cloud Sync;
- Billing;
- Production Runtime;
- Marketplace.

## UX ограничения

- Navigation использует query parameter `view`.
- Pipeline editing поддерживает базовые операции и undo/redo history в рамках текущей сессии.
- Rename/Delete/Duplicate Project используют modal dialogs.
- Undo/Redo history хранится в памяти приложения и не восстанавливается после reload.

## Engineering ограничения

- Local Storage Repository предназначен для demo persistence.
- Simulation metrics являются расчетными.
- React Flow используется как UI adapter, Domain Pipeline остается источником правды.

## Тестовое покрытие (обновлено в рамках Engineering Roadmap, см. CLAUDE.md §19)

- Добавлен Vitest (`vitest.config.ts`, `npm test` / `npm run test:watch`).
- Domain-слой (`src/entities/**`) покрыт unit-тестами для shared-примитивов и сущностей Node, Edge, Project, Review, Run, Pipeline: фабрики дают валидный по Zod-схеме объект, схемы отклоняют задокументированные невалидные значения.
- Остальные сущности (Architecture, Framework, KnowledgeModule, Model, Product, Prompt) пока без тестов — следующий кандидат при продолжении Epic 1.
- UI/stores/simulation остаются непокрытыми тестами — это осознанный выбор по CLAUDE.md §19 (decision rule: начинать с domain-слоя, т.к. он чистый и не имеет зависимостей).
