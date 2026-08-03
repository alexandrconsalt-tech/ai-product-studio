import {
  AI_SUMMARY_V3_PIPELINE_VERSION,
  TRANSCRIPTION_SUMMARY_V3_CRM_DRY_RUN_FLAG,
  TRANSCRIPTION_SUMMARY_V3_ENABLED_FLAG,
} from "@/features/transcription-summary/contracts/constants";

const ALLOWED_PRODUCT_IDS = new Set([
  "project_transcription_summary_module",
  "product_transcription_summary_module",
]);

export function resolveTranscriptionSummaryV3RuntimeConfig(
  productId: string | null,
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  const isPreview = environment.VERCEL_ENV === "preview";
  const isProduction = environment.VERCEL_ENV === "production";
  const allowedEnvironment = isPreview || isProduction || environment.NODE_ENV !== "production";
  const enabledFlag = environment[TRANSCRIPTION_SUMMARY_V3_ENABLED_FLAG] === "true";
  const crmDryRun = environment[TRANSCRIPTION_SUMMARY_V3_CRM_DRY_RUN_FLAG] === "true";
  const productScoped = productId !== null && ALLOWED_PRODUCT_IDS.has(productId);
  return {
    transcriptionSummaryV3Enabled:
      allowedEnvironment
      && enabledFlag
      && crmDryRun
      && productScoped,
    transcriptionSummaryV3CrmDryRun: crmDryRun,
    transcriptionSummaryV3Required: (isPreview || isProduction) && productScoped,
    transcriptionSummaryV3PipelineVersion: AI_SUMMARY_V3_PIPELINE_VERSION,
  };
}
