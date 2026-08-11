import type { AiDecision, SummaryRun } from "./types";

export type SummarySections = {
  conversationResult: string;
  keyFacts: string[];
  quotes: string[];
  nextSteps: string[];
};

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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function pickArray(source: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function nestedRecord(source: Record<string, unknown>, path: string[]): Record<string, unknown> {
  let current: unknown = source;
  for (const key of path) {
    const record = asRecord(current);
    if (!record) return {};
    current = record[key];
  }
  return asRecord(current) ?? {};
}

function nestedString(source: Record<string, unknown>, paths: string[][]): string {
  for (const path of paths) {
    const parent = nestedRecord(source, path.slice(0, -1));
    const value = parent[path[path.length - 1]];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

function pickTextArray(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) return [value.trim()];
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string" && item.trim()) return [item.trim()];
    const record = asRecord(item);
    if (!record) return [];
    const label = pickString(record, ["label", "name"], "");
    const text = pickString(record, ["value", "text", "summary"], "");
    return text ? [`${label ? `${label}: ` : ""}${text}`] : [];
  });
}

function sectionsFromObject(summary: Record<string, unknown>): SummarySections | null {
  const conversationResult = pickString(summary, ["conversation_result", "overview", "summary"], "");
  if (!conversationResult) return null;
  const hasStructuredFields = ["conversation_result", "overview", "key_facts", "quotes", "next_steps", "agreements", "agreement_next_step", "next_step"]
    .some((key) => key in summary);
  if (!hasStructuredFields && /^Итог разговора\s*$/im.test(conversationResult)) {
    return parseFormattedSummary(conversationResult);
  }
  return {
    conversationResult,
    keyFacts: pickTextArray(summary.key_facts),
    quotes: pickTextArray(summary.quotes),
    nextSteps: [
      ...pickTextArray(summary.next_steps),
      ...pickTextArray(summary.agreements),
      ...pickTextArray(summary.agreement_next_step),
      ...pickTextArray(summary.next_step),
    ],
  };
}

function summaryObjectCandidates(source: Record<string, unknown>): Record<string, unknown>[] {
  const reportJson = asRecord(source.report_json) ?? {};
  const pipelineReport = asRecord(source.pipeline_report) ?? {};
  const reportResult = asRecord(reportJson.result) ?? {};
  const sourceResult = asRecord(source.result) ?? {};
  const candidates = [source.summary, reportResult.summary, sourceResult.summary, pipelineReport.summary]
    .map(asRecord)
    .filter((value): value is Record<string, unknown> => Boolean(value));

  const run = asRecord(reportJson.run) ?? asRecord(source.run);
  const stages = Array.isArray(run?.stages) ? run.stages : [];
  for (const item of stages) {
    const stage = asRecord(item);
    if (stage?.stage_id === "summary_generator") {
      const output = asRecord(stage.output);
      if (output) candidates.push(output);
    }
  }
  return candidates;
}

function parseFormattedSummary(value: string): SummarySections {
  const headings = [
    { key: "conversationResult", pattern: "Итог разговора" },
    { key: "keyFacts", pattern: "Ключевые факты" },
    { key: "quotes", pattern: "(?:Важная цитата|Важные цитаты|Цитаты)" },
    { key: "nextSteps", pattern: "(?:Договорённости\\s*(?:\\/|и)\\s*следующий шаг|Договоренности\\s*(?:\\/|и)\\s*следующий шаг)" },
  ] as const;
  const matches = headings.flatMap((heading) => {
    const match = new RegExp(`(?:^|\\n)${heading.pattern}\\s*\\n+`, "i").exec(value);
    return match ? [{ ...heading, index: match.index + (match[0].startsWith("\n") ? 1 : 0), contentStart: match.index + match[0].length }] : [];
  }).sort((a, b) => a.index - b.index);
  if (!matches.length) return { conversationResult: value.trim(), keyFacts: [], quotes: [], nextSteps: [] };

  const sections: SummarySections = { conversationResult: "", keyFacts: [], quotes: [], nextSteps: [] };
  matches.forEach((match, index) => {
    const content = value.slice(match.contentStart, matches[index + 1]?.index ?? value.length).trim();
    if (match.key === "conversationResult") sections.conversationResult = content;
    else sections[match.key] = content.split(/\n+/).map((item) => item.replace(/^[•\-]\s*/, "").replace(/^«|»$/g, "").trim()).filter(Boolean);
  });
  return sections;
}

