import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const DATASET_PATH = resolve(ROOT, "tests/golden/transcription-summary-v3/quality-regression/cases.json");
const BASELINE_PATH = resolve(ROOT, "tests/golden/transcription-summary-v3/quality-regression/baseline.json");
const POLICY_FILES = [
  "src/features/transcription-summary/summary-judges/prompt-builders.ts",
  "src/features/transcription-summary/summary-judges/post-validation.ts",
  "src/features/transcription-summary/quality-gate/evaluate.ts",
  "src/features/transcription-summary/contracts/quality-gate/v3/contract.ts",
];
const TRIGGER_PATHS = [
  "src/features/transcription-summary/summary/prompt-builder.ts",
  "src/features/transcription-summary/summary/summary-plan.ts",
  "src/features/transcription-summary/contracts",
  "src/features/transcription-summary/normalization",
  ...POLICY_FILES,
];
const THRESHOLDS = Object.freeze({
  completeReportRate: 1,
  timeoutAfterRetryCount: 0,
  schemaErrorCount: 0,
  technicalResidueCount: 0,
  crmWriteCount: 0,
  meanQualityScore: 95,
  p10QualityScore: 90,
  shareAtLeast95: 0.9,
  criticalMeaningRecall: 0.98,
  hallucinationRate: 0.01,
  falseAgreementRate: 0,
  nextStepAccuracy: 0.98,
  callResultAccuracy: 0.98,
  summaryRubricRecall: 0.98,
  semanticDuplicationRate: 0.02,
});

function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function fingerprint(paths) {
  const hash = createHash("sha256");
  for (const path of paths) hash.update(path).update("\0").update(readFileSync(resolve(ROOT, path))).update("\0");
  return hash.digest("hex");
}

function filesIn(paths) {
  return paths.flatMap((path) => {
    const absolute = resolve(ROOT, path);
    if (!statSync(absolute).isDirectory()) return [path];
    const walk = (directory) => readdirSync(directory).flatMap((name) => {
      const child = resolve(directory, name);
      return statSync(child).isDirectory() ? walk(child) : [child.slice(ROOT.length + 1)];
    });
    return walk(absolute).filter((file) => /\.(?:ts|json)$/u.test(file));
  }).sort();
}

function normalized(value) {
  return String(value ?? "").normalize("NFKC").toLocaleLowerCase("ru-RU").replace(/ё/gu, "е").replace(/\s+/gu, " ").trim();
}

function containsAny(value, alternatives) {
  const source = normalized(value);
  return alternatives.some((alternative) => source.includes(normalized(alternative)));
}

function stageIssues(report) {
  return (report?.stages ?? []).flatMap((stage) => stage.validation_result?.issues ?? []);
}

function outputText(outputs) {
  return JSON.stringify({
    facts: outputs?.facts_agent ?? null,
    needs: outputs?.needs_agent ?? null,
    outcome: outputs?.outcome_agent ?? null,
    store: outputs?.conversation_store ?? null,
    summary: outputs?.summary_agent ?? null,
  });
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)];
}

export function validateDataset(dataset) {
  const errors = [];
  if (dataset.version !== "summary-v3-golden-v1") errors.push("DATASET_VERSION_INVALID");
  if (!Array.isArray(dataset.cases) || dataset.cases.length < 40) errors.push("DATASET_REQUIRES_40_CASES");
  const ids = new Set();
  for (const item of dataset.cases ?? []) {
    if (!item.id || ids.has(item.id)) errors.push(`DUPLICATE_OR_EMPTY_ID:${item.id ?? ""}`);
    ids.add(item.id);
    if (item.provenance?.kind !== "production-derived-anonymized" || !/^[a-f0-9]{12,64}$/u.test(item.provenance.source_hash ?? "")) errors.push(`PROVENANCE_INVALID:${item.id}`);
    if (!Array.isArray(item.transcript) || item.transcript.length < 1) errors.push(`TRANSCRIPT_MISSING:${item.id}`);
    if (!Array.isArray(item.critical_meanings) || !Array.isArray(item.forbidden_meanings)) errors.push(`RUBRIC_MISSING:${item.id}`);
    if (!item.expected_call_result || !item.expected_primary_next_step || !item.summary_rubric) errors.push(`EXPECTATION_MISSING:${item.id}`);
  }
  const coverage = new Set((dataset.cases ?? []).flatMap((item) => item.tags ?? []));
  for (const tag of dataset.required_coverage ?? []) if (!coverage.has(tag)) errors.push(`COVERAGE_MISSING:${tag}`);
  return errors;
}

