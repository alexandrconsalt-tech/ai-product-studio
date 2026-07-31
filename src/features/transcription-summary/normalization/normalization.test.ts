import { describe, expect, it } from "vitest";
import { FactsV3Contract } from "../contracts/facts/v3/contract";
import { FactsVerifiedV3Schema } from "../contracts/facts-verified/v3/contract";
import { NeedsV3Contract } from "../contracts/needs/v3/contract";
import { OutcomeV3Contract } from "../contracts/outcome/v3/contract";
import { normalizeContractOutput } from "./normalize";
import {
  getNormalizationPolicy,
  listNormalizationPolicies,
  validateNormalizationPolicies,
} from "./registry";
import {
  applyFundingSourcePolicyV3,
  FUNDING_SOURCE_POLICY_ID,
  FUNDING_SOURCE_POLICY_VERSION,
  resolveFundingSourceFromVerifiedFactsV3,
} from "./policies/funding-source";
import type { NormalizationPolicy } from "./types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function normalize<
  TContract extends typeof FactsV3Contract | typeof NeedsV3Contract | typeof OutcomeV3Contract,
>(
  contract: TContract,
  value: unknown,
) {
  const transport = contract.transportValidator.parse(value);
  return normalizeContractOutput(contract, transport);
}

function needsWithFunding(value: string) {
  const fixture = clone(NeedsV3Contract.fixtures.valid) as Record<string, any>;
  fixture.structured_crm_attributes.funding_source.value = value;
  return fixture;
}

function needsWithTerm(value: string) {
  const fixture = clone(NeedsV3Contract.fixtures.valid) as Record<string, any>;
  fixture.structured_crm_attributes.purchase_term.value = value;
  return fixture;
}

describe("Phase 3 normalization registry", () => {
  it("has exactly one deterministic policy set for every v3 Agent contract", () => {
    expect(listNormalizationPolicies(FactsV3Contract.id).length).toBeGreaterThan(0);
    expect(listNormalizationPolicies(NeedsV3Contract.id).length).toBeGreaterThan(0);
    expect(listNormalizationPolicies(OutcomeV3Contract.id)).toEqual([]);
    expect(FactsV3Contract.normalizationPolicyId).toBe("normalization.facts.v3");
    expect(NeedsV3Contract.normalizationPolicyId).toBe("normalization.needs.v3");
    expect(OutcomeV3Contract.normalizationPolicyId).toBe("normalization.none.v1");
  });

  it("rejects two aliases for the same field when they have conflicting outputs", () => {
    const base = {
      version: "3.0.0",
      contractIds: ["needs.agent.output.v3"],
      fieldPath: "structured_crm_attributes.funding_source.value",
      mode: "alias" as const,
      canonicalValues: ["one", "two"],
    };
    const policies: NormalizationPolicy[] = [
      {
        ...base,
        id: "policy.one",
        rules: [{ id: "one", input: "alias", output: "one", caseSensitive: false, description: "one" }],
      },
      {
        ...base,
        id: "policy.two",
        rules: [{ id: "two", input: "ALIAS", output: "two", caseSensitive: false, description: "two" }],
      },
    ];
    expect(() => validateNormalizationPolicies(policies)).toThrow("Conflicting normalization alias");
  });
});

