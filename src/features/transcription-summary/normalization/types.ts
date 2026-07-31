import type { ContractDefinition } from "../contracts/contract-types";

export type NormalizationMode = "alias" | "format" | "whitespace" | "numeric";

export type NormalizationRule = Readonly<{
  id: string;
  input: string | RegExp;
  output: string;
  caseSensitive: boolean;
  description: string;
}>;

export type NormalizationPolicy = Readonly<{
  id: string;
  version: string;
  contractIds: readonly string[];
  fieldPath: string;
  mode: NormalizationMode;
  rules: readonly NormalizationRule[];
  canonicalValues?: readonly string[];
  ambiguousInputs?: readonly string[];
}>;

export type NormalizationTransformation = Readonly<{
  transformationId: string;
  policyId: string;
  policyVersion: string;
  ruleId: string;
  contractId: string;
  contractVersion: string;
  itemId?: string;
  fieldPath: string;
  originalValue: unknown;
  normalizedValue: unknown;
  result: "applied" | "unchanged" | "rejected_ambiguous";
}>;

export type NormalizationErrorCode =
  | "NORMALIZATION_POLICY_NOT_FOUND"
  | "NORMALIZATION_ALIAS_UNKNOWN"
  | "NORMALIZATION_AMBIGUOUS"
  | "NORMALIZATION_OUTPUT_INVALID"
  | "NORMALIZATION_INVARIANT_VIOLATION";

export type NormalizationError = Readonly<{
  status: "TECHNICAL_ERROR";
  errorCode: NormalizationErrorCode;
  message: string;
  contractId: string;
  fieldPath?: string;
}>;

export type NormalizationResult<T> =
  | Readonly<{
      ok: true;
      value: T;
      transformations: readonly NormalizationTransformation[];
    }>
  | Readonly<{
      ok: false;
      error: NormalizationError;
      transformations: readonly NormalizationTransformation[];
    }>;

export type NormalizableContract = ContractDefinition;
