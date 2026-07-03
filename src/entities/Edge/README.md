# Edge

Edge описывает связь между Node внутри Pipeline.

Edge не зависит от React Flow и хранит только доменную связь: source, target, optional ports и optional condition.

Validation rules:

- `sourceNodeId` и `targetNodeId` обязательны;
- self-loop запрещается на уровне validation rules Pipeline;
- `condition` используется для routing и conditional pipeline.

