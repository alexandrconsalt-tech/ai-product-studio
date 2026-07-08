"use client";

import { getDifferenceStatus, isGoldenDataset } from "./scoring";
import type { GoldenDatasetItem, HumanReview, ReviewRecord, SummaryRun } from "./types";

const RUNS_KEY = "summary_review_runs_v1";
const REVIEWS_KEY = "summary_review_human_reviews_v1";
const MAX_STORED_RUNS = 30;
const MAX_TEXT_CHARS = 60_000;
const MAX_SOURCE_JSON_CHARS = 120_000;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function trimText(value: string): string {
  return value.length > MAX_TEXT_CHARS ? `${value.slice(0, MAX_TEXT_CHARS)}\n\n[Обрезано для локального хранения]` : value;
}

function compactSourceRunJson(value: unknown): unknown {
  try {
    const json = JSON.stringify(value);
    if (json.length <= MAX_SOURCE_JSON_CHARS) return value;
    if (value && typeof value === "object") {
      const source = value as Record<string, unknown>;
      return {
        compacted: true,
        reason: "Полный pipeline_report.json слишком большой для localStorage. Summary, transcript, score и judges сохранены отдельно.",
        id: source.id ?? source.run_id ?? source.runId,
        created_at: source.created_at ?? source.createdAt ?? source.finishedAt ?? source.startedAt,
        summary: source.summary ?? source.final_summary,
        result: source.result && typeof source.result === "object"
          ? {
              summary: (source.result as Record<string, unknown>).summary,
              summary_quality_gate: (source.result as Record<string, unknown>).summary_quality_gate,
              quality_gate: (source.result as Record<string, unknown>).quality_gate,
            }
          : undefined,
      };
    }
  } catch {
    // Fall through to a minimal marker below.
  }
  return { compacted: true, reason: "Источник отчёта не удалось сохранить полностью в localStorage." };
}

function compactRun(run: SummaryRun): SummaryRun {
  return {
    ...run,
    transcript: trimText(run.transcript),
    summary: trimText(run.summary),
    sourceRunJson: compactSourceRunJson(run.sourceRunJson),
  };
}

function saveRunsCompact(runs: SummaryRun[]) {
  const compact = runs.slice(0, MAX_STORED_RUNS).map(compactRun);
  try {
    writeJson(RUNS_KEY, compact);
  } catch (error) {
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      window.localStorage.removeItem(RUNS_KEY);
      try {
        writeJson(RUNS_KEY, compact.slice(0, 5).map((run) => ({ ...run, sourceRunJson: compactSourceRunJson({}) })));
      } catch {
        // Summary Review must remain usable even when the browser storage is
        // already full from other app areas. The current run is still shown in
        // React state; only durable local history is skipped.
      }
      return;
    }
    throw error;
  }
}

export function getRuns(): SummaryRun[] {
  return readJson<SummaryRun[]>(RUNS_KEY, []);
}

export function getReviews(): HumanReview[] {
  return readJson<HumanReview[]>(REVIEWS_KEY, []);
}

export function saveRun(run: SummaryRun) {
  const runs = getRuns();
  const next = [compactRun(run), ...runs.filter((item) => item.id !== run.id).map(compactRun)];
  saveRunsCompact(next);
}

export function saveReview(review: HumanReview) {
  const reviews = getReviews();
  const next = [review, ...reviews.filter((item) => item.runId !== review.runId)];
  writeJson(REVIEWS_KEY, next);
}

export function getRun(runId: string): SummaryRun | undefined {
  return getRuns().find((run) => run.id === runId);
}

export function getReview(runId: string): HumanReview | undefined {
  return getReviews().find((review) => review.runId === runId);
}

export function getRecords(): ReviewRecord[] {
  const reviews = getReviews();
  return getRuns().map((run) => {
    const review = reviews.find((item) => item.runId === run.id);
    const difference = review ? Math.abs(run.aiScore - review.humanScore) : null;
    return {
      run,
      review,
      isGolden: isGoldenDataset(run, review),
      difference,
      differenceStatus: difference === null ? "Нет оценки" : getDifferenceStatus(difference),
      reviewStatus: review ? "Оценено" : "Не оценено",
    };
  });
}

export function getGoldenDataset(): GoldenDatasetItem[] {
  return getRecords()
    .filter((record) => record.isGolden && record.review)
    .map((record) => ({
      id: `golden-${record.run.id}`,
      runId: record.run.id,
      transcript: record.run.transcript,
      summary: record.run.summary,
      aiScore: record.run.aiScore,
      humanScore: record.review?.humanScore ?? 0,
      criteria: record.review?.criteriaJson ?? {},
      approvedBy: record.review?.reviewerName ?? "",
      createdAt: record.review?.createdAt ?? new Date().toISOString(),
    }));
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
