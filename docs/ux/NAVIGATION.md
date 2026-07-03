# Navigation

## Назначение

Документ описывает navigation model AI Product Studio.

## Sidebar

Sidebar содержит только:

1. Projects
2. Product
3. Architecture
4. Pipeline
5. Playground
6. Settings

Другие разделы запрещены без обновления UX Specification.

## Navigation Principles

- Navigation отражает путь продукта.
- Активный project context сохраняется между разделами.
- Disabled state используется, если раздел еще недоступен по lifecycle.
- Пользователь должен понимать, почему раздел заблокирован.

## Sidebar Behavior

Default width: 248 px.

Collapsed width: 64 px.

Collapsed mode:

- показываются icons;
- labels скрыты;
- tooltip показывает название раздела;
- active state сохраняется.

## Section Availability

| Раздел | Когда доступен |
|---|---|
| Projects | Всегда |
| Product | После создания Project |
| Architecture | После Product Complete gate |
| Pipeline | После Architecture Complete gate |
| Playground | После Pipeline Complete gate |
| Settings | Всегда |

## Header Navigation

Header показывает:

- project name;
- breadcrumb;
- current status;
- primary action;
- optional review/gate status.

## Command Palette

Command Palette доступна глобально.

Типы команд:

- открыть раздел;
- создать Project;
- найти Project;
- перейти к next action;
- открыть Review issues;
- запустить проверку доступного artifact.

## Empty Navigation States

Если Project не выбран:

- Product, Architecture, Pipeline и Playground показывают disabled state;
- primary action в header: создать или выбрать Project.

