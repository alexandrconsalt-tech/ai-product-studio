import type { z } from "zod";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type JsonSchema = Readonly<Record<string, unknown>>;

export type ContractStatus = "draft" | "active" | "deprecated";

export type ProviderCapabilityRequirements = Readonly<{
  structuredOutput: boolean;
  jsonSchemaDraft: "2020-12";
}>;

export type CompatibilityMetadata = Readonly<{
  reads: readonly string[];
  writes: string;
}>;

export type MigrationMetadata = Readonly<{
  acceptsLegacyVersions: readonly string[];
  migrationPolicyId: string | null;
}>;

export type FixtureKind =
  | "valid"
  | "missing_required"
  | "extra_legacy_field"
  | "invalid_enum"
  | "invalid_nested_type";

export type ContractFixtures = Readonly<Record<FixtureKind, JsonValue>>;

export type ContractDefinition<
  TSchema extends z.ZodType = z.ZodType,
  TTransportSchema extends z.ZodType = TSchema,
> = Readonly<{
  id: string;
  version: string;
  stageId: string;
  productId: string;
  schema: JsonSchema;
  transportValidator: TTransportSchema;
  validator: TSchema;
  schemaHash: string;
  domainSchema: JsonSchema;
  domainSchemaHash: string;
  status: ContractStatus;
  createdAt: string;
  description: string;
  canonicalEnums: readonly string[];
  normalizationPolicyId: string;
  repairPolicyId: string;
  providerCapabilities: ProviderCapabilityRequirements;
  backwardCompatibility: CompatibilityMetadata;
  migration: MigrationMetadata;
  fixtures: ContractFixtures;
}>;

export type InferContract<TContract extends ContractDefinition> = z.infer<TContract["validator"]>;
export type InferTransportContract<TContract extends ContractDefinition> = z.infer<TContract["transportValidator"]>;

export type ContractReference = Readonly<{
  id: string;
  version: string;
  stageId: string;
  productId: string;
  schemaHash: string;
  domainSchemaHash: string;
  normalizationPolicyId: string;
  status: ContractStatus;
}>;

export const CONTRACT_ROLES = [
  "transcript",
  "facts",
  "factJudge",
  "factsVerified",
  "needs",
  "needJudge",
  "needsVerified",
  "outcome",
  "outcomeJudge",
  "outcomeVerified",
  "conversationStore",
  "summaryInput",
  "summary",
  "summaryJudgeInput",
  "summaryJudges",
  "qualityGateInput",
  "qualityGate",
  "crmPublicationInput",
  "crmPublicationResult",
  "pipelineReport",
] as const;

export type ContractRole = (typeof CONTRACT_ROLES)[number];

export type PipelineContractManifest = Readonly<{
  productId: string;
  pipelineId: string;
  pipelineVersion: string;
  mode: "diagnostic" | "runtime";
  contracts: Readonly<Record<ContractRole, ContractReference>>;
  manifestHash: string;
}>;
