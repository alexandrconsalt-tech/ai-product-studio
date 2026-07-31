import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Phase 7 runtime boundary", () => {
  const root = process.cwd();
  const route = readFileSync(
    join(root, "src/app/api/transcription-summary-v3/structured/route.ts"),
    "utf8",
  );
  const pipeline = readFileSync(
    join(root, "public/pipeline-lab-v3.html"),
    "utf8",
  );
  const gateSource = readdirSync(
    join(root, "src/features/transcription-summary/quality-gate"),
  )
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => readFileSync(
      join(root, "src/features/transcription-summary/quality-gate", name),
      "utf8",
    ))
    .join("\n");

  it("routes the existing Gate stage to the deterministic v3 implementation", () => {
    expect(pipeline).toContain("return 'qualityGate'");
    expect(pipeline).toContain("action:'quality_gate_summary'");
    expect(route).toContain('action: z.literal("quality_gate_summary")');
    expect(route).toContain("executeSummaryQualityGateV3");
  });

  it("passes exactly the five Judge stage outputs to Gate", () => {
    expect(pipeline).toContain(`verdicts:[
          ctx.truth_check,
          ctx.critical_completeness_check,
          ctx.agent_utility_check,
          ctx.action_check,
          ctx.presentation_check
        ]`);
  });

  it("hands a typed Gate result to CRM inside the full Phase 9 flow", () => {
    expect(pipeline).toContain("if(role==='crmPublication')");
    expect(pipeline).toContain("qualityGate:ctx.summary_quality_gate");
    expect(pipeline).toContain("reason:'FULL_V3_ORCHESTRATOR'");
    expect(gateSource).not.toMatch(/moduleCrm|publish_result|crm_write|localStorage|callModel|executeStructuredCompletion/i);
  });

  it("does not call the legacy Gate from the v3 role branch", () => {
    const v3Start = pipeline.indexOf("async function runV3StructuredStage");
    const v3End = pipeline.indexOf("async function runStage", v3Start);
    const v3Runtime = pipeline.slice(v3Start, v3End);
    expect(v3Runtime).toContain("if(role==='qualityGate')");
    expect(v3Runtime).not.toContain("moduleSummaryQualityGateV1");
    expect(v3Runtime).not.toContain("CODE_FUNCS.summaryQualityGate");
  });
});
