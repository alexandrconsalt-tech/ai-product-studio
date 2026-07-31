import { FUNDING_SOURCE_VALUES } from "../../contracts/canonical-enums";
import type { FactsVerifiedV3 } from "../../contracts/facts-verified/v3/contract";
import type { NeedsV3 } from "../../contracts/needs/v3/contract";
import type { NormalizationPolicy } from "../types";

export const FUNDING_SOURCE_POLICY_ID = "funding-source-policy-v3";
export const FUNDING_SOURCE_POLICY_VERSION = "3.1.0";
export const FUNDING_SOURCE_POLICY_PROMPT = Object.freeze({
  id: FUNDING_SOURCE_POLICY_ID,
  version: FUNDING_SOURCE_POLICY_VERSION,
  canonicalValues: FUNDING_SOURCE_VALUES,
  mandatoryCashMappings: [
    "деньги на счету",
    "деньги на счёте",
    "свои деньги",
    "наличные",
    "депозит",
  ],
  cashCanonicalValue: "наличные / депозит",
  forbiddenInference: "Фраза «родители покупают квартиру» сама по себе не является funding_source.",
} as const);

export const FUNDING_SOURCE_POLICY: NormalizationPolicy = Object.freeze({
  id: FUNDING_SOURCE_POLICY_ID,
  version: FUNDING_SOURCE_POLICY_VERSION,
  contractIds: ["needs.agent.output.v3"],
  fieldPath: "structured_crm_attributes.funding_source.value",
  mode: "alias",
  canonicalValues: FUNDING_SOURCE_VALUES,
  ambiguousInputs: [
    "деньги есть",
    "будем решать",
    "возможно ипотека",
    "смешанная оплата",
  ],
  rules: [
    {
      id: "funding.cash.cash-on-hand",
      input: "наличными",
      output: "наличные / депозит",
      caseSensitive: false,
      description: "Морфологический вариант оплаты наличными.",
    },
    {
      id: "funding.cash.cash",
      input: "наличные",
      output: "наличные / депозит",
      caseSensitive: false,
      description: "Краткий вариант canonical cash/deposit.",
    },
    {
      id: "funding.cash.for-cash",
      input: "за наличные",
      output: "наличные / депозит",
      caseSensitive: false,
      description: "Формальный предложный вариант оплаты наличными.",
    },
    {
      id: "funding.cash.own-money",
      input: "свои деньги",
      output: "наличные / депозит",
      caseSensitive: false,
      description: "Однозначный alias собственных денежных средств.",
    },
    {
      id: "funding.cash.own-funds",
      input: "собственные средства",
      output: "наличные / депозит",
      caseSensitive: false,
      description: "Однозначный alias собственных денежных средств.",
    },
    {
      id: "funding.cash.deposit",
      input: "депозит",
      output: "наличные / депозит",
      caseSensitive: false,
      description: "Краткий вариант денежных средств на депозите.",
    },
    {
      id: "funding.cash.deposit-money",
      input: "деньги на депозите",
      output: "наличные / депозит",
      caseSensitive: false,
      description: "Прямой вариант денежных средств на депозите.",
    },
    {
      id: "funding.cash.account-money",
      input: "деньги на счету",
      output: "наличные / депозит",
      caseSensitive: false,
      description: "Прямое указание клиента на собственные деньги на счёте.",
    },
    {
      id: "funding.cash.account-money-yo",
      input: "деньги на счёте",
      output: "наличные / депозит",
      caseSensitive: false,
      description: "Орфографический вариант указания на деньги на счёте.",
    },
    {
      id: "funding.mortgage-approved",
      input: "одобренная ипотека",
      output: "ипотека одобрена",
      caseSensitive: false,
      description: "Морфологический вариант уже одобренной ипотеки.",
    },
    {
      id: "funding.mortgage-in-progress",
      input: "ипотека в процессе оформления",
      output: "ипотека в процессе",
      caseSensitive: false,
      description: "Формальный вариант ипотеки в процессе оформления.",
    },
    {
      id: "funding.own-property-sale",
      input: "продажа собственной квартиры",
      output: "продажа своей квартиры",
      caseSensitive: false,
      description: "Морфологический вариант продажи собственной квартиры.",
    },
  ],
});

const CASH_EVIDENCE_PATTERN =
  /(деньг[аи]\s+на\s+сч[её]т(?:е|у)?|свои\s+деньги|собственные\s+средства|наличн|депозит)/iu;

export type DeterministicFundingSourceResult = Readonly<{
  value: "наличные / депозит";
  sourceTurnIds: readonly string[];
  evidence: string;
  confidence: number;
  sourceFactId: string;
}>;

export function resolveFundingSourceFromVerifiedFactsV3(
  facts: FactsVerifiedV3,
): DeterministicFundingSourceResult | null {
  const clientTurnIds = new Set(
    facts.source_references
      .filter((source) => source.speaker === "client")
      .map((source) => source.turn_id),
  );
  for (const fact of facts.verified_facts) {
    if (!fact.source_turn_ids.some((turnId) => clientTurnIds.has(turnId))) continue;
    const searchable = [fact.predicate, fact.value, fact.evidence].join(" ");
    if (!CASH_EVIDENCE_PATTERN.test(searchable)) continue;
    return Object.freeze({
      value: "наличные / депозит",
      sourceTurnIds: [...fact.source_turn_ids],
      evidence: fact.evidence,
      confidence: fact.confidence,
      sourceFactId: fact.id,
    });
  }
  return null;
}

export function applyFundingSourcePolicyV3(
  needs: NeedsV3,
  facts: FactsVerifiedV3,
): Readonly<{
  value: NeedsV3;
  applied: boolean;
  sourceFactId: string | null;
  previousValue: string;
}> {
  const funding = resolveFundingSourceFromVerifiedFactsV3(facts);
  const previous = needs.structured_crm_attributes.funding_source;
  if (!funding) {
    return Object.freeze({
      value: needs,
      applied: false,
      sourceFactId: null,
      previousValue: previous.value,
    });
  }
  const sourceTurnIds = [...funding.sourceTurnIds];
  const applied = previous.value !== funding.value
    || previous.evidence !== funding.evidence
    || previous.source_turn_ids.join("|") !== sourceTurnIds.join("|");
  if (!applied) {
    return Object.freeze({
      value: needs,
      applied: false,
      sourceFactId: funding.sourceFactId,
      previousValue: previous.value,
    });
  }
  return Object.freeze({
    value: {
      ...needs,
      structured_crm_attributes: {
        ...needs.structured_crm_attributes,
        funding_source: {
          ...previous,
          value: funding.value,
          source_turn_ids: sourceTurnIds,
          evidence: funding.evidence,
          confidence: Math.max(previous.confidence, funding.confidence),
        },
      },
    },
    applied: true,
    sourceFactId: funding.sourceFactId,
    previousValue: previous.value,
  });
}
