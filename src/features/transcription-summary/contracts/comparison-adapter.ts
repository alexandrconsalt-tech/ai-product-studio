import type { JsonSchema, JsonValue } from "./contract-types";

export type ContractDiffCategory =
  | "missing_field"
  | "extra_field"
  | "enum_mismatch"
  | "type_mismatch"
  | "required_mismatch"
  | "legacy_field"
  | "version_conflict";

export type ContractDiff = Readonly<{
  category: ContractDiffCategory;
  path: string;
  current: JsonValue | null;
  draft: JsonValue | null;
}>;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function jsonValue(value: unknown): JsonValue | null {
  return value === undefined ? null : value as JsonValue;
}

function compareNode(
  current: Record<string, unknown>,
  draft: Record<string, unknown>,
  path: string,
  output: ContractDiff[],
): void {
  const currentProperties = record(current.properties);
  const draftProperties = record(draft.properties);
  const keys = new Set([...Object.keys(currentProperties), ...Object.keys(draftProperties)]);

  for (const key of [...keys].sort()) {
    const currentField = record(currentProperties[key]);
    const draftField = record(draftProperties[key]);
    const fieldPath = `${path}/properties/${key}`;
    if (!(key in currentProperties)) {
      output.push({ category: "missing_field", path: fieldPath, current: null, draft: jsonValue(draftProperties[key]) });
      continue;
    }
    if (!(key in draftProperties)) {
      output.push({
        category: /agreement_id|legacy|call_results/.test(key) ? "legacy_field" : "extra_field",
        path: fieldPath,
        current: jsonValue(currentProperties[key]),
        draft: null,
      });
      continue;
    }
    if (currentField.type !== draftField.type) {
      output.push({ category: "type_mismatch", path: fieldPath, current: jsonValue(currentField.type), draft: jsonValue(draftField.type) });
    }
    if (stableArray(currentField.enum) !== stableArray(draftField.enum)) {
      output.push({ category: "enum_mismatch", path: `${fieldPath}/enum`, current: jsonValue(currentField.enum), draft: jsonValue(draftField.enum) });
    }
    compareNode(currentField, draftField, fieldPath, output);
  }

  if (stableArray(current.required) !== stableArray(draft.required)) {
    output.push({ category: "required_mismatch", path: `${path}/required`, current: jsonValue(current.required), draft: jsonValue(draft.required) });
  }
}

function stableArray(value: unknown): string {
  return JSON.stringify(Array.isArray(value) ? [...value].sort() : value ?? null);
}

export function compareRuntimeAndDraftContracts(
  current: JsonSchema,
  draft: JsonSchema,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): readonly ContractDiff[] {
  if (environment.NODE_ENV === "production") {
    throw new Error("Contract comparison adapter is available only in dev/test");
  }
  const output: ContractDiff[] = [];
  compareNode(record(current), record(draft), "#", output);
  return output;
}
