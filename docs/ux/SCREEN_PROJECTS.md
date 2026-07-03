# Projects Screen

## Назначение

Projects — стартовая точка AI Product Studio. Экран позволяет создать, найти, открыть, дублировать или архивировать Project.

## User Flow

```text
Open Projects -> Search or Create Project -> Select Project -> Continue next stage
```

## Основные действия

Primary action: создать Project.

Secondary actions:

- открыть Project;
- дублировать Project;
- архивировать Project;
- найти Project;
- восстановить archived Project, если такая возможность включена позже.

## Layout

Workspace:

- top search row;
- project list;
- project status column;
- updatedAt column;
- quick action menu.

Right AI Assistant Panel:

- скрыт по умолчанию;
- может объяснять, какой Project требует внимания.

## Empty State

Показывается, если Projects отсутствуют.

Содержит:

- короткое описание: "Создайте первый Project, чтобы пройти путь Idea -> Playground";
- primary action: создать Project;
- без демонстрационных моков.

## Создание Project

Dialog fields:

- name;
- description optional;
- initial idea optional but recommended.

Validation:

- name required;
- idea может быть добавлена позже, но Product workspace будет blocked до ее заполнения.

## Поиск

Search должен искать по:

- Project name;
- description;
- status.

Search не должен создавать отдельный advanced filter в MVP.

## Дублирование

Duplicate action:

- создает новый Project draft;
- копирует name with suffix;
- не копирует Playground Runs;
- Review history копируется только как reference, не как active review.

## Архив

Archive action:

- требует confirmation;
- переводит Project в `archived`;
- скрывает из active list;
- не удаляет данные.

## States

- empty;
- loading;
- list;
- search no results;
- archived filter;
- creation dialog;
- archive confirmation;
- error.

## Ошибки

- project name missing;
- duplicate failed;
- archive failed;
- project cannot open because data corrupted.

## Связь с Domain Model

Использует:

- `Project`;
- `Review`;
- `Run` через summary counts.

