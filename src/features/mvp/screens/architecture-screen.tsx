"use client";

import { Badge, Card, EmptyState, Page, Section, Status, Tabs, Tab } from "@/shared/ui";
import { useRepositoryStore } from "@/shared/stores/repository-store";
import { getProjectBundle } from "../selectors";

export function ArchitectureScreen() {
  const { snapshot, selectedProjectId } = useRepositoryStore();
  const { architecture, reviews } = getProjectBundle(snapshot, selectedProjectId);
  const architectureReview = reviews.find((review) => review.targetType === "architecture");
  const models = snapshot?.models.filter((model) => architecture?.modelIds.includes(model.id)) ?? [];

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
        {["Overview", "Capabilities", "AI Components", "Models", "Data Flow", "Evaluation", "Review"].map((tab, index) => (
          <Tab key={tab} active={index === 0}>{tab}</Tab>
        ))}
      </Tabs>
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
      <Section>
        <h2 className="text-lg font-semibold">Models</h2>
        <div className="flex flex-wrap gap-2">
          {models.map((model) => <Badge key={model.id} tone="info">{model.name}</Badge>)}
        </div>
      </Section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Data Flow</h2>
          <div className="grid gap-2">
            {architecture.dataFlow.map((flow) => <p key={flow.id} className="text-sm text-text-muted">{flow.source} {"->"} {flow.target}: {flow.dataType}</p>)}
          </div>
        </Card>
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Evaluation</h2>
          <div className="grid gap-2">
            {architecture.evaluation.map((item) => <p key={`${item.metric}-${item.method}`} className="text-sm text-text-muted">{item.metric}: {item.method} {item.threshold}</p>)}
          </div>
        </Card>
      </div>
      <Card>
        <h2 className="mb-2 text-lg font-semibold">Review</h2>
        <div className="flex items-center gap-2">
          <Status tone={architectureReview?.status === "approved" ? "success" : "warning"}>{architectureReview?.status ?? "not_reviewed"}</Status>
          <span className="text-sm text-text-muted">Score: {architectureReview?.score ?? 0}</span>
        </div>
      </Card>
    </Page>
  );
}
