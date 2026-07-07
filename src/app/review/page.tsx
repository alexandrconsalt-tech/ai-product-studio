import { Suspense } from "react";
import { ReviewWorkspace } from "@/features/summary-review/review-workspace";

export default function ReviewPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-background text-foreground" />}>
      <ReviewWorkspace />
    </Suspense>
  );
}

