import { describe, expect, it } from "vitest";
import { resolveTranscriptionSummaryV3RuntimeConfig } from "./runtime-config";

describe("transcription summary v3 runtime config", () => {
  it("requires and enables v3 only for the target product in Preview", () => {
    const environment = {
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      TRANSCRIPTION_SUMMARY_V3_ENABLED: "true",
      TRANSCRIPTION_SUMMARY_V3_CRM_DRY_RUN: "true",
    };
    expect(resolveTranscriptionSummaryV3RuntimeConfig(
      "project_transcription_summary_module",
      environment,
    )).toEqual({
      transcriptionSummaryV3Enabled: true,
      transcriptionSummaryV3CrmDryRun: true,
      transcriptionSummaryV3Required: true,
      transcriptionSummaryV3PipelineVersion: "3.0.0",
    });
    expect(resolveTranscriptionSummaryV3RuntimeConfig(
      "unrelated_product",
      environment,
    )).toMatchObject({
      transcriptionSummaryV3Enabled: false,
      transcriptionSummaryV3Required: false,
    });
  });

  it("fails closed in Preview when a required flag is missing", () => {
    expect(resolveTranscriptionSummaryV3RuntimeConfig(
      "project_transcription_summary_module",
      {
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        TRANSCRIPTION_SUMMARY_V3_ENABLED: "true",
      },
    )).toMatchObject({
      transcriptionSummaryV3Enabled: false,
      transcriptionSummaryV3CrmDryRun: false,
      transcriptionSummaryV3Required: true,
    });
  });

  it("keeps production v3 disabled and not required", () => {
    expect(resolveTranscriptionSummaryV3RuntimeConfig(
      "project_transcription_summary_module",
      {
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        TRANSCRIPTION_SUMMARY_V3_ENABLED: "true",
        TRANSCRIPTION_SUMMARY_V3_CRM_DRY_RUN: "true",
      },
    )).toMatchObject({
      transcriptionSummaryV3Enabled: false,
      transcriptionSummaryV3CrmDryRun: true,
      transcriptionSummaryV3Required: false,
    });
  });
});
