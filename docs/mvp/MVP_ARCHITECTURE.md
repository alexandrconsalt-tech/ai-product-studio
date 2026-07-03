# MVP Architecture

## Назначение

MVP v1.0 демонстрирует полный путь AI Product Studio:

```text
Create Project -> Product -> Architecture -> Pipeline -> Playground -> Simulation Run
```

## Слои

- Domain Model: `src/entities`.
- Design System: `src/shared/ui`.
- Repository Pattern: `src/shared/repositories`.
- State: `src/shared/stores`.
- Simulation Engine: `src/shared/simulation`.
- MVP Screens: `src/features/mvp`.

## Repository

MVP использует `LocalStorageProjectRepository`.

Экраны не обращаются к Local Storage напрямую. Замена на Backend Repository должна происходить через замену implementation `projectRepository`.

Repository contract включает snapshot operations и typed CRUD-style методы для Project, Product, Architecture, Pipeline и Run. Это подготовка к Backend Repository без изменения экранов.

## State Stores

- Project Store.
- Product Store.
- Architecture Store.
- Pipeline Store.
- Playground Store.
- UI Store.

Pipeline Store содержит in-memory history stack для undo/redo действий редактирования Pipeline.

## Навигация

Deep Links реализованы через `/?view=projects|product|architecture|pipeline|playground|settings`.

## Ограничения архитектуры

MVP не реализует Backend, Auth, настоящий AI Runtime, Cloud Sync и Multi-user.
