import {
  AI_SUMMARY_V3_PIPELINE_ID,
  AI_SUMMARY_V3_PIPELINE_VERSION,
  TRANSCRIPTION_SUMMARY_PRODUCT_ID,
} from "./constants";
import {
  CONTRACT_ROLES,
  type ContractReference,
  type ContractRole,
  type PipelineContractManifest,
} from "./contract-types";
import { getContract } from "./registry";
import { deepFreeze, stableStringify } from "./schema-utils";
import { createHash } from "node:crypto";

const MANIFEST_CONTRACT_IDS: Readonly<Record<ContractRole, string>> = Object.freeze({
  transcript: "transcript.validated.v3",
  facts: "facts.agent.output.v3",
  factJudge: "facts.judge.verdict.v3",
  factsVerified: "facts.verified.v3",
  needs: "needs.agent.output.v3",
  needJudge: "needs.judge.verdict.v3",
  needsVerified: "needs.verified.v3",
  outcome: "outcome.agent.output.v3",
  outcomeJudge: "outcome.judge.verdict.v3",
  outcomeVerified: "outcome.verified.v3",
  conversationStore: "conversation.store.v3",
  summaryInput: "summary.agent.input.v3",
  summary: "summary.content.v3",
  summaryJudgeInput: "summary.judge.input.v3",
  summaryJudges: "summary.judge.verdict.v3",
  qualityGateInput: "summary.quality-gate.input.v3",
  qualityGate: "summary.quality-gate.v3",
  crmPublicationInput: "crm.publication.input.v3",
  crmPublicationResult: "crm.publication.result.v3",
  pipelineReport: "pipeline.report.v3",
});

const MANIFEST_CONTRACT_VERSIONS: Readonly<Partial<Record<ContractRole, string>>> =
  Object.freeze({
    conversationStore: "3.2.0",
    summary: "3.1.0",
    summaryJudges: "3.1.0",
    qualityGate: "3.2.0",
    pipelineReport: "3.2.0",
  });

function toReference(contract: ReturnType<typeof getContract>): ContractReference {
  return {
    id: contract.id,
    version: contract.version,
    stageId: contract.stageId,
    productId: contract.productId,
    schemaHash: contract.schemaHash,
    domainSchemaHash: contract.domainSchemaHash,
    normalizationPolicyId: contract.normalizationPolicyId,
    status: contract.status,
  };
}

export function calculateManifestHash(
  manifest: Omit<PipelineContractManifest, "manifestHash"> | PipelineContractManifest,
): string {
  const { manifestHash: _ignored, ...hashable } = manifest as PipelineContractManifest;
  return createHash("sha256").update(stableStringify(hashable)).digest("hex");
}

export function createContractManifest(pipelineVersion: string): PipelineContractManifest {
  if (pipelineVersion !== AI_SUMMARY_V3_PIPELINE_VERSION) {
    throw new Error(`Unsupported pipeline version: ${pipelineVersion}`);
  }

  const contracts = Object.fromEntries(
    CONTRACT_ROLES.map((role) => [
      role,
      toReference(getContract(
        MANIFEST_CONTRACT_IDS[role],
        MANIFEST_CONTRACT_VERSIONS[role] ?? pipelineVersion,
      )),
    ]),
  ) as Record<ContractRole, ContractReference>;

  const base = {
    productId: TRANSCRIPTION_SUMMARY_PRODUCT_ID,
    pipelineId: AI_SUMMARY_V3_PIPELINE_ID,
    pipelineVersion: AI_SUMMARY_V3_PIPELINE_VERSION,
    mode: "diagnostic" as const,
    contracts,
  };
  return deepFreeze({ ...base, manifestHash: calculateManifestHash(base) });
}

export function validateContractManifest(manifest: PipelineContractManifest): true {
  if (manifest.productId !== TRANSCRIPTION_SUMMARY_PRODUCT_ID) {
    throw new Error(`Manifest product mismatch: ${manifest.productId}`);
  }
  if (
    manifest.pipelineId !== AI_SUMMARY_V3_PIPELINE_ID
    || manifest.pipelineVersion !== AI_SUMMARY_V3_PIPELINE_VERSION
  ) {
    throw new Error("Manifest pipeline identity mismatch");
  }

  for (const role of CONTRACT_ROLES) {
    const reference = manifest.contracts[role];
    if (!reference) throw new Error(`Manifest is missing contract role: ${role}`);
    const registered = getContract(reference.id, reference.version);
    if (
      registered.productId !== manifest.productId
      || registered.schemaHash !== reference.schemaHash
      || registered.domainSchemaHash !== reference.domainSchemaHash
      || registered.normalizationPolicyId !== reference.normalizationPolicyId
      || registered.stageId !== reference.stageId
    ) {
      throw new Error(`Manifest contract mismatch: ${role}`);
    }
    if (manifest.mode === "runtime" && registered.status !== "active") {
      throw new Error(`Draft contract cannot be used by runtime manifest: ${reference.id}`);
    }
  }

  for (const roles of [
    ["facts", "factJudge", "factsVerified"],
    ["needs", "needJudge", "needsVerified"],
    ["outcome", "outcomeJudge", "outcomeVerified"],
  ] as const) {
    const versions = new Set(roles.map((role) => manifest.contracts[role].version));
    if (versions.size !== 1) {
      throw new Error(`Manifest contract versions are incompatible: ${roles.join(", ")}`);
    }
  }

  if (calculateManifestHash(manifest) !== manifest.manifestHash) {
    throw new Error("Manifest hash mismatch");
  }
  return true;
}