describe("Funding source and purchase term policies", () => {
  const cashAliases = [
    "наличными",
    "наличные",
    "за наличные",
    "свои деньги",
    "собственные средства",
    "депозит",
    "деньги на депозите",
    "деньги на счету",
    "деньги на счёте",
  ];

  for (const alias of cashAliases) {
    it(`normalizes funding alias "${alias}" to the single canonical value`, () => {
      const result = normalize(NeedsV3Contract, needsWithFunding(alias));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.structured_crm_attributes.funding_source.value).toBe("наличные / депозит");
      expect(result.transformations).toHaveLength(1);
      expect(result.transformations[0]).toMatchObject({
        contractId: "needs.agent.output.v3",
        contractVersion: "3.0.0",
        itemId: "funding-1",
        fieldPath: "structured_crm_attributes.funding_source.value",
        originalValue: alias,
        normalizedValue: "наличные / депозит",
        result: "applied",
      });
    });
  }

  for (const rule of getNormalizationPolicy(
    "needs.agent.output.v3",
    "structured_crm_attributes.funding_source.value",
  ).rules) {
    if (typeof rule.input !== "string") continue;
    it(`covers registered funding rule ${rule.id}`, () => {
      const result = normalize(NeedsV3Contract, needsWithFunding(rule.input as string));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.structured_crm_attributes.funding_source.value).toBe(rule.output);
        expect(result.transformations.some((item) => item.ruleId === rule.id)).toBe(true);
      }
    });
  }

  const terms = new Map([
    ["в течение месяца", "до 1 месяца"],
    ["1 месяц", "до 1 месяца"],
    ["до месяца", "до 1 месяца"],
    ["два-три месяца", "2–3 месяца"],
    ["2-3 месяца", "2–3 месяца"],
    ["2 — 3 месяца", "2–3 месяца"],
    ["3-6 месяцев", "3–6 месяцев"],
    ["3 — 6 месяцев", "3–6 месяцев"],
    ["больше 6 месяцев", "более 6 месяцев"],
    ["свыше 6 месяцев", "более 6 месяцев"],
  ]);

  for (const [alias, canonical] of terms) {
    it(`normalizes purchase term "${alias}"`, () => {
      const result = normalize(NeedsV3Contract, needsWithTerm(alias));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.structured_crm_attributes.purchase_term.value).toBe(canonical);
    });
  }

  it("keeps canonical values unchanged without creating transformations", () => {
    const result = normalize(NeedsV3Contract, NeedsV3Contract.fixtures.valid);
    expect(result).toMatchObject({ ok: true, transformations: [] });
  });

  it("uses funding-source-policy-v3 as the deterministic SSOT for verified cash evidence", () => {
    const facts = FactsVerifiedV3Schema.parse({
      verified_facts: [{
        id: "fact-funding",
        kind: "client_fact",
        subject: "client",
        predicate: "источник средств",
        value: "деньги на счету",
        source_turn_ids: ["turn-1"],
        evidence: "Деньги на счету.",
        confidence: 0.99,
        verification_status: "verified",
      }, {
        id: "fact-family",
        kind: "client_fact",
        subject: "client",
        predicate: "контекст покупки",
        value: "родители покупают квартиру",
        source_turn_ids: ["turn-1"],
        evidence: "Родители покупают квартиру.",
        confidence: 0.95,
        verification_status: "verified",
      }],
      verified_quotes: [],
      verified_client_questions: [],
      rejected_item_references: [],
      source_references: [{
        turn_id: "turn-1",
        speaker: "client",
        text: "Деньги на счету, родители покупают квартиру.",
      }],
      verdict_trail: [{
        item_id: "fact-funding",
        agent_value: { value: "деньги на счету" },
        judge_verdict: "verified",
        applied_correction: null,
        invariant_result: "passed",
        final_verdict: "verified",
        rule_id: "reconcile.verified.v1",
      }, {
        item_id: "fact-family",
        agent_value: { value: "родители покупают квартиру" },
        judge_verdict: "verified",
        applied_correction: null,
        invariant_result: "passed",
        final_verdict: "verified",
        rule_id: "reconcile.verified.v1",
      }],
      technical_metadata: {
        reconciliation_status: "completed",
        reconciled_at: "2026-07-30T00:00:00.000Z",
        source_contract_id: "facts.agent.output.v3",
        judge_contract_id: "facts.judge.verdict.v3",
      },
    });
    const needs = clone(NeedsV3Contract.fixtures.valid) as any;
    needs.structured_crm_attributes.funding_source.value = "не определено";
    needs.structured_crm_attributes.funding_source.source_turn_ids = ["turn-2"];
    needs.structured_crm_attributes.funding_source.evidence = "Источник не определён.";

    expect(FUNDING_SOURCE_POLICY_ID).toBe("funding-source-policy-v3");
    expect(FUNDING_SOURCE_POLICY_VERSION).toBe("3.1.0");
    expect(resolveFundingSourceFromVerifiedFactsV3(facts)).toMatchObject({
      value: "наличные / депозит",
      sourceFactId: "fact-funding",
    });
    expect(applyFundingSourcePolicyV3(needs, facts)).toMatchObject({
      applied: true,
      value: {
        structured_crm_attributes: {
          funding_source: {
            value: "наличные / депозит",
            source_turn_ids: ["turn-1"],
          },
        },
      },
    });
  });

  it("does not infer a funding source from family purchase context alone", () => {
    const facts = FactsVerifiedV3Schema.parse({
      verified_facts: [{
        id: "fact-family",
        kind: "client_fact",
        subject: "client",
        predicate: "контекст покупки",
        value: "родители покупают квартиру",
        source_turn_ids: ["turn-1"],
        evidence: "Родители покупают квартиру.",
        confidence: 0.95,
        verification_status: "verified",
      }],
      verified_quotes: [],
      verified_client_questions: [],
      rejected_item_references: [],
      source_references: [{ turn_id: "turn-1", speaker: "client", text: "Родители покупают квартиру." }],
      verdict_trail: [{
        item_id: "fact-family",
        agent_value: { value: "родители покупают квартиру" },
        judge_verdict: "verified",
        applied_correction: null,
        invariant_result: "passed",
        final_verdict: "verified",
        rule_id: "reconcile.verified.v1",
      }],
      technical_metadata: {
        reconciliation_status: "completed",
        reconciled_at: "2026-07-30T00:00:00.000Z",
        source_contract_id: "facts.agent.output.v3",
        judge_contract_id: "facts.judge.verdict.v3",
      },
    });
    expect(resolveFundingSourceFromVerifiedFactsV3(facts)).toBeNull();
  });

  it.each([
    "деньги есть",
    "будем решать",
    "возможно ипотека",
    "смешанная оплата",
  ])("does not normalize ambiguous funding value %s", (value) => {
    const input = needsWithFunding(value);
    expect(NeedsV3Contract.transportValidator.safeParse(input).success).toBe(false);
    const result = normalizeContractOutput(NeedsV3Contract, input as never);
    expect(result).toMatchObject({
      ok: false,
      error: { errorCode: "NORMALIZATION_AMBIGUOUS" },
      transformations: [{ result: "rejected_ambiguous", originalValue: value }],
    });
  });

  it.each(["скоро", "не срочно", "как получится"])("does not normalize ambiguous purchase term %s", (value) => {
    const input = needsWithTerm(value);
    expect(NeedsV3Contract.transportValidator.safeParse(input).success).toBe(false);
    expect(normalizeContractOutput(NeedsV3Contract, input as never)).toMatchObject({
      ok: false,
      error: { errorCode: "NORMALIZATION_AMBIGUOUS" },
    });
  });

  it("returns a typed error for an unknown alias", () => {
    const input = needsWithFunding("бартер");
    expect(normalizeContractOutput(NeedsV3Contract, input as never)).toMatchObject({
      ok: false,
      error: { errorCode: "NORMALIZATION_ALIAS_UNKNOWN" },
    });
  });
});

