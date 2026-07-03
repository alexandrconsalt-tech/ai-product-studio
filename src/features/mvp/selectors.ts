import type { RepositorySnapshot } from "@/shared/repositories/types";

export function getSelectedProject(snapshot: RepositorySnapshot | null, selectedProjectId: string | null) {
  return snapshot?.projects.find((project) => project.id === selectedProjectId) ?? snapshot?.projects[0] ?? null;
}

export function getProjectBundle(snapshot: RepositorySnapshot | null, selectedProjectId: string | null) {
  const project = getSelectedProject(snapshot, selectedProjectId);
  const product = project?.productId ? snapshot?.products.find((item) => item.id === project.productId) ?? null : null;
  const architecture = project?.architectureId ? snapshot?.architectures.find((item) => item.id === project.architectureId) ?? null : null;
  const pipeline = project?.pipelineId ? snapshot?.pipelines.find((item) => item.id === project.pipelineId) ?? null : null;
  const reviews = project ? snapshot?.reviews.filter((review) => project.reviewIds.includes(review.id)) ?? [] : [];
  const runs = project ? snapshot?.runs.filter((run) => project.playgroundRunIds.includes(run.id)) ?? [] : [];

  return { project, product, architecture, pipeline, reviews, runs };
}

