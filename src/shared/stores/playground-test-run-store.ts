"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { PlaygroundTestRun } from "@/entities/PlaygroundTestRun/model/types";

/**
 * Persisted the same way execution-trace-store.ts is (Zustand `persist`,
 * SSR-safe via createJSONStorage deferring localStorage access to client
 * hydration) -- this is Playground test history feeding Dashboard, so it
 * must survive a reload the same way a Run's own record does (§8.5/§8.6).
 *
 * Capped per-project (not globally) at MAX_RUNS_PER_PROJECT, oldest
 * evicted first, so one heavily-tested product can't starve another's
 * history out of localStorage.
 */
const MAX_RUNS_PER_PROJECT = 200;

type PlaygroundTestRunStore = Readonly<{
  runsByProjectId: Readonly<Record<string, readonly PlaygroundTestRun[]>>;
  recordRun: (run: PlaygroundTestRun) => void;
  getRuns: (projectId: string) => readonly PlaygroundTestRun[];
}>;

export function withCappedRun(
  runsByProjectId: Readonly<Record<string, readonly PlaygroundTestRun[]>>,
  run: PlaygroundTestRun,
): Record<string, readonly PlaygroundTestRun[]> {
  const existing = runsByProjectId[run.projectId] ?? [];
  // Newest first, matching the convention already used by
  // playground-store.ts's addRun (prepends to Run history).
  const next = [run, ...existing].slice(0, MAX_RUNS_PER_PROJECT);
  return { ...runsByProjectId, [run.projectId]: next };
}

export const usePlaygroundTestRunStore = create<PlaygroundTestRunStore>()(
  persist(
    (set, get) => ({
      runsByProjectId: {},
      recordRun: (run) => set((state) => ({ runsByProjectId: withCappedRun(state.runsByProjectId, run) })),
      getRuns: (projectId) => get().runsByProjectId[projectId] ?? [],
    }),
    {
      name: "ai-product-studio.playground-test-runs.v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ runsByProjectId: state.runsByProjectId }),
    },
  ),
);
