// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { useRepositoryStore } from "@/shared/stores/repository-store";
import { usePlaygroundStore } from "@/shared/stores/playground-store";
import { useExecutionTraceStore } from "@/shared/stores/execution-trace-store";
import { demoSnapshot } from "@/shared/repositories/demo-data";
import { executePipeline } from "@/shared/runtime/pipeline-executor";
import { realStageRegistry } from "@/shared/runtime/real-stage";
import { defaultLLMProviderRegistry } from "@/shared/llm/provider-registry";
import { seededPromptRegistry } from "@/shared/prompts/seed-prompts";
import type { ExecutionEvent } from "@/shared/runtime/types";
import { ExecutionInspectorScreen } from "./execution-inspector-screen";

describe("ExecutionInspectorScreen", () => {
  afterEach(() => {
    useRepositoryStore.setState({ snapshot: null, selectedProjectId: null });
    usePlaygroundStore.setState({ selectedRunId: null });
    useExecutionTraceStore.setState({ tracesByRunId: {} });
  });

  it("shows an explicit empty state, not an error, when the selected run has no recorded trace", () => {
    useRepositoryStore.setState({ snapshot: demoSnapshot, selectedProjectId: demoSnapshot.projects[0].id });
    render(<ExecutionInspectorScreen />);
    expect(screen.getByText(/нет сохранённого execution trace/i)).toBeInTheDocument();
  });

  it("renders Score/Health/Timeline for a real, freshly-executed run with a recorded trace", async () => {
    const pipeline = demoSnapshot.pipelines[0];
    const registry = realStageRegistry({ llmProviders: defaultLLMProviderRegistry, prompts: seededPromptRegistry, models: demoSnapshot.models });
    const events: ExecutionEvent[] = [];
    const run = await executePipeline(pipeline, "Клиент интересуется CRM-интеграцией.", { registry, onEvent: (e) => events.push(e) });

    useRepositoryStore.setState({
      snapshot: {
        ...demoSnapshot,
        runs: [run, ...demoSnapshot.runs],
        projects: demoSnapshot.projects.map((project) =>
          project.pipelineId === run.pipelineId ? { ...project, playgroundRunIds: [run.id, ...project.playgroundRunIds] } : project,
        ),
      },
      selectedProjectId: demoSnapshot.projects[0].id,
    });
    usePlaygroundStore.setState({ selectedRunId: run.id });
    useExecutionTraceStore.setState({ tracesByRunId: { [run.id]: events } });

    render(<ExecutionInspectorScreen />);

    expect(screen.getByText("Execution Inspector")).toBeInTheDocument();
    expect(screen.getByText(/\/100/)).toBeInTheDocument();
    expect(screen.getByText("Timeline")).toBeInTheDocument();
    expect(screen.getByText("Need Extractor")).toBeInTheDocument();
  });
});
