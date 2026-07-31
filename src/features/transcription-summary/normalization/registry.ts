import { COMMUNICATION_CHANNEL_POLICIES } from "./policies/communication-channel";
import { deepFreeze } from "../contracts/schema-utils";
import { FUNDING_SOURCE_POLICY } from "./policies/funding-source";
import { NEED_TYPE_POLICY } from "./policies/need-types";
import { NUMBER_POLICIES } from "./policies/numbers";
import { OUTCOME_STATUS_POLICIES } from "./policies/outcome-status";
import { PURCHASE_TERM_POLICY } from "./policies/purchase-term";
import { SPEAKER_ROLE_POLICIES } from "./policies/speaker-role";
import { TEXT_POLICIES } from "./policies/text";
import type { NormalizationPolicy } from "./types";

export const NORMALIZATION_POLICY_SET_IDS = Object.freeze({
  "facts.agent.output.v3": "normalization.facts.v3",
  "needs.agent.output.v3": "normalization.needs.v3",
} as const);

export const NORMALIZATION_POLICIES: readonly NormalizationPolicy[] = deepFreeze([
  FUNDING_SOURCE_POLICY,
  PURCHASE_TERM_POLICY,
  NEED_TYPE_POLICY,
  ...SPEAKER_ROLE_POLICIES,
  ...OUTCOME_STATUS_POLICIES,
  ...COMMUNICATION_CHANNEL_POLICIES,
  ...NUMBER_POLICIES,
  ...TEXT_POLICIES,
]);

function comparable(value: string, caseSensitive: boolean): string {
  return caseSensitive ? value : value.toLocaleLowerCase("ru-RU");
}

export function validateNormalizationPolicies(
  policies: readonly NormalizationPolicy[],
): true {
  const policyIds = new Set<string>();
  const aliases = new Map<string, string>();

  for (const policy of policies) {
    if (policyIds.has(policy.id)) {
      throw new Error(`Duplicate normalization policy: ${policy.id}`);
    }
    policyIds.add(policy.id);
    if (!policy.contractIds.length || !policy.fieldPath || !policy.rules.length) {
      throw new Error(`Incomplete normalization policy: ${policy.id}`);
    }
    for (const contractId of policy.contractIds) {
      for (const rule of policy.rules) {
        if (typeof rule.input !== "string") continue;
        const key = [
          contractId,
          policy.fieldPath,
          comparable(rule.input, rule.caseSensitive),
        ].join(":");
        const previous = aliases.get(key);
        if (previous !== undefined && previous !== rule.output) {
          throw new Error(`Conflicting normalization alias: ${key}`);
        }
        aliases.set(key, rule.output);
      }
    }
  }
  return true;
}

validateNormalizationPolicies(NORMALIZATION_POLICIES);

export function listNormalizationPolicies(
  contractId: string,
): readonly NormalizationPolicy[] {
  if (!getNormalizationPolicySetId(contractId)) return [];
  return NORMALIZATION_POLICIES.filter((policy) =>
    policy.contractIds.includes(contractId),
  );
}

export function getNormalizationPolicySetId(contractId: string): string | null {
  return NORMALIZATION_POLICY_SET_IDS[
    contractId as keyof typeof NORMALIZATION_POLICY_SET_IDS
  ] ?? null;
}

export function getNormalizationPolicy(
  contractId: string,
  fieldPath: string,
): NormalizationPolicy {
  const matches = NORMALIZATION_POLICIES.filter(
    (policy) =>
      policy.contractIds.includes(contractId)
      && policy.fieldPath === fieldPath,
  );
  if (matches.length !== 1) {
    throw new Error(
      matches.length
        ? `Ambiguous normalization policy: ${contractId}:${fieldPath}`
        : `Normalization policy not found: ${contractId}:${fieldPath}`,
    );
  }
  return matches[0];
}

export function transportStringValuesForField(
  contractId: string,
  fieldPath: string,
): readonly [string, ...string[]] {
  const policy = getNormalizationPolicy(contractId, fieldPath);
  const values = [
    ...(policy.canonicalValues ?? []),
    ...policy.rules.flatMap((rule) =>
      typeof rule.input === "string" ? [rule.input] : []),
  ];
  const unique = [...new Set(values)];
  if (!unique.length) {
    throw new Error(`Policy has no transport string values: ${policy.id}`);
  }
  return unique as [string, ...string[]];
}
