import { describe, expect, it } from "vitest";
import { applyTranscriptSpeakerInheritanceV3 } from "./transcript-speaker-policy";

describe("applyTranscriptSpeakerInheritanceV3", () => {
  it("removes marker turns and preserves traceable content ids", () => {
    const result = applyTranscriptSpeakerInheritanceV3({
      transcript_id: "transcript-marker",
      turns: [
        { id: "turn-1", sequence: 0, speaker: "client", text: "Клиент:" },
        { id: "turn-2", sequence: 1, speaker: "other", text: "Деньги на счету." },
        { id: "turn-3", sequence: 2, speaker: "agent", text: "Агент:" },
        { id: "turn-4", sequence: 3, speaker: "other", text: "Позвоню вечером." },
        { id: "turn-5", sequence: 4, speaker: "other", text: "Если получится, покажу завтра." },
      ],
      validation_warnings: [],
    });

    expect(result.turns).toEqual([
      { id: "turn-2", sequence: 1, speaker: "client", text: "Деньги на счету." },
      { id: "turn-4", sequence: 3, speaker: "agent", text: "Позвоню вечером." },
      { id: "turn-5", sequence: 4, speaker: "agent", text: "Если получится, покажу завтра." },
    ]);
    expect(result.validation_warnings).toContain("speaker_marker_turns_removed:2");
    expect(result.validation_warnings).toContain("speaker_roles_inherited:3");
  });
});
