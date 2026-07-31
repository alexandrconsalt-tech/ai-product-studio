import type { PipelineContractManifest } from "../contracts/contract-types";

export const V3_RUNTIME_CONFIGURATION = Object.freeze({
  pipelineVersion: "3.0.0",
  stageVersion: "3.0.0",
  provider: "openai-direct",
  contractFamily: "v3",
  structuredOutputRequired: true,
  parserFallbackEnabled: false,
} as const);

export type V3RuntimeConfiguration = typeof V3_RUNTIME_CONFIGURATION;

export type V3RuntimeConfigurationError = Readonly<{
  status: "TECHNICAL_ERROR";
  errorCode: "V3_RUNTIME_CONFIGURATION_MISMATCH";
  message: string;
}>;

export function validateV3RuntimeConfiguration(input: {
  configuration: V3RuntimeConfiguration;
  manifest: PipelineContractManifest;
}): V3RuntimeConfigurationError | null {
  const configuration = input.configuration;
  const mismatches = [
    configuration.pipelineVersion !== V3_RUNTIME_CONFIGURATION.pipelineVersion
      ? `pipeline_version=${configuration.pipelineVersion}`
      : null,
    configuration.stageVersion !== V3_RUNTIME_CONFIGURATION.stageVersion
      ? `stage_version=${configuration.stageVersion}`
      : null,
    configuration.provider !== V3_RUNTIME_CONFIGURATION.provider
      ? `provider=${configuration.provider}`
      : null,
    configuration.contractFamily !== V3_RUNTIME_CONFIGURATION.contractFamily
      ? `contract_family=${configuration.contractFamily}`
      : null,
    configuration.structuredOutputRequired !== true
      ? "structured_output_required=false"
      : null,
    configuration.parserFallbackEnabled !== false
      ? "parser_fallback_enabled=true"
      : null,
    input.manifest.pipelineVersion !== V3_RUNTIME_CONFIGURATION.pipelineVersion
      ? `manifest_pipeline_version=${input.manifest.pipelineVersion}`
      : null,
    ...Object.values(input.manifest.contracts).flatMap((contract) => {
      const issues: string[] = [];
      if (/transcription_summary_v1/i.test(contract.id)) issues.push(`contract_id=${contract.id}`);
      if (contract.version.startsWith("1.")) issues.push(`contract_version=${contract.version}`);
      return issues;
    }),
  ].filter((value): value is string => value !== null);

  return mismatches.length
    ? {
        status: "TECHNICAL_ERROR",
        errorCode: "V3_RUNTIME_CONFIGURATION_MISMATCH",
        message: mismatches.join(", "),
      }
    : null;
}
