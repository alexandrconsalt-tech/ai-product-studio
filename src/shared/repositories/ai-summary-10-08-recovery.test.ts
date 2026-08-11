import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const projectId = "project_ai_summary_2026_08_10";

function readRecoveryStage() {
  const context = { window: {} as Record<string, unknown>, Object };
  runInNewContext(readFileSync(resolve(process.cwd(), "public", "ai-summary-10-08-pipeline-v1.js"), "utf8"), context);
  const config = context.window.__AI_SUMMARY_10_08_PIPELINE_CONFIG__ as {
    version: number;
    revision: number;
    sourceReport: string;
    stages: ReadonlyArray<Record<string, unknown>>;
  };
  return config;
}

function readFinalizationRecovery() {
  const context = { window: {} as Record<string, unknown>, Object };
  runInNewContext(readFileSync(resolve(process.cwd(), "public", "ai-summary-10-08-summary-judge-recovery-v1.js"), "utf8"), context);
  runInNewContext(readFileSync(resolve(process.cwd(), "public", "ai-summary-10-08-finalization-v1.js"), "utf8"), context);
  return {
    summaryJudge: context.window.__AI_SUMMARY_10_08_SUMMARY_JUDGE_RECOVERY_V1__ as Record<string, unknown>,
    finalization: context.window.__AI_SUMMARY_10_08_FINALIZATION_V1__ as { stages: ReadonlyArray<Record<string, unknown>> },
  };
}

