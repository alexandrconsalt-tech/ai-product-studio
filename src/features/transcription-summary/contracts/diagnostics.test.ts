import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { compareRuntimeAndDraftContracts } from "./comparison-adapter";
import {
  isTranscriptionSummaryV3RegistryDiagnosticEnabled,
  loadDiagnosticContractRegistry,
} from "./feature-flag";
import { OutcomeV3Contract } from "./outcome/v3/contract";

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });
}

describe("diagnostic-only registry controls", () => {
  it("keeps the feature flag disabled by default", () => {
    expect(isTranscriptionSummaryV3RegistryDiagnosticEnabled({})).toBe(false);
    expect(loadDiagnosticContractRegistry({})).toBeNull();
  });

  it("loads only diagnostic definitions when explicitly enabled", () => {
    const environment = { TRANSCRIPTION_SUMMARY_V3_CONTRACT_REGISTRY: "true" };
    expect(isTranscriptionSummaryV3RegistryDiagnosticEnabled(environment)).toBe(true);
    expect(loadDiagnosticContractRegistry(environment)).toHaveLength(26);
  });

  it("blocks the comparison adapter in production", () => {
    expect(() => compareRuntimeAndDraftContracts({}, {}, { NODE_ENV: "production" })).toThrow("only in dev/test");
  });

  it("reports legacy/type/required differences without changing either schema", () => {
    const current = {
      type: "object",
      properties: {
        call_results: { type: "array", items: { type: "string" } },
        agreement_id: { type: "string" },
      },
      required: ["call_results"],
    };
    const before = JSON.stringify(current);
    const draftBefore = JSON.stringify(OutcomeV3Contract.schema);
    const diff = compareRuntimeAndDraftContracts(current, OutcomeV3Contract.schema, { NODE_ENV: "test" });
    expect(diff.some((item) => item.category === "legacy_field")).toBe(true);
    expect(diff.some((item) => item.category === "missing_field")).toBe(true);
    expect(diff.some((item) => item.category === "required_mismatch")).toBe(true);
    expect(JSON.stringify(current)).toBe(before);
    expect(JSON.stringify(OutcomeV3Contract.schema)).toBe(draftBefore);
  });
});

describe("Phase 2 runtime boundary", () => {
  it("keeps the iframe flag message-only and fail-closed", () => {
    const root = process.cwd();
    const iframe = readFileSync(join(root, "public", "pipeline-lab-v3.html"), "utf8");
    const bridge = readFileSync(join(root, "src", "features", "mvp", "screens", "pipeline-lab-v3-screen.tsx"), "utf8");
    expect(iframe).toContain("transcriptionSummaryV3Enabled:false");
    expect(iframe).toContain("event.source!==window.parent");
    expect(iframe).not.toMatch(/localStorage[^;\n]*transcriptionSummaryV3Enabled/);
    expect(iframe).not.toMatch(/searchParams[^;\n]*transcriptionSummaryV3Enabled/i);
    expect(bridge).toContain("PipelineRuntimeConfigSchema.safeParse");
  });

  it("only imports contracts outside the feature in the scoped v3 API", () => {
    const srcRoot = join(process.cwd(), "src");
    const contractRoot = join(srcRoot, "features", "transcription-summary");
    const offenders = sourceFiles(srcRoot)
      .filter((path) => /\.(ts|tsx)$/.test(path))
      .filter((path) => !path.startsWith(contractRoot))
      .filter((path) => readFileSync(path, "utf8").includes("transcription-summary/contracts"))
      .map((path) => relative(srcRoot, path));
    expect(offenders).toEqual([
      "app/api/transcription-summary-v3/config/runtime-config.ts",
      "app/api/transcription-summary-v3/structured/route.ts",
    ]);
  });
});
