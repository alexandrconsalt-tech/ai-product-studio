import { TRANSCRIPTION_SUMMARY_V3_REGISTRY_FLAG } from "./constants";
import { TRANSCRIPTION_SUMMARY_CONTRACTS } from "./registry";

export function isTranscriptionSummaryV3RegistryDiagnosticEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return environment[TRANSCRIPTION_SUMMARY_V3_REGISTRY_FLAG] === "true";
}

export function loadDiagnosticContractRegistry(
  environment?: Readonly<Record<string, string | undefined>>,
) {
  if (!isTranscriptionSummaryV3RegistryDiagnosticEnabled(environment)) return null;
  return TRANSCRIPTION_SUMMARY_CONTRACTS;
}
