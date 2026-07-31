import { createHash } from "node:crypto";
import type { z } from "zod";
import { stableStringify } from "../contracts/schema-utils";
import {
  getNormalizationPolicySetId,
  listNormalizationPolicies,
} from "./registry";
import type {
  NormalizableContract,
  NormalizationError,
  NormalizationPolicy,
  NormalizationResult,
  NormalizationRule,
  NormalizationTransformation,
} from "./types";

type MutableJson = Record<string, unknown> | unknown[];

function normalizedComparable(value: string): string {
  return value.normalize("NFC").trim().toLocaleLowerCase("ru-RU");
}

function regexMatches(regex: RegExp, value: string): boolean {
  return new RegExp(regex.source, regex.flags.replace("g", "")).test(value);
}

function deterministicTransformationId(
  transformation: Omit<NormalizationTransformation, "transformationId">,
): string {
  return `norm_${createHash("sha256").update(stableStringify(transformation)).digest("hex").slice(0, 24)}`;
}

function transformation(
  input: Omit<NormalizationTransformation, "transformationId">,
): NormalizationTransformation {
  return Object.freeze({
    transformationId: deterministicTransformationId(input),
    ...input,
  });
}

function error(
  contractId: string,
  errorCode: NormalizationError["errorCode"],
  message: string,
  fieldPath?: string,
): NormalizationError {
  return {
    status: "TECHNICAL_ERROR",
    errorCode,
    message,
    contractId,
    ...(fieldPath ? { fieldPath } : {}),
  };
}

function aliasRule(
  policy: NormalizationPolicy,
  value: string,
): { rule: NormalizationRule; output: string } | null {
  const matches = policy.rules.filter((rule) => {
    if (typeof rule.input === "string") {
      return rule.caseSensitive
        ? value === rule.input
        : normalizedComparable(value) === normalizedComparable(rule.input);
    }
    return regexMatches(rule.input, value);
  });
  const outputs = new Set(matches.map((rule) => rule.output));
  if (outputs.size > 1) {
    throw new Error(`ambiguous:${matches.map((rule) => rule.id).join(",")}`);
  }
  return matches[0] ? { rule: matches[0], output: matches[0].output } : null;
}

function numericValue(rule: NormalizationRule, value: string): number {
  if (rule.output === "$percent") return Number(value.slice(0, -1)) / 100;
  return Number(value);
}

