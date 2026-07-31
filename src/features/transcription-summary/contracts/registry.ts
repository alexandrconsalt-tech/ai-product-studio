import type { ContractDefinition } from "./contract-types";
import { CrmPublicationInputV3Contract } from "./crm-publication-input/v3/contract";
import { CrmPublicationResultV3Contract } from "./crm-publication-result/v3/contract";
import {
  getNormalizationPolicySetId,
  listNormalizationPolicies,
} from "../normalization/registry";
import {
  ConversationStoreV3Contract,
  DeprecatedConversationStoreV3_0Contract,
} from "./conversation-store/v3/contract";
import { FactJudgeV3Contract } from "./fact-judge/v3/contract";
import { FactsVerifiedV3Contract } from "./facts-verified/v3/contract";
import { FactsV3Contract } from "./facts/v3/contract";
import { NeedJudgeV3Contract } from "./need-judge/v3/contract";
import { NeedsVerifiedV3Contract } from "./needs-verified/v3/contract";
import { NeedsV3Contract } from "./needs/v3/contract";
import { OutcomeJudgeV3Contract } from "./outcome-judge/v3/contract";
import { OutcomeVerifiedV3Contract } from "./outcome-verified/v3/contract";
import { OutcomeV3Contract } from "./outcome/v3/contract";
import {
  DeprecatedPipelineReportV3_0Contract,
  DeprecatedPipelineReportV3_1Contract,
  PipelineReportV3Contract,
} from "./pipeline-report/v3/contract";
import {
  DeprecatedQualityGateV3_0Contract,
  QualityGateV3Contract,
} from "./quality-gate/v3/contract";
import { SummaryQualityGateInputV3Contract } from "./quality-gate-input/v3/contract";
import {
  DeprecatedSummaryJudgeV3_0Contract,
  SummaryJudgeV3Contract,
} from "./summary-judges/v3/contract";
import { SummaryJudgeInputV3Contract } from "./summary-judge-input/v3/contract";
import { SummaryAgentInputV3Contract } from "./summary-input/v3/contract";
import {
  DeprecatedSummaryV3_0Contract,
  SummaryV3Contract,
} from "./summary/v3/contract";
import { TranscriptV3Contract } from "./transcript/v3/contract";

export const TRANSCRIPTION_SUMMARY_CONTRACTS = Object.freeze([
  TranscriptV3Contract,
  FactsV3Contract,
  FactJudgeV3Contract,
  FactsVerifiedV3Contract,
  NeedsV3Contract,
  NeedJudgeV3Contract,
  NeedsVerifiedV3Contract,
  OutcomeV3Contract,
  OutcomeJudgeV3Contract,
  OutcomeVerifiedV3Contract,
  DeprecatedConversationStoreV3_0Contract,
  ConversationStoreV3Contract,
  SummaryAgentInputV3Contract,
  DeprecatedSummaryV3_0Contract,
  SummaryV3Contract,
  SummaryJudgeInputV3Contract,
  DeprecatedSummaryJudgeV3_0Contract,
  SummaryJudgeV3Contract,
  SummaryQualityGateInputV3Contract,
  DeprecatedQualityGateV3_0Contract,
  QualityGateV3Contract,
  CrmPublicationInputV3Contract,
  CrmPublicationResultV3Contract,
  DeprecatedPipelineReportV3_0Contract,
  DeprecatedPipelineReportV3_1Contract,
  PipelineReportV3Contract,
] as const);

export function validateRegistryDefinitions(
  definitions: readonly ContractDefinition[],
): void {
  const identities = new Set<string>();
  const activeStages = new Set<string>();

  for (const contract of definitions) {
    const identity = `${contract.productId}:${contract.id}@${contract.version}`;
    if (identities.has(identity)) throw new Error(`Duplicate contract: ${identity}`);
    identities.add(identity);

    if (contract.status === "active") {
      const stageIdentity = `${contract.productId}:${contract.stageId}`;
      if (activeStages.has(stageIdentity)) {
        throw new Error(`Ambiguous active contract for stage: ${stageIdentity}`);
      }
      activeStages.add(stageIdentity);
    }

    const expectedNormalizationPolicy = getNormalizationPolicySetId(contract.id);
    if (
      expectedNormalizationPolicy !== null
      && (
        contract.normalizationPolicyId !== expectedNormalizationPolicy
        || listNormalizationPolicies(contract.id).length === 0
      )
    ) {
      throw new Error(`Missing normalization policy set: ${identity}`);
    }
  }
}

validateRegistryDefinitions(TRANSCRIPTION_SUMMARY_CONTRACTS);

export function getContract(id: string, version?: string): ContractDefinition {
  if (!version) throw new Error(`Contract version is required for "${id}"`);
  const contract = TRANSCRIPTION_SUMMARY_CONTRACTS.find(
    (candidate) => candidate.id === id && candidate.version === version,
  );
  if (!contract) throw new Error(`Unknown contract: ${id}@${version}`);
  return contract;
}

export function getActiveContract(stageId: string, productId: string): ContractDefinition {
  const matches = TRANSCRIPTION_SUMMARY_CONTRACTS.filter(
    (contract) =>
      contract.stageId === stageId
      && contract.productId === productId
      && contract.status === "active",
  );
  if (matches.length !== 1) {
    throw new Error(
      matches.length === 0
        ? `No active contract for ${productId}:${stageId}`
        : `Ambiguous active contract for ${productId}:${stageId}`,
    );
  }
  return matches[0];
}

export function listContracts(productId: string): readonly ContractDefinition[] {
  return TRANSCRIPTION_SUMMARY_CONTRACTS.filter(
    (contract) => contract.productId === productId,
  );
}
