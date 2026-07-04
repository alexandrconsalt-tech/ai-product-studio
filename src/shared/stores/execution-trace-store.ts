"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ExecutionEvent } from "@/shared/runtime/types";

/**
 * Persisted to localStorage (v2.0, ADR-worthy: this is the first
 * store in the repository to use Zustand's `persist` middleware --
 * §8.5 previously stated "no middleware" for every store; that claim
 * is now only true for the other six). Reason for the change: a
 * `Run` itself survives a reload (`RepositorySnapshot`, §8.6), but
 * until now its ExecutionTrace did not -- reloading the page silently
 * emptied the Execution Inspector/Analytics for any already-completed
 * run, which was the single most confusing gap found in the
 * Iteration 25 v2.0 audit. `createJSONStorage` defers all
 * `localStorage` access to client-side hydration, so this stays
 * SSR-safe the same way `LocalStorageProjectRepository` is (§45 NX-4)
 * without an explicit `typeof window` check here.
 *
 * Capped at `MAX_TRACES` most-recently-recorded runs (evicting the
 * oldest by insertion order) -- unbounded growth was fine for an
 * in-memory session store but not for something written to
 * localStorage on every run.
 */
const MAX_TRACES = 20;

type ExecutionTraceStore = Readonly<{
  tracesByRunId: Readonly<Record<string, readonly ExecutionEvent[]>>;
  recordTrace: (runId: string, events: readonly ExecutionEvent[]) => void;
  getTrace: (runId: string) => readonly ExecutionEvent[] | undefined;
}>;

export function withCappedTrace(
  tracesByRunId: Readonly<Record<string, readonly ExecutionEvent[]>>,
  runId: string,
  events: readonly ExecutionEvent[],
): Record<string, readonly ExecutionEvent[]> {
  const withoutRun = Object.fromEntries(Object.entries(tracesByRunId).filter(([id]) => id !== runId));
  const runIds = Object.keys(withoutRun);
  const overflow = runIds.length + 1 - MAX_TRACES;
  const trimmed = overflow > 0 ? Object.fromEntries(Object.entries(withoutRun).slice(overflow)) : withoutRun;
  return { ...trimmed, [runId]: events };
}

export const useExecutionTraceStore = create<ExecutionTraceStore>()(
  persist(
    (set, get) => ({
      tracesByRunId: {},
      recordTrace: (runId, events) => set((state) => ({ tracesByRunId: withCappedTrace(state.tracesByRunId, runId, events) })),
      getTrace: (runId) => get().tracesByRunId[runId],
    }),
    {
      name: "ai-product-studio.execution-traces.v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ tracesByRunId: state.tracesByRunId }),
    },
  ),
);
