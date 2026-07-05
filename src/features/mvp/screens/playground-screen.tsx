"use client";

import * as React from "react";
import { FlaskConical } from "lucide-react";
import { Badge, Card, EmptyState, Page, Search, Section, Status } from "@/shared/ui";
import { useRepositoryStore } from "@/shared/stores/repository-store";
import { usePlaygroundTestRunStore } from "@/shared/stores/playground-test-run-store";
import { createPlaygroundTestRun } from "@/entities/PlaygroundTestRun/model/factory";
import type { PlaygroundTestRunSource } from "@/entities/PlaygroundTestRun/model/types";
import type { PipelineLabV3RunPayload } from "@/shared/model/pipeline-lab-v3-message";
import { PipelineLabV3Screen } from "./pipeline-lab-v3-screen";

const SOURCE: PlaygroundTestRunSource = "pipeline-lab-v3";

/**
 * Playground is a universal test bench, not tied to any one product's
 * pipeline (CLAUDE.md addendum "Product -> Playground -> Dashboard"): a
 * product picker up top, Pipeline Lab v3 below scoped to whichever
 * product is selected (existing app-wide `selectedProjectId`, so the
 * same product naturally carries across Product -> Playground ->
 * Dashboard). Every run's aggregate result is recorded into
 * PlaygroundTestRun history for Dashboard to read.
 *
 * This replaces the previous mock-executor demo UI this screen used to
 * show (`executePipeline`/`realStageRegistry` against the domain
 * Pipeline entity) -- that Production Pipeline Runtime code is untouched
 * and still exercised by the (hidden) Analytics screen's Golden Dataset
 * evaluation/benchmark, so nothing was deleted, only this screen's
 * presentation changed to the product-first Pipeline Lab v3 flow this
 * refactor asked for.
 */
export function PlaygroundScreen() {
  const { snapshot, selectedProjectId, selectProject } = useRepositoryStore();
  const { recordRun } = usePlaygroundTestRunStore();
  const [query, setQuery] = React.useState("");
  const projects = snapshot?.projects ?? [];
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const filtered = projects.filter((project) => `${project.name} ${project.description ?? ""}`.toLowerCase().includes(query.toLowerCase()));

  const handleRunComplete = React.useCallback(
    (payload: PipelineLabV3RunPayload) => {
      if (!selectedProjectId) return;
      recordRun(
        createPlaygroundTestRun({
          projectId: selectedProjectId,
          source: SOURCE,
          status: payload.status,
          stageCount: payload.stageCount,
          errorCount: payload.errorCount,
          warningCount: payload.warningCount,
          tokens: payload.tokens,
          costUsd: payload.costUsd,
          durationMs: payload.durationMs,
          confidence: payload.confidence,
          qualityScore: payload.qualityScore,
          decision: payload.decision,
          transcript: payload.transcript,
          report: payload.report,
          startedAt: payload.startedAt,
          finishedAt: payload.finishedAt,
        }),
      );
    },
    [selectedProjectId, recordRun],
  );

  return (
    <Page className="max-w-none">
      <div>
        <h1 className="text-2xl font-semibold">Песочница</h1>
        <p className="text-sm text-text-muted">Выберите продукт и протестируйте его пайплайн в Pipeline Lab v3 — загрузка данных, запуск, промежуточные результаты и отчёт.</p>
      </div>

      <Section>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Продукты</h2>
          <Status tone="info">{projects.length}</Status>
        </div>
        <Search value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск продукта" aria-label="Поиск продукта" />
        {filtered.length === 0 ? (
          <EmptyState>Продукты не найдены. Создайте продукт в разделе «Продукт».</EmptyState>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {filtered.map((project) => (
              <Card key={project.id} className={project.id === selectedProjectId ? "border-focus" : undefined}>
                <button type="button" className="w-full text-left" onClick={() => selectProject(project.id)}>
                  <p className="truncate text-sm font-medium">{project.name}</p>
                  <p className="mt-1 truncate text-xs text-text-muted">{project.description}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge tone={project.id === selectedProjectId ? "info" : "neutral"}>{project.status}</Badge>
                  </div>
                </button>
              </Card>
            ))}
          </div>
        )}
      </Section>

      {selectedProject ? (
        <Section className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <FlaskConical className="size-4 text-text-muted" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Pipeline Lab v3 — {selectedProject.name}</h2>
          </div>
          <Card className="h-[75vh] min-h-[560px] overflow-hidden p-0">
            <PipelineLabV3Screen productId={selectedProject.id} onRunComplete={handleRunComplete} />
          </Card>
        </Section>
      ) : (
        <EmptyState>Выберите продукт выше, чтобы открыть Pipeline Lab v3.</EmptyState>
      )}
    </Page>
  );
}
