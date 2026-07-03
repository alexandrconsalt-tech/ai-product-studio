# Design System Foundation

## Назначение

Design System AI Product Studio задает единый интерфейсный фундамент для будущих экранов.

Это не экран, не Product Workspace, не Pipeline implementation и не бизнес-логика.

## Принципы

- Content First: интерфейс подчинен рабочему содержанию.
- Minimal UI: никаких декоративных элементов.
- Progressive Disclosure: сложность раскрывается по мере необходимости.
- Consistency: одинаковые patterns работают одинаково.
- Accessibility: keyboard, focus и readable contrast обязательны.
- Keyboard First: профессиональный пользователь должен работать быстро.
- Dark First: dark theme является first-class theme.
- AI First: AI states и explanations имеют системные компоненты.

## Структура реализации

```text
src/shared/ui
├── ai.tsx
├── containers.tsx
├── feedback.tsx
├── form.tsx
├── index.ts
├── layout.tsx
├── navigation.tsx
└── pipeline.tsx
```

## Правила

- Все экраны используют компоненты из `src/shared/ui`.
- Цвета берутся только из design tokens.
- Inline colors запрещены.
- Компоненты не содержат бизнес-логику.
- Domain-specific behavior реализуется выше уровня shared UI.

