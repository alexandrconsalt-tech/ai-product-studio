import { Suspense } from "react";
import { MvpShell } from "@/features/mvp/mvp-shell";

export default function HomePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-background text-foreground" />}>
      <MvpShell />
    </Suspense>
  );
}
