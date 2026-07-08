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

function pickObject(source: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  for (const key of keys) {
    const value = source[key];
    if (value && typeof value === "object") return value as Record<string, unknown>;
  }
  return {};
}

// Pipeline Lab v3's own fields (facts/needs/outcome, and since the
// stages-1-9 rework, conversation_store) are {value, confidence, evidence,
// verification_status} objects, not flat strings/arrays -- but a report
// from before that rework could still have a flat value. Support both so
// old and new pipeline_report.json exports import the same way.
function pickFieldValue(container: Record<string, unknown>, field: string): unknown {
  const raw = container[field];
  if (raw && typeof raw === "object" && "value" in (raw as Record<string, unknown>)) {
    return (raw as Record<string, unknown>).value;
  }
  return raw;
}

// Prefers Conversation Store (verified data, the pipeline's own source of
// truth for Summary) over the raw, pre-verification Fact Agent output --
// falls back to the older flat top-level fields for reports predating both.
function pickClientName(merged: Record<string, unknown>): string {
  const store = pickObject(merged, ["conversation_store"]);
  const storeFacts = pickObject(store, ["facts"]);
  const storeValue = pickFieldValue(storeFacts, "client_name");
  if (typeof storeValue === "string" && storeValue.trim()) return storeValue;

  const facts = pickObject(merged, ["facts"]);
  const factsValue = pickFieldValue(facts, "client_name");
  if (typeof factsValue === "string" && factsValue.trim()) return factsValue;

  return pickString(merged, ["client_name", "clientName", "client", "customer_name"], "Клиент не указан");
}

// The Summary Agent's own output contract is `{"summary": "..."}` (an
// object), not a bare string -- see public/pipeline-lab-v3.html's Summary
// Agent stage schema.
function pickSummaryText(merged: Record<string, unknown>): string {
  const summary = merged.summary;
  if (summary && typeof summary === "object") {
    const text = (summary as Record<string, unknown>).summary;
    if (typeof text === "string" && text.trim()) return text;
  }
  return pickString(merged, ["summary", "final_summary", "finalSummary", "ai_summary"], "");
}

// The 5 post-summary judges are 5 separate top-level ctx keys
// (truth_check/critical_facts_check/context_utility_check/action_check/
// presentation_check), never one combined "judges" bag -- bundle them here
// so downstream review/report screens have a single object to read.
function pickJudgesBag(merged: Record<string, unknown>): Record<string, unknown> {
  const judgeKeys = ["truth_check", "critical_facts_check", "context_utility_check", "action_check", "presentation_check"];
  const bag: Record<string, unknown> = {};
  for (const key of judgeKeys) {
    const value = merged[key];
    if (value && typeof value === "object") bag[key] = value;
  }
  if (Object.keys(bag).length) return bag;
  return pickObject(merged, ["ai_judges", "aiJudges", "judges", "judge_results", "quality_gates"]);
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

  // The Quality Orchestrator's output (score/decision) is `ctx.summary_quality_gate`
  // (or the legacy `ctx.gate`), never a flat top-level field -- see
  // public/pipeline-lab-v3.html's summaryQualityGate()/gate() codeFns.
  const gate = pickObject(merged, ["summary_quality_gate", "gate"]);
  const hasGate = Object.keys(gate).length > 0;

  return {
    id,
    createdAt:
      pickString(merged, ["created_at", "createdAt", "timestamp", "date", "finishedAt", "startedAt"], "") ||
      new Date().toISOString(),
    clientName: pickClientName(merged),
    transcript: pickString(merged, ["transcript", "transcription", "dialogue", "call_transcript", "__transcript"], ""),
    summary: pickSummaryText(merged),
    aiScore: hasGate
      ? pickNumber(gate, ["summary_quality_score"], 0)
      : pickNumber(merged, ["ai_score", "aiScore", "quality_score", "summary_quality_score"], 0),
    aiDecision: (hasGate
      ? pickString(gate, ["decision"], "MANUAL_REVIEW")
      : pickString(merged, ["ai_decision", "aiDecision", "decision"], "MANUAL_REVIEW")) as AiDecision,
    aiJudgesJson: pickJudgesBag(merged),
    sourceRunJson: input ?? {},
  };
}

