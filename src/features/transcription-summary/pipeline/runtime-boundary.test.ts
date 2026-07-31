import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Phase 9 full runtime boundary", () => {
  const root = process.cwd();
  const route = readFileSync(
    join(root, "src/app/api/transcription-summary-v3/structured/route.ts"),
    "utf8",
  );
  const config = readFileSync(
    join(root, "src/app/api/transcription-summary-v3/config/runtime-config.ts"),
    "utf8",
  );
  const pipeline = readFileSync(join(root, "public/pipeline-lab-v3.html"), "utf8");

  it("runs the full v3 flow through one typed orchestrator action", () => {
    expect(route).toContain('action: z.literal("execute_pipeline")');
    expect(route).toContain("executeTranscriptionSummaryV3Pipeline");
    expect(route).toContain("RuntimeTranscriptionSummaryV3StageExecutor");
    expect(pipeline).toContain("action:'execute_pipeline'");
    expect(pipeline).toContain("await runFullV3Pipeline");
  });

  it("has no artificial Phase 4-8 boundary in the active v3 path", () => {
    expect(pipeline).not.toMatch(/PHASE_[4-8]_BOUNDARY/);
    expect(pipeline).not.toMatch(/Phase [4-8] завершается после/);
  });

  it("uses explicit server flags and cannot be enabled by query or Local Storage", () => {
    expect(config).toContain("TRANSCRIPTION_SUMMARY_V3_ENABLED_FLAG");
    expect(config).toContain("TRANSCRIPTION_SUMMARY_V3_CRM_DRY_RUN_FLAG");
    expect(config).toContain('environment.VERCEL_ENV === "preview"');
    expect(pipeline).not.toMatch(/localStorage[^;\n]*transcriptionSummaryV3Enabled/);
    expect(pipeline).not.toMatch(/searchParams[^;\n]*transcriptionSummaryV3Enabled/i);
  });

  it("fails closed until Preview typed config is received and rejects every legacy runtime marker", () => {
    expect(pipeline).toContain("PIPELINE_RUNTIME_CONFIG_RECEIVED=false");
    expect(pipeline).toContain("V3_RUNTIME_CONFIGURATION_MISMATCH");
    expect(pipeline).toContain("IS_TRANSCRIPTION_SUMMARY_PRODUCT");
    expect(route).toContain("validateV3RuntimeConfiguration");
    expect(route).toContain('rawRequest.provider === "ai-tunnel"');
    expect(route).toContain('rawRequest.stage_version === "v1"');
    expect(route).toContain('rawRequest.contractVersion === "transcription_summary_v1"');
    expect(route).toContain("rawRequest.parserFallbackEnabled === true");
  });

  it("allows only direct OpenAI and keeps CRM server-side dry-run", () => {
    expect(route).toContain('provider: z.literal("openai-direct")');
    expect(route).toContain("dryRun: true");
    expect(route).toContain("CRM_CLIENT_MUST_NOT_BE_CALLED_IN_DRY_RUN");
    expect(pipeline).toContain("provider:'openai-direct'");
    expect(pipeline).toContain("parserFallbackEnabled:false");
    const fullV3 = pipeline.slice(
      pipeline.indexOf("async function runFullV3Pipeline"),
      pipeline.indexOf("async function runPipeline"),
    );
    expect(fullV3).not.toContain("provider:'ai-tunnel'");
  });

  it("keeps the OpenAI credential server-side and never accepts it from Preview UI", () => {
    expect(route).toContain("createOpenAiDirectTransport()");
    expect(route).not.toMatch(/apiKey:\s*z\.string/);
    const fullV3 = pipeline.slice(
      pipeline.indexOf("async function runFullV3Pipeline"),
      pipeline.indexOf("async function runPipeline"),
    );
    expect(fullV3).not.toContain("loadOpenaiKey()");
    expect(fullV3).not.toMatch(/\bapiKey\s*:/);
  });

  it("keeps legacy run orchestration available behind the false flag branch", () => {
    expect(pipeline).toContain("for(let i=0;i<active.length;i++)");
    expect(pipeline).toContain("const v3Role=transcriptionSummaryV3Enabled()?v3SelectedRole(stage):null");
    expect(pipeline).toContain("if(v3Role) return runV3StructuredStage");
  });
});
