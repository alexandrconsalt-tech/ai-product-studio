import { describe, expect, it } from "vitest";
import { FactJudgeV3Contract } from "../contracts/fact-judge/v3/contract";
import { FactsV3Contract } from "../contracts/facts/v3/contract";
import { NeedJudgeV3Contract } from "../contracts/need-judge/v3/contract";
import { NeedsV3Contract } from "../contracts/needs/v3/contract";
import { OutcomeJudgeV3Contract } from "../contracts/outcome-judge/v3/contract";
import { OutcomeV3Contract } from "../contracts/outcome/v3/contract";
import { SummaryJudgeV3Contract } from "../contracts/summary-judges/v3/contract";
import { SummaryV3Contract } from "../contracts/summary/v3/contract";
import { validateOpenAIStructuredOutputSchema } from "./openai-schema-preflight";

const LLM_CONTRACTS = [
  ["Facts Agent", FactsV3Contract],
  ["Facts Judge", FactJudgeV3Contract],
  ["Needs Agent", NeedsV3Contract],
  ["Needs Judge", NeedJudgeV3Contract],
  ["Outcome Agent", OutcomeV3Contract],
  ["Outcome Judge", OutcomeJudgeV3Contract],
  ["Summary Agent", SummaryV3Contract],
  ["Summary Judge · faithfulness", SummaryJudgeV3Contract],
  ["Summary Judge · completeness", SummaryJudgeV3Contract],
  ["Summary Judge · usefulness", SummaryJudgeV3Contract],
  ["Summary Judge · agreements_next_step", SummaryJudgeV3Contract],
  ["Summary Judge · format", SummaryJudgeV3Contract],
] as const;

describe("OpenAI Structured Outputs schema preflight", () => {
  it.each(LLM_CONTRACTS)("%s passes provider preflight", (_name, contract) => {
    expect(validateOpenAIStructuredOutputSchema(contract.schema)).toEqual({
      ok: true,
      issues: [],
    });
  });

  it("reports exact paths for an incompatible schema", () => {
    const result = validateOpenAIStructuredOutputSchema({
      type: "object",
      properties: {
        optional: { type: "string", minLength: 1 },
      },
      additionalProperties: true,
    });
    expect(result).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          path: "$.additionalProperties",
          code: "additional_properties_must_be_false",
        }),
        expect.objectContaining({
          path: "$.required",
          code: "required_missing",
        }),
        expect.objectContaining({
          path: "$.properties.optional.minLength",
          code: "unsupported_keyword",
        }),
      ]),
    });
  });
});