describe("Needs, channels, statuses, text and numbers", () => {
  it("normalizes only an already classified interest and never creates one from a question", () => {
    const fixture = clone(NeedsV3Contract.fixtures.valid) as Record<string, any>;
    fixture.structured_crm_attributes.interested_in = [{
      id: "interest-1",
      value: "новостройка",
      source_turn_ids: ["turn-1"],
      evidence: "Интересуют новостройки.",
      confidence: 0.9,
      verification_status: "extracted",
    }];
    fixture.client_questions = [{
      id: "question-1",
      question: "А ипотека есть?",
      source_turn_ids: ["turn-1"],
      evidence: "А ипотека есть?",
      confidence: 1,
      verification_status: "extracted",
    }];
    const result = normalize(NeedsV3Contract, fixture);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.structured_crm_attributes.interested_in.map((item) => item.value)).toEqual(["Новостройки"]);
    expect(result.value.structured_crm_attributes.interested_in).toHaveLength(1);
    expect(result.value.client_questions).toHaveLength(1);
  });

  for (const rule of getNormalizationPolicy(
    "needs.agent.output.v3",
    "structured_crm_attributes.interested_in.*.value",
  ).rules) {
    if (typeof rule.input !== "string") continue;
    it(`covers registered interest rule ${rule.id}`, () => {
      const fixture = clone(NeedsV3Contract.fixtures.valid) as Record<string, any>;
      fixture.structured_crm_attributes.interested_in = [{
        id: "interest-1",
        value: rule.input,
        source_turn_ids: ["turn-1"],
        evidence: "Прямо указан интерес.",
        confidence: 1,
        verification_status: "extracted",
      }];
      const result = normalize(NeedsV3Contract, fixture);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.structured_crm_attributes.interested_in[0].value).toBe(rule.output);
        expect(result.transformations.some((item) => item.ruleId === rule.id)).toBe(true);
      }
    });
  }

  it.each([
    ["ватсап", "whatsapp"],
    ["Whats App", "whatsapp"],
    ["электронная почта", "email"],
    ["e-mail", "email"],
    ["почта", "email"],
    ["телефон", "phone"],
    ["MAX", "max"],
    ["мессенджер MAX", "max"],
    ["телеграм", "telegram"],
  ])("normalizes communication channel %s", (alias, canonical) => {
    const fixture = clone(NeedsV3Contract.fixtures.valid) as Record<string, any>;
    fixture.communication_preferences = [{
      id: "channel-1",
      channel: alias,
      source_turn_ids: ["turn-1"],
      evidence: "Канал указан клиентом.",
      confidence: 1,
      verification_status: "extracted",
    }];
    const result = normalize(NeedsV3Contract, fixture);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.communication_preferences[0].channel).toBe(canonical);
      expect(result.value.property_requirements).toEqual([]);
    }
  });

  for (const rule of getNormalizationPolicy(
    "needs.agent.output.v3",
    "communication_preferences.*.channel",
  ).rules) {
    if (typeof rule.input !== "string") continue;
    it(`covers registered communication channel rule ${rule.id}`, () => {
      const fixture = clone(NeedsV3Contract.fixtures.valid) as Record<string, any>;
      fixture.communication_preferences = [{
        id: "channel-1",
        channel: rule.input,
        source_turn_ids: ["turn-1"],
        evidence: "Канал указан клиентом.",
        confidence: 1,
        verification_status: "extracted",
      }];
      const result = normalize(NeedsV3Contract, fixture);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.communication_preferences[0].channel).toBe(rule.output);
        expect(result.transformations.some((item) => item.ruleId === rule.id)).toBe(true);
      }
    });
  }

  for (const rule of getNormalizationPolicy(
    "facts.agent.output.v3",
    "quotes.*.speaker",
  ).rules) {
    if (typeof rule.input !== "string") continue;
    it(`covers registered speaker role rule ${rule.id}`, () => {
      const fixture = clone(FactsV3Contract.fixtures.valid) as Record<string, any>;
      fixture.quotes[0].speaker = rule.input;
      const result = normalize(FactsV3Contract, fixture);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.quotes[0].speaker).toBe(rule.output);
        expect(result.transformations.some((item) => item.ruleId === rule.id)).toBe(true);
      }
    });
  }

  it("keeps the exact Outcome object contract without format-changing normalization", () => {
    const fixture = clone(OutcomeV3Contract.fixtures.valid);
    const result = normalize(OutcomeV3Contract, fixture);
    expect(result).toMatchObject({ ok: true, value: fixture, transformations: [] });
  });

  it("keeps legacy Outcome structure invalid at both boundaries", () => {
    expect(OutcomeV3Contract.transportValidator.safeParse(OutcomeV3Contract.fixtures.extra_legacy_field).success).toBe(false);
    expect(OutcomeV3Contract.validator.safeParse(OutcomeV3Contract.fixtures.extra_legacy_field).success).toBe(false);
  });
});

