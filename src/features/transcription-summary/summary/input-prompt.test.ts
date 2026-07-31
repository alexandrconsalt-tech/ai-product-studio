import { describe, expect, it } from "vitest";
import { buildSummaryAgentInput } from "./input-builder";
import { createSummaryFixtureContext } from "./fixtures";
import { buildSummaryPromptV3 } from "./prompt-builder";
import { calculateConversationStoreContentHash } from "../store";

describe("Summary input и prompt", () => {
  it("передаёт Store 3.2 и полную транскрипцию", () => {
    const fixture = createSummaryFixtureContext();
    const result = buildSummaryAgentInput({
      manifest: fixture.manifest,
      conversationStore: fixture.store,
      transcript: fixture.transcript,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.meta.storeContractVersion).toBe("3.2.0");
    expect(result.value.transcriptContext.turns).toHaveLength(fixture.transcript.turns.length);
  });

  it("принимает partial Store", () => {
    const fixture = createSummaryFixtureContext();
    const partial = {
      ...fixture.store,
      partial: true,
      source_errors: ["outcome"],
    };
    const { content_hash: _hash, ...hashable } = partial;
    const result = buildSummaryAgentInput({
      manifest: fixture.manifest,
      conversationStore: {
        ...partial,
        content_hash: calculateConversationStoreContentHash(hashable),
      },
      transcript: fixture.transcript,
    });
    expect(result.ok).toBe(true);
  });

  it("делает Store и транскрипцию равноправными видимыми источниками", () => {
    const fixture = createSummaryFixtureContext();
    const built = buildSummaryAgentInput({
      manifest: fixture.manifest,
      conversationStore: fixture.store,
      transcript: fixture.transcript,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const prompt = buildSummaryPromptV3(built.value).resolvedPrompt;
    expect(prompt).toContain("Conversation Store v3 — структурированный источник");
    expect(prompt).toContain("Полная транскрипция — равноправный источник");
    expect(prompt).toContain("conversation_result");
    expect(prompt).toContain("Верни ровно четыре поля");
  });

  it("не запускается без Store", () => {
    const fixture = createSummaryFixtureContext();
    expect(buildSummaryAgentInput({
      manifest: fixture.manifest,
      conversationStore: null,
      transcript: fixture.transcript,
    })).toMatchObject({ ok: false, disposition: "NOT_RUN" });
  });
});
