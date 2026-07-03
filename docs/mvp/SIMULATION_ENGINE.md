# Simulation Engine

## Назначение

Simulation Engine заменяет настоящий AI Runtime в MVP.

Он не подключает OpenAI или другие providers.

## Flow

```text
Input -> Pipeline Nodes -> Output -> Logs -> Metrics -> Run History
```

## Output

Simulation создает:

- structured output;
- execution logs;
- tokens;
- cost;
- latency;
- duration.

## Замена в будущем

Настоящий Runtime должен заменить `simulatePipelineRun()` при сохранении интерфейса Playground Store и Repository.

