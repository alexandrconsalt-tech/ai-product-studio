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
const STORAGE_KEY = "ai-product-studio.playground-test-runs.v1";

type PlaygroundTestRunStore = Readonly<{
  runsByProjectId: Readonly<Record<string, readonly PlaygroundTestRun[]>>;
  recordRun: (run: PlaygroundTestRun) => void;
  getRuns: (projectId: string) => readonly PlaygroundTestRun[];
  refreshFromStorage: () => void;
}>;

function normalizeRunsByProjectId(value: unknown): Record<string, readonly PlaygroundTestRun[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, readonly PlaygroundTestRun[]> = {};
  for (const [projectId, runs] of Object.entries(value)) {
    if (!Array.isArray(runs)) continue;
    result[projectId] = runs.filter((run): run is PlaygroundTestRun => Boolean(run && typeof run === "object" && "id" in run && "projectId" in run)).slice(0, MAX_RUNS_PER_PROJECT);
  }
  return result;
}

function readPersistedRunsByProjectId(): Record<string, readonly PlaygroundTestRun[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { state?: { runsByProjectId?: unknown } };
    return normalizeRunsByProjectId(parsed.state?.runsByProjectId);
  } catch {
    return {};
  }
}

function mergeRunsByProjectId(
  first: Readonly<Record<string, readonly PlaygroundTestRun[]>>,
  second: Readonly<Record<string, readonly PlaygroundTestRun[]>>,
): Record<string, readonly PlaygroundTestRun[]> {
  const projectIds = new Set([...Object.keys(first), ...Object.keys(second)]);
  const result: Record<string, readonly PlaygroundTestRun[]> = {};
  for (const projectId of projectIds) {
    const byId = new Map<string, PlaygroundTestRun>();
    for (const run of [...(first[projectId] ?? []), ...(second[projectId] ?? [])]) {
      const existing = byId.get(run.id);
      if (!existing || new Date(run.finishedAt).getTime() >= new Date(existing.finishedAt).getTime()) {
        byId.set(run.id, run);
      }
    }
    result[projectId] = [...byId.values()].sort((a, b) => new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime()).slice(0, MAX_RUNS_PER_PROJECT);
  }
  return result;
}

export function withCappedRun(
  runsByProjectId: Readonly<Record<string, readonly PlaygroundTestRun[]>>,
  run: PlaygroundTestRun,
): Record<string, readonly PlaygroundTestRun[]> {
  const existing = runsByProjectId[run.projectId] ?? [];
  // Newest first, matching the convention already used by
  // playground-store.ts's addRun (prepends to Run history).
  const next = [run, ...existing.filter((item) => item.id !== run.id)].slice(0, MAX_RUNS_PER_PROJECT);
  return { ...runsByProjectId, [run.projectId]: next };
}

export const usePlaygroundTestRunStore = create<PlaygroundTestRunStore>()(
  persist(
    (set, get) => ({
      runsByProjectId: {},
      recordRun: (run) =>
        set((state) => {
          const latest = mergeRunsByProjectId(state.runsByProjectId, readPersistedRunsByProjectId());
          return { runsByProjectId: withCappedRun(latest, run) };
        }),
      getRuns: (projectId) => get().runsByProjectId[projectId] ?? [],
      refreshFromStorage: () => set((state) => ({ runsByProjectId: mergeRunsByProjectId(state.runsByProjectId, readPersistedRunsByProjectId()) })),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ runsByProjectId: state.runsByProjectId }),
    },
  ),
);
