"use client";

import * as React from "react";
import { isPipelineLabV3RunMessage, type PipelineLabV3RunPayload } from "@/shared/model/pipeline-lab-v3-message";

/**
 * Embeds `public/pipeline-lab-v3.html` -- a standalone, pre-built HTML/CSS/JS
 * tool (10-stage call-analysis pipeline tester) provided as-is and
 * deliberately NOT modified or ported into this app's React/Zustand
 * architecture, beyond two small additive hooks (productId-namespaced
 * config storage + a postMessage bridge on run completion) needed to make
 * it usable per-product from Playground and to feed Dashboard's run
 * history. Rendered via `<iframe>` so its own inline scripts/styles run
 * in an isolated document, untouched by this app's CSS/React tree.
 *
 * `productId` and `onRunComplete` are both optional: without them this
 * renders byte-for-byte the same as before (the hidden standalone
 * "Pipeline Lab v3" route still uses it that way).
 */
export type PipelineLabV3ScreenProps = Readonly<{
  productId?: string;
  onRunComplete?: (payload: PipelineLabV3RunPayload) => void;
}>;

export function PipelineLabV3Screen({ productId, onRunComplete }: PipelineLabV3ScreenProps) {
  React.useEffect(() => {
    if (!onRunComplete) return;
    const handleMessage = (event: MessageEvent) => {
      if (!isPipelineLabV3RunMessage(event.data)) return;
      if (productId && event.data.productId !== productId) return;
      onRunComplete(event.data.payload);
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [productId, onRunComplete]);

  const src = productId ? `/pipeline-lab-v3.html?productId=${encodeURIComponent(productId)}` : "/pipeline-lab-v3.html";

  return (
    <div className="h-full min-h-0 w-full">
      <iframe src={src} title="Pipeline Lab v3" className="h-full w-full border-0" />
    </div>
  );
}
