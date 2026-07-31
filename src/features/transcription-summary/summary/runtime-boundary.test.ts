import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Phase 5 runtime boundary", () => {
  const route = readFileSync(
    new URL("../../../app/api/transcription-summary-v3/structured/route.ts", import.meta.url),
    "utf8",
  );
  const pipeline = readFileSync(
    new URL("../../../../public/pipeline-lab-v3.html", import.meta.url),
    "utf8",
  );

  it("runs Summary v3 only from the completed Store v3 stage", () => {
    expect(pipeline).toContain("stage.type==='llm'&&stage.outKey==='summary'");
    expect(pipeline).toContain("conversationStore:ctx.conversation_store");
    expect(pipeline).toContain("action:'summarize'");
    expect(route).toContain("executeSummaryAgentV3");
    expect(route).toContain('action: z.literal("summarize")');
  });

  it("hands a successful Summary v3 to the full Phase 9 orchestrator", () => {
    expect(pipeline).toContain("return 'summaryJudges'");
    expect(pipeline).not.toContain("return 'phase6Blocked'");
    expect(pipeline).toContain("summaryAgentV3Failure");
    expect(pipeline).toContain("reason:'FULL_V3_ORCHESTRATOR'");
    expect(pipeline).toContain("action:'execute_pipeline'");
    expect(pipeline).toContain("transcriptionSummaryV3Enabled()\n    ? {tokens:0,cost:0,attempted:false");
  });

  it("does not import Store v1, raw Agent outputs or a legacy parser in Summary v3", () => {
    const summaryBranch = pipeline.slice(
      pipeline.indexOf("if(role==='summary')"),
      pipeline.indexOf("if(role==='summaryJudges')"),
    );
    expect(summaryBranch).not.toMatch(/fact_check|need_check|outcome_check|parseJSON|conversation_store_v1/);
    expect(route).not.toMatch(/adaptSummary.*StoreV1/);
  });

  it("uses Store v3 provenance without the legacy Store helper", () => {
    expect(pipeline).toContain("String(ctx.conversation_store?.content_hash||'')");
  });
});
