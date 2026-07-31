import type { CrmPublicationInputV3 } from "../contracts/crm-publication-input/v3/contract";

export type CrmPublicationPolicyDecision = Readonly<{
  allowed: true;
  reasonCode: "SUMMARY_SAVE_ALLOWED";
}>;

export function evaluateCrmPublicationPolicyV3(
  _decision: CrmPublicationInputV3["qualityGate"]["decision"],
): CrmPublicationPolicyDecision {
  return { allowed: true, reasonCode: "SUMMARY_SAVE_ALLOWED" };
}
