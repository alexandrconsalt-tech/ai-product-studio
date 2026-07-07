import { Suspense } from "react";
import { ReviewWorkspace } from "@/features/summary-review/review-workspace";

export default async function RunReviewPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  return (
    <Suspense fallback={<main className="min-h-screen bg-background text-foreground" />}>
      <ReviewWorkspace runId={runId} />
    </Suspense>
  );
}

