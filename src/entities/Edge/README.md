# Edge

Edge описывает связь между Node внутри Pipeline.

Edge не зависит от React Flow и хранит только доменную связь: source, target, optional ports и optional condition.

Validation rules:

- `sourceNodeId` и `targetNodeId` обязательны;
- self-loop запрещается на уровне validation rules Pipeline;
- `condition` используется для routing и conditional pipeline; с 2026-07-03 это структурная форма `{field, operator, value, description?}` (`operator` из `eq|neq|gt|gte|lt|lte`), а не свободная строка-expression — закрывает gap из CLAUDE.md §14.2/§63 пункт 6.

