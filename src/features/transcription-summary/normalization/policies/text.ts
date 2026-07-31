import type { NormalizationPolicy, NormalizationRule } from "../types";

const trimOnlyRules: readonly NormalizationRule[] = [
  { id: "text.unicode-nfc", input: /[\s\S]*/u, output: "$nfc", caseSensitive: true, description: "Unicode NFC normalization." },
  { id: "text.trim", input: /^\s+|\s+$/gu, output: "", caseSensitive: true, description: "Remove technical leading and trailing whitespace." },
];

const normalizedTextRules: readonly NormalizationRule[] = [
  ...trimOnlyRules,
  { id: "text.collapse-spaces", input: /[ \t]{2,}/gu, output: " ", caseSensitive: true, description: "Collapse repeated horizontal whitespace." },
];

const paths: Readonly<Record<string, ReadonlyArray<readonly [string, "trim" | "collapse"]>>> = {
  "facts.agent.output.v3": [
    ["confirmed_facts.*.predicate", "collapse"],
    ["confirmed_facts.*.value", "collapse"],
    ["client_questions.*.question", "collapse"],
    ["quotes.*.text", "trim"],
    ["contextual_statements.*.statement", "collapse"],
    ["rejected_assumptions.*.statement", "collapse"],
  ],
  "needs.agent.output.v3": [
    ["business_needs.*.need_type", "collapse"],
    ["business_needs.*.value", "collapse"],
    ["property_requirements.*.need_type", "collapse"],
    ["property_requirements.*.value", "collapse"],
    ["client_questions.*.question", "collapse"],
  ],
  "outcome.agent.output.v3": [
    ["call_result.description", "collapse"],
    ["agreements.*.action", "collapse"],
    ["agreements.*.deadline", "collapse"],
    ["primary_next_step.action", "collapse"],
    ["primary_next_step.deadline", "collapse"],
    ["unresolved_questions.*.question", "collapse"],
  ],
};

export const TEXT_POLICIES: readonly NormalizationPolicy[] = Object.freeze(
  Object.entries(paths).flatMap(([contractId, entries]) =>
    entries.map(([fieldPath, mode], index) => ({
      id: `normalization.${contractId.split(".")[0]}.text-${index + 1}.v3`,
      version: "3.0.0",
      contractIds: [contractId],
      fieldPath,
      mode: "whitespace" as const,
      rules: mode === "trim" ? trimOnlyRules : normalizedTextRules,
    })),
  ),
);