describe("Determinism, idempotency and invariants", () => {
  it("fails when the contract does not reference its registered policy set", () => {
    const contract = {
      ...NeedsV3Contract,
      normalizationPolicyId: "normalization.missing.v3",
    } as typeof NeedsV3Contract;
    const transport = NeedsV3Contract.transportValidator.parse(needsWithFunding("наличными"));
    expect(normalizeContractOutput(contract, transport)).toMatchObject({
      ok: false,
      error: { errorCode: "NORMALIZATION_POLICY_NOT_FOUND" },
    });
  });

  it("returns identical values, operation order and transformation IDs for identical input", () => {
    const input = needsWithFunding("наличными");
    const first = normalize(NeedsV3Contract, input);
    const second = normalize(NeedsV3Contract, input);
    expect(first).toEqual(second);
  });

  it("is idempotent and creates no new transformations on the normalized value", () => {
    const first = normalize(NeedsV3Contract, needsWithFunding("наличными"));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = normalize(NeedsV3Contract, first.value);
    expect(second).toMatchObject({ ok: true, transformations: [] });
    if (second.ok) expect(second.value).toEqual(first.value);
  });

  it("does not hide unregistered evidence changes performed by a domain transform", () => {
    const input = needsWithFunding("наличными");
    input.structured_crm_attributes.funding_source.evidence = "  Оплачу наличными.  ";
    expect(normalize(NeedsV3Contract, input)).toMatchObject({
      ok: false,
      error: { errorCode: "NORMALIZATION_INVARIANT_VIOLATION" },
    });
  });

  it("returns NORMALIZATION_OUTPUT_INVALID when a registered output cannot pass the domain schema", () => {
    const input = needsWithFunding("наличными");
    const transport = NeedsV3Contract.transportValidator.parse(input);
    const impossible = {
      ...NeedsV3Contract,
      validator: { safeParse: () => ({ success: false, error: { message: "forced invalid output" } }) },
    } as unknown as typeof NeedsV3Contract;
    expect(normalizeContractOutput(impossible, transport)).toMatchObject({
      ok: false,
      error: { errorCode: "NORMALIZATION_OUTPUT_INVALID" },
    });
  });
});
