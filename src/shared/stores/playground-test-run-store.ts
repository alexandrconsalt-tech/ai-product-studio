"use client";

import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
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
const MAX_TRANSCRIPT_CHARS = 60_000;
const MAX_REPORT_JSON_CHARS = 120_000;
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function compactReport(report: unknown): unknown {
  try {
    if (JSON.stringify(report).length <= MAX_REPORT_JSON_CHARS) return report;

    const source = asRecord(report);
    const result = asRecord(source?.result);
    const stageReports = Array.isArray(source?.stageReports)
      ? source.stageReports.map((item) => {
          const entry = asRecord(item);
          const stage = asRecord(entry?.stage);
          const stageReport = asRecord(entry?.report);
          return {
            stage: stage ? { name: stage.name, outKey: stage.outKey, type: stage.type } : undefined,
            report: stageReport ? { status: stageReport.status, error: stageReport.error, meta: stageReport.meta } : undefined,
          };
        })
      : undefined;

    return {
      compacted: true,
      reason: "Полный отчёт сокращён для сохранения истории запуска в Local Storage.",
      usage: source?.usage,
      result: result
        ? {
            summary: result.summary,
            crm: result.crm,
            summary_quality_gate: result.summary_quality_gate,
            quality_gate: result.quality_gate,
            gate: result.gate,
            truth_check: result.truth_check,
            critical_facts_check: result.critical_facts_check,
            context_utility_check: result.context_utility_check,
            action_check: result.action_check,
            presentation_check: result.presentation_check,
          }
        : undefined,
      stageReports,
    };
  } catch {
    return { compacted: true, reason: "Полный отчёт не удалось сериализовать; основные показатели запуска сохранены." };
  }
}

function compactRun(run: PlaygroundTestRun): PlaygroundTestRun {
  return {
    ...run,
    transcript: run.transcript && run.transcript.length > MAX_TRANSCRIPT_CHARS
      ? `${run.transcript.slice(0, MAX_TRANSCRIPT_CHARS)}\n\n[Обрезано для локального хранения]`
      : run.transcript,
    report: compactReport(run.report),
  };
}

function keepNewestRuns(
  runsByProjectId: Readonly<Record<string, readonly PlaygroundTestRun[]>>,
  limit: number,
): Record<string, readonly PlaygroundTestRun[]> {
  const newest = Object.values(runsByProjectId)
    .flat()
    .sort((a, b) => new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime())
    .slice(0, limit);
  const result: Record<string, PlaygroundTestRun[]> = {};
  for (const run of newest) {
    result[run.projectId] = [...(result[run.projectId] ?? []), compactRun(run)];
  }
  return result;
}

function isQuotaExceeded(error: unknown): boolean {
  return error instanceof DOMException && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED");
}

function writeRunHistory(name: string, value: string): void {
  try {
    window.localStorage.setItem(name, value);
    return;
  } catch (error) {
    if (!isQuotaExceeded(error)) throw error;
  }

  try {
    const parsed = JSON.parse(value) as { state?: Record<string, unknown>; version?: number };
    const runsByProjectId = normalizeRunsByProjectId(parsed.state?.runsByProjectId);
    const totalRuns = Object.values(runsByProjectId).reduce((sum, runs) => sum + runs.length, 0);
    const retentionLimits = [totalRuns, 100, 50, 20, 10, 5, 1].filter((limit, index, values) => limit > 0 && values.indexOf(limit) === index);

    for (const limit of retentionLimits) {
      const compacted = JSON.stringify({
        ...parsed,
        state: { ...parsed.state, runsByProjectId: keepNewestRuns(runsByProjectId, limit) },
      });
      try {
        window.localStorage.setItem(name, compacted);
        return;
      } catch (error) {
        if (!isQuotaExceeded(error)) throw error;
      }
    }
  } catch (error) {
    if (!isQuotaExceeded(error) && !(error instanceof SyntaxError)) throw error;
  }
}

const resilientRunHistoryStorage: StateStorage = {
  getItem: (name) => window.localStorage.getItem(name),
  setItem: writeRunHistory,
  removeItem: (name) => window.localStorage.removeItem(name),
};

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
      storage: createJSONStorage(() => resilientRunHistoryStorage),
      partialize: (state) => ({ runsByProjectId: state.runsByProjectId }),
    },
  ),
);
