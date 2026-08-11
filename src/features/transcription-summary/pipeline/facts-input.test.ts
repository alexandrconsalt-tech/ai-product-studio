import { describe, expect, it } from "vitest";
import { TranscriptV3Schema } from "../contracts/transcript/v3/contract";
import { buildCompactFactsInputV3 } from "./facts-input";

function transcript() {
  return TranscriptV3Schema.parse({
    transcript_id: "facts-input-test",
    turns: [
      { id: "turn-1", sequence: 0, speaker: "operator", text: "Здравствуйте.", started_at_ms: null, ended_at_ms: null },
      { id: "turn-2", sequence: 1, speaker: "client", text: "Да.", started_at_ms: null, ended_at_ms: null },
      { id: "turn-3", sequence: 2, speaker: "agent", text: "Угу.", started_at_ms: null, ended_at_ms: null },
      { id: "turn-4", sequence: 3, speaker: "agent", text: "Квартира приобретена по ДДУ и находится в ипотеке.", started_at_ms: null, ended_at_ms: null },
    ],
    metadata: { run_id: "run", sha256: "a".repeat(64), duplicated: "not-for-provider" },
    validation_warnings: ["not-for-provider"],
  });
}

describe("Facts input compaction v3", () => {
  it("оставляет в initial input только id, speaker и text", () => {
    const result = buildCompactFactsInputV3(transcript(), "initial");
    expect(result.turns).toEqual([
      { id: "turn-1", speaker: "operator", text: "Здравствуйте." },
      { id: "turn-2", speaker: "client", text: "Да." },
      { id: "turn-3", speaker: "agent", text: "Угу." },
      { id: "turn-4", speaker: "agent", text: "Квартира приобретена по ДДУ и находится в ипотеке." },
    ]);
    expect(result.duplicatedContextTokensRemoved).toBeGreaterThan(0);
  });

  it("при retry сохраняет все клиентские turns и значимый ответ агента", () => {
    const result = buildCompactFactsInputV3(transcript(), "retry");
    expect(result.turns.map((turn) => turn.id)).toEqual(["turn-2", "turn-4"]);
    expect(result.removedTurnIds).toEqual(["turn-1", "turn-3"]);
  });
});
