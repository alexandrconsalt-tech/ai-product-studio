import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DIRECT_FACT_TYPES,
  DirectFactsRuntimeSchema,
} from "./direct-runtime-contract";

describe("direct production Facts runtime contract", () => {
  const pipeline = readFileSync(
    new URL("../../../../../public/pipeline-lab-v3.html", import.meta.url),
    "utf8",
  );

  it("accepts the compact type-based contract", () => {
    expect(DirectFactsRuntimeSchema.parse({
      facts: [{
        id: "fact_1",
        type: "client_finance",
        value: "наличные / депозит",
        speaker: "Клиент",
        evidence: "По поводу денег, у меня деньги на счету",
        source_turn_ids: ["turn_7"],
        confidence: 0.99,
        business_priority: "important",
      }],
      quotes: [],
    }).facts[0].type).toBe("client_finance");
  });

  it("rejects legacy fact fields and keeps the browser schema in sync", () => {
    const legacy = {
      id: "fact_1",
      category: "client_finance",
      name: "источник средств",
      value: "наличные / депозит",
      normalized_value: "наличные / депозит",
      speaker: "Клиент",
      evidence: "деньги на счету",
      source_turn_ids: ["turn_7"],
      confidence: 0.99,
      verification_status: "extracted",
    };
    expect(DirectFactsRuntimeSchema.safeParse({ facts: [legacy], quotes: [] }).success).toBe(false);
    for (const type of DIRECT_FACT_TYPES) expect(pipeline).toContain(`'${type}'`);
    expect(pipeline).toContain("required:['id','type','value','speaker','evidence','source_turn_ids','confidence','business_priority']");
    expect(pipeline).toContain("factSchemaExactKeys(value,'',['facts','quotes'])");
  });
});
