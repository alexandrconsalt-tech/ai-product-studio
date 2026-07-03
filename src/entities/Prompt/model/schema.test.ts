import { describe, expect, it } from "vitest";
import { createPrompt } from "./factory";
import { PromptSchema } from "./schema";

describe("Prompt", () => {
  it("factory defaults status to draft (added 2026-07-03, CLAUDE.md §16/§63 item 7)", () => {
    const prompt = createPrompt({ name: "Call Summary Behavior", purpose: "generation", description: "Formats a structured call summary." });
    expect(prompt.status).toBe("draft");
    expect(PromptSchema.safeParse(prompt).success).toBe(true);
  });

  it("accepts an explicit non-draft status for a prompt already wired into a ready pipeline", () => {
    const prompt = createPrompt({ name: "Quality Check Behavior", purpose: "evaluation", description: "Checks completeness.", status: "ready" });
    expect(PromptSchema.safeParse(prompt).success).toBe(true);
  });

  it("rejects an empty description", () => {
    const prompt = createPrompt({ name: "x", purpose: "instruction", description: "" });
    expect(PromptSchema.safeParse(prompt).success).toBe(false);
  });

  it("rejects an undocumented status", () => {
    const prompt = createPrompt({ name: "x", purpose: "instruction", description: "y" });
    const invalid = { ...prompt, status: "deprecated" };
    expect(PromptSchema.safeParse(invalid).success).toBe(false);
  });
});
