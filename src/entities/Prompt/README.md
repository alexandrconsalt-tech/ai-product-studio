# Prompt

Prompt описывает поведение AI как сущность, но не хранит полный текст prompt.

Lifecycle: `draft -> in_progress -> review -> ready -> completed -> archived` (переиспользует `LifecycleStatusSchema`, как Product/Architecture/Pipeline — добавлено 2026-07-03, закрывает gap из CLAUDE.md §16/§63 пункт 7).

Validation rules:

- `purpose` фиксирует назначение;
- `description` объясняет поведение;
- `status` определяет, готов ли prompt быть referenced непустым (non-draft) Pipeline — see `Review.targetType: "prompt"` для gating;
- `ownerModuleId` связывает prompt с KnowledgeModule, если применимо.

