import { describe, expect, it } from "vitest";
import { PipelineLabV3ConfigMessageSchema, PipelineRuntimeConfigSchema } from "@/shared/model/pipeline-lab-v3-message";
import { resolveTranscriptionSummaryV3RuntimeConfig } from "./runtime-config";

describe("iframe v3 config boundary", () => {
  it("is false by default and requires an explicit Vercel production scope", () => {
    expect(resolveTranscriptionSummaryV3RuntimeConfig("project_transcription_summary_module", {})).toEqual({
      transcriptionSummaryV3Enabled: false,
      transcriptionSummaryV3CrmDryRun: false,
      transcriptionSummaryV3Required: false,
      transcriptionSummaryV3PipelineVersion: "3.0.0",
    });
    expect(resolveTranscriptionSummaryV3RuntimeConfig("project_transcription_summary_module", {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      TRANSCRIPTION_SUMMARY_V3_ENABLED: "true",
      TRANSCRIPTION_SUMMARY_V3_CRM_DRY_RUN: "true",
    }).transcriptionSummaryV3Enabled).toBe(true);
  });

  it("allows only the scoped product in non-production", () => {
    const environment = {
      NODE_ENV: "test",
      TRANSCRIPTION_SUMMARY_V3_ENABLED: "true",
      TRANSCRIPTION_SUMMARY_V3_CRM_DRY_RUN: "true",
    };
    expect(resolveTranscriptionSummaryV3RuntimeConfig("project_transcription_summary_module", environment).transcriptionSummaryV3Enabled).toBe(true);
    expect(resolveTranscriptionSummaryV3RuntimeConfig("project_other", environment).transcriptionSummaryV3Enabled).toBe(false);
  });

  it("allows a Vercel Preview build but requires both explicit flags", () => {
    expect(resolveTranscriptionSummaryV3RuntimeConfig("project_transcription_summary_module", {
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      TRANSCRIPTION_SUMMARY_V3_ENABLED: "true",
      TRANSCRIPTION_SUMMARY_V3_CRM_DRY_RUN: "true",
    }).transcriptionSummaryV3Enabled).toBe(true);
    expect(resolveTranscriptionSummaryV3RuntimeConfig("project_transcription_summary_module", {
      VERCEL_ENV: "preview",
      TRANSCRIPTION_SUMMARY_V3_ENABLED: "true",
    }).transcriptionSummaryV3Enabled).toBe(false);
  });

  it("validates true/false typed messages and rejects invalid messages", () => {
    const config = {
      transcriptionSummaryV3Enabled: true,
      transcriptionSummaryV3CrmDryRun: true,
      transcriptionSummaryV3Required: true,
      transcriptionSummaryV3PipelineVersion: "3.0.0",
    };
    expect(PipelineRuntimeConfigSchema.safeParse(config).success).toBe(true);
    expect(PipelineRuntimeConfigSchema.safeParse({ ...config, transcriptionSummaryV3Enabled: false }).success).toBe(true);
    expect(PipelineLabV3ConfigMessageSchema.safeParse({
      source: "ai-communication-studio",
      type: "runtime-config",
      config: { ...config, transcriptionSummaryV3Enabled: "true" },
    }).success).toBe(false);
  });
});
