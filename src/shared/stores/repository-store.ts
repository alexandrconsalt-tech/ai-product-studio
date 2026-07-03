"use client";

import { create } from "zustand";
import type { RepositorySnapshot } from "@/shared/repositories/types";
import { projectRepository } from "@/shared/repositories/local-storage-repository";

type RepositoryState = Readonly<{
  snapshot: RepositorySnapshot | null;
  selectedProjectId: string | null;
  load: () => void;
  reset: () => void;
  setSnapshot: (snapshot: RepositorySnapshot) => void;
  selectProject: (projectId: string) => void;
}>;

const selectedProjectStorageKey = "ai-product-studio.selected-project-id.v1";

const readSelectedProjectId = (): string | null => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(selectedProjectStorageKey);
};

const writeSelectedProjectId = (projectId: string): void => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(selectedProjectStorageKey, projectId);
  }
};

export const useRepositoryStore = create<RepositoryState>((set) => ({
  snapshot: null,
  selectedProjectId: null,
  load: () => {
    const snapshot = projectRepository.load();
    const storedProjectId = readSelectedProjectId();
    const selectedProjectId = storedProjectId && snapshot.projects.some((project) => project.id === storedProjectId) ? storedProjectId : snapshot.projects[0]?.id ?? null;
    if (selectedProjectId) writeSelectedProjectId(selectedProjectId);
    set({ snapshot, selectedProjectId });
  },
  reset: () => {
    const snapshot = projectRepository.reset();
    const selectedProjectId = snapshot.projects[0]?.id ?? null;
    if (selectedProjectId) writeSelectedProjectId(selectedProjectId);
    set({ snapshot, selectedProjectId });
  },
  setSnapshot: (snapshot) => {
    projectRepository.save(snapshot);
    set((state) => ({
      snapshot,
      selectedProjectId: state.selectedProjectId && snapshot.projects.some((project) => project.id === state.selectedProjectId) ? state.selectedProjectId : snapshot.projects[0]?.id ?? null,
    }));
  },
  selectProject: (projectId) => {
    writeSelectedProjectId(projectId);
    set({ selectedProjectId: projectId });
  },
}));

