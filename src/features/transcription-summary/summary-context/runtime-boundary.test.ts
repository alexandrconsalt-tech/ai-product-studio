import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pipeline = readFileSync(resolve(process.cwd(), "public/pipeline-lab-v3.html"), "utf8");

describe("Canonical Summary Context runtime boundary", () => {
  it("keeps the Builder inside the existing 13-stage pipeline", () => {
    expect(pipeline).toContain("function buildCanonicalSummaryContext(store,transcript='',cardMetadata={})");
    expect(pipeline).toContain("canonical-summary-context-v1");
    expect(pipeline).toContain("ctx.__canonical_summary_context=audit.summaryContext");
    expect(pipeline).not.toContain("outKey:'canonical_summary_context'");
  });

  it("passes only ranked context to Summary Agent", () => {
    expect(pipeline).toContain("SUMMARY AGENT INPUT (единственный генеративный контекст");
    expect(pipeline).toContain("prompt_contains_raw_store:false");
    expect(pipeline).toContain("transcriptInjected:false");
    expect(pipeline).not.toContain("+'\\n\\nCONVERSATION STORE (структурированный источник):\\n'+JSON.stringify(safeStore)");
  });

  it("exposes ranking diagnostics and blocks unsafe AUTO_SAVE", () => {
    for (const reason of [
      "confirmed_conversation_result_missing",
      "critical_meaning_lost=",
      "primary_next_step_contradicts_verified_outcome",
      "builder_used_unverified_data",
      "builder_ranking_technical_error",
    ]) expect(pipeline).toContain(reason);
    expect(pipeline).toContain("Canonical Summary Context · ");
    expect(pipeline).toContain("Ranking diagnostics");
  });
});