export function evaluateCase(golden, pipelineResult, httpStatus = 200, durationMs = 0) {
  const report = pipelineResult?.report ?? {};
  const outputs = pipelineResult?.outputs ?? {};
  const semanticText = outputText(outputs);
  const summary = outputs.summary_agent ?? {};
  const outcome = outputs.outcome_agent ?? {};
  const store = outputs.conversation_store ?? {};
  const gate = outputs.quality_gate ?? {};
  const issues = stageIssues(report);
  const diagnosticsIssue = issues.find((issue) => issue.code === "POST_FINAL_DIAGNOSTICS");
  let diagnostics = {};
  try { diagnostics = JSON.parse(diagnosticsIssue?.message ?? "{}"); } catch { diagnostics = {}; }
  const criticalHits = golden.critical_meanings.filter((meaning) => containsAny(semanticText, meaning.any_of)).map((meaning) => meaning.id);
  const forbiddenHits = golden.forbidden_meanings.filter((meaning) => containsAny(semanticText, meaning.any_of)).map((meaning) => meaning.id);
  const next = JSON.stringify(outcome.primary_next_step ?? store.primary_next_step ?? {});
  const nextExpected = golden.expected_primary_next_step;
  const nextCorrect = nextExpected.status === "not_defined"
    ? /not_defined/u.test(next) && !Array.isArray(outcome.agreements) || (/not_defined/u.test(next) && (outcome.agreements?.length ?? 0) === 0)
    : containsAny(next, nextExpected.required_any_of ?? []) && !(nextExpected.forbidden_any_of ?? []).some((item) => containsAny(next, [item]));
  const falseAgreement = (golden.forbidden_agreements ?? []).some((item) => containsAny(JSON.stringify(outcome.agreements ?? []), item.any_of))
    || (nextExpected.status === "not_defined" && (outcome.agreements?.length ?? 0) > 0);
  const stageErrors = (report.stages ?? []).map((stage) => `${stage.error_code ?? ""} ${stage.validation_result?.issues?.map((issue) => issue.code).join(" ") ?? ""}`);
  const visibleSummary = [summary.conversation_result, ...(summary.key_facts ?? []).flatMap((item) => [item.label, item.value]), ...(summary.quotes ?? []).map((item) => item.text), summary.next_step].join(" ");
  const criticalById = new Map(golden.critical_meanings.map((meaning) => [meaning.id, meaning]));
  const summaryRequired = golden.summary_rubric.required_meaning_ids.map((id) => criticalById.get(id)).filter(Boolean);
  const summaryHits = summaryRequired.filter((meaning) => containsAny(visibleSummary, meaning.any_of)).map((meaning) => meaning.id);
  const technicalResidue = Number((diagnostics.technicalResidue?.length ?? 0) > 0 || /```|\btechnical_error\b|\berror\b|"(?:status|code|message)"\s*:/iu.test(visibleSummary));
  return {
    id: golden.id,
    http_status: httpStatus,
    duration_ms: durationMs,
    complete_report: httpStatus === 200 && report.stages?.length === 13,
    timeout_after_retry: stageErrors.some((value) => /timeout/iu.test(value)),
    schema_error: stageErrors.some((value) => /schema|output_invalid|parse/iu.test(value)),
    technical_residue: technicalResidue,
    crm_write: !["DRY_RUN", "NOT_RUN"].includes(report.crm_status),
    crm_status: report.crm_status ?? null,
    quality_score: typeof gate.qualityScore === "number" ? gate.qualityScore : report.quality_score,
    criteria: Object.fromEntries((report.stages ?? []).filter((stage) => stage.stage_id?.startsWith("summary_judge_")).map((stage) => {
      const audit = stage.validation_result?.issues?.find((issue) => issue.code === "JUDGE_SCORE_AUDIT");
      try { return [stage.stage_id.replace("summary_judge_", ""), JSON.parse(audit?.message ?? "null")]; } catch { return [stage.stage_id, null]; }
    })),
    critical_hits: criticalHits,
    critical_total: golden.critical_meanings.length,
    forbidden_hits: forbiddenHits,
    output_meaning_total: Math.max(1, criticalHits.length + forbiddenHits.length),
    false_agreement: falseAgreement,
    call_result_correct: containsAny(outcome.call_result ?? store.call_result ?? "", golden.expected_call_result.any_of),
    summary_rubric_hits: summaryHits,
    summary_rubric_total: summaryRequired.length,
    next_step_correct: nextCorrect,
    semantic_duplications: diagnostics.semanticRepetitionCount ?? diagnostics.nextStepDuplicationCount ?? 0,
    visible_meanings: Math.max(1, golden.critical_meanings.length),
    summary,
    gate_decision: gate.decision ?? report.quality_decision ?? null,
    pipeline_report: report,
  };
}

export function aggregateResults(caseResults) {
  const scores = caseResults.map((item) => item.quality_score).filter((score) => typeof score === "number");
  const criticalTotal = caseResults.reduce((sum, item) => sum + item.critical_total, 0);
  const criticalHits = caseResults.reduce((sum, item) => sum + item.critical_hits.length, 0);
  const forbiddenHits = caseResults.reduce((sum, item) => sum + item.forbidden_hits.length, 0);
  const outputMeanings = caseResults.reduce((sum, item) => sum + item.output_meaning_total, 0);
  const duplications = caseResults.reduce((sum, item) => sum + item.semantic_duplications, 0);
  const visibleMeanings = caseResults.reduce((sum, item) => sum + item.visible_meanings, 0);
  const summaryRubricTotal = caseResults.reduce((sum, item) => sum + (item.summary_rubric_total ?? 0), 0);
  const summaryRubricHits = caseResults.reduce((sum, item) => sum + (item.summary_rubric_hits?.length ?? 0), 0);
  const criteria = {};
  for (const item of caseResults) for (const [criterion, audit] of Object.entries(item.criteria ?? {})) {
    if (typeof audit?.effective_score !== "number") continue;
    (criteria[criterion] ??= []).push(audit.effective_score);
  }
  return {
    case_count: caseResults.length,
    complete_report_rate: caseResults.filter((item) => item.complete_report).length / Math.max(1, caseResults.length),
    timeout_after_retry_count: caseResults.filter((item) => item.timeout_after_retry).length,
    schema_error_count: caseResults.filter((item) => item.schema_error).length,
    technical_residue_count: caseResults.reduce((sum, item) => sum + item.technical_residue, 0),
    crm_write_count: caseResults.filter((item) => item.crm_write).length,
    mean_quality_score: scores.reduce((sum, score) => sum + score, 0) / Math.max(1, scores.length),
    p10_quality_score: percentile(scores, 0.1),
    share_at_least_95: scores.filter((score) => score >= 95).length / Math.max(1, caseResults.length),
    critical_meaning_recall: criticalHits / Math.max(1, criticalTotal),
    hallucination_rate: forbiddenHits / Math.max(1, outputMeanings),
    false_agreement_rate: caseResults.filter((item) => item.false_agreement).length / Math.max(1, caseResults.length),
    call_result_accuracy: caseResults.filter((item) => item.call_result_correct).length / Math.max(1, caseResults.length),
    summary_rubric_recall: summaryRubricHits / Math.max(1, summaryRubricTotal),
    next_step_accuracy: caseResults.filter((item) => item.next_step_correct).length / Math.max(1, caseResults.length),
    semantic_duplication_rate: duplications / Math.max(1, visibleMeanings),
    criterion_means: Object.fromEntries(Object.entries(criteria).map(([criterion, values]) => [criterion, values.reduce((sum, score) => sum + score, 0) / values.length])),
  };
}

function acceptanceFailures(metrics) {
  const map = [
    ["complete_report_rate", ">=", THRESHOLDS.completeReportRate],
    ["timeout_after_retry_count", "<=", THRESHOLDS.timeoutAfterRetryCount],
    ["schema_error_count", "<=", THRESHOLDS.schemaErrorCount],
    ["technical_residue_count", "<=", THRESHOLDS.technicalResidueCount],
    ["crm_write_count", "<=", THRESHOLDS.crmWriteCount],
    ["mean_quality_score", ">=", THRESHOLDS.meanQualityScore],
    ["p10_quality_score", ">=", THRESHOLDS.p10QualityScore],
    ["share_at_least_95", ">=", THRESHOLDS.shareAtLeast95],
    ["critical_meaning_recall", ">=", THRESHOLDS.criticalMeaningRecall],
    ["hallucination_rate", "<=", THRESHOLDS.hallucinationRate],
    ["false_agreement_rate", "<=", THRESHOLDS.falseAgreementRate],
    ["call_result_accuracy", ">=", THRESHOLDS.callResultAccuracy],
    ["summary_rubric_recall", ">=", THRESHOLDS.summaryRubricRecall],
    ["next_step_accuracy", ">=", THRESHOLDS.nextStepAccuracy],
    ["semantic_duplication_rate", "<=", THRESHOLDS.semanticDuplicationRate],
  ];
  return map.filter(([key, operator, threshold]) => operator === ">=" ? metrics[key] < threshold : metrics[key] > threshold)
    .map(([key, operator, threshold]) => `${key}:${metrics[key]} ${operator} ${threshold}`);
}

export function caseAcceptanceFailures(caseResults) {
  return caseResults.flatMap((item) => [
    ...(typeof item.quality_score !== "number" || item.quality_score < 90 ? [`${item.id}:QUALITY_SCORE_BELOW_90`] : []),
    ...(item.forbidden_hits.length ? [`${item.id}:CRITICAL_FORBIDDEN_MEANING:${item.forbidden_hits.join(",")}`] : []),
  ]);
}

export function compareWithBaseline(current, baseline, policyFingerprint) {
  const previous = new Map((baseline?.cases ?? []).map((item) => [item.id, item]));
  const improved = [];
  const regressions = [];
  for (const item of current) {
    const before = previous.get(item.id);
    if (!before) continue;
    const delta = (item.quality_score ?? 0) - (before.quality_score ?? 0);
    const criterionRegressions = Object.entries(item.criteria ?? {}).flatMap(([criterion, audit]) => {
      const beforeScore = before.criteria?.[criterion]?.effective_score;
      const afterScore = audit?.effective_score;
      return typeof beforeScore === "number" && typeof afterScore === "number" && afterScore < beforeScore
        ? [`CRITERION_DECREASED:${criterion}:${beforeScore}->${afterScore}`] : [];
    });
    if (delta > 0) improved.push({ id: item.id, delta });
    if (delta < 0 || (item.quality_score ?? 0) < 90 || item.forbidden_hits.length > (before.forbidden_hits?.length ?? 0)
      || item.critical_hits.length < (before.critical_hits?.length ?? 0) || criterionRegressions.length > 0) {
      regressions.push({ id: item.id, delta, reasons: [
        ...(delta < 0 ? ["QUALITY_SCORE_DECREASED"] : []),
        ...((item.quality_score ?? 0) < 90 ? ["QUALITY_SCORE_BELOW_90"] : []),
        ...(item.forbidden_hits.length > (before.forbidden_hits?.length ?? 0) ? ["NEW_FORBIDDEN_MEANING"] : []),
        ...(item.critical_hits.length < (before.critical_hits?.length ?? 0) ? ["CRITICAL_MEANING_LOST"] : []),
        ...criterionRegressions,
      ] });
    }
  }
  const policyChanged = Boolean(baseline?.policy_fingerprint && baseline.policy_fingerprint !== policyFingerprint);
  return { improved, regressions, policy_changed: policyChanged };
}

async function runLive(dataset, endpoint) {
  if (!/^https?:\/\//u.test(endpoint)) throw new Error("QUALITY_REGRESSION_URL or --url must contain the production structured endpoint");
  const results = [];
  for (const [index, item] of dataset.cases.entries()) {
    const started = Date.now();
    const transcript = {
      transcript_id: `golden-${item.id}`,
      turns: item.transcript.map((turn, sequence) => ({ id: `turn-${sequence + 1}`, sequence, speaker: turn.speaker, text: turn.text, started_at_ms: null, ended_at_ms: null })),
      metadata: { golden_case_id: item.id }, validation_warnings: [],
    };
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(300_000), body: JSON.stringify({
        action: "execute_pipeline", runId: `golden-${Date.now()}-${index}`, transcript, provider: "openai-direct",
        models: { default: process.env.QUALITY_REGRESSION_MODEL ?? "gpt-5-mini-2025-08-07" },
        runtimeConfiguration: { pipelineVersion: "3.0.0", stageVersion: "3.0.0", provider: "openai-direct", contractFamily: "v3", structuredOutputRequired: true, parserFallbackEnabled: false },
      }) });
      const payload = await response.json().catch(() => ({}));
      results.push(evaluateCase(item, payload.result, response.status, Date.now() - started));
    } catch (error) {
      results.push({
        id: item.id, http_status: 0, duration_ms: Date.now() - started, complete_report: false,
        timeout_after_retry: error?.name === "TimeoutError", schema_error: false, technical_residue: 0,
        crm_write: false, crm_status: null, quality_score: null, criteria: {}, critical_hits: [],
        critical_total: item.critical_meanings.length, forbidden_hits: [], output_meaning_total: 1,
        false_agreement: false, call_result_correct: false, summary_rubric_hits: [],
        summary_rubric_total: item.summary_rubric.required_meaning_ids.length, next_step_correct: false,
        semantic_duplications: 0, visible_meanings: Math.max(1, item.critical_meanings.length),
        runner_error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      });
    }
  }
  return results;
}

async function main() {
  const args = new Map(process.argv.slice(2).map((value, index, values) => value.startsWith("--") ? [value, values[index + 1]?.startsWith("--") ? true : values[index + 1]] : null).filter(Boolean));
  const dataset = json(DATASET_PATH);
  const datasetErrors = validateDataset(dataset);
  if (datasetErrors.length) throw new Error(`Golden Dataset invalid:\n${datasetErrors.join("\n")}`);
  if (!args.has("--live") && !args.has("--results")) {
    process.stdout.write(`${JSON.stringify({ status: "VALID", cases: dataset.cases.length, trigger_fingerprint: fingerprint(filesIn(TRIGGER_PATHS)), policy_fingerprint: fingerprint(POLICY_FILES) }, null, 2)}\n`);
    return;
  }
  const caseResults = args.has("--results")
    ? json(resolve(ROOT, String(args.get("--results")))).cases
    : await runLive(dataset, String(args.get("--url") || process.env.QUALITY_REGRESSION_URL || ""));
  if (!caseResults || caseResults.length !== dataset.cases.length) throw new Error("Regression result must contain every Golden case");
  const baseline = json(args.get("--baseline") ? resolve(ROOT, String(args.get("--baseline"))) : BASELINE_PATH);
  const policyFingerprint = fingerprint(POLICY_FILES);
  const metrics = aggregateResults(caseResults);
  const comparison = compareWithBaseline(caseResults, baseline, policyFingerprint);
  const failures = [
    ...acceptanceFailures(metrics),
    ...caseAcceptanceFailures(caseResults),
    ...comparison.regressions.map((item) => `${item.id}:${item.reasons.join(",")}`),
  ];
  if (comparison.policy_changed && metrics.mean_quality_score > (baseline.metrics?.mean_quality_score ?? 0)) failures.push("POLICY_CHANGED_SCORE_INCREASE_NOT_ACCEPTABLE");
  const metricDeltas = Object.fromEntries(Object.entries(metrics).flatMap(([key, value]) =>
    typeof value === "number" && typeof baseline.metrics?.[key] === "number" ? [[key, value - baseline.metrics[key]]] : []));
  const criterionDeltas = Object.fromEntries(Object.entries(metrics.criterion_means ?? {}).flatMap(([criterion, value]) =>
    typeof value === "number" && typeof baseline.metrics?.criterion_means?.[criterion] === "number"
      ? [[criterion, value - baseline.metrics.criterion_means[criterion]]] : []));
  const report = { generated_at: new Date().toISOString(), dataset_version: dataset.version, trigger_fingerprint: fingerprint(filesIn(TRIGGER_PATHS)), policy_fingerprint: policyFingerprint, before: baseline.metrics ?? null, after: metrics, metric_deltas: metricDeltas, criterion_deltas: criterionDeltas, improved_cases: comparison.improved, regressions: comparison.regressions, policy_changed: comparison.policy_changed, failures, accepted: failures.length === 0, cases: caseResults };
  const output = resolve(ROOT, String(args.get("--output") || "artifacts/transcription-summary-v3-quality-regression.json"));
  mkdirSync(resolve(output, ".."), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  if (args.has("--accept-baseline")) {
    if (!report.accepted) throw new Error("Cannot accept a failed regression as baseline");
    writeFileSync(BASELINE_PATH, `${JSON.stringify({ dataset_version: dataset.version, status: "ACCEPTED", accepted_at: report.generated_at, trigger_fingerprint: report.trigger_fingerprint, policy_fingerprint: report.policy_fingerprint, metrics: report.after, cases: report.cases }, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify({ output, accepted: report.accepted, before: report.before, after: report.after, improved_cases: report.improved_cases, regressions: report.regressions, failures }, null, 2)}\n`);
  if (!report.accepted) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
