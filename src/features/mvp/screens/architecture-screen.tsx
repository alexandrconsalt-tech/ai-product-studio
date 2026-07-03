"use client";

import * as React from "react";
import { Badge, Card, EmptyState, Page, Section, Status, Tabs, Tab } from "@/shared/ui";
import { useRepositoryStore } from "@/shared/stores/repository-store";
import { getProjectBundle } from "../selectors";

const ARCHITECTURE_TABS = ["Overview", "Capabilities", "AI Components", "Models", "Data Flow", "Evaluation", "Review"] as const;
type ArchitectureTab = (typeof ARCHITECTURE_TABS)[number];

export function ArchitectureScreen() {
  const { snapshot, selectedProjectId } = useRepositoryStore();
  const { architecture, reviews } = getProjectBundle(snapshot, selectedProjectId);
  const architectureReview = reviews.find((review) => review.targetType === "architecture");
  const models = snapshot?.models.filter((model) => architecture?.modelIds.includes(model.id)) ?? [];
  const [activeTab, setActiveTab] = React.useState<ArchitectureTab>("Overview");

  if (!architecture) {
    return <EmptyState>Architecture станет доступна после Product Complete gate.</EmptyState>;
  }

  return (
    <Page>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Architecture</h1>
          <p className="text-sm text-text-muted">Capabilities, AI Components, Models, Data Flow, Evaluation и Review.</p>
        </div>
        <Status tone="success">{architecture.status}</Status>
      </div>
      <Tabs>
        {ARCHITECTURE_TABS.map((tab) => (
          <Tab key={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)}>
            {tab}
          </Tab>
        ))}
      </Tabs>
      {activeTab === "Overview" ? (
        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <p className="text-sm font-medium">Capabilities</p>
            <p className="text-sm text-text-muted">{architecture.capabilities.length}</p>
          </Card>
          <Card>
            <p className="text-sm font-medium">AI Components</p>
            <p className="text-sm text-text-muted">{architecture.aiComponents.length}</p>
          </Card>
          <Card>
            <p className="text-sm font-medium">Models</p>
            <p className="text-sm text-text-muted">{models.length}</p>
          </Card>
        </div>
      ) : null}
      {activeTab === "Capabilities" ? (
        <Section>
          <h2 className="text-lg font-semibold">Capabilities</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {architecture.capabilities.map((capability) => (
              <Card key={capability.id}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{capability.name}</p>
                  <Badge tone={capability.required ? "info" : "neutral"}>{capability.required ? "required" : "optional"}</Badge>
                </div>
                <p className="text-sm text-text-muted">{capability.description}</p>
              </Card>
            ))}
          </div>
        </Section>
      ) : null}
      {activeTab === "AI Components" ? (
        <Section>
          <h2 className="text-lg font-semibold">AI Components</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {architecture.aiComponents.map((component) => (
              <Card key={component.id}>
                <Badge>{component.type}</Badge>
                <p className="mt-2 text-sm font-medium">{component.name}</p>
                <p className="text-sm text-text-muted">{component.description}</p>
              </Card>
            ))}
          </div>
        </Section>
      ) : null}
      {activeTab === "Models" ? (
        <Section>
          <h2 className="text-lg font-semibold">Models</h2>
          <div className="flex flex-wrap gap-2">
            {models.map((model) => <Badge key={model.id} tone="info">{model.name}</Badge>)}
          </div>
        </Section>
      ) : null}
      {activeTab === "Data Flow" ? (
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Data Flow</h2>
          <div className="grid gap-2">
            {architecture.dataFlow.map((flow) => <p key={flow.id} className="text-sm text-text-muted">{flow.source} {"->"} {flow.target}: {flow.dataType}</p>)}
          </div>
        </Card>
      ) : null}
      {activeTab === "Evaluation" ? (
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Evaluation</h2>
          <div className="grid gap-2">
            {architecture.evaluation.map((item) => <p key={`${item.metric}-${item.method}`} className="text-sm text-text-muted">{item.metric}: {item.method} {item.threshold}</p>)}
          </div>
        </Card>
      ) : null}
      {activeTab === "Review" ? (
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Review</h2>
          <div className="flex items-center gap-2">
            <Status tone={architectureReview?.status === "approved" ? "success" : "warning"}>{architectureReview?.status ?? "not_reviewed"}</Status>
            <span className="text-sm text-text-muted">Score: {architectureReview?.score ?? 0}</span>
          </div>
        </Card>
      ) : null}
    </Page>
  );
}
