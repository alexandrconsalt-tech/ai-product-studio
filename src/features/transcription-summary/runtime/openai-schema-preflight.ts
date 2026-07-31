import type { JsonSchema } from "../contracts/contract-types";

export type OpenAiSchemaPreflightIssue = Readonly<{
  path: string;
  code: string;
  message: string;
}>;

export type OpenAiSchemaPreflightResult =
  | Readonly<{ ok: true; issues: readonly [] }>
  | Readonly<{ ok: false; issues: readonly OpenAiSchemaPreflightIssue[] }>;

const UNSUPPORTED_KEYWORDS = new Set([
  "$schema",
  "allOf",
  "default",
  "dependentRequired",
  "dependentSchemas",
  "else",
  "examples",
  "if",
  "maxLength",
  "minLength",
  "not",
  "oneOf",
  "patternProperties",
  "then",
  "uniqueItems",
]);

function pointer(path: readonly (string | number)[]): string {
  if (path.length === 0) return "$";
  return `$${path.map((part) => (
    typeof part === "number"
      ? `[${part}]`
      : `.${part.replaceAll("~", "~0").replaceAll("/", "~1")}`
  )).join("")}`;
}

export function validateOpenAIStructuredOutputSchema(
  schema: JsonSchema,
): OpenAiSchemaPreflightResult {
  const issues: OpenAiSchemaPreflightIssue[] = [];
  const seen = new Set<object>();

  function add(path: readonly (string | number)[], code: string, message: string) {
    issues.push({ path: pointer(path), code, message });
  }

  function visit(value: unknown, path: readonly (string | number)[]) {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, [...path, index]));
      return;
    }
    if (!value || typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);

    const object = value as Record<string, unknown>;
    for (const key of Object.keys(object)) {
      if (UNSUPPORTED_KEYWORDS.has(key)) {
        add([...path, key], "unsupported_keyword", `OpenAI Structured Outputs does not support "${key}"`);
      }
    }

    if (object.type === "object") {
      if (object.additionalProperties !== false) {
        add(
          [...path, "additionalProperties"],
          "additional_properties_must_be_false",
          "Every object must set additionalProperties to false",
        );
      }
      const properties = object.properties;
      const required = object.required;
      if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
        add([...path, "properties"], "object_properties_missing", "Object schema must define properties");
      } else if (!Array.isArray(required)) {
        add([...path, "required"], "required_missing", "Every object field must be required");
      } else {
        const requiredNames = new Set(required.filter((item): item is string => typeof item === "string"));
        for (const property of Object.keys(properties)) {
          if (!requiredNames.has(property)) {
            add(
              [...path, "properties", property],
              "property_not_required",
              `Property "${property}" must be listed in required`,
            );
          }
        }
      }
    }

    for (const [key, entry] of Object.entries(object)) visit(entry, [...path, key]);
  }

  if (schema.type !== "object") {
    add(["type"], "root_must_be_object", "Structured Output root schema must be an object");
  }
  if ("anyOf" in schema || "oneOf" in schema) {
    add([], "root_union_not_supported", "Structured Output root schema cannot be a union");
  }
  visit(schema, []);
  return issues.length === 0 ? { ok: true, issues: [] } : { ok: false, issues };
}
