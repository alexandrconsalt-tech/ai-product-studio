"use client";

import * as React from "react";
import {
  PipelineRuntimeConfigSchema,
  isPipelineLabV3RunMessage,
  type PipelineLabV3ConfigMessage,
  type PipelineLabV3RunPayload,
  type PipelineRuntimeConfig,
} from "@/shared/model/pipeline-lab-v3-message";
import { useUiStore } from "@/shared/stores/ui-store";

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
 * `productId`, `productName` and `onRunComplete` are all optional:
 * without them this renders byte-for-byte the same as before (the
 * hidden standalone "Pipeline Lab v3" route still uses it that way).
 * `productName` is shown in the tool's own header instead of its
 * previous hardcoded "Тестовый стенд AI-пайплайнов" branding, so the
 * embedded tool reads consistently as "this product's test bench"
 * rather than a fixed call-analysis-flavored name.
 */
export type PipelineLabV3ScreenProps = Readonly<{
  productId?: string;
  productName?: string;
  preset?: "default" | "blank";
  onRunComplete?: (payload: PipelineLabV3RunPayload) => void;
}>;

export function PipelineLabV3Screen({ productId, productName, preset, onRunComplete }: PipelineLabV3ScreenProps) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [runtimeConfig, setRuntimeConfig] = React.useState<PipelineRuntimeConfig | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (productId) params.set("productId", productId);
    void fetch(`/api/transcription-summary-v3/config?${params.toString()}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((value: unknown) => {
        const parsed = PipelineRuntimeConfigSchema.safeParse(value);
        setRuntimeConfig(parsed.success ? parsed.data : null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setRuntimeConfig(null);
      });
    return () => controller.abort();
  }, [productId]);

  const sendRuntimeConfig = React.useCallback(() => {
    if (!runtimeConfig) return;
    const message: PipelineLabV3ConfigMessage = {
      source: "ai-communication-studio",
      type: "runtime-config",
      config: runtimeConfig,
    };
    iframeRef.current?.contentWindow?.postMessage(message, window.location.origin);
  }, [runtimeConfig]);

  React.useEffect(() => {
    sendRuntimeConfig();
  }, [sendRuntimeConfig]);

  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mobileViewport = window.matchMedia("(max-width: 640px)");
    const initiallyCollapsed = useUiStore.getState().sidebarCollapsed;
    let collapsedForModule = false;
    const syncSidebar = () => {
      if (mobileViewport.matches && !useUiStore.getState().sidebarCollapsed) {
        useUiStore.setState({ sidebarCollapsed: true });
        collapsedForModule = true;
      } else if (!mobileViewport.matches && collapsedForModule) {
        useUiStore.setState({ sidebarCollapsed: initiallyCollapsed });
        collapsedForModule = false;
      }
    };
    syncSidebar();
    mobileViewport.addEventListener("change", syncSidebar);
    return () => {
      mobileViewport.removeEventListener("change", syncSidebar);
      if (collapsedForModule) useUiStore.setState({ sidebarCollapsed: initiallyCollapsed });
    };
  }, []);

  React.useEffect(() => {
    if (!onRunComplete) return;
    const handleMessage = (event: MessageEvent) => {
      if (!isPipelineLabV3RunMessage(event.data)) return;
      if (productId && event.data.productId && event.data.productId !== productId) return;
      onRunComplete(event.data.payload);
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [productId, onRunComplete]);

  const params = new URLSearchParams();
  if (productId) params.set("productId", productId);
  if (productName) params.set("productName", productName);
  if (preset) params.set("preset", preset);
  const query = params.toString();
  const src = query ? `/pipeline-lab-v3.html?${query}` : "/pipeline-lab-v3.html";

  return (
    <div className="h-full min-h-0 w-full">
      <iframe ref={iframeRef} src={src} title="Pipeline Lab v3" className="h-full w-full border-0" onLoad={sendRuntimeConfig} />
    </div>
  );
}
