import type { PipelineContractManifest } from "../contracts/contract-types";
import {
  CRM_PUBLICATION_POLICY_ID,
  CRM_PUBLICATION_POLICY_VERSION,
  CrmPublicationInputV3Contract,
  CrmPublicationInputV3Schema,
  type CrmPublicationInputV3,
} from "../contracts/crm-publication-input/v3/contract";
import { CrmPublicationResultV3Contract } from "../contracts/crm-publication-result/v3/contract";
import { validateContractManifest } from "../contracts/manifest";
import { executeSummaryQualityGateV3 } from "../quality-gate";
import { calculateConversationStoreContentHash } from "../store";
import { calculateSummaryContentHash } from "../summary-judges/input-builder";

export type BuildCrmPublicationInputResult =
  | Readonly<{ ok: true; value: CrmPublicationInputV3 }>
  | Readonly<{
      ok: false;
      disposition: "NOT_RUN" | "TECHNICAL_ERROR";
      errorCode: "CRM_INPUT_INVALID" | "CRM_HASH_MISMATCH";
    }>;

function phase8ManifestValid(manifest: PipelineContractManifest): boolean {
  const input = manifest.contracts.crmPublicationInput;
  const result = manifest.contracts.crmPublicationResult;
  return input?.id === CrmPublicationInputV3Contract.id
    && input.version === CrmPublicationInputV3Contract.version
    && result?.id === CrmPublicationResultV3Contract.id
    && result.version === CrmPublicationResultV3Contract.version;
}

export function buildCrmPublicationInputV3(input: {
  manifest: PipelineContractManifest;
  executionId: string;
  conversationStore: unknown;
  summary: unknown;
  qualityGate: unknown | null | undefined;
  target: unknown;
  dryRun: boolean;
}): BuildCrmPublicationInputResult {
  try {
    validateContractManifest(input.manifest);
  } catch {
    return { ok: false, disposition: "TECHNICAL_ERROR", errorCode: "CRM_HASH_MISMATCH" };
  }
  if (!phase8ManifestValid(input.manifest)) {
    return { ok: false, disposition: "TECHNICAL_ERROR", errorCode: "CRM_INPUT_INVALID" };
  }
  if (!input.conversationStore || typeof input.conversationStore !== "object") {
    return { ok: false, disposition: "TECHNICAL_ERROR", errorCode: "CRM_INPUT_INVALID" };
  }
  const store = input.conversationStore as Record<string, unknown>;
  const contentHash = typeof store.content_hash === "string" ? store.content_hash : "";
  const { content_hash: _ignored, ...hashableStore } = store;
  const calculatedStoreHash = calculateConversationStoreContentHash(hashableStore);
  const summaryHash = calculateSummaryContentHash(input.summary);
  if (contentHash !== calculatedStoreHash) {
    return { ok: false, disposition: "TECHNICAL_ERROR", errorCode: "CRM_HASH_MISMATCH" };
  }
  const meta = store.meta as Record<string, unknown> | undefined;
  const qualityGate = input.qualityGate ?? executeSummaryQualityGateV3({
    manifest: input.manifest,
    conversationStore: input.conversationStore,
    summary: input.summary,
    verdicts: [],
  }).value;
  const value = {
    meta: {
      runId: meta?.run_id,
      executionId: input.executionId,
      productId: input.manifest.productId,
      pipelineId: input.manifest.pipelineId,
      pipelineVersion: input.manifest.pipelineVersion,
      manifestHash: input.manifest.manifestHash,
      storeId: meta?.store_id,
      storeContentHash: contentHash,
      summaryHash,
      qualityGatePolicyVersion: "3.0.0",
    },
    conversationStore: input.conversationStore,
    summary: input.summary,
    qualityGate,
    target: input.target,
    publicationPolicy: {
      policyId: CRM_PUBLICATION_POLICY_ID,
      policyVersion: CRM_PUBLICATION_POLICY_VERSION,
      dryRun: input.dryRun,
    },
  };
  const parsed = CrmPublicationInputV3Schema.safeParse(value);
  if (!parsed.success) {
    const hashMismatch = parsed.error.issues.some((issue) => /hash|provenance/i.test(issue.message));
    return {
      ok: false,
      disposition: "TECHNICAL_ERROR",
      errorCode: hashMismatch ? "CRM_HASH_MISMATCH" : "CRM_INPUT_INVALID",
    };
  }
  return { ok: true, value: parsed.data };
}
