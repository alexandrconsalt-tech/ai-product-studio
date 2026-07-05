// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { AD_COPY_CRM_INPUT_EXAMPLE } from "@/shared/model/ad-copy-crm-input";
import { runAdCopyTestBench, type AdCopyStageResult } from "./ad-copy-test-bench";

const { callConfiguredLlmMock } = vi.hoisted(() => ({ callConfiguredLlmMock: vi.fn() }));

vi.mock("@/shared/llm/browser-direct-provider", async () => {
  const actual = await vi.importActual<typeof import("@/shared/llm/browser-direct-provider")>("@/shared/llm/browser-direct-provider");
  return { ...actual, callConfiguredLlm: callConfiguredLlmMock };
});

const BENEFITS_JSON = JSON.stringify({
  advantages: ["панорамные окна", "рядом парк"],
  usp: "Единственная квартира с видом на парк на этом этаже",
  strengths: ["локация"],
  target_audience: "Семьи с детьми",
  selling_points: ["рядом школа"],
  style: "деловой",
});

const AD_JSON = JSON.stringify({ title: "2-комн. квартира у парка", description: "Просторная светлая квартира с дизайнерским ремонтом рядом с парком.", cta: "Записаться на показ" });

function highConfidenceCheckJson() {
  return JSON.stringify({
    facts_ok: true,
    style_ok: true,
    language_ok: true,
    prohibited_words_ok: true,
    readability_score: 90,
    seo_ok: true,
    duplicates_ok: true,
    title: "2-комн. квартира у парка",
    description: "Просторная светлая квартира с дизайнерским ремонтом рядом с парком.",
    cta: "Записаться на показ",
    issues: [],
  });
}

function lowConfidenceCheckJson() {
  return JSON.stringify({
    facts_ok: false,
    style_ok: false,
    language_ok: true,
    prohibited_words_ok: false,
    readability_score: 40,
    seo_ok: false,
    duplicates_ok: false,
    title: "2-комн. квартира у парка",
    description: "Просторная светлая квартира с дизайнерским ремонтом рядом с парком.",
    cta: "Записаться на показ",
    issues: ["стиль не соответствует аудитории"],
  });
}

function stageById(stages: readonly AdCopyStageResult[], id: AdCopyStageResult["id"]) {
  return stages.find((stage) => stage.id === id);
}

describe("runAdCopyTestBench", () => {
  afterEach(() => {
    callConfiguredLlmMock.mockReset();
  });

  it("fails at validation with real Zod errors and skips every downstream stage, without calling any LLM", async () => {
    const updates: (readonly AdCopyStageResult[])[] = [];
    const result = await runAdCopyTestBench(JSON.stringify({ deal_type: "lease" }), (stages) => updates.push(stages));

    expect(result.success).toBe(false);
    expect(stageById(result.stages, "validate")?.status).toBe("failed");
    expect(stageById(result.stages, "validate")?.error).toMatch(/deal_type/);
    expect(stageById(result.stages, "normalize")?.status).toBe("skipped");
    expect(stageById(result.stages, "saveCrm")?.status).toBe("skipped");
    expect(callConfiguredLlmMock).not.toHaveBeenCalled();
    expect(updates.length).toBeGreaterThan(0);
  });

  it("completes all 10 stages and saves on the first attempt when confidence >= 90", async () => {
    callConfiguredLlmMock
      .mockResolvedValueOnce({ text: BENEFITS_JSON, vendor: "openai", model: "gpt-5-mini" })
      .mockResolvedValueOnce({ text: AD_JSON, vendor: "openai", model: "gpt-5-mini" })
      .mockResolvedValueOnce({ text: highConfidenceCheckJson(), vendor: "openai", model: "gpt-5-mini" });

    const result = await runAdCopyTestBench(JSON.stringify(AD_COPY_CRM_INPUT_EXAMPLE), () => {});

    expect(result.success).toBe(true);
    expect(result.stages.every((stage) => stage.status === "succeeded")).toBe(true);
    expect(result.finalRecord?.lowConfidence).toBe(false);
    expect(result.finalRecord?.retryCount).toBe(0);
    expect(result.finalRecord?.confidenceScore).toBeGreaterThanOrEqual(90);
    expect(callConfiguredLlmMock).toHaveBeenCalledTimes(3);
  });

  it("retries Generate -> Check -> Quality up to 2 times when confidence stays below 90, then saves flagged low-confidence", async () => {
    callConfiguredLlmMock.mockResolvedValueOnce({ text: BENEFITS_JSON, vendor: "openai", model: "gpt-5-mini" });
    for (let i = 0; i < 3; i += 1) {
      callConfiguredLlmMock.mockResolvedValueOnce({ text: AD_JSON, vendor: "openai", model: "gpt-5-mini" });
      callConfiguredLlmMock.mockResolvedValueOnce({ text: lowConfidenceCheckJson(), vendor: "openai", model: "gpt-5-mini" });
    }

    const result = await runAdCopyTestBench(JSON.stringify(AD_COPY_CRM_INPUT_EXAMPLE), () => {});

    expect(result.success).toBe(true);
    expect(result.finalRecord?.lowConfidence).toBe(true);
    expect(result.finalRecord?.retryCount).toBe(2);
    expect(stageById(result.stages, "gate")?.attempt).toBe(3);
    // 1 benefits call + 3 attempts * (generate + check) = 7 total LLM calls.
    expect(callConfiguredLlmMock).toHaveBeenCalledTimes(7);
  });

  it("surfaces a schema-mismatch LLM response as a failed stage instead of silently continuing", async () => {
    callConfiguredLlmMock.mockResolvedValueOnce({ text: JSON.stringify({ unexpected: true }), vendor: "openai", model: "gpt-5-mini" });

    const result = await runAdCopyTestBench(JSON.stringify(AD_COPY_CRM_INPUT_EXAMPLE), () => {});

    expect(result.success).toBe(false);
    expect(stageById(result.stages, "benefits")?.status).toBe("failed");
    expect(stageById(result.stages, "storage")?.status).toBe("skipped");
  });
});
