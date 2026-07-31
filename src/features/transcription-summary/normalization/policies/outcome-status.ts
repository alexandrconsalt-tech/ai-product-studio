import { OUTCOME_STATUS_VALUES } from "../../contracts/canonical-enums";
import type { NormalizationPolicy } from "../types";

const rules = [
  ...OUTCOME_STATUS_VALUES.map((status) => ({
    id: `outcome.${status}.upper`,
    input: status.toUpperCase(),
    output: status,
    caseSensitive: true,
    description: "Регистровый технический alias Outcome status.",
  })),
  { id: "outcome.not-defined.space", input: "not defined", output: "not_defined", caseSensitive: false, description: "Технический вариант snake_case status." },
  { id: "outcome.not-defined.hyphen", input: "not-defined", output: "not_defined", caseSensitive: false, description: "Технический вариант snake_case status." },
] as const;

export const OUTCOME_STATUS_POLICIES: readonly NormalizationPolicy[] = Object.freeze([
  {
    id: "normalization.outcome.agreement-status.v3",
    version: "3.0.0",
    contractIds: ["outcome.agent.output.v3"],
    fieldPath: "agreements.*.status",
    mode: "alias",
    canonicalValues: OUTCOME_STATUS_VALUES,
    rules,
  },
  {
    id: "normalization.outcome.next-step-status.v3",
    version: "3.0.0",
    contractIds: ["outcome.agent.output.v3"],
    fieldPath: "primary_next_step.status",
    mode: "alias",
    canonicalValues: OUTCOME_STATUS_VALUES,
    rules,
  },
]);
