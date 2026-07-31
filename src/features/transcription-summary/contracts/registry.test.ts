import { describe, expect, it } from "vitest";
import {
  AI_SUMMARY_V3_PIPELINE_VERSION,
  TRANSCRIPTION_SUMMARY_PRODUCT_ID,
} from "./constants";
import type { ContractDefinition, PipelineContractManifest } from "./contract-types";
import {
  calculateManifestHash,
  createContractManifest,
  validateContractManifest,
} from "./manifest";
import {
  getActiveContract,
  getContract,
  listContracts,
  TRANSCRIPTION_SUMMARY_CONTRACTS,
  validateRegistryDefinitions,
} from "./registry";
import { calculateSchemaHash } from "./schema-utils";

describe("Versioned Contract Registry", () => {
  it("contains one current contract per required role plus six deprecated contracts", () => {
    const contracts = listContracts(TRANSCRIPTION_SUMMARY_PRODUCT_ID);
    expect(contracts).toHaveLength(26);
    expect(contracts.filter((contract) => contract.status === "draft")).toHaveLength(20);
    expect(contracts.filter((contract) => contract.status === "deprecated")).toHaveLength(6);
    expect(new Set(contracts.map((contract) => contract.id)).size).toBe(20);
  });

  it("gets a contract only by explicit ID and version", () => {
    expect(getContract("needs.agent.output.v3", "3.0.0").stageId).toBe("needs_extract");
    expect(() => getContract("needs.agent.output.v3")).toThrow("version is required");
    expect(() => getContract("needs.agent.output.v3", "9.9.9")).toThrow("Unknown contract");
  });

  it("does not silently treat draft contracts as active", () => {
    expect(() => getActiveContract("needs_extract", TRANSCRIPTION_SUMMARY_PRODUCT_ID)).toThrow("No active contract");
  });

  it("rejects ambiguous active contracts", () => {
    const base = TRANSCRIPTION_SUMMARY_CONTRACTS[0];
    const definitions = [
      { ...base, id: "transcript.one", status: "active" as const },
      { ...base, id: "transcript.two", status: "active" as const },
    ] satisfies ContractDefinition[];
    expect(() => validateRegistryDefinitions(definitions)).toThrow("Ambiguous active contract");
  });

  it("isolates other products", () => {
    expect(listContracts("product_other")).toEqual([]);
  });

  it("calculates stable schema hashes independent of object key order", () => {
    const left = { type: "object", properties: { a: { type: "string" }, b: { type: "number" } } };
    const right = { properties: { b: { type: "number" }, a: { type: "string" } }, type: "object" };
    expect(calculateSchemaHash(left)).toBe(calculateSchemaHash(right));
  });

  it("keeps transport, canonical domain and normalization metadata in one contract definition", () => {
    const needs = getContract("needs.agent.output.v3", "3.0.0");
    expect(needs.schemaHash).toHaveLength(64);
    expect(needs.domainSchemaHash).toHaveLength(64);
    expect(needs.schemaHash).not.toBe(needs.domainSchemaHash);
    expect(needs.normalizationPolicyId).toBe("normalization.needs.v3");
    expect(needs.transportValidator.safeParse(needs.fixtures.invalid_enum).success).toBe(true);
    expect(needs.validator.safeParse(needs.fixtures.invalid_enum).success).toBe(false);
  });
});

