import { expectTypeOf } from "vitest";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  ConversationStoreV3Contract,
  PROVISIONAL_CONVERSATION_STORE_FIXTURE,
} from "./conversation-store/v3/contract";
import { FactJudgeV3Contract } from "./fact-judge/v3/contract";
import { FactsVerifiedV3Contract, FactsVerifiedV3Schema, type FactsVerifiedV3 } from "./facts-verified/v3/contract";
import { FactsV3Contract, FactsV3Schema, type FactsV3 } from "./facts/v3/contract";
import {
  NEED_JUDGE_CANONICAL_VALUE_CORRECTION_FIXTURE,
  NeedJudgeV3Contract,
} from "./need-judge/v3/contract";
import { NeedsVerifiedV3Contract, NeedsVerifiedV3Schema, type NeedsVerifiedV3 } from "./needs-verified/v3/contract";
import { NeedsV3Contract, NeedsV3Schema, type NeedsV3 } from "./needs/v3/contract";
import { OutcomeJudgeV3Contract } from "./outcome-judge/v3/contract";
import { OutcomeVerifiedV3Contract, OutcomeVerifiedV3Schema, type OutcomeVerifiedV3 } from "./outcome-verified/v3/contract";
import {
  OUTCOME_CALL_RESULTS_STRING_ARRAY_FIXTURE,
  OutcomeV3Contract,
  OutcomeV3Schema,
  type OutcomeV3,
} from "./outcome/v3/contract";
import { PipelineReportV3Contract } from "./pipeline-report/v3/contract";
import { QualityGateV3Contract } from "./quality-gate/v3/contract";
import { SummaryQualityGateInputV3Contract } from "./quality-gate-input/v3/contract";
import { SUMMARY_JUDGE_PAYLOAD_FIXTURES, SummaryJudgeV3Contract, SummaryJudgeV3Schema } from "./summary-judges/v3/contract";
import { SummaryJudgeInputV3Contract } from "./summary-judge-input/v3/contract";
import { SummaryAgentInputV3Contract } from "./summary-input/v3/contract";
import { SummaryV3Contract } from "./summary/v3/contract";
import { TranscriptV3Contract } from "./transcript/v3/contract";

const contracts = [
  TranscriptV3Contract,
  FactsV3Contract,
  FactJudgeV3Contract,
  FactsVerifiedV3Contract,
  NeedsV3Contract,
  NeedJudgeV3Contract,
  NeedsVerifiedV3Contract,
  OutcomeV3Contract,
  OutcomeJudgeV3Contract,
  OutcomeVerifiedV3Contract,
  ConversationStoreV3Contract,
  SummaryAgentInputV3Contract,
  SummaryV3Contract,
  SummaryJudgeInputV3Contract,
  SummaryJudgeV3Contract,
  SummaryQualityGateInputV3Contract,
  QualityGateV3Contract,
  PipelineReportV3Contract,
] as const;

describe("draft v3 contract fixtures", () => {
  for (const contract of contracts) {
    it(`${contract.id}@${contract.version} accepts its valid fixture`, () => {
      expect(contract.validator.safeParse(contract.fixtures.valid).success).toBe(true);
    });

    for (const kind of [
      "missing_required",
      "extra_legacy_field",
      "invalid_enum",
      "invalid_nested_type",
    ] as const) {
      it(`${contract.id}@${contract.version} rejects ${kind}`, () => {
        expect(contract.validator.safeParse(contract.fixtures[kind]).success).toBe(false);
      });
    }
  }
});

