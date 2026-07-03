# Node

Node описывает универсальный шаг AI Pipeline.

Node не зависит от React Flow, UI, canvas или layout engine. Поле `position` является optional доменным layout hint, а не React Flow model.

Типы:

- Agent
- LLM
- Function
- Router
- Tool
- Store
- Validation
- Human Review
- Input
- Output

Validation rules:

- `type` выбирается из фиксированного списка;
- `inputPorts` и `outputPorts` описывают контракты;
- `modelId` допустим для AI-связанных node;
- `promptId` допустим для AI-связанных node.
- `temperature`, `tools` и `metadata` используются Inspector и Runtime, но не содержат UI-state.
