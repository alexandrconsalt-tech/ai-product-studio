"use client";

import { create } from "zustand";
import type { ExecutionEvent } from "@/shared/runtime/types";

/**
 * Session-only store of raw ExecutionEvent streams, keyed by Run.id.
 * Deliberately NOT persisted to localStorage (unlike
 * RepositorySnapshot) and not a new domain entity/schema change --
 * this is UI-session telemetry for the Execution Inspector, not
 * something that needs to survive a reload or be shared across
 * devices. A Run created in an earlier session (e.g. the seeded
 * `run_demo_seed`) simply has no trace here; the Inspector must
 * handle that as an explicit "no trace available" state, not an error.
 */
type ExecutionTraceStore = Readonly<{
  tracesByRunId: Readonly<Record<string, readonly ExecutionEvent[]>>;
  recordTrace: (runId: string, events: readonly ExecutionEvent[]) => void;
  getTrace: (runId: string) => readonly ExecutionEvent[] | undefined;
}>;

export const useExecutionTraceStore = create<ExecutionTraceStore>((set, get) => ({
  tracesByRunId: {},
  recordTrace: (runId, events) => set((state) => ({ tracesByRunId: { ...state.tracesByRunId, [runId]: events } })),
  getTrace: (runId) => get().tracesByRunId[runId],
}));
