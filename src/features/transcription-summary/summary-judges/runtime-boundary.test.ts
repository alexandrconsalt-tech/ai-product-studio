import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Phase 6 runtime boundary", () => {
  const root = process.cwd();
  const route = readFileSync(
    join(root, "src/app/api/transcription-summary-v3/structured/route.ts"),
    "utf8",
  );
  const pipeline = readFileSync(
    join(root, "public/pipeline-lab-v3.html"),
    "utf8",
  );
  const judgeSource = readdirSync(
    join(root, "src/features/transcription-summary/summary-judges"),
  )
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => readFileSync(
      join(root, "src/features/transcription-summary/summary-judges", name),
      "utf8",
    ))
    .join("\n");

  it("maps exactly five existing runtime stages to five independent Judges", () => {
    for (const outKey of [
      "truth_check",
      "critical_completeness_check",
      "agent_utility_check",
      "action_check",
      "presentation_check",
    ]) {
      expect(pipeline).toContain(outKey);
    }
    expect(pipeline).toContain("return 'summaryJudges'");
    expect(pipeline).toContain("action:'judge_summary'");
    expect(route).toContain('action: z.literal("judge_summary")');
    expect(route).toContain("executeSummaryJudgeV3");
  });

  it("continues after one technical Judge and hands all verdicts to Phase 7", () => {
    expect(pipeline).toContain("report.phase_boundary_stop=false");
    expect(pipeline).toContain("typed.verdict==='fail'?'attn':'bad'");
    expect(pipeline).not.toContain("summaryJudgeV3Failure");
  });

  it("keeps Judges isolated from Quality Gate and CRM implementation details", () => {
    expect(pipeline).toContain("action:'quality_gate_summary'");
    expect(judgeSource).not.toMatch(/quality[-_]?gate|adaptSummaryJudgeToQualityGate|moduleCrm|publish_result/i);
  });

  it("does not use legacy Judge validators or compatibility mapping in the v3 route", () => {
    expect(route).not.toContain("adaptSummaryJudgeToQualityGateV1");
    expect(route).not.toContain("compatibility");
    expect(judgeSource).not.toMatch(/validateTruth|validatePresentation|legacy|parseJSON/);
  });
});