describe("audit regression fixtures", () => {
  it("accepts a registered funding alias only at the transport boundary", () => {
    expect(NeedsV3Contract.validator.safeParse(NeedsV3Contract.fixtures.valid).success).toBe(true);
    expect(NeedsV3Contract.validator.safeParse(NeedsV3Contract.fixtures.invalid_enum).success).toBe(false);
    expect(NeedsV3Contract.transportValidator.safeParse(NeedsV3Contract.fixtures.invalid_enum).success).toBe(true);
  });

  it("does not allow Need Judge to correct canonical value", () => {
    expect(NeedJudgeV3Contract.validator.safeParse(NEED_JUDGE_CANONICAL_VALUE_CORRECTION_FIXTURE).success).toBe(false);
  });

  it("does not model a client question as a confirmed fact", () => {
    expect(FactsV3Contract.validator.safeParse(FactsV3Contract.fixtures.valid).success).toBe(true);
    expect(FactsV3Contract.validator.safeParse(FactsV3Contract.fixtures.invalid_enum).success).toBe(false);
  });

  it("rejects legacy Outcome shapes and call_results string arrays", () => {
    expect(OutcomeV3Contract.validator.safeParse(OutcomeV3Contract.fixtures.extra_legacy_field).success).toBe(false);
    expect(OutcomeV3Contract.validator.safeParse(OUTCOME_CALL_RESULTS_STRING_ARRAY_FIXTURE).success).toBe(false);
  });

  it("accepts a partial Store but still rejects structurally invalid items", () => {
    expect(
      ConversationStoreV3Contract.validator.safeParse(
        ConversationStoreV3Contract.fixtures.invalid_nested_type,
      ).success,
    ).toBe(false);
    expect(
      ConversationStoreV3Contract.validator.safeParse(
        PROVISIONAL_CONVERSATION_STORE_FIXTURE,
      ).success,
    ).toBe(true);
  });

  it("records unavailable quality without a blocking decision", () => {
    expect(QualityGateV3Contract.validator.safeParse(
      QualityGateV3Contract.fixtures.valid,
    ).success).toBe(true);
    expect(QualityGateV3Contract.validator.safeParse(QualityGateV3Contract.fixtures.invalid_nested_type).success).toBe(false);
  });

  it("rejects provisional, legacy, duplicate, unknown-source and missing-trail verified data", () => {
    for (const contract of [FactsVerifiedV3Contract, NeedsVerifiedV3Contract, OutcomeVerifiedV3Contract]) {
      expect(contract.validator.safeParse(contract.fixtures.invalid_enum).success).toBe(false);
      expect(contract.validator.safeParse(contract.fixtures.extra_legacy_field).success).toBe(false);
      expect(contract.validator.safeParse(contract.fixtures.invalid_nested_type).success).toBe(false);
      expect(contract.validator.safeParse(contract.fixtures.missing_required).success).toBe(false);
    }
    const valid = FactsVerifiedV3Contract.fixtures.valid as FactsVerifiedV3;
    expect(FactsVerifiedV3Schema.safeParse({
      ...valid,
      verified_client_questions: [...valid.verified_client_questions, valid.verified_client_questions[0]],
    }).success).toBe(false);
    expect(FactsVerifiedV3Schema.safeParse({
      ...valid,
      rejected_item_references: [{ item_id: "question-1", reason: "technical_error" }],
    }).success).toBe(false);
  });

  it("accepts all five Summary Judge criterion payloads and rejects score on technical_error", () => {
    const metadata = {
      sourceStoreId: "store-0123456789abcdef01234567",
      sourceStoreHash: "a".repeat(64),
      sourceSummaryHash: "b".repeat(64),
      contractVersion: "3.1.0",
      promptVersion: "summary-judge-test-v3.0.0",
    };
    for (const criterion of Object.keys(SUMMARY_JUDGE_PAYLOAD_FIXTURES) as Array<keyof typeof SUMMARY_JUDGE_PAYLOAD_FIXTURES>) {
      expect(SummaryJudgeV3Schema.safeParse({
        criterion,
        verdict: "pass",
        score: 100,
        confidence: 1,
        issues: [],
        evidence: [],
        payload: SUMMARY_JUDGE_PAYLOAD_FIXTURES[criterion],
        metadata,
      }).success).toBe(true);
    }
    expect(SummaryJudgeV3Schema.safeParse({
      criterion: "format",
      verdict: "technical_error",
      score: 0,
      confidence: null,
      issues: [],
      evidence: [],
      payload: SUMMARY_JUDGE_PAYLOAD_FIXTURES.format,
      metadata,
    }).success).toBe(false);
  });
});

describe("TypeScript types are inferred from the schema API", () => {
  it("keeps exported domain types identical to z.infer", () => {
    expectTypeOf<FactsV3>().toEqualTypeOf<z.infer<typeof FactsV3Schema>>();
    expectTypeOf<NeedsV3>().toEqualTypeOf<z.infer<typeof NeedsV3Schema>>();
    expectTypeOf<OutcomeV3>().toEqualTypeOf<z.infer<typeof OutcomeV3Schema>>();
    expectTypeOf<FactsVerifiedV3>().toEqualTypeOf<z.infer<typeof FactsVerifiedV3Schema>>();
    expectTypeOf<NeedsVerifiedV3>().toEqualTypeOf<z.infer<typeof NeedsVerifiedV3Schema>>();
    expectTypeOf<OutcomeVerifiedV3>().toEqualTypeOf<z.infer<typeof OutcomeVerifiedV3Schema>>();
  });
});
