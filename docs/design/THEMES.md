# Themes

## Назначение

Theme Engine централизует colors, surfaces, borders, text и states.

## Themes

### Light Theme

Использует `:root`.

### Dark Theme

Использует `.dark`.

### System Theme

System Theme должен применяться на application layer через выбор light/dark class. Shared UI не содержит theme switching logic.

## Правила

- Компоненты используют только CSS variables/Tailwind tokens.
- Inline colors запрещены.
- Цвет статуса всегда сопровождается текстом или icon.
- Dark theme не является инверсией light theme; она настроена отдельно.

