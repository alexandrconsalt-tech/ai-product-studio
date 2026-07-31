import { PARTY_VALUES, RECIPIENT_VALUES, SPEAKER_ROLES } from "../../contracts/canonical-enums";
import type { NormalizationPolicy } from "../types";

const speakerRules = [
  { id: "role.client.upper", input: "CLIENT", output: "client", caseSensitive: true, description: "Регистровый технический alias роли client." },
  { id: "role.agent.upper", input: "AGENT", output: "agent", caseSensitive: true, description: "Регистровый технический alias роли agent." },
  { id: "role.operator.upper", input: "OPERATOR", output: "operator", caseSensitive: true, description: "Регистровый технический alias роли operator." },
  { id: "role.other.upper", input: "OTHER", output: "other", caseSensitive: true, description: "Регистровый технический alias роли other." },
  { id: "role.client.ru", input: "клиент", output: "client", caseSensitive: false, description: "Русский технический alias роли client." },
  { id: "role.agent.ru", input: "агент", output: "agent", caseSensitive: false, description: "Русский технический alias роли agent." },
  { id: "role.operator.ru", input: "оператор", output: "operator", caseSensitive: false, description: "Русский технический alias роли operator." },
  { id: "role.other.ru", input: "другое", output: "other", caseSensitive: false, description: "Русский технический alias роли other." },
] as const;

export const SPEAKER_ROLE_POLICIES: readonly NormalizationPolicy[] = Object.freeze([
  {
    id: "normalization.facts.quote-speaker.v3",
    version: "3.0.0",
    contractIds: ["facts.agent.output.v3"],
    fieldPath: "quotes.*.speaker",
    mode: "alias",
    canonicalValues: SPEAKER_ROLES,
    rules: speakerRules,
  },
  ...[
    "agreements.*.owner",
    "primary_next_step.owner",
    "unresolved_questions.*.asked_by",
    "unresolved_questions.*.assigned_to",
  ].map((fieldPath, index) => ({
    id: `normalization.outcome.party-role-${index + 1}.v3`,
    version: "3.0.0",
    contractIds: ["outcome.agent.output.v3"],
    fieldPath,
    mode: "alias" as const,
    canonicalValues: PARTY_VALUES,
    rules: speakerRules.filter((rule) => rule.output !== "other"),
  })),
  ...[
    "agreements.*.recipient",
    "primary_next_step.recipient",
  ].map((fieldPath, index) => ({
    id: `normalization.outcome.recipient-role-${index + 1}.v3`,
    version: "3.0.0",
    contractIds: ["outcome.agent.output.v3"],
    fieldPath,
    mode: "alias" as const,
    canonicalValues: RECIPIENT_VALUES,
    rules: speakerRules.filter((rule) => rule.output !== "other"),
  })),
]);
