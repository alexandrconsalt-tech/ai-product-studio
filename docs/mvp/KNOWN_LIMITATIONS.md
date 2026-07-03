# Known Limitations

## Не реализовано в MVP

- настоящий AI Runtime;
- OpenAI API;
- Backend;
- Authentication;
- Multi-user;
- Cloud Sync;
- Billing;
- Production Runtime;
- Marketplace.

## UX ограничения

- Navigation использует query parameter `view`.
- Pipeline editing поддерживает базовые операции и undo/redo history в рамках текущей сессии.
- Rename/Delete/Duplicate Project используют modal dialogs.
- Undo/Redo history хранится в памяти приложения и не восстанавливается после reload.

## Engineering ограничения

- Local Storage Repository предназначен для demo persistence.
- Simulation metrics являются расчетными.
- React Flow используется как UI adapter, Domain Pipeline остается источником правды.
