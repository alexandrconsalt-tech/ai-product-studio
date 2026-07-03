# Review

Review хранит результат проверки качества Product, Architecture, Pipeline, Run или Project.

Validation rules:

- `score` находится в диапазоне 0-100;
- blocking issue должен препятствовать переходу Quality Gate;
- `reviewerModuleId` связывает Review с KnowledgeModule.

