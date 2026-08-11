import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const projectId = "project_72f7b30d-0d09-49fd-81b7-82a8b8f88c4f";

function readRecoveredConfig() {
  const context = { window: {} as Record<string, unknown> };
  for (const file of ["ai-application-attributes-pipeline-v14.js", "ai-application-attributes-pipeline-v15.js", "ai-application-attributes-pipeline-v16.js", "ai-application-attributes-pipeline-v17.js", "ai-application-attributes-pipeline-v18.js"]) {
    runInNewContext(readFileSync(resolve(process.cwd(), "public", file), "utf8"), context);
  }
  return context.window.__AI_APPLICATION_ATTRIBUTES_PIPELINE_CONFIG__ as {
    version: number;
    revision: number;
    deletedStageOutKeys: string[];
    stages: Array<{ enabled: boolean; name: string; outKey: string; provider?: string; prompt: string; promptVersion?: number; maxTokens?: number; responseContract?: string; runtimeType?: string; actualExecutor?: string; sourceOutKey?: string; contractId?: string; contractVersion?: string }>;
  };
}

describe("AI Атрибуты в Заявке recovery preset", () => {
  it("contains the recovered v18 six-stage application-attributes pipeline", () => {
    const config = readRecoveredConfig();

    expect(config.version).toBe(14);
    expect(config.revision).toBe(18);
    expect(config.deletedStageOutKeys).toEqual(["interest_judge", "funding_source_judge", "purchase_term_judge", "attributes_merger"]);
    expect(config.stages.map((stage) => stage.outKey)).toEqual([
      "interest_extractor",
      "funding_source_extractor",
      "purchase_term_extractor",
      "attributes_judge",
      "attributes_quality_gate",
      "crm_attributes_result",
    ]);
    expect(config.stages.every((stage) => stage.enabled)).toBe(true);
    expect(config.stages.every((stage) => stage.provider === "ai-tunnel")).toBe(true);
    expect(config.stages[0].prompt).toContain("Ты — Extractor, а не проверщик");
    expect(config.stages[0].prompt).not.toContain("{{ctx.interest_extractor}}");
    expect(config.stages[0].prompt).toContain("{{transcript}}");
    expect(config.stages[3].prompt).toContain("{{attributes_judge_input}}");
    expect(config.stages[3].prompt).toContain("{{transcript}}");
    expect(config.stages[4].prompt).toContain("{{ctx.attributes_judge}}");
    expect(config.stages[4].prompt).not.toContain("attributes_merger");
    expect(config.stages[5].prompt).toContain("{{attributes_quality_gate}}");
    expect(config.stages[5]).toMatchObject({
      runtimeType: "deterministic",
      actualExecutor: "code",
      sourceOutKey: "attributes_quality_gate",
      contractId: "crm_attributes_result",
      contractVersion: "v1",
    });
    expect(config.stages[0]).toMatchObject({ maxTokens: 4000, responseContract: "application_interest_extractor_v1" });
    expect(config.stages[1]).toMatchObject({ maxTokens: 2000, responseContract: "application_funding_source_extractor_v1" });
    expect(config.stages[2]).toMatchObject({ maxTokens: 2000, responseContract: "application_purchase_term_extractor_v1" });
    expect(config.stages[3]).toMatchObject({ type: "check", runtimeType: "llm_judge", outKey: "attributes_judge", responseContract: "application_attributes_judge_v1", maxTokens: 4000 });
    expect(config.stages[4]).toMatchObject({ runtimeType: "deterministic", actualExecutor: "code", sourceOutKey: "attributes_judge", contractId: "application_attributes_quality_gate", contractVersion: "v1" });
  });

  it("distinguishes current primary-market interest from the seller's object history", () => {
    const config = readRecoveredConfig();
    const extractor = config.stages.find((stage) => stage.outKey === "interest_extractor")!;
    const judge = config.stages.find((stage) => stage.outKey === "attributes_judge")!;

    expect(extractor.promptVersion).toBe(17);
    expect(extractor.prompt).toContain("ИСТОРИЯ ОБЪЕКТА НЕ РАВНА ИНТЕРЕСУ К НОВОСТРОЙКАМ");
    expect(extractor.prompt).toContain("Квартира куплена собственником по ДДУ в 2021 году, сейчас собственность оформлена");
    expect(extractor.prompt).toContain("Ремонт от застройщика, ключи получили год назад");
    expect(extractor.prompt).toContain("Нет, только вторичку");
    expect(extractor.prompt).toContain("Рассматриваю также несданные квартиры от застройщика");
    expect(extractor.prompt).toContain("Звоню по переуступке, когда сдаётся корпус?");

    expect(judge.promptVersion).toBe(18);
    expect(judge.prompt).toContain("INTEREST");
    expect(judge.prompt).toContain("newbuild_from_context");
    expect(judge.prompt).toContain("прошлый ДДУ продавца");
    expect(judge.prompt).toContain("direct_confirmation");
    expect(judge.prompt).toContain("soft_confirmation");
    expect(extractor.prompt).toContain("value.length === evidence.length");
    expect(extractor.prompt).toContain("Новые Ватутинки, кварталы Реки");
    expect(judge.prompt).toContain("ровно одно evidence");
    expect(judge.prompt).toContain("immutable technical_error");
  });

  it("loads the preset only for the recovered product and bypasses Summary migrations", () => {
    const html = readFileSync(resolve(process.cwd(), "public", "pipeline-lab-v3.html"), "utf8");

    expect(html).toContain('<script src="/ai-application-attributes-pipeline-v14.js"></script>');
    expect(html).toContain('<script src="/ai-application-attributes-pipeline-v15.js"></script>');
    expect(html).toContain('<script src="/ai-application-attributes-pipeline-v16.js"></script>');
    expect(html).toContain('<script src="/ai-application-attributes-pipeline-v17.js"></script>');
    expect(html).toContain('<script src="/ai-application-attributes-pipeline-v18.js"></script>');
    expect(html).toContain(`const APPLICATION_ATTRIBUTES_PROJECT_ID = '${projectId}';`);
    expect(html).toContain("restoreApplicationAttributesPipelineConfig()||restoreAiSummaryTenAugustPipelineConfig()||restoreTranscriptionModulePipelineConfig()");
    expect(html).toContain("if(IS_APPLICATION_ATTRIBUTES_PROJECT){");
    expect(html).toContain("buildCustomPipelineExecutionSummary");
    expect(html).toContain("runApplicationAttributesCrmStage");
  });
});
