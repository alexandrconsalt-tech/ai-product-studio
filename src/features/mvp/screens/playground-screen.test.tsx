// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useRepositoryStore } from "@/shared/stores/repository-store";
import { usePlaygroundStore } from "@/shared/stores/playground-store";
import { useExecutionTraceStore } from "@/shared/stores/execution-trace-store";
import { demoSnapshot } from "@/shared/repositories/demo-data";
import { PlaygroundScreen } from "./playground-screen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("PlaygroundScreen", () => {
  afterEach(() => {
    useRepositoryStore.setState({ snapshot: null, selectedProjectId: null });
    usePlaygroundStore.setState({ selectedRunId: null });
    useExecutionTraceStore.setState({ tracesByRunId: {} });
  });

  it("disables the Execution Inspector button until a run with a recorded trace exists", () => {
    useRepositoryStore.setState({ snapshot: demoSnapshot, selectedProjectId: demoSnapshot.projects[0].id });
    render(<PlaygroundScreen />);
    expect(screen.getByRole("button", { name: /execution inspector/i })).toBeDisabled();
  });

  it("runs the real Pipeline Executor end to end and records a trace on completion", async () => {
    useRepositoryStore.setState({ snapshot: demoSnapshot, selectedProjectId: demoSnapshot.projects[0].id });
    render(<PlaygroundScreen />);

    fireEvent.click(screen.getByRole("button", { name: /run pipeline/i }));

    await waitFor(() => expect(screen.getByText("succeeded")).toBeInTheDocument(), { timeout: 10000 });
    expect(screen.getByRole("button", { name: /execution inspector/i })).not.toBeDisabled();
    expect(Object.keys(useExecutionTraceStore.getState().tracesByRunId)).toHaveLength(1);
  }, 10000);
});
