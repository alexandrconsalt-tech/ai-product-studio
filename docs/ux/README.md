# UX Architecture & Screen Specification

## Назначение

Документальный пакет TASK-005 описывает UX Architecture AI Product Studio до реализации React-компонентов.

Это не UI implementation, не дизайн-макеты и не бизнес-логика. Это specification уровня Figma Design System, вокруг которой будут строиться будущие screens, components и interaction patterns.

## Главный принцип

AI Product Studio — это Cursor для AI Product Manager.

Не Dashboard. Не CRM. Не ERP. Не Notion. Не Figma.

Интерфейс должен помогать Senior AI Product Manager быстро пройти путь:

```text
Idea -> Discovery -> PRD -> Architecture -> Pipeline -> Playground
```

## Структура документов

| Документ | Назначение |
|---|---|
| `UX_PRINCIPLES.md` | UX principles и правила применения |
| `NAVIGATION.md` | Sidebar и navigation model |
| `GLOBAL_LAYOUT.md` | Общий layout приложения |
| `SCREEN_PROJECTS.md` | Specification экрана Projects |
| `SCREEN_PRODUCT.md` | Specification workspace Product |
| `SCREEN_ARCHITECTURE.md` | Specification workspace Architecture |
| `SCREEN_PIPELINE.md` | Specification workspace Pipeline |
| `SCREEN_PLAYGROUND.md` | Specification workspace Playground |
| `COMPONENT_INVENTORY.md` | Component inventory |

## Boundaries

Разрешено:

- описывать layout, interactions, states, empty states, errors;
- описывать UX flows;
- описывать component responsibilities;
- связывать UX с Domain Model.

Запрещено:

- создавать React Components;
- создавать Store;
- создавать API;
- создавать mocks;
- реализовывать Pipeline;
- добавлять разделы навигации сверх заданных.

## Критерии качества

- UX помогает пройти основной путь с минимальным cognitive load.
- Каждый screen имеет назначение, flow, actions, states и errors.
- Navigation содержит только: Projects, Product, Architecture, Pipeline, Playground, Settings.
- Specification не зависит от конкретной UI library.
- UX использует существующую Domain Model.

