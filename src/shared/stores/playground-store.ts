"use client";

import { create } from "zustand";
import type { Run } from "@/entities/Run/model/types";
import { useRepositoryStore } from "./repository-store";

type PlaygroundStore = Readonly<{
  input: string;
  selectedRunId: string | null;
  setInput: (input: string) => void;
  selectRun: (runId: string | null) => void;
  addRun: (run: Run) => void;
}>;

export const usePlaygroundStore = create<PlaygroundStore>((set) => ({
  input: "Клиент просит интеграцию с CRM, хочет понять сроки внедрения, точность summary и стоимость пилота.",
  selectedRunId: null,
  setInput: (input) => set({ input }),
  selectRun: (runId) => set({ selectedRunId: runId }),
  addRun: (run) => {
    const repository = useRepositoryStore.getState();
    const snapshot = repository.snapshot;
    if (!snapshot) return;
    repository.setSnapshot({
      ...snapshot,
      runs: [run, ...snapshot.runs],
      projects: snapshot.projects.map((project) =>
        project.pipelineId === run.pipelineId ? { ...project, playgroundRunIds: [run.id, ...project.playgroundRunIds] } : project,
      ),
    });
    set({ selectedRunId: run.id });
  },
}));

