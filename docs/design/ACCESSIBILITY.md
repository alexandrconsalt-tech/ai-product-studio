# Accessibility

## Требования

- Все interactive элементы имеют focus visible.
- IconButton имеет `aria-label`.
- Dialog использует `role="dialog"`.
- Alert/Error State используют `role="alert"` или `role="status"`.
- Цвет не является единственным способом передачи статуса.
- Disabled state визуально и семантически понятен.

## Keyboard Support

- Navigation Item доступен через keyboard.
- Button и IconButton работают через Enter/Space.
- Tabs используют `role="tablist"` и `role="tab"`.
- Command Palette должна поддерживать keyboard navigation на application layer.

## Contrast

Компоненты используют theme tokens, настроенные для readable contrast в light и dark theme.

