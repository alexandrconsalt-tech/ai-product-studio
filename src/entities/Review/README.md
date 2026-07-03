# Review

Review хранит результат проверки качества Product, Architecture, Pipeline, Run, Project или Prompt (`prompt` добавлен 2026-07-03, закрывает gap из CLAUDE.md §16/§63 пункт 7).

Validation rules:

- `score` находится в диапазоне 0-100;
- blocking issue должен препятствовать переходу Quality Gate;
- `reviewerModuleId` связывает Review с KnowledgeModule;
- Prompt referenced by a non-draft Pipeline should have a corresponding `Review{targetType: "prompt"}` — this is not yet enforced in code (no runtime gate), only representable in the schema.

