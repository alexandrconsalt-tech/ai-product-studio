import { describe, expect, it } from "vitest";
import { ConversationStoreV3Schema } from "../contracts/conversation-store/v3/contract";
import { EMPTY_OUTCOME_V3 } from "../contracts/outcome/v3/contract";
import {
  createPhase4StoreInput,
  createPhase4StoreWithoutNeedsInput,
} from "./fixtures";
import {
  buildConversationStoreV3,
  InMemoryConversationStoreV3Repository,
} from "./index";

describe("Conversation Store v3.2 из raw Extractor", () => {
  it("объединяет facts, needs и outcome без Judge", () => {
    const result = buildConversationStoreV3(createPhase4StoreInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(ConversationStoreV3Schema.safeParse(result.store).success).toBe(true);
    expect(result.store).toMatchObject({
      partial: false,
      source_errors: [],
      transcript_available: true,
      primary_next_step: { status: "confirmed" },
    });
    expect(result.store.facts).toHaveLength(0);
    expect(result.store.attributes.funding_source).toMatchObject({ value: "наличные / депозит" });
    expect(result.store.agreements).toHaveLength(1);
  });

  it("создаёт partial Store при технической ошибке Extractor", () => {
    const result = buildConversationStoreV3(createPhase4StoreWithoutNeedsInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.store.partial).toBe(true);
    expect(result.store.source_errors).toEqual(["needs"]);
    expect(result.store.attributes).toEqual({});
  });

  it("подставляет точный пустой Outcome и продолжает", () => {
    const result = buildConversationStoreV3({
      ...createPhase4StoreInput(),
      outcome: { call_results: ["legacy string"] },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.store.source_errors).toContain("outcome");
    expect(result.store.call_result).toBe("");
    expect(result.store.agreements).toEqual([]);
    expect(result.store.primary_next_step).toEqual(EMPTY_OUTCOME_V3.primary_next_step);
  });

  it("удаляет PII и дедуплицирует по id", () => {
    const input = createPhase4StoreInput();
    const facts = structuredClone(input.facts) as Record<string, any>;
    facts.confirmed_facts = [{
      ...facts.confirmed_facts[0],
      id: "objection-price",
      kind: "requirement_signal",
      predicate: "explicit_objection",
      value: "Цена слишком высокая",
      evidence: "Цена слишком высокая, телефон +7 999 111-22-33",
    }, {
      ...facts.confirmed_facts[0],
      id: "objection-price",
      kind: "requirement_signal",
      predicate: "explicit_objection",
      value: "Цена слишком высокая",
      evidence: "Цена слишком высокая, телефон +7 999 111-22-33",
    }];
    const result = buildConversationStoreV3({ ...input, facts });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.store.facts).toHaveLength(1);
    expect(JSON.stringify(result.store)).not.toContain("+7 999");
  });

  it("сохраняет и возвращает изолированную копию", async () => {
    const result = buildConversationStoreV3(createPhase4StoreInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const repository = new InMemoryConversationStoreV3Repository();
    await repository.save(result.store);
    const first = await repository.getByRunId(result.store.meta.run_id);
    expect(first).toEqual(result.store);
    if (first) first.facts.splice(0);
    expect(await repository.getByRunId(result.store.meta.run_id)).toEqual(result.store);
  });

  it("дедуплицирует Store по meaning_id между CRM, needs и facts", () => {
    const input = createPhase4StoreInput();
    const facts = structuredClone(input.facts) as Record<string, any>;
    facts.confirmed_facts.push({
      ...facts.confirmed_facts[0],
      id: "price-objection",
      kind: "requirement_signal",
      predicate: "explicit_objection",
      value: "Цена и ремонт слишком дорогие",
      evidence: "Цена высокая, ремонт слишком дорогой.",
    });
    const needs = structuredClone(input.needs) as Record<string, any>;
    needs.business_needs = [
      { ...needs.structured_crm_attributes.funding_source, id: "mortgage-duplicate", need_type: "financial_context", value: "Ипотека не нужна" },
      { ...needs.structured_crm_attributes.funding_source, id: "price-sensitive", need_type: "price_sensitivity", value: "Чувствительность к цене и ремонту", evidence: "Цена высокая, ремонт слишком дорогой." },
    ];

    const result = buildConversationStoreV3({ ...input, facts, needs });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.store.facts.map((item) => item.meaning_id)).toEqual(["objection:price_or_repair"]);
    expect(result.store.requirements).toEqual([]);
    expect(result.store.attributes.funding_source).toMatchObject({ value: "наличные / депозит" });
  });
});
