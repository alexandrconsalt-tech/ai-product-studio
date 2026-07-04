import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/**
 * Global Vitest setup (`vitest.config.ts`'s `setupFiles`), run once per
 * test file regardless of that file's `@vitest-environment`. Most of
 * this repository's tests are pure-logic and run under the default
 * `node` environment (no `document`) -- only screen/component tests
 * opt into `jsdom` via a `// @vitest-environment jsdom` docblock. The
 * `typeof document`/`typeof window` guards keep this file harmless for
 * those, so introducing component testing (2026-07-04, v2.0 audit item
 * P1 #5) doesn't require touching the 34 existing pure-logic test files.
 */
afterEach(() => {
  if (typeof document !== "undefined") {
    cleanup();
  }
});

/**
 * jsdom does not implement `ResizeObserver`. `@xyflow/react`'s
 * per-node measurement path already guards for this
 * (`typeof ResizeObserver === "undefined"`), but its container-level
 * `useResizeHandler` constructs one unconditionally -- without this
 * polyfill, rendering `PipelineScreen` (or any `<ReactFlow>` usage) in
 * a jsdom test throws `ReferenceError: ResizeObserver is not defined`.
 * A no-op stand-in is sufficient: these tests assert on rendered
 * content, not on real resize-driven layout.
 */
if (typeof window !== "undefined" && typeof window.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
