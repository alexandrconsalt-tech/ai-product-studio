"use client";

import { getDifferenceStatus, isGoldenDataset } from "./scoring";
import type { GoldenDatasetItem, HumanReview, ReviewRecord, SummaryRun } from "./types";

const RUNS_KEY = "summary_review_runs_v1";
const REVIEWS_KEY = "summary_review_human_reviews_v1";

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

export function getRuns(): SummaryRun[] {
  return readJson<SummaryRun[]>(RUNS_KEY, []);
}

export function getReviews(): HumanReview[] {
  return readJson<HumanReview[]>(REVIEWS_KEY, []);
}

export function saveRun(run: SummaryRun) {
  const runs = getRuns();
  const next = [run, ...runs.filter((item) => item.id !== run.id)];
  writeJson(RUNS_KEY, next);
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

