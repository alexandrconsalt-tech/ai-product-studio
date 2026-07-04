"use client";

import * as React from "react";
import { CheckCircle2, Download, PlayCircle, XCircle } from "lucide-react";
import { Badge, Button, Card, EmptyState, Page, Section, Status } from "@/shared/ui";
import { useRepositoryStore } from "@/shared/stores/repository-store";
import { useExecutionTraceStore } from "@/shared/stores/execution-trace-store";
import { computeCostAnalytics } from "@/shared/evaluation/cost-analytics";
import { assessProductionReadiness } from "@/shared/evaluation/production-readiness";
import { evaluateGoldenDataset, type EvaluationReport } from "@/shared/evaluation/evaluate";
import { runBenchmark, withNodeModel, type BenchmarkReport } from "@/shared/evaluation/benchmark";
import { ILLUSTRATIVE_CALL_ANALYSIS_DATASET } from "@/shared/evaluation/golden-dataset";
import { buildReportEnvelope } from "@/shared/evaluation/reports";
import { downloadJson } from "@/shared/lib/download-json";
import { buildExecutionTrace } from "@/shared/runtime/execution-trace";
import { realStageRegistry } from "@/shared/runtime/real-stage";
import { defaultLLMProviderRegistry } from "@/shared/llm/provider-registry";
import { seededPromptRegistry } from "@/shared/prompts/seed-prompts";
import type { Pipeline } from "@/entities/Pipeline/model/types";
import type { Model } from "@/entities/Model/model/types";
import { getProjectBundle } from "../selectors";

/**
 * "Golden Dataset available" is only true for the AI Call Analysis
 * pipeline -- the one pipeline this repository actually has an
 * (illustrative) golden dataset for (CLAUDE.md §26). Other demo
 * pipelines (§M.8) honestly show this check as failing rather than
 * defaulting to true.
 */
const PIPELINE_IDS_WITH_GOLDEN_DATASET = new Set(["pipeline_demo_call_analysis"]);

/**
 * Reflects this repository's actual, last-verified `npm test` result
 * (CLAUDE.md §19) -- not a live in-browser test run, which the client
 * cannot perform. Update this if the suite starts failing.
 */
const REPOSITORY_TESTS_PASSING = true;

/**
 * The one node/model pair this repository has a real comparison to
 * make (CLAUDE.md §28, `pdf-notes.txt` Этап 4: "benchmark 1-2
 * cheaper/local models against the current baseline on simple
 * steps"): the demo pipeline's summary node ("Need Extractor",
 * `node_llm`) defaults to `model_reasoning` -- compare it against the
 * cheaper `model_fast` on the same Golden Dataset. Scoped narrowly
 * (one node, two named models) rather than a general "pick any
 * node/model" UI, since this is the only pairing with a real dataset
 * and a real cost story behind it today.
 */
const BENCHMARK_NODE_ID = "node_llm";
const BENCHMARK_MODEL_IDS = ["model_reasoning", "model_fast"] as const;

async function runModelComparisonBenchmark(pipeline: Pipeline, models: readonly Model[]) {
  const registry = realStageRegistry({ llmProviders: defaultLLMProviderRegistry, prompts: seededPromptRegistry, models });
  const variants = BENCHMARK_MODEL_IDS.map((modelId) => ({
    id: modelId,
    label: models.find((m) => m.id === modelId)?.name ?? modelId,
    pipeline: withNodeModel(pipeline, BENCHMARK_NODE_ID, modelId),
  }));
  return runBenchmark(variants, ILLUSTRATIVE_CALL_ANALYSIS_DATASET, { executeOptions: { registry, projectId: pipeline.projectId } });
}

/**
 * Runs the illustrative Golden Dataset through the same real Pipeline
 * Executor Playground uses (`realStageRegistry`, mock LLM provider by
 * default) -- reusing the already-implemented evaluation mechanism
 * (`evaluateGoldenDataset`, CLAUDE.md §26/§27) rather than building a
 * second one for this screen. Against the default mock provider this
 * honestly reports a low/zero pass rate (mock output never matches
 * `CallAnalysisSummarySchema`) -- see `evaluate.test.ts`'s own
 * "honestly reports failures" test; that is the correct behavior, not
 * a bug to hide.
 */
