import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Phase 4 runtime boundary", () => {
  const route = readFileSync(
    new URL("../../../app/api/transcription-summary-v3/structured/route.ts", import.meta.url),
    "utf8",
  );
  const pipeline = readFileSync(
    new URL("../../../../public/pipeline-lab-v3.html", import.meta.url),
    "utf8",
  );

  it("builds Store v3 directly and has no verified-to-Store-v1 adapter path", () => {
    expect(route).toContain('action: z.literal("build_store")');
    expect(route).toContain("buildConversationStoreV3");
    expect(route).not.toMatch(/adapt(?:Facts|Needs|Outcome)VerifiedToConversationStoreV1/);
    expect(pipeline).not.toMatch(/reconciled\.compatibility/);
  });

  it("intercepts only the flagged Conversation Store stage and hands its output to Summary v3", () => {
    expect(pipeline).toContain("stage.codeFn==='conversationStore'&&stage.outKey==='conversation_store'");
    expect(pipeline).toContain("stage.type==='llm'&&stage.outKey==='summary'");
    expect(pipeline).toContain("action:'summarize'");
    expect(pipeline).toContain("conversationStoreV3Failure");
  });
});
