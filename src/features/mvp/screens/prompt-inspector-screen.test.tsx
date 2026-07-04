// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useRepositoryStore } from "@/shared/stores/repository-store";
import { demoSnapshot } from "@/shared/repositories/demo-data";
import { PromptInspectorScreen } from "./prompt-inspector-screen";

describe("PromptInspectorScreen", () => {
  beforeEach(() => {
    useRepositoryStore.setState({ snapshot: demoSnapshot, selectedProjectId: demoSnapshot.projects[0].id });
  });

  afterEach(() => {
    useRepositoryStore.setState({ snapshot: null, selectedProjectId: null });
  });

  it("lists every prompt registered in the Prompt Registry", () => {
    render(<PromptInspectorScreen />);
    expect(screen.getByText("prompt_call_summary")).toBeInTheDocument();
    expect(screen.getByText("prompt_quality_check")).toBeInTheDocument();
    expect(screen.getByText("prompt_lead_qualification")).toBeInTheDocument();
    expect(screen.getByText("prompt_chat_classification")).toBeInTheDocument();
  });

  it("shows the first prompt's real template by default (no hydration-mismatch placeholder)", () => {
    render(<PromptInspectorScreen />);
    expect(screen.getByText(/анализируешь транскрипт/i)).toBeInTheDocument();
  });

  it("switches the detail panel when a different prompt is selected", () => {
    render(<PromptInspectorScreen />);
    fireEvent.click(screen.getByText("prompt_lead_qualification"));
    expect(screen.getByText(/оцениваешь входящий лид/i)).toBeInTheDocument();
  });

  it("renders extracted template variables as badges", () => {
    render(<PromptInspectorScreen />);
    expect(screen.getByText("{{transcript}}")).toBeInTheDocument();
  });
});
