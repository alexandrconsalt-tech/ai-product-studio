# Model

Model описывает используемую AI-модель как доменную сущность.

Сущность не хранит секреты, ключи доступа или provider-specific runtime config.

Validation rules:

- `provider` должен быть известным;
- `capabilities` описывают назначение модели;
- `contextWindow` указывается только если известно.