function applyTextRule(rule: NormalizationRule, value: string): string {
  if (rule.output === "$nfc") return value.normalize("NFC");
  if (typeof rule.input === "string") {
    return rule.caseSensitive
      ? value.split(rule.input).join(rule.output)
      : value.replace(new RegExp(rule.input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu"), rule.output);
  }
  return value.replace(new RegExp(rule.input.source, rule.input.flags), rule.output);
}

type Target = {
  parent: Record<string, unknown> | unknown[];
  key: string | number;
  fieldPath: string;
  itemId?: string;
};

function readTarget(target: Target): unknown {
  if (Array.isArray(target.parent) && typeof target.key === "number") {
    return target.parent[target.key];
  }
  if (!Array.isArray(target.parent) && typeof target.key === "string") {
    return target.parent[target.key];
  }
  throw new Error(`Invalid normalization target: ${target.fieldPath}`);
}

function writeTarget(target: Target, value: unknown): void {
  if (Array.isArray(target.parent) && typeof target.key === "number") {
    target.parent[target.key] = value;
    return;
  }
  if (!Array.isArray(target.parent) && typeof target.key === "string") {
    target.parent[target.key] = value;
    return;
  }
  throw new Error(`Invalid normalization target: ${target.fieldPath}`);
}

function policyTargets(root: unknown, policy: NormalizationPolicy): Target[] {
  const segments = policy.fieldPath.split(".");
  const targets: Target[] = [];

  function walk(
    value: unknown,
    segmentIndex: number,
    actualPath: string[],
    itemId?: string,
    parent?: Record<string, unknown> | unknown[],
    key?: string | number,
  ): void {
    if (segmentIndex === segments.length) {
      if (parent !== undefined && key !== undefined) {
        targets.push({ parent, key, fieldPath: actualPath.join("."), ...(itemId ? { itemId } : {}) });
      }
      return;
    }
    const segment = segments[segmentIndex];
    if (segment === "*") {
      if (!Array.isArray(value)) return;
      value.forEach((entry, index) => {
        const nextId = entry && typeof entry === "object" && "id" in entry && typeof entry.id === "string"
          ? entry.id
          : itemId;
        walk(entry, segmentIndex + 1, [...actualPath, String(index)], nextId, value, index);
      });
      return;
    }
    if (!value || typeof value !== "object" || !(segment in value)) return;
    const record = value as Record<string, unknown>;
    const next = record[segment];
    const nextId = next && typeof next === "object" && "id" in next && typeof next.id === "string"
      ? next.id
      : itemId;
    walk(next, segmentIndex + 1, [...actualPath, segment], nextId, record, segment);
  }

  walk(root, 0, []);
  return targets;
}

function applyPolicy(
  value: unknown,
  policy: NormalizationPolicy,
  contract: NormalizableContract,
): NormalizationResult<unknown> {
  const mutable = value as MutableJson;
  const transformations: NormalizationTransformation[] = [];

  for (const target of policyTargets(mutable, policy)) {
    const original = readTarget(target);
    if (original === null || original === undefined) continue;

    if (policy.mode === "alias") {
      if (typeof original !== "string") {
        return {
          ok: false,
          error: error(contract.id, "NORMALIZATION_INVARIANT_VIOLATION", `Alias policy received non-string value at ${target.fieldPath}`, target.fieldPath),
          transformations,
        };
      }
      const canonical = policy.canonicalValues?.find((entry) => entry === original);
      if (canonical !== undefined) continue;
      if (policy.ambiguousInputs?.some(
        (entry) => normalizedComparable(entry) === normalizedComparable(original),
      )) {
        const rejected = transformation({
          policyId: policy.id,
          policyVersion: policy.version,
          ruleId: `${policy.id}.ambiguous`,
          contractId: contract.id,
          contractVersion: contract.version,
          ...(target.itemId ? { itemId: target.itemId } : {}),
          fieldPath: target.fieldPath,
          originalValue: original,
          normalizedValue: original,
          result: "rejected_ambiguous",
        });
        return {
          ok: false,
          error: error(contract.id, "NORMALIZATION_AMBIGUOUS", `Ambiguous value at ${target.fieldPath}`, target.fieldPath),
          transformations: [...transformations, rejected],
        };
      }
      let matched: ReturnType<typeof aliasRule>;
      try {
        matched = aliasRule(policy, original);
      } catch {
        return {
          ok: false,
          error: error(contract.id, "NORMALIZATION_AMBIGUOUS", `Multiple rules match ${target.fieldPath}`, target.fieldPath),
          transformations,
        };
      }
      if (!matched) {
        const canonicalCase = policy.canonicalValues?.find(
          (entry) => normalizedComparable(entry) === normalizedComparable(original),
        );
        if (canonicalCase !== undefined) {
          writeTarget(target, canonicalCase);
          transformations.push(transformation({
            policyId: policy.id,
            policyVersion: policy.version,
            ruleId: `${policy.id}.canonical-case`,
            contractId: contract.id,
            contractVersion: contract.version,
            ...(target.itemId ? { itemId: target.itemId } : {}),
            fieldPath: target.fieldPath,
            originalValue: original,
            normalizedValue: canonicalCase,
            result: "applied",
          }));
          continue;
        }
        return {
          ok: false,
          error: error(contract.id, "NORMALIZATION_ALIAS_UNKNOWN", `Unknown alias at ${target.fieldPath}`, target.fieldPath),
          transformations,
        };
      }
      writeTarget(target, matched.output);
      transformations.push(transformation({
        policyId: policy.id,
        policyVersion: policy.version,
        ruleId: matched.rule.id,
        contractId: contract.id,
        contractVersion: contract.version,
        ...(target.itemId ? { itemId: target.itemId } : {}),
        fieldPath: target.fieldPath,
        originalValue: original,
        normalizedValue: matched.output,
        result: original === matched.output ? "unchanged" : "applied",
      }));
      continue;
    }

    if (policy.mode === "numeric") {
      if (typeof original === "number") continue;
      if (typeof original !== "string") {
        return {
          ok: false,
          error: error(contract.id, "NORMALIZATION_INVARIANT_VIOLATION", `Numeric policy received unsupported value at ${target.fieldPath}`, target.fieldPath),
          transformations,
        };
      }
      const matches = policy.rules.filter(
        (rule) => rule.input instanceof RegExp && regexMatches(rule.input, original),
      );
      if (matches.length !== 1) {
        return {
          ok: false,
          error: error(contract.id, matches.length ? "NORMALIZATION_AMBIGUOUS" : "NORMALIZATION_ALIAS_UNKNOWN", `Invalid numeric alias at ${target.fieldPath}`, target.fieldPath),
          transformations,
        };
      }
      const normalized = numericValue(matches[0], original);
      writeTarget(target, normalized);
      transformations.push(transformation({
        policyId: policy.id,
        policyVersion: policy.version,
        ruleId: matches[0].id,
        contractId: contract.id,
        contractVersion: contract.version,
        ...(target.itemId ? { itemId: target.itemId } : {}),
        fieldPath: target.fieldPath,
        originalValue: original,
        normalizedValue: normalized,
        result: "applied",
      }));
      continue;
    }

    if (typeof original !== "string") continue;
    let normalized = original;
    for (const rule of policy.rules) {
      const next = applyTextRule(rule, normalized);
      if (next === normalized) continue;
      const before = normalized;
      normalized = next;
      transformations.push(transformation({
        policyId: policy.id,
        policyVersion: policy.version,
        ruleId: rule.id,
        contractId: contract.id,
        contractVersion: contract.version,
        ...(target.itemId ? { itemId: target.itemId } : {}),
        fieldPath: target.fieldPath,
        originalValue: before,
        normalizedValue: normalized,
        result: "applied",
      }));
    }
    writeTarget(target, normalized);
  }

  return { ok: true, value: mutable, transformations };
}

export function normalizeContractOutput<TContract extends NormalizableContract>(
  contract: TContract,
  validatedTransportValue: unknown,
): NormalizationResult<z.infer<TContract["validator"]>> {
  const expectedPolicySet = getNormalizationPolicySetId(contract.id);
  if (expectedPolicySet === null) {
    const parsed = contract.validator.safeParse(validatedTransportValue);
    return parsed.success
      ? { ok: true, value: parsed.data as z.infer<TContract["validator"]>, transformations: [] }
      : {
          ok: false,
          error: error(contract.id, "NORMALIZATION_OUTPUT_INVALID", parsed.error.message),
          transformations: [],
        };
  }
  if (contract.normalizationPolicyId !== expectedPolicySet) {
    return {
      ok: false,
      error: error(contract.id, "NORMALIZATION_POLICY_NOT_FOUND", `Expected ${expectedPolicySet}, received ${contract.normalizationPolicyId}`),
      transformations: [],
    };
  }
  const policies = listNormalizationPolicies(contract.id);
  if (!policies.length) {
    return {
      ok: false,
      error: error(contract.id, "NORMALIZATION_POLICY_NOT_FOUND", `No policies registered for ${contract.id}`),
      transformations: [],
    };
  }

  let current: unknown = structuredClone(validatedTransportValue);
  const transformations: NormalizationTransformation[] = [];
  for (const policy of policies) {
    const applied = applyPolicy(current, policy, contract);
    transformations.push(...applied.transformations);
    if (!applied.ok) return { ...applied, transformations };
    current = applied.value;
  }
  const parsed = contract.validator.safeParse(current);
  if (!parsed.success) {
    return {
      ok: false,
      error: error(contract.id, "NORMALIZATION_OUTPUT_INVALID", parsed.error.message),
      transformations,
    };
  }
  if (stableStringify(parsed.data) !== stableStringify(current)) {
    return {
      ok: false,
      error: error(contract.id, "NORMALIZATION_INVARIANT_VIOLATION", "Canonical validator performed an unregistered transformation"),
      transformations,
    };
  }
  return {
    ok: true,
    value: parsed.data as z.infer<TContract["validator"]>,
    transformations: Object.freeze(transformations),
  };
}
