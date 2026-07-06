// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { AD_COPY_INPUT_EXAMPLE } from "@/shared/model/ad-copy-crm-input";
import { defaultAdCopyStages, runAdCopyPipeline, type AdCopyStageReport } from "./ad-copy-test-bench";

const { callModelByNameMock } = vi.hoisted(() => ({ callModelByNameMock: vi.fn() }));

vi.mock("@/shared/llm/browser-direct-provider", async () => {
  const actual = await vi.importActual<typeof import("@/shared/llm/browser-direct-provider")>("@/shared/llm/browser-direct-provider");
  return { ...actual, callModelByName: callModelByNameMock };
});

const BENEFITS_JSON = JSON.stringify({
  advantages: ["панорамные окна", "рядом парк"],
  usp: "Единственная квартира с видом на парк",
  strengths: ["локация"],
  selling_points: ["рядом школа"],
  target_audience: ["Семьи с детьми"],
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

function reportFor(reports: Readonly<Record<string, AdCopyStageReport>>, id: string) {
  return reports[id];
}

describe("runAdCopyPipeline", () => {
  afterEach(() => {
    callModelByNameMock.mockReset();
  });

  it("reports real Zod validation errors for a property missing a required field but keeps running downstream (never hard-aborts, matching Pipeline Lab v3)", async () => {
    callModelByNameMock.mockResolvedValue(BENEFITS_JSON);
    const stages = defaultAdCopyStages();
    const result = await runAdCopyPipeline(stages, JSON.stringify({ property: { property_type: "Квартира" } }), () => {});

    expect(reportFor(result.reports, "validate").status).toBe("bad");
    expect(reportFor(result.reports, "validate").checks?.some((check) => check.label.includes("deal_type"))).toBe(true);
    // Downstream stages still ran (honest continuation) on whatever partial data survived, never left "idle".
    expect(reportFor(result.reports, "normalize").status).not.toBe("idle");
    expect(reportFor(result.reports, "saveCrm").status).not.toBe("idle");
  });

  it("accepts a property missing only optional fields (e.g. price) without failing validation", async () => {
    callModelByNameMock.mockResolvedValueOnce(BENEFITS_JSON).mockResolvedValueOnce(AD_JSON).mockResolvedValueOnce(highConfidenceCheckJson());
    const stages = defaultAdCopyStages();
    const result = await runAdCopyPipeline(stages, JSON.stringify({ property: { deal_type: "Продать", property_type: "Квартира" } }), () => {});

    expect(reportFor(result.reports, "validate").status).toBe("ok");
  });

  it("completes the full 10-stage pipeline and saves on the first attempt when confidence >= 90", async () => {
    callModelByNameMock.mockResolvedValueOnce(BENEFITS_JSON).mockResolvedValueOnce(AD_JSON).mockResolvedValueOnce(highConfidenceCheckJson());

    const stages = defaultAdCopyStages();
    const updates: (Readonly<Record<string, AdCopyStageReport>>)[] = [];
    const result = await runAdCopyPipeline(stages, JSON.stringify(AD_COPY_INPUT_EXAMPLE), (reports) => updates.push(reports));

    expect(Object.values(result.reports).every((report) => report.status === "ok")).toBe(true);
    expect(result.finalRecord?.lowConfidence).toBe(false);
    expect(result.finalRecord?.retryCount).toBe(0);
    expect(result.finalRecord?.confidenceScore).toBeGreaterThanOrEqual(90);
    expect(callModelByNameMock).toHaveBeenCalledTimes(3);
    expect(updates.length).toBeGreaterThan(0);
  });

  it("retries Generate -> Check -> Quality -> Gate up to 2 times when the Checker finds real issues (confidence stays below 90), then saves flagged low-confidence", async () => {
    callModelByNameMock.mockResolvedValueOnce(BENEFITS_JSON);
    for (let i = 0; i < 3; i += 1) {
      callModelByNameMock.mockResolvedValueOnce(AD_JSON);
      callModelByNameMock.mockResolvedValueOnce(lowConfidenceCheckJson());
    }

    const stages = defaultAdCopyStages();
    const result = await runAdCopyPipeline(stages, JSON.stringify(AD_COPY_INPUT_EXAMPLE), () => {});

    expect(result.finalRecord?.lowConfidence).toBe(true);
    expect(result.finalRecord?.retryCount).toBe(2);
    expect(reportFor(result.reports, "gate").attempt).toBe(3);
    // 1 benefits call + 3 attempts * (generate + check) = 7 total model calls.
    expect(callModelByNameMock).toHaveBeenCalledTimes(7);
  });

  it("treats a disabled Checker as gracefully absent, not a confidence penalty -- its weight is excluded from the average rather than scored as a failure", async () => {
    callModelByNameMock.mockResolvedValueOnce(BENEFITS_JSON).mockResolvedValueOnce(AD_JSON);

    const stages = defaultAdCopyStages().map((stage) => (stage.id === "check" ? { ...stage, enabled: false } : stage));
    const result = await runAdCopyPipeline(stages, JSON.stringify(AD_COPY_INPUT_EXAMPLE), () => {});

    expect(reportFor(result.reports, "check").status).toBe("idle");
    expect(reportFor(result.reports, "quality").status).not.toBe("idle");
    expect(reportFor(result.reports, "saveAd").status).toBe("ok");
    expect(result.finalRecord?.confidenceScore).toBeGreaterThanOrEqual(90);
    expect(result.finalRecord?.retryCount).toBe(0);
    // 1 benefits + 1 generate -- no retry needed, Checker never called since disabled.
    expect(callModelByNameMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to the raw Generator output (ctx.ad) for Quality's title/description/cta when the Checker produced nothing, instead of reading empty fields", async () => {
    callModelByNameMock.mockResolvedValueOnce(BENEFITS_JSON).mockResolvedValueOnce(AD_JSON);
    const stages = defaultAdCopyStages().filter((stage) => stage.id !== "check");
    const result = await runAdCopyPipeline(stages, JSON.stringify(AD_COPY_INPUT_EXAMPLE), () => {});

    expect(result.finalRecord?.title).toBe("2-комн. квартира у парка");
    expect(reportFor(result.reports, "quality").checks?.some((check) => check.label.includes("Структура текста") && check.pass)).toBe(true);
  });
});
