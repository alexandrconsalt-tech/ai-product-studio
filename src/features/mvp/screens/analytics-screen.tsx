"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { Badge, Card, EmptyState, Page, Section, Status } from "@/shared/ui";
import { useRepositoryStore } from "@/shared/stores/repository-store";
import { useExecutionTraceStore } from "@/shared/stores/execution-trace-store";
import { computeCostAnalytics } from "@/shared/evaluation/cost-analytics";
import { assessProductionReadiness } from "@/shared/evaluation/production-readiness";
import { buildExecutionTrace } from "@/shared/runtime/execution-trace";
import { seededPromptRegistry } from "@/shared/prompts/seed-prompts";
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

export function AnalyticsScreen() {
  const { snapshot, selectedProjectId } = useRepositoryStore();
  const { tracesByRunId } = useExecutionTraceStore();
  const { pipeline, runs } = getProjectBundle(snapshot, selectedProjectId);

  if (!pipeline) {
    return <EmptyState>Analytics станет доступна после создания Pipeline.</EmptyState>;
  }

  const traces = runs.map((run) => tracesByRunId[run.id]).filter((events): events is NonNullable<typeof events> => Boolean(events)).map((events) => buildExecutionTrace(pipeline, events));

  const cost = computeCostAnalytics(runs, traces);
  const readiness = assessProductionReadiness(pipeline, {
    prompts: seededPromptRegistry,
    runs,
    goldenDatasetAvailable: PIPELINE_IDS_WITH_GOLDEN_DATASET.has(pipeline.id),
    testsPassing: REPOSITORY_TESTS_PASSING,
  });

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