describe("immutable diagnostic manifest", () => {
  it("contains all contracts and validates", () => {
    const manifest = createContractManifest(AI_SUMMARY_V3_PIPELINE_VERSION);
    expect(Object.keys(manifest.contracts)).toHaveLength(20);
    expect(manifest.mode).toBe("diagnostic");
    expect(validateContractManifest(manifest)).toBe(true);
  });

  it("is deeply immutable", () => {
    const manifest = createContractManifest(AI_SUMMARY_V3_PIPELINE_VERSION);
    expect(Object.isFrozen(manifest)).toBe(true);
    expect(Object.isFrozen(manifest.contracts)).toBe(true);
    expect(Object.isFrozen(manifest.contracts.needs)).toBe(true);
    expect(manifest.contracts.factsVerified.id).toBe("facts.verified.v3");
    expect(manifest.contracts.needsVerified.id).toBe("needs.verified.v3");
    expect(manifest.contracts.outcomeVerified.id).toBe("outcome.verified.v3");
    expect(manifest.contracts.conversationStore.version).toBe("3.2.0");
    expect(manifest.contracts.summaryInput.version).toBe("3.0.0");
    expect(manifest.contracts.summary.version).toBe("3.1.0");
    expect(manifest.contracts.summaryJudgeInput.version).toBe("3.0.0");
    expect(manifest.contracts.summaryJudges.version).toBe("3.1.0");
    expect(manifest.contracts.qualityGateInput.version).toBe("3.0.0");
    expect(manifest.contracts.qualityGate.version).toBe("3.2.0");
    expect(manifest.contracts.crmPublicationInput.version).toBe("3.0.0");
    expect(manifest.contracts.crmPublicationResult.version).toBe("3.0.0");
    expect(manifest.contracts.pipelineReport.version).toBe("3.2.0");
    expect(manifest.contracts.needs.normalizationPolicyId).toBe("normalization.needs.v3");
    expect(manifest.contracts.needs.domainSchemaHash).toHaveLength(64);
  });

  it("has a stable hash independent of contract key order", () => {
    const manifest = createContractManifest(AI_SUMMARY_V3_PIPELINE_VERSION);
    const reversedContracts = Object.fromEntries(Object.entries(manifest.contracts).reverse());
    expect(calculateManifestHash({ ...manifest, contracts: reversedContracts } as PipelineContractManifest)).toBe(manifest.manifestHash);
  });

  it("changes hash when one contract version changes", () => {
    const manifest = createContractManifest(AI_SUMMARY_V3_PIPELINE_VERSION);
    const changed = {
      ...manifest,
      contracts: {
        ...manifest.contracts,
        needs: { ...manifest.contracts.needs, version: "3.0.1" },
      },
    };
    expect(calculateManifestHash(changed as PipelineContractManifest)).not.toBe(manifest.manifestHash);
  });

  it("rejects incompatible Agent/Judge/Verified versions", () => {
    const manifest = createContractManifest(AI_SUMMARY_V3_PIPELINE_VERSION);
    const incompatible = {
      ...manifest,
      contracts: {
        ...manifest.contracts,
        factsVerified: { ...manifest.contracts.factsVerified, version: "3.0.1" },
      },
    } as PipelineContractManifest;
    expect(() => validateContractManifest(incompatible)).toThrow();
  });

  it("rejects unknown or missing contracts and product mixing", () => {
    const manifest = createContractManifest(AI_SUMMARY_V3_PIPELINE_VERSION);
    const missing = {
      ...manifest,
      contracts: { ...manifest.contracts, needs: undefined },
    } as unknown as PipelineContractManifest;
    expect(() => validateContractManifest(missing)).toThrow("missing contract role");

    const mixedProduct = {
      ...manifest,
      productId: "product_other",
    } as PipelineContractManifest;
    expect(() => validateContractManifest(mixedProduct)).toThrow("product mismatch");
  });

  it("rejects a different pipeline version or pipeline identity", () => {
    expect(() => createContractManifest("2.0.0")).toThrow("Unsupported pipeline version");

    const manifest = createContractManifest(AI_SUMMARY_V3_PIPELINE_VERSION);
    const mixedPipeline = {
      ...manifest,
      pipelineId: "pipeline.other",
      manifestHash: calculateManifestHash({ ...manifest, pipelineId: "pipeline.other" } as PipelineContractManifest),
    } as PipelineContractManifest;
    expect(() => validateContractManifest(mixedPipeline)).toThrow("pipeline identity mismatch");
  });

  it("rejects draft contracts in runtime mode", () => {
    const manifest = createContractManifest(AI_SUMMARY_V3_PIPELINE_VERSION);
    const runtime = {
      ...manifest,
      mode: "runtime",
      manifestHash: calculateManifestHash({ ...manifest, mode: "runtime" } as PipelineContractManifest),
    } as PipelineContractManifest;
    expect(() => validateContractManifest(runtime)).toThrow("Draft contract cannot be used");
  });
});