export function getSummarySections(input: unknown, fallback = ""): SummarySections {
  const source = asRecord(input) ?? {};
  for (const candidate of summaryObjectCandidates(source)) {
    const sections = sectionsFromObject(candidate);
    if (sections) return sections;
  }
  return parseFormattedSummary(fallback);
}

export function formatSummarySections(sections: SummarySections): string {
  return [
    `Итог разговора\n${sections.conversationResult || "Не указано"}`,
    `Ключевые факты\n${sections.keyFacts.length ? sections.keyFacts.map((item) => `• ${item}`).join("\n") : "Не указаны"}`,
    `Цитаты\n${sections.quotes.length ? sections.quotes.map((item) => `• «${item.replace(/^«|»$/g, "")}»`).join("\n") : "Не указаны"}`,
    `Договорённости и следующий шаг\n${sections.nextSteps.length ? sections.nextSteps.map((item) => `• ${item}`).join("\n") : "Не указаны"}`,
  ].join("\n\n");
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
  const direct = pickString(merged, ["summary", "final_summary", "finalSummary", "ai_summary"], "");
  if (direct) return direct;
  const nested = nestedString(merged, [
    ["result", "summary", "summary"],
    ["result", "final_summary"],
    ["result", "card", "summary"],
    ["card", "summary"],
    ["crm", "card", "summary"],
    ["result", "crm", "card", "summary"],
  ]);
  if (nested) return nested;
  const steps = [...pickArray(merged, ["steps"]), ...pickArray(merged, ["stageReports"])];
  for (const item of steps) {
    const record = asRecord(item);
    const stage = asRecord(record?.stage);
    const report = asRecord(record?.report) ?? record;
    const output = asRecord(report?.output);
    const name = String(stage?.name ?? record?.name ?? "");
    const outputText = output?.summary;
    if (/Генерация саммари|summary/i.test(name) && typeof outputText === "string" && outputText.trim()) return outputText;
  }
  return "";
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
  const reportJson = source.report_json && typeof source.report_json === "object" ? (source.report_json as Record<string, unknown>) : {};
  const nested = {
    ...reportJson,
    ...(source.pipeline_report && typeof source.pipeline_report === "object" ? source.pipeline_report : {}),
    ...(source.result && typeof source.result === "object" ? source.result : {}),
    ...(source.output && typeof source.output === "object" ? source.output : {}),
    ...(reportJson.result && typeof reportJson.result === "object" ? reportJson.result : {}),
  } as Record<string, unknown>;
  const merged = { ...nested, ...source };

  const id =
    pickString(merged, ["run_id", "runId", "id", "execution_id"], "") ||
    `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;

  // The Quality Orchestrator's output (score/decision) is `ctx.summary_quality_gate`
  // (or the legacy `ctx.gate`), never a flat top-level field -- see
  // public/pipeline-lab-v3.html's summaryQualityGate()/gate() codeFns.
  const gate = pickObject(merged, ["summary_quality_gate", "quality_gate", "gate"]);
  const hasGate = Object.keys(gate).length > 0;

  return {
    id,
    createdAt:
      pickString(merged, ["created_at", "createdAt", "timestamp", "date", "finishedAt", "startedAt"], "") ||
      new Date().toISOString(),
    clientName: pickClientName(merged),
    transcript: pickString(merged, ["transcript", "transcription", "dialogue", "call_transcript", "__transcript"], ""),
    summary: formatSummarySections(getSummarySections(input, pickSummaryText(merged))),
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
