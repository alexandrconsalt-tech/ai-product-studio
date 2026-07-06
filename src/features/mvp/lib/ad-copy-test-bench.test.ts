// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { AD_COPY_INPUT_EXAMPLE } from "@/shared/model/ad-copy-crm-input";
import { defaultAdCopyStages, repairAndParseJson, runAdCopyPipeline, type AdCopyStageReport } from "./ad-copy-test-bench";

const { callModelByNameMock } = vi.hoisted(() => ({ callModelByNameMock: vi.fn() }));

vi.mock("@/shared/llm/browser-direct-provider", async () => {
  const actual = await vi.importActual<typeof import("@/shared/llm/browser-direct-provider")>("@/shared/llm/browser-direct-provider");
  return { ...actual, callModelByName: callModelByNameMock };
});

const BENEFITS_JSON = JSON.stringify({
  usp: "Единственная квартира с видом на парк в этом доме",
  advantages: [
    "Панорамные окна дарят много естественного света весь день",
    "Соседство с парком позволяет гулять и отдыхать в двух шагах от дома",
    "Дизайнерский ремонт избавляет от любых хлопот с обустройством",
  ],
  selling_points: ["рядом парк", "панорамные окна"],
});

const AD_JSON = JSON.stringify({ title: "2-комн. квартира у парка", description: "Просторная светлая квартира с дизайнерским ремонтом рядом с парком.", cta: "Записаться на показ" });

function highConfidenceCheckJson() {
  return JSON.stringify({
    facts_ok: true,
    style_ok: true,
    language_ok: true,
    prohibited_words_ok: true,
    ai_cliches_ok: true,
    readability_score: 90,
    seo_ok: true,
    duplicates_ok: true,
    user_settings_ok: true,
    platform_requirements_ok: true,
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
    ai_cliches_ok: false,
    readability_score: 40,
    seo_ok: false,
    duplicates_ok: false,
    user_settings_ok: true,
    platform_requirements_ok: true,
    title: "2-комн. квартира у парка",
    description: "Просторная светлая квартира с дизайнерским ремонтом рядом с парком.",
    cta: "Записаться на показ",
    issues: ["стиль не соответствует настройкам пользователя", "найдены AI-штампы"],
  });
}

function reportFor(reports: Readonly<Record<string, AdCopyStageReport>>, id: string) {
  return reports[id];
}

describe("repairAndParseJson", () => {
  it("parses already-valid JSON without marking it repaired", () => {
    const result = repairAndParseJson('{"title":"x","description":"y","cta":"z"}');
    expect(result.ok).toBe(true);
    expect(result.repaired).toBe(false);
  });

  it("repairs a trailing comma without losing data", () => {
    const result = repairAndParseJson('{"title":"x","description":"y","cta":"z",}');
    expect(result.ok).toBe(true);
    expect(result.repaired).toBe(true);
    expect(result.value).toEqual({ title: "x", description: "y", cta: "z" });
  });

  it("repairs a raw newline left inside a string value", () => {
    const result = repairAndParseJson('{"title":"x","description":"line one\nline two","cta":"z"}');
    expect(result.ok).toBe(true);
    expect(result.repaired).toBe(true);
    expect((result.value as { description: string }).description).toBe("line one\nline two");
  });

  it("closes brackets left open by a truncated response", () => {
    const result = repairAndParseJson('{"title":"x","description":"y","cta":"z"');
    expect(result.ok).toBe(true);
    expect(result.repaired).toBe(true);
  });

  it("reports genuinely unrepairable text honestly, without guessing at missing content", () => {
    const result = repairAndParseJson("this is not JSON at all, just prose.");
    expect(result.ok).toBe(false);
  });
});

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
    // The mandatory legal disclaimer (by deal_type "Продать") is guaranteed even though the mocked Generator/Checker text didn't include it.
    expect(result.finalRecord?.description).toContain("Мы гарантируем безопасную сделку");
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

  it("treats a disabled Checker as gracefully absent, not a confidence penalty -- its 2 components are excluded from the average rather than scored as a failure", async () => {
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
    expect(reportFor(result.reports, "quality").checks?.some((check) => check.label.includes("Требования площадок") && check.pass)).toBe(true);
  });

  it("marks a stage's JSON-repair diagnostics on its report (test-bench UI item #7: RAW response / repair result)", async () => {
    callModelByNameMock
      .mockResolvedValueOnce(BENEFITS_JSON)
      .mockResolvedValueOnce('{"title":"x","description":"y","cta":"z",}') // trailing comma -- repairable
      .mockResolvedValueOnce(highConfidenceCheckJson());

    const stages = defaultAdCopyStages();
    const result = await runAdCopyPipeline(stages, JSON.stringify(AD_COPY_INPUT_EXAMPLE), () => {});

    const generateReport = reportFor(result.reports, "generate");
    expect(generateReport.rawResponse).toBe('{"title":"x","description":"y","cta":"z",}');
    expect(generateReport.jsonRepaired).toBe(true);
    expect(generateReport.status).not.toBe("bad");
  });
});