async function runIllustrativeEvaluation(pipeline: Pipeline, models: readonly Model[]) {
  const registry = realStageRegistry({ llmProviders: defaultLLMProviderRegistry, prompts: seededPromptRegistry, models });
  return evaluateGoldenDataset(pipeline, ILLUSTRATIVE_CALL_ANALYSIS_DATASET, { executeOptions: { registry, projectId: pipeline.projectId } });
}

export function AnalyticsScreen() {
  const { snapshot, selectedProjectId } = useRepositoryStore();
  const { tracesByRunId } = useExecutionTraceStore();
  const { pipeline, runs } = getProjectBundle(snapshot, selectedProjectId);
  const [evaluation, setEvaluation] = React.useState<EvaluationReport | null>(null);
  const [evaluating, setEvaluating] = React.useState(false);
  const [benchmark, setBenchmark] = React.useState<BenchmarkReport | null>(null);
  const [benchmarking, setBenchmarking] = React.useState(false);

  if (!pipeline) {
    return <EmptyState>Analytics станет доступна после создания Pipeline.</EmptyState>;
  }

  const goldenDatasetAvailable = PIPELINE_IDS_WITH_GOLDEN_DATASET.has(pipeline.id);
  const benchmarkAvailable = goldenDatasetAvailable && pipeline.nodes.some((node) => node.id === BENCHMARK_NODE_ID);
  const traces = runs.map((run) => tracesByRunId[run.id]).filter((events): events is NonNullable<typeof events> => Boolean(events)).map((events) => buildExecutionTrace(pipeline, events));

  const cost = computeCostAnalytics(runs, traces);
  const readiness = assessProductionReadiness(pipeline, {
    prompts: seededPromptRegistry,
    runs,
    goldenDatasetAvailable,
    testsPassing: REPOSITORY_TESTS_PASSING,
  });

  const handleRunEvaluation = () => {
    setEvaluating(true);
    runIllustrativeEvaluation(pipeline, snapshot?.models ?? [])
      .then(setEvaluation)
      .finally(() => setEvaluating(false));
  };

  const exportEvaluationReport = () => {
    if (!evaluation) return;
    downloadJson(`evaluation-report-${pipeline.id}.json`, buildReportEnvelope("evaluation_report", evaluation));
  };

  const handleRunBenchmark = () => {
    setBenchmarking(true);
    runModelComparisonBenchmark(pipeline, snapshot?.models ?? [])
      .then(setBenchmark)
      .finally(() => setBenchmarking(false));
  };

  const exportBenchmarkReport = () => {
    if (!benchmark) return;
    downloadJson(`benchmark-report-${pipeline.id}.json`, buildReportEnvelope("benchmark_report", benchmark));
  };

  return (
    <Page className="max-w-none">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-text-muted">Pipeline {pipeline.id} · {cost.runCount} historical run(s)</p>
      </div>

      <Section>
        <h2 className="mb-2 text-lg font-semibold">Cost Analytics</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Card><p className="text-xs text-text-muted">Total Cost</p><p className="text-xl font-semibold">${cost.totalCostUsd.toFixed(4)}</p></Card>
          <Card><p className="text-xs text-text-muted">Avg Cost / Run</p><p className="text-xl font-semibold">${cost.averageCostPerRun.toFixed(4)}</p></Card>
          <Card><p className="text-xs text-text-muted">Avg Latency</p><p className="text-xl font-semibold">{Math.round(cost.averageLatencyMs)} ms</p></Card>
          <Card><p className="text-xs text-text-muted">Avg Confidence</p><p className="text-xl font-semibold">{cost.averageConfidence.toFixed(2)}</p></Card>
        </div>
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium text-text-muted">Top Expensive Stages {traces.length === 0 ? "(нет trace в этой сессии)" : ""}</h3>
          {cost.topExpensiveStages.length === 0 ? (
            <EmptyState>Нет данных по стадиям — запустите Pipeline в Playground.</EmptyState>
          ) : (
            <div className="grid gap-1">
              {cost.topExpensiveStages.map((stage) => (
                <div key={stage.nodeId} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                  <span>{stage.name}</span>
                  <span className="text-text-muted">${stage.totalCost.toFixed(4)} ({stage.runCount} run(s))</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Golden Dataset Evaluation</h2>
          {goldenDatasetAvailable ? (
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={handleRunEvaluation} disabled={evaluating}>
                <PlayCircle className="size-4" aria-hidden="true" />
                {evaluating ? "Evaluating…" : "Run Evaluation"}
              </Button>
              <Button variant="secondary" onClick={exportEvaluationReport} disabled={!evaluation}>
                <Download className="size-4" aria-hidden="true" />
                Evaluation Report
              </Button>
            </div>
          ) : null}
        </div>
        {!goldenDatasetAvailable ? (
          <EmptyState>Для этого Pipeline ещё не создан Golden Dataset (CLAUDE.md §26).</EmptyState>
        ) : !evaluation ? (
          <EmptyState>Нажмите &quot;Run Evaluation&quot;, чтобы прогнать {ILLUSTRATIVE_CALL_ANALYSIS_DATASET.examples.length} illustrative-примеров через реальный Pipeline Executor.</EmptyState>
        ) : (
          <div className="mt-2 grid gap-2">
            <p className="text-sm text-text-muted">
              Dataset {evaluation.datasetId} v{evaluation.datasetVersion} · {evaluation.passedExamples}/{evaluation.totalExamples} passed ({Math.round(evaluation.passRate * 100)}%)
            </p>
            <div className="grid gap-1">
              {evaluation.results.map((result) => (
                <div key={result.exampleId} className="flex items-start gap-2 rounded-md border border-border p-2 text-sm">
                  {result.passed ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-error" aria-hidden="true" />}
                  <div>
                    <p className="font-medium">{result.exampleId}</p>
                    <p className="text-text-muted">{result.scores.map((score) => `${score.scorerName}: ${score.passed ? "OK" : score.details ?? "failed"}`).join(" · ")}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      <Section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Benchmark: Model Comparison</h2>
          {benchmarkAvailable ? (
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={handleRunBenchmark} disabled={benchmarking}>
                <PlayCircle className="size-4" aria-hidden="true" />
                {benchmarking ? "Benchmarking…" : "Run Benchmark"}
              </Button>
              <Button variant="secondary" onClick={exportBenchmarkReport} disabled={!benchmark}>
                <Download className="size-4" aria-hidden="true" />
                Benchmark Report
              </Button>
            </div>
          ) : null}
        </div>
        {!benchmarkAvailable ? (
          <EmptyState>Для этого Pipeline нет заданной пары моделей для сравнения (CLAUDE.md §28).</EmptyState>
        ) : !benchmark ? (
          <EmptyState>
            Нажмите &quot;Run Benchmark&quot;, чтобы сравнить {BENCHMARK_MODEL_IDS.length} модели узла &quot;Need Extractor&quot; на одном Golden Dataset (CLAUDE.md §28 -- сравнение версий, а не проверка одной версии).
          </EmptyState>
        ) : (
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {benchmark.results.map((variantResult) => (
              <Card key={variantResult.variantId} className="grid gap-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{variantResult.variantLabel}</p>
                  <Badge tone={variantResult.evaluation.passRate > 0 ? "success" : "neutral"}>
                    {variantResult.evaluation.passedExamples}/{variantResult.evaluation.totalExamples} passed ({Math.round(variantResult.evaluation.passRate * 100)}%)
                  </Badge>
                </div>
                <div className="grid gap-1">
                  {variantResult.evaluation.results.map((result) => (
                    <div key={result.exampleId} className="flex items-start gap-2 rounded-md border border-border p-2 text-xs">
                      {result.passed ? <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-success" aria-hidden="true" /> : <XCircle className="mt-0.5 size-3 shrink-0 text-error" aria-hidden="true" />}
                      <span>{result.exampleId}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Production Readiness</h2>
          <Status tone={readiness.ready ? "success" : "warning"}>{readiness.ready ? "Production Ready" : "Needs Attention"}</Status>
        </div>
        <div className="mt-2 grid gap-2">
          {readiness.checks.map((check) => (
            <div key={check.id} className="flex items-start gap-2 rounded-md border border-border p-2 text-sm">
              {check.passed ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-error" aria-hidden="true" />}
              <div>
                <p className="font-medium">{check.label}</p>
                <p className="text-text-muted">{check.detail}</p>
              </div>
              <Badge tone={check.passed ? "success" : "error"} className="ml-auto">{check.passed ? "OK" : "Attention"}</Badge>
            </div>
          ))}
        </div>
      </Section>
    </Page>
  );
}
