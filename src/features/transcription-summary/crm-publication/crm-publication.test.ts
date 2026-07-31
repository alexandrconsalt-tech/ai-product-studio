import { describe, expect, it, vi } from "vitest";
import { createCrmPublicationFixture } from "./fixtures";
import { buildCrmPublicationInputV3 } from "./input-builder";
import { evaluateCrmPublicationPolicyV3 } from "./policy";
import { buildCrmPayloadV3, executeCrmPublicationV3 } from "./publish";
import { InMemoryCrmPublicationRepositoryV3 } from "./repository";
import { CRM_WRITABLE_FIELDS, type CrmClientV3 } from "./types";

const now = () => new Date("2026-07-30T12:00:00.000Z");

function successClient(): CrmClientV3 {
  return {
    publishSummary: vi.fn(async () => ({
      ok: true as const,
      publicationId: "publication-1",
      providerResponseId: "provider-response-1",
      writtenFields: CRM_WRITABLE_FIELDS,
    })),
  };
}

function args(scores: Parameters<typeof createCrmPublicationFixture>[0] = {}) {
  return {
    ...createCrmPublicationFixture(scores),
    executionId: "execution-1",
    dryRun: false,
    repository: new InMemoryCrmPublicationRepositoryV3(),
    client: successClient(),
    now,
  };
}

describe("CRM всегда сохраняет готовое Summary", () => {
  it("политика не зависит от старых решений Gate", () => {
    for (const decision of ["QUALITY_RECORDED", "AUTO_SAVE", "REVIEW_REQUIRED", "TECHNICAL_ERROR"]) {
      expect(evaluateCrmPublicationPolicyV3(decision)).toEqual({
        allowed: true,
        reasonCode: "SUMMARY_SAVE_ALLOWED",
      });
    }
  });

  it("сохраняет Summary при низкой оценке", async () => {
    const input = args({ faithfulness: 0, completeness: 25 });
    const result = await executeCrmPublicationV3(input);
    expect(result.ok && result.value.status).toBe("PUBLISHED");
    expect(input.client.publishSummary).toHaveBeenCalledOnce();
  });

  it("сохраняет Summary при частичной оценке Judge", async () => {
    const input = args({ faithfulness: null });
    const result = await executeCrmPublicationV3(input);
    expect(result.ok && result.value.status).toBe("PUBLISHED");
    const payload = vi.mocked(input.client.publishSummary).mock.calls[0][0];
    expect(payload).toMatchObject({
      summary: input.summary,
      quality_evaluation_partial: true,
      summary_quality_score: 100,
    });
  });

  it("сохраняет NOT_EVALUATED без фиксированного score", async () => {
    const input = args({
      faithfulness: null,
      completeness: null,
      usefulness: null,
      agreements_next_step: null,
      format: null,
    });
    const built = buildCrmPublicationInputV3(input);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(buildCrmPayloadV3(built.value)).toMatchObject({
      summary: input.summary,
      summary_quality_score: null,
      summary_quality_status: "NOT_EVALUATED",
      quality_issues: [],
      quality_evaluation_partial: true,
    });
    const result = await executeCrmPublicationV3(input);
    expect(result.ok && result.value.status).toBe("PUBLISHED");
  });

  it("сохраняет Summary при отсутствии результата Gate", async () => {
    const input = { ...args(), qualityGate: null };
    const result = await executeCrmPublicationV3(input);
    expect(result.ok && result.value.status).toBe("PUBLISHED");
    const payload = vi.mocked(input.client.publishSummary).mock.calls[0][0];
    expect(payload).toMatchObject({
      summary: input.summary,
      summary_quality_score: null,
      summary_quality_status: "NOT_EVALUATED",
      quality_evaluation_partial: true,
    });
  });
});
