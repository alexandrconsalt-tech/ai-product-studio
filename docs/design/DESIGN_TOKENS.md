# Design Tokens

## Colors

Token groups:

- Primary
- Secondary
- Surface
- Background
- Border
- Text
- Muted
- Success
- Warning
- Error
- Info
- Hover
- Selected
- Focus
- Disabled

Themes:

- Light Theme: `:root`.
- Dark Theme: `.dark`.
- System Theme: выбирается приложением через системную preference и применяет light/dark class.

Implementation:

- CSS variables находятся в `src/app/globals.css`.
- Tailwind aliases находятся в `tailwind.config.ts`.

## Radius

- none: 0
- sm: 4 px
- md: 6 px
- lg: 8 px
- xl: 12 px
- full: 9999 px

## Shadows

- sm: subtle elevation.
- md: panels, popovers.
- lg: dialogs, command palette.

## Motion

- fast: 120 ms
- base: 180 ms
- slow: 240 ms

Easing:

- standard: `cubic-bezier(0.2, 0, 0, 1)`
- entrance: `cubic-bezier(0, 0, 0.2, 1)`
- exit: `cubic-bezier(0.4, 0, 1, 1)`

