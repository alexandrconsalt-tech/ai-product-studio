import { createHash } from "node:crypto";
import { z } from "zod";
import {
  CONTRACT_CREATED_AT,
  CONTRACT_VERSION_V3,
  TRANSCRIPTION_SUMMARY_PRODUCT_ID,
} from "./constants";
import type { ContractDefinition, ContractFixtures, ContractStatus, JsonSchema } from "./contract-types";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function calculateSchemaHash(schema: JsonSchema): string {
  return createHash("sha256").update(stableStringify(schema)).digest("hex");
}

export function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}

type DefineContractInput<TSchema extends z.ZodType, TTransportSchema extends z.ZodType> = {
  id: string;
  version?: string;
  stageId: string;
  description: string;
  validator: TSchema;
  transportValidator?: TTransportSchema;
  fixtures: ContractFixtures;
  canonicalEnums?: readonly string[];
  status?: ContractStatus;
  normalizationPolicyId?: string;
  repairPolicyId?: string;
  structuredOutput?: boolean;
  backwardCompatibility?: {
    reads: readonly string[];
    writes: string;
  };
  migration?: {
    acceptsLegacyVersions: readonly string[];
    migrationPolicyId: string | null;
  };
};

const OPENAI_UNSUPPORTED_SCHEMA_KEYWORDS = new Set([
  "$schema",
  "default",
  "examples",
  "minLength",
  "maxLength",
  "oneOf",
]);

function toOpenAiStructuredOutputSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toOpenAiStructuredOutputSchema);
  if (!value || typeof value !== "object") return value;

  const source = value as Record<string, unknown>;
  const required = new Set(
    Array.isArray(source.required)
      ? source.required.filter((item): item is string => typeof item === "string")
      : [],
  );
  const entries = Object.entries(source).flatMap(([key, entry]) => {
    if (key === "oneOf") {
      return [["anyOf", toOpenAiStructuredOutputSchema(entry)] as const];
    }
    if (OPENAI_UNSUPPORTED_SCHEMA_KEYWORDS.has(key)) return [];
    if (key === "properties" && entry && typeof entry === "object" && !Array.isArray(entry)) {
      const properties = Object.fromEntries(
        Object.entries(entry as Record<string, unknown>)
          .filter(([property]) => required.has(property))
          .map(([property, propertySchema]) => [
            property,
            toOpenAiStructuredOutputSchema(propertySchema),
          ]),
      );
      return [[key, properties] as const];
    }
    return [[key, toOpenAiStructuredOutputSchema(entry)] as const];
  });
  const result = Object.fromEntries(entries);
  if (result.type === "object" && !Array.isArray(result.required)) {
    result.required = [];
  }
  return result;
}

export function defineContract<
  const TSchema extends z.ZodType,
  const TTransportSchema extends z.ZodType = TSchema,
>(
  input: DefineContractInput<TSchema, TTransportSchema>,
): ContractDefinition<TSchema, TTransportSchema> {
  const transportValidator = (input.transportValidator ?? input.validator) as TTransportSchema;
  const schema = deepFreeze(
    toOpenAiStructuredOutputSchema(z.toJSONSchema(transportValidator)) as JsonSchema,
  );
  const domainSchema = deepFreeze(z.toJSONSchema(input.validator) as JsonSchema);
  const version = input.version ?? CONTRACT_VERSION_V3;
  return Object.freeze({
    id: input.id,
    version,
    stageId: input.stageId,
    productId: TRANSCRIPTION_SUMMARY_PRODUCT_ID,
    schema,
    transportValidator,
    validator: input.validator,
    schemaHash: calculateSchemaHash(schema),
    domainSchema,
    domainSchemaHash: calculateSchemaHash(domainSchema),
    status: input.status ?? "draft",
    createdAt: CONTRACT_CREATED_AT,
    description: input.description,
    canonicalEnums: Object.freeze([...(input.canonicalEnums ?? [])]),
    normalizationPolicyId: input.normalizationPolicyId ?? "normalization.none.v1",
    repairPolicyId: input.repairPolicyId ?? "repair.structured-once.v1",
    providerCapabilities: Object.freeze({
      structuredOutput: input.structuredOutput ?? true,
      jsonSchemaDraft: "2020-12" as const,
    }),
    backwardCompatibility: Object.freeze({
      reads: input.backwardCompatibility?.reads ?? [`${input.id}@${version}`],
      writes: input.backwardCompatibility?.writes ?? `${input.id}@${version}`,
    }),
    migration: Object.freeze({
      acceptsLegacyVersions: input.migration?.acceptsLegacyVersions ?? [],
      migrationPolicyId: input.migration?.migrationPolicyId ?? null,
    }),
    fixtures: deepFreeze(input.fixtures),
  });
}
