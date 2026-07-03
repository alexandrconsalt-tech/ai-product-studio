# Motion

## Назначение

Motion должен помогать ориентации, а не украшать интерфейс.

## Duration

- Hover: 120 ms.
- Dialog: 180-240 ms.
- Panel: 180 ms.
- Sidebar: 180 ms.
- Canvas interactions: immediate, без тяжелой анимации.

## Easing

- Standard: `cubic-bezier(0.2, 0, 0, 1)`.
- Entrance: `cubic-bezier(0, 0, 0.2, 1)`.
- Exit: `cubic-bezier(0.4, 0, 1, 1)`.

## Запрещено

- тяжелые декоративные анимации;
- motion, мешающий keyboard-first flow;
- анимации, скрывающие state changes.

