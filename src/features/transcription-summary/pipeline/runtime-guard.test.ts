import { describe, expect, it } from "vitest";
import { createContractManifest } from "../contracts/manifest";
import { AI_SUMMARY_V3_PIPELINE_VERSION } from "../contracts/constants";
import {
  V3_RUNTIME_CONFIGURATION,
  validateV3RuntimeConfiguration,
  type V3RuntimeConfiguration,
} from "./runtime-guard";

describe("v3 runtime configuration guard", () => {
  const manifest = createContractManifest(AI_SUMMARY_V3_PIPELINE_VERSION);

  it("accepts only the Phase 9 direct Structured Output runtime", () => {
    expect(validateV3RuntimeConfiguration({
      configuration: V3_RUNTIME_CONFIGURATION,
      manifest,
    })).toBeNull();
  });

  it.each([
    ["AI Tunnel", { provider: "ai-tunnel" }],
    ["stage v1", { stageVersion: "v1" }],
    ["contract family v1", { contractFamily: "transcription_summary_v1" }],
    ["parser fallback", { parserFallbackEnabled: true }],
    ["Structured Output disabled", { structuredOutputRequired: false }],
  ])("rejects %s with V3_RUNTIME_CONFIGURATION_MISMATCH", (_name, override) => {
    const configuration = {
      ...V3_RUNTIME_CONFIGURATION,
      ...override,
    } as unknown as V3RuntimeConfiguration;
    expect(validateV3RuntimeConfiguration({ configuration, manifest })).toMatchObject({
      status: "TECHNICAL_ERROR",
      errorCode: "V3_RUNTIME_CONFIGURATION_MISMATCH",
    });
  });
});
