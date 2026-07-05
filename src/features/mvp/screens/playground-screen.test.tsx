// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useRepositoryStore } from "@/shared/stores/repository-store";
import { usePlaygroundTestRunStore } from "@/shared/stores/playground-test-run-store";
import { demoSnapshot } from "@/shared/repositories/demo-data";
import { PlaygroundScreen } from "./playground-screen";

describe("PlaygroundScreen", () => {
  afterEach(() => {
    useRepositoryStore.setState({ snapshot: null, selectedProjectId: null });
    usePlaygroundTestRunStore.setState({ runsByProjectId: {} });
  });

  it("shows the product picker and scopes the Pipeline Lab v3 iframe to the selected product", () => {
    const [firstProject, secondProject] = demoSnapshot.projects;
    useRepositoryStore.setState({ snapshot: demoSnapshot, selectedProjectId: firstProject.id });
    render(<PlaygroundScreen />);

    const picker = screen.getByRole("combobox", { name: "Выбрать продукт" }) as HTMLSelectElement;
    expect(screen.getByRole("option", { name: firstProject.name })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: secondProject.name })).toBeInTheDocument();
    const iframe = screen.getByTitle("Pipeline Lab v3") as HTMLIFrameElement;
    const iframeUrl = new URL(iframe.src);
    expect(iframeUrl.searchParams.get("productId")).toBe(firstProject.id);
    expect(iframeUrl.searchParams.get("productName")).toBe(firstProject.name);

    fireEvent.change(picker, { target: { value: secondProject.id } });
    expect(useRepositoryStore.getState().selectedProjectId).toBe(secondProject.id);
  });

  it("records a PlaygroundTestRun when the iframe reports run completion for the selected product", () => {
    const project = demoSnapshot.projects[0];
    useRepositoryStore.setState({ snapshot: demoSnapshot, selectedProjectId: project.id });
    render(<PlaygroundScreen />);

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            source: "pipeline-lab-v3",
            type: "run-complete",
            productId: project.id,
            payload: {
              startedAt: "2026-07-05T10:00:00.000Z",
              finishedAt: "2026-07-05T10:00:05.000Z",
              durationMs: 5000,
              stageCount: 10,
              errorCount: 0,
              warningCount: 0,
              tokens: 1200,
              costUsd: 0.012,
              status: "succeeded",
              confidence: 0.9,
              qualityScore: 92,
              decision: "AUTO_SAVE",
            },
          },
        }),
      );
    });

    const runs = usePlaygroundTestRunStore.getState().getRuns(project.id);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ projectId: project.id, status: "succeeded", costUsd: 0.012, qualityScore: 92 });
  });
});
