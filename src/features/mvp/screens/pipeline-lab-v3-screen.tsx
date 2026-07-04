"use client";

/**
 * Embeds `public/pipeline-lab-v3.html` -- a standalone, pre-built HTML/CSS/JS
 * tool (10-stage call-analysis pipeline tester) provided as-is and
 * deliberately NOT modified or ported into this app's React/Zustand
 * architecture. Rendered via `<iframe>` so its own inline scripts/styles run
 * in an isolated document, untouched by this app's CSS/React tree.
 */
export function PipelineLabV3Screen() {
  return (
    <div className="h-full min-h-0 w-full">
      <iframe src="/pipeline-lab-v3.html" title="Pipeline Lab v3" className="h-full w-full border-0" />
    </div>
  );
}
