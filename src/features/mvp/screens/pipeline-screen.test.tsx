// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { useRepositoryStore } from "@/shared/stores/repository-store";
import { usePipelineStore } from "@/shared/stores/pipeline-store";
import { demoSnapshot } from "@/shared/repositories/demo-data";
import { PipelineScreen } from "./pipeline-screen";

describe("PipelineScreen", () => {
  afterEach(() => {
    useRepositoryStore.setState({ snapshot: null, selectedProjectId: null });
    usePipelineStore.setState({ selectedNodeId: null, history: {} });
  });

  it("shows the node-count/edge-count summary for the real demo pipeline", () => {
    useRepositoryStore.setState({ snapshot: demoSnapshot, selectedProjectId: demoSnapshot.projects[0].id });
    render(<PipelineScreen />);
    expect(screen.getByText(/8 nodes/)).toBeInTheDocument();
    expect(screen.getByText(/8 edges/)).toBeInTheDocument();
  });

  it("shows a real, non-decorative Runtime panel for the selected llm node -- resolved model, prompt, and stage handler", () => {
    useRepositoryStore.setState({ snapshot: demoSnapshot, selectedProjectId: demoSnapshot.projects[0].id });
    usePipelineStore.setState({ selectedNodeId: "node_llm" });

    render(<PipelineScreen />);

    expect(screen.getByText("Runtime")).toBeInTheDocument();
    expect(screen.getByText(/Real LLM call via LLMProvider/)).toBeInTheDocument();
    expect(screen.getAllByText(/Reasoning LLM/).length).toBeGreaterThan(0);
    expect(screen.getByText(/prompt_call_summary/)).toBeInTheDocument();
    expect(screen.getByText(/v1\.0\.0/)).toBeInTheDocument();
  });

  it("shows an honest 'not resolved' warning instead of the resolved fields for a passthrough node with no model/prompt", () => {
    useRepositoryStore.setState({ snapshot: demoSnapshot, selectedProjectId: demoSnapshot.projects[0].id });
    usePipelineStore.setState({ selectedNodeId: "node_input" });

    render(<PipelineScreen />);

    expect(screen.getByText(/Passthrough \(deterministic, no model call\)/)).toBeInTheDocument();
    expect(screen.getAllByText("Не назначена").length + screen.getAllByText("Не назначен").length).toBeGreaterThan(0);
  });
});