describe("AI Summary 10.08 recovery", () => {
  it("reconstructs the six-stage pipeline_report 55 recovery without changing LLM prompts or settings", () => {
    const config = readRecoveryStage();

    expect(config).toMatchObject({ version: 14, revision: 4, sourceReport: "pipeline_report (55).json" });
    expect(config.stages).toHaveLength(6);
    expect(config.stages.slice(0, 4).map((stage) => createHash("sha256").update(JSON.stringify(stage)).digest("hex"))).toEqual([
      "8f5558c09a2998dbe87a9394b33187b8accbe80c1ba9e090db1bafb5696f83dc",
      "6dbc50ebb705f137877b46c8992265b8cbafa36b94716b3343010e1065ff101d",
      "78cc20ea08ddae2eaf265e5a02705ddd966fc49037d5079dae5759047a10522c",
      "a4948d396aae52277aac77d64975b4f0e7afb05f50b66e481753f62cd8d873da",
    ]);
    expect(config.stages[0]).toMatchObject({
      enabled: true,
      type: "llm",
      name: "Facts Extractor",
      provider: "ai-tunnel",
      model: "gpt-5-mini",
      outKey: "facts_extractor",
      temperature: 0,
      maxTokens: 6000,
      promptSource: "user_override",
      promptEdited: true,
      settingsEdited: true,
      userEdited: true,
    });
    expect(config.stages[4]).toEqual({
      enabled: true,
      type: "code",
      name: "Store Cleaner",
      outKey: "clean_conversation_store",
      codeFn: "aiSummaryStoreCleaner",
      sourceOutKey: "conversation_judge",
      contractId: "ai_summary_10_08_clean_conversation_store",
      contractVersion: "v1",
      schemaId: "ai_summary_10_08_clean_conversation_store_v1",
      stageVersion: "v4",
    });
    const { contractId, contractVersion, schemaId, ...summaryFromRecovery } = config.stages[5] as Record<string, unknown>;
    expect(createHash("sha256").update(JSON.stringify(summaryFromRecovery)).digest("hex")).toBe("da5b66b522d74ca4d785f6409812f605124b01228be03269457872f16bcf4c00");
    expect({ contractId, contractVersion, schemaId }).toEqual({ contractId: "ai_summary_10_08_summary", contractVersion: "v1", schemaId: "ai_summary_10_08_summary_v1" });
  });

  it("uses product-scoped strict and versioned contracts for custom extractors", () => {
    const html = readFileSync(resolve(process.cwd(), "public", "pipeline-lab-v3.html"), "utf8");
    const guard = readFileSync(resolve(process.cwd(), "public", "ai-summary-10-08-conversation-judge-v5.js"), "utf8");

    expect(html).toContain('<script src="/ai-summary-10-08-pipeline-v1.js"></script>');
    expect(html).toContain('<script src="/ai-summary-10-08-store-cleaner.js"></script>');
    expect(html).toContain('<script src="/ai-summary-10-08-conversation-judge-v5.js"></script>');
    expect(html).toContain('<script src="/ai-summary-10-08-summary-judge-recovery-v1.js"></script>');
    expect(html).toContain('<script src="/ai-summary-10-08-finalization-v1.js"></script>');
    expect(html).toContain(`const AI_SUMMARY_TEN_AUGUST_PROJECT_ID = '${projectId}';`);
    expect(html).toContain("const AI_SUMMARY_CUSTOM_RESPONSE_CONTRACTS=Object.freeze({");
    expect(html).toContain("facts_extractor:Object.freeze({contractId:AI_SUMMARY_FACTS_CONTRACT_ID");
    expect(html).toContain("needs_extractor:Object.freeze({contractId:AI_SUMMARY_NEEDS_CONTRACT_ID");
    expect(html).toContain("outcome_extractor:Object.freeze({contractId:AI_SUMMARY_OUTCOME_CONTRACT_ID");
    expect(html).toContain("conversation_judge:Object.freeze({contractId:AI_SUMMARY_CONVERSATION_JUDGE_CONTRACT_ID");
    expect(html).toContain("summary_generator:Object.freeze({contractId:AI_SUMMARY_SUMMARY_CONTRACT_ID");
    expect(html).toContain("additionalProperties:false,required:['fact','evidence']");
    expect(html).toContain("required:['primary_need','requirements','preferences','objections','unresolved_questions']");
    expect(html).toContain("required:['call_result','agreement','next_step','responsible_party','deadline','channel']");
    expect(html).toContain("AI_SUMMARY_CONVERSATION_JUDGE_UPSTREAM_KEYS");
    expect(html).toContain("AI_SUMMARY_JUDGE_ROLE_CONSISTENCY_V2");
    expect(html).toContain("AI_SUMMARY_JUDGE_SELLER_SCOPE_V3");
    expect(guard).toContain("AI_SUMMARY_JUDGE_OUTCOME_EVIDENCE_V4");
    expect(guard).toContain("AI_SUMMARY_SUMMARY_JUDGE_EVIDENCE_V2");
    expect(html).toContain("outcome_evidence_audit");
    expect(html).toContain("ROLE_INCONSISTENCY: <краткий смысл сомнительного или удалённого факта>");
    expect(html).toContain("aiSummarySummaryGeneratorProvenance(ctx)");
    expect(html).toContain("SUMMARY_GENERATOR_FORBIDDEN_CONTEXT_REFERENCE");
    expect(html).toContain("CURRENT_RUN_PROVENANCE_VALIDATION_FAILED");
    expect(html).toContain("ensureAiSummaryTenAugustStoreCleaner(restored,deletedStageOutKeys)");
    expect(html).toContain("ensureAiSummaryTenAugustSummaryGenerator(restored,deletedStageOutKeys)");
    expect(html).toContain("ensureAiSummaryTenAugustSummaryJudge(restored,deletedStageOutKeys)");
    expect(html).toContain("ensureAiSummaryTenAugustFinalizationStages(restored,deletedStageOutKeys)");
    expect(html).toContain("migrateAiSummaryTenAugustRuntimeContracts(restored)");
    expect(html).toContain("cleaner.stageVersion!=='v4'");
    expect(html).toContain("runAiSummaryStoreCleanerStage(stage,ctx,t0)");
    expect(html).toContain("aiSummaryCustomContract.validate(parsed)");
    expect(html).toContain("!aiSummaryCustomContract&&stage.type==='llm'");
    expect(html).toContain("aiSummaryCustomStructuredContract");
    expect(html).toContain("aiSummaryCustomContract?false:stageAllowsVendorFallback(stage)");
  });

  it("restores the exact seventh stage and appends two deterministic versioned stages", () => {
    const recovery = readRecoveryStage();
    const { summaryJudge, finalization } = readFinalizationRecovery();
    const effectiveStages = [...recovery.stages, summaryJudge, ...finalization.stages];

    expect(effectiveStages).toHaveLength(9);
    expect(effectiveStages.map((stage) => stage.outKey)).toEqual([
      "facts_extractor", "needs_extractor", "outcome_extractor", "conversation_judge", "clean_conversation_store", "summary_generator", "summary_judge", "summary_quality_gate", "crm_summary_result",
    ]);
    expect(createHash("sha256").update(JSON.stringify(summaryJudge)).digest("hex")).toBe("ae6aa8d4d42e78ee5847cddd414cdc30f4db22fce7571d0bcc691cb3b01f9e0a");
    expect(finalization.stages).toEqual([
      expect.objectContaining({ type: "code", name: "Summary Quality Gate", outKey: "summary_quality_gate", codeFn: "aiSummaryQualityGate", contractId: "ai_summary_10_08_summary_quality_gate", contractVersion: "v1", schemaId: "ai_summary_10_08_summary_quality_gate_v1" }),
      expect.objectContaining({ type: "code", name: "CRM Result", outKey: "crm_summary_result", codeFn: "aiSummaryCrmResult", contractId: "ai_summary_10_08_crm_result", contractVersion: "v1", schemaId: "ai_summary_10_08_crm_result_v1" }),
    ]);
  });

  it("keeps current user config authoritative and exposes autosave state", () => {
    const html = readFileSync(resolve(process.cwd(), "public", "pipeline-lab-v3.html"), "utf8");

    expect(html).toContain("const raw=localStorage.getItem(CONFIG_STORAGE_KEY)");
    expect(html).toContain("if(!raw) return restoreApplicationAttributesPipelineConfig()||restoreAiSummaryTenAugustPipelineConfig()");
    expect(html).toContain("CONFIG_STORAGE_KEY+'.previous'");
    expect(html).toContain("CONFIG_STORAGE_KEY+'.invalid-backup'");
    expect(html).toContain('id="pipelineSaveState"');
    expect(html).toContain("schedulePipelineAutosave()");
  });

  it("migrates the obsolete Facts budget and records the exact AI Tunnel request budget", () => {
    const html = readFileSync(resolve(process.cwd(), "public", "pipeline-lab-v3.html"), "utf8");

    expect(html).toContain("migrateAiSummaryTenAugustTokenBudget(restored)");
    expect(html).toContain("AI_SUMMARY_FACTS_DEFAULT_MAX_TOKENS=6000");
    expect(html).toContain("requestedOutputTokenBudget=Math.max(1,Math.round(Number(maxTokens)||2000))");
    expect(html).toContain("requested_output_token_budget:Number(requestedOutputTokenBudget)");
    expect(html).toContain("effective_output_token_budget:Number(effectiveExtractionMaxTokens)");
  });
});
