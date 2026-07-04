// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useRepositoryStore } from "@/shared/stores/repository-store";
import { useExecutionTraceStore } from "@/shared/stores/execution-trace-store";
import { demoSnapshot } from "@/shared/repositories/demo-data";
import { AnalyticsScreen } from "./analytics-screen";

describe("AnalyticsScreen", () => {
  afterEach(() => {
    useRepositoryStore.setState({ snapshot: null, selectedProjectId: null });
    useExecutionTraceStore.setState({ tracesByRunId: {} });
  });

  it("shows real Cost Analytics numbers derived from the seeded demo run", () => {
    useRepositoryStore.setState({ snapshot: demoSnapshot, selectedProjectId: demoSnapshot.projects[0].id });
    render(<AnalyticsScreen />);

    expect(screen.getByText("Cost Analytics")).toBeInTheDocument();
    expect(screen.getAllByText("$0.0320").length).toBeGreaterThan(0);
  });

  it("honestly shows Golden Dataset Evaluation as unavailable for a pipeline with no dataset", () => {
    useRepositoryStore.setState({ snapshot: demoSnapshot, selectedProjectId: demoSnapshot.projects[1].id });
    render(<AnalyticsScreen />);
    expect(screen.getByText(/ещё не создан Golden Dataset/i)).toBeInTheDocument();
  });

  it("runs the Golden Dataset evaluation end to end and reports a real (mock-provider) pass rate", async () => {
    useRepositoryStore.setState({ snapshot: demoSnapshot, selectedProjectId: demoSnapshot.projects[0].id });
    render(<AnalyticsScreen />);

    fireEvent.click(screen.getByRole("button", { name: /run evaluation/i }));

    await waitFor(() => expect(screen.getByText(/passed \(/)).toBeInTheDocument(), { timeout: 10000 });
    // Mock LLM Provider output never matches CallAnalysisSummarySchema (evaluate.test.ts's
    // own "honestly reports failures" case) -- 0% here is correct, not a broken test.
    expect(screen.getByText(/0% ожидаемо при Mock LLM Provider/)).toBeInTheDocument();
  }, 10000);
});
