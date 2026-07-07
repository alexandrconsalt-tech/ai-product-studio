import type { AiDecision, SummaryRun } from "./types";

function pickString(source: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}

function pickNumber(source: Record<string, unknown>, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return fallback;
}

function pickObject(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (value && typeof value === "object") return value;
  }
  return {};
}

export function normalizePlaygroundRun(input: unknown): SummaryRun {
  const source = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const nested = {
    ...(source.pipeline_report && typeof source.pipeline_report === "object" ? source.pipeline_report : {}),
    ...(source.result && typeof source.result === "object" ? source.result : {}),
    ...(source.output && typeof source.output === "object" ? source.output : {}),
  } as Record<string, unknown>;
  const merged = { ...nested, ...source };

  const id =
    pickString(merged, ["run_id", "runId", "id", "execution_id"], "") ||
    `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;

  return {
    id,
    createdAt:
      pickString(merged, ["created_at", "createdAt", "timestamp", "date"], "") || new Date().toISOString(),
    clientName: pickString(merged, ["client_name", "clientName", "client", "customer_name"], "Клиент не указан"),
    transcript: pickString(merged, ["transcript", "transcription", "dialogue", "call_transcript"], ""),
    summary: pickString(merged, ["summary", "final_summary", "finalSummary", "ai_summary"], ""),
    aiScore: pickNumber(merged, ["ai_score", "aiScore", "quality_score", "summary_quality_score"], 0),
    aiDecision: pickString(merged, ["ai_decision", "aiDecision", "decision"], "MANUAL_REVIEW") as AiDecision,
    aiJudgesJson: pickObject(merged, ["ai_judges", "aiJudges", "judges", "judge_results", "quality_gates"]),
    sourceRunJson: input ?? {},
  };
}

