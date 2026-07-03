"use client";

import * as React from "react";
import { Play } from "lucide-react";
import { Button, Card, EmptyState, Page, Section, Textarea, Badge, Status } from "@/shared/ui";
import { useRepositoryStore } from "@/shared/stores/repository-store";
import { usePlaygroundStore } from "@/shared/stores/playground-store";
import { executePipeline } from "@/shared/runtime/pipeline-executor";
import { realStageRegistry } from "@/shared/runtime/real-stage";
import { defaultLLMProviderRegistry } from "@/shared/llm/provider-registry";
import { seededPromptRegistry } from "@/shared/prompts/seed-prompts";
import { getProjectBundle } from "../selectors";

function stringifyOutput(output: unknown): string {
  return JSON.stringify(output, null, 2);
}

export function PlaygroundScreen() {
  const { snapshot, selectedProjectId } = useRepositoryStore();
  const { input, setInput, selectedRunId, selectRun, addRun } = usePlaygroundStore();
  const { pipeline, runs } = getProjectBundle(snapshot, selectedProjectId);
  const [executing, setExecuting] = React.useState(false);
  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null;

  if (!pipeline) {
    return <EmptyState>Playground станет доступен после Pipeline Complete gate.</EmptyState>;
  }

  const handleRun = () => {
    setExecuting(true);
    // Real Production Pipeline Runtime (src/shared/runtime), replacing
    // the Simulation Engine here per the "gradually replace" plan --
    // this is the first (and so far only) screen wired to it. Stage
    // handlers still use LLMProvider's default mock (see
    // src/shared/llm/provider-registry.ts) unless OPENAI_API_KEY is
    // configured server-side, so this remains a real executor with a
    // fake model call by default, not a real LLM integration.
    const registry = realStageRegistry({
      llmProviders: defaultLLMProviderRegistry,
      prompts: seededPromptRegistry,
      models: snapshot?.models ?? [],
    });
    executePipeline(pipeline, input, { registry, projectId: pipeline.projectId })
      .then((run) => addRun(run))
      .finally(() => setExecuting(false));
  };

  const tokens = selectedRun?.metrics.find((metric) => metric.name === "tokens")?.value ?? 0;
  // Derived from latencyMs rather than a separate "duration" metric --
  // the Runtime's stage handlers only report latency once (as
  // "latency"), not redundantly under two different metric names.
  const duration = Math.round(((selectedRun?.latencyMs ?? 0) / 100)) / 10;

  return (
    <Page className="max-w-none">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Playground</h1>
          <p className="text-sm text-text-muted">Pipeline Executor выполняет граф пайплайна по узлам; модель по умолчанию — mock LLM provider (без реального AI-вызова).</p>
        </div>
        <Button variant="primary" onClick={handleRun} disabled={executing || !input.trim()}>
          <Play className="size-4" aria-hidden="true" />
          {executing ? "Execution" : "Run Pipeline"}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="grid gap-3">
          <h2 className="text-lg font-semibold">Input</h2>
          <Textarea className="min-h-56" value={input} onChange={(event) => setInput(event.target.value)} />
        </Card>
        <Card className="grid gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Output</h2>
            {selectedRun ? <Status tone={selectedRun.status === "succeeded" ? "success" : "warning"}>{selectedRun.status}</Status> : null}
          </div>
          <pre className="min-h-56 overflow-auto rounded-md bg-muted p-3 text-sm text-foreground">{selectedRun ? stringifyOutput(selectedRun.output) : "Run отсутствует"}</pre>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><p className="text-xs text-text-muted">Tokens</p><p className="text-xl font-semibold">{tokens}</p></Card>
        <Card><p className="text-xs text-text-muted">Cost</p><p className="text-xl font-semibold">${selectedRun?.costUsd?.toFixed(4) ?? "0.0000"}</p></Card>
        <Card><p className="text-xs text-text-muted">Latency</p><p className="text-xl font-semibold">{selectedRun?.latencyMs ?? 0} ms</p></Card>
        <Card><p className="text-xs text-text-muted">Duration</p><p className="text-xl font-semibold">{duration}s</p></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Execution Log</h2>
          <div className="grid gap-2">
            {(selectedRun?.logs ?? []).map((log, index) => (
              <div key={`${log.timestamp}-${index}`} className="flex items-center gap-2 text-sm">
                <Badge tone={log.level === "error" ? "error" : log.level === "warning" ? "warning" : "neutral"}>{log.level}</Badge>
                <span className="text-text-muted">{log.message}</span>
              </div>
            ))}
          </div>
        </Card>
        <Section>
          <h2 className="text-lg font-semibold">Run History</h2>
          <div className="grid gap-2">
            {runs.map((run) => (
              <button key={run.id} type="button" className="rounded-lg border border-border bg-surface p-3 text-left text-sm hover:bg-hover" onClick={() => selectRun(run.id)}>
                <p className="font-medium">{run.id}</p>
                <p className="text-text-muted">{run.latencyMs} ms · ${run.costUsd?.toFixed(4) ?? "0.0000"}</p>
              </button>
            ))}
          </div>
        </Section>
      </div>
    </Page>
  );
}

