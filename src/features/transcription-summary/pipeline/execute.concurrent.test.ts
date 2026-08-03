import { describe, expect, it } from "vitest";
import { executeTranscriptionSummaryV3Pipeline } from "./execute";
import type { PipelineStageExecution, TranscriptionSummaryV3StageId } from "./types";

const transcript = {
  transcript_id: "transcript-concurrent-judges",
  turns: [{
    id: "turn-1",
    sequence: 1,
    speaker: "client",
    text: "Перезвоните завтра.",
    started_at_ms: null,
    ended_at_ms: null,
  }],
  metadata: {},
  validation_warnings: [],
};

function success(stageId: TranscriptionSummaryV3StageId): PipelineStageExecution {
  const value = stageId === "quality_gate"
    ? { qualityScore: 100, decision: "QUALITY_RECORDED" }
    : stageId === "crm_publication"
      ? { status: "DRY_RUN" }
      : { stageId };
  return {
    status: "SUCCESS",
    value,
    audit: {
      contractId: "",
      contractVersion: "",
      schemaHash: "",
      validationStatus: "valid",
      blocking: false,
    },
  };
}

describe("typed v3 Judge orchestration", () => {
  it("запускает пять Judges параллельно и изолирует rejected Judge", async () => {
    let active = 0;
    let maxActive = 0;
    const result = await executeTranscriptionSummaryV3Pipeline({
      transcript,
      runId: "run-concurrent-judges",
      executor: {
        async execute(stageId) {
          if (!stageId.startsWith("summary_judge_")) return success(stageId);
          active += 1;
          maxActive = Math.max(maxActive, active);
          await new Promise((resolve) => setTimeout(resolve, 10));
          active -= 1;
          if (stageId === "summary_judge_format") throw new Error("controlled rejection");
          return success(stageId);
        },
      },
    });
    expect(maxActive).toBe(5);
    expect(result.report.stages).toHaveLength(13);
    expect(result.report.stages.find((stage) => stage.stage_id === "summary_judge_format")).toMatchObject({
      status: "TECHNICAL_ERROR",
      error_code: "UNHANDLED_STAGE_ERROR",
      blocking: false,
    });
    expect(result.report.stages.filter((stage) => stage.stage_id.startsWith("summary_judge_") && stage.status === "SUCCESS")).toHaveLength(4);
    expect(result.report.crm_status).toBe("DRY_RUN");
  });
});
