import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Phase 8 runtime boundary", () => {
  const root = process.cwd();
  const route = readFileSync(
    join(root, "src/app/api/transcription-summary-v3/structured/route.ts"),
    "utf8",
  );
  const pipeline = readFileSync(join(root, "public/pipeline-lab-v3.html"), "utf8");
  const crmSource = readdirSync(
    join(root, "src/features/transcription-summary/crm-publication"),
  )
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => readFileSync(
      join(root, "src/features/transcription-summary/crm-publication", name),
      "utf8",
    ))
    .join("\n");

  it("routes only the existing CRM stage through the v3 adapter when the flag selects v3", () => {
    expect(pipeline).toContain("stage.type==='code'&&stage.codeFn==='crm'&&stage.outKey==='crm'");
    expect(pipeline).toContain("return 'crmPublication'");
    expect(pipeline).toContain("if(role==='crmPublication')");
  });

  it("forces server-side dry-run and returns CRM in the full Phase 9 report", () => {
    expect(route).toContain('action: z.literal("publish_crm_summary")');
    expect(route).toContain("executeCrmPublicationV3");
    expect(route).toContain("dryRun: true");
    expect(route).toContain("CRM_CLIENT_MUST_NOT_BE_CALLED_IN_DRY_RUN");
    expect(pipeline).toContain("report.crm_status");
    expect(pipeline).toContain("reason:'FULL_V3_ORCHESTRATOR'");
  });

  it("keeps target deterministic and outside LLM output", () => {
    expect(pipeline).toContain("crmSystem:'pipeline-lab-diagnostic-crm'");
    expect(pipeline).toContain("entityId:String(ctx.__run_id||'')");
    expect(crmSource).not.toMatch(/transcript|raw LLM|legacy parser|localStorage|callModel/i);
  });

  it("does not invoke legacy CRM from the v3 branch", () => {
    const start = pipeline.indexOf("if(role==='crmPublication')");
    const end = pipeline.indexOf("const inputData=", start);
    const branch = pipeline.slice(start, end);
    expect(branch).not.toContain("CODE_FUNCS.crm");
    expect(branch).not.toContain("moduleCrm");
    expect(branch).not.toContain("crmAdapterFor");
  });
});
