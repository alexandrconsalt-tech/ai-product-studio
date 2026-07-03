"use client";

import * as React from "react";
import { Badge, Card, EmptyState, Page, Section, Status, Tabs, Tab } from "@/shared/ui";
import { useRepositoryStore } from "@/shared/stores/repository-store";
import { getProjectBundle } from "../selectors";

const PRODUCT_TABS = ["Idea", "Discovery", "Frameworks", "PRD", "Review"] as const;
type ProductTab = (typeof PRODUCT_TABS)[number];

export function ProductScreen() {
  const { snapshot, selectedProjectId } = useRepositoryStore();
  const { product, reviews } = getProjectBundle(snapshot, selectedProjectId);
  const productReview = reviews.find((review) => review.targetType === "product");
  const frameworks = snapshot?.frameworks.filter((framework) => product?.frameworkIds.includes(framework.id)) ?? [];
  const [activeTab, setActiveTab] = React.useState<ProductTab>("Idea");

  if (!product) {
    return <EmptyState>Выберите Project, чтобы открыть Product Workspace.</EmptyState>;
  }

  return (
    <Page>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Product</h1>
          <p className="text-sm text-text-muted">Idea, Discovery, Frameworks, PRD и Review из Repository.</p>
        </div>
        <Status tone="success">{product.status}</Status>
      </div>
      <Tabs>
        {PRODUCT_TABS.map((tab) => (
          <Tab key={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)}>
            {tab}
          </Tab>
        ))}
      </Tabs>
      {activeTab === "Idea" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-2 text-lg font-semibold">Idea</h2>
            <p className="text-sm text-text-muted">{product.idea?.statement}</p>
          </Card>
          <Card>
            <h2 className="mb-2 text-lg font-semibold">Problem</h2>
            <p className="text-sm text-text-muted">{product.problem?.statement}</p>
          </Card>
        </div>
      ) : null}
      {activeTab === "Discovery" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-2 text-lg font-semibold">Discovery</h2>
            <p className="text-sm text-text-muted">{product.discovery}</p>
          </Card>
          <Card>
            <h2 className="mb-2 text-lg font-semibold">JTBD</h2>
            <div className="grid gap-2">
              {product.jtbd.map((job) => <p key={job.statement} className="text-sm text-text-muted">{job.statement}</p>)}
            </div>
          </Card>
        </div>
      ) : null}
      {activeTab === "Frameworks" ? (
        <Section>
          <h2 className="text-lg font-semibold">Frameworks</h2>
          <div className="flex flex-wrap gap-2">
            {frameworks.map((framework) => <Badge key={framework.id}>{framework.name}</Badge>)}
          </div>
        </Section>
      ) : null}
      {activeTab === "PRD" ? (
        <Card>
          <h2 className="mb-2 text-lg font-semibold">PRD</h2>
          <p className="text-sm text-text-muted">{product.prd}</p>
        </Card>
      ) : null}
      {activeTab === "Review" ? (
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Review</h2>
          <div className="flex items-center gap-2">
            <Status tone={productReview?.status === "approved" ? "success" : "warning"}>{productReview?.status ?? "not_reviewed"}</Status>
            <span className="text-sm text-text-muted">Score: {productReview?.score ?? 0}</span>
          </div>
        </Card>
      ) : null}
    </Page>
  );
}

