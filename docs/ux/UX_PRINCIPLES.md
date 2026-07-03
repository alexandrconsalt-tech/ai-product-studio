# UX Principles

## Назначение

Документ задает UX principles AI Product Studio. Эти принципы обязательны для всех будущих screens и components.

## Focus First

Пользователь всегда должен видеть текущую задачу и следующий шаг.

Правила:

- один главный workspace на экране;
- secondary panels не конкурируют с рабочей областью;
- главное действие визуально и логически одно;
- системные подсказки не перекрывают рабочий контекст.

Пример: в Product workspace основной action — перейти к следующему этапу или отправить artifact на Review, а не набор равнозначных кнопок.

## Progressive Disclosure

Сложность раскрывается постепенно.

Правила:

- базовые поля видны сразу;
- advanced settings скрыты в panels, tabs или раскрываемых секциях;
- ошибки показываются рядом с источником проблемы;
- AI explanations доступны по запросу, но не перегружают основной экран.

Пример: Model selection details в Architecture видны в Models tab, но не перегружают Overview.

## Minimal Cognitive Load

Интерфейс не заставляет пользователя помнить состояние проекта.

Правила:

- status, gate, review score и next action всегда видимы;
- breadcrumbs показывают местоположение;
- empty states объясняют, что нужно сделать;
- labels используют терминологию Domain Model.

## One Primary Action

На каждом экране есть только одно primary action.

Правила:

- primary action зависит от текущего lifecycle;
- destructive actions всегда secondary;
- если primary action невозможен, показывается причина и required action.

Пример: если Product Review не пройден, primary action — "Исправить Product", а не "Перейти к Architecture".

## Keyboard First

Опыт должен быть быстрым для профессионального пользователя.

Правила:

- Command Palette доступна глобально;
- основные actions доступны с keyboard;
- navigation работает без мыши;
- focus states обязательны.

## AI First

AI помогает выполнять работу, но не заменяет структуру продукта.

Правила:

- AI Assistant Panel контекстный;
- AI предлагает next action, questions и explanations;
- AI output всегда связан с artifact;
- AI не создает скрытых изменений без подтверждения пользователя.

## Explainability

Пользователь должен понимать, почему система предлагает действие.

Правила:

- review issues имеют rationale;
- gate failure объясняет missing criteria;
- AI recommendation показывает source artifact;
- architecture decision показывает trade-offs.

## Consistency

Одинаковые сущности выглядят и ведут себя одинаково.

Правила:

- status badges единообразны;
- review patterns одинаковы в Product, Architecture и Pipeline;
- tabs, panels, dialogs и command actions используют общие rules.

## Predictability

Система не должна неожиданно менять контекст.

Правила:

- navigation не теряет unsaved work;
- destructive actions требуют confirmation;
- state transitions явно подтверждаются;
- background AI work имеет progress и result.

