import type { NormalizationPolicy } from "../types";

const numericRules = [
  {
    id: "number.confidence.decimal-string",
    input: /^(?:0(?:\.\d+)?|1(?:\.0+)?)$/u,
    output: "$number",
    caseSensitive: true,
    description: "Decimal string in the closed confidence interval.",
  },
  {
    id: "number.confidence.percent-string",
    input: /^(?:\d|[1-9]\d|100)%$/u,
    output: "$percent",
    caseSensitive: true,
    description: "Integer percentage converted to a confidence ratio.",
  },
] as const;

const fields: Readonly<Record<string, readonly string[]>> = {
  "facts.agent.output.v3": [
    "confirmed_facts.*.confidence",
    "client_questions.*.confidence",
    "quotes.*.confidence",
    "contextual_statements.*.confidence",
    "rejected_assumptions.*.confidence",
  ],
  "needs.agent.output.v3": [
    "business_needs.*.confidence",
    "property_requirements.*.confidence",
    "structured_crm_attributes.interested_in.*.confidence",
    "structured_crm_attributes.funding_source.confidence",
    "structured_crm_attributes.purchase_term.confidence",
    "communication_preferences.*.confidence",
    "client_questions.*.confidence",
  ],
  "outcome.agent.output.v3": [
    "call_result.confidence",
    "agreements.*.confidence",
    "primary_next_step.confidence",
  ],
};

export const NUMBER_POLICIES: readonly NormalizationPolicy[] = Object.freeze(
  Object.entries(fields).flatMap(([contractId, fieldPaths]) =>
    fieldPaths.map((fieldPath, index) => ({
      id: `normalization.${contractId.split(".")[0]}.confidence-${index + 1}.v3`,
      version: "3.0.0",
      contractIds: [contractId],
      fieldPath,
      mode: "numeric" as const,
      rules: numericRules,
    })),
  ),
);

export const CONFIDENCE_TRANSPORT_STRING_PATTERN = /^(?:(?:0(?:\.\d+)?|1(?:\.0+)?)|(?:\d|[1-9]\d|100)%)$/u;
