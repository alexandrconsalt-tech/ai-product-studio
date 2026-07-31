import { createHash } from "node:crypto";
import type { PipelineContractManifest } from "../contracts/contract-types";
import {
  ConversationStoreV3Contract,
  ConversationStoreV3Schema,
  type ConversationStoreV3,
} from "../contracts/conversation-store/v3/contract";
import { validateContractManifest } from "../contracts/manifest";
import {
  SummaryJudgeInputV3Contract,
  SummaryJudgeInputV3Schema,
  type SummaryCriterionV3,
  type SummaryJudgeInputV3,
} from "../contracts/summary-judge-input/v3/contract";
import { SummaryJudgeV3Contract } from "../contracts/summary-judges/v3/contract";
import { stableStringify } from "../contracts/schema-utils";
import { SummaryV3Contract, SummaryV3Schema } from "../contracts/summary/v3/contract";
import { TranscriptV3Schema, type TranscriptV3 } from "../contracts/transcript/v3/contract";
import {
  calculateConversationStoreContentHash,
  calculateTranscriptContentHash,
} from "../store";

export type SummaryJudgeInputErrorCode =
  | "SUMMARY_JUDGE_SUMMARY_MISSING"
  | "SUMMARY_JUDGE_SUMMARY_TECHNICAL_ERROR"
  | "SUMMARY_JUDGE_MANIFEST_MISMATCH"
  | "SUMMARY_JUDGE_INPUT_INVALID";

export type BuildSummaryJudgeInputResult =
  | Readonly<{ ok: true; value: SummaryJudgeInputV3 }>
  | Readonly<{
      ok: false;
      disposition: "NOT_RUN" | "TECHNICAL_ERROR";
      error: {
        status: "NOT_RUN" | "TECHNICAL_ERROR";
        errorCode: SummaryJudgeInputErrorCode;
        message: string;
      };
    }>;

export function calculateSummaryContentHash(summary: unknown): string {
  return createHash("sha256").update(stableStringify(summary)).digest("hex");
}

function fail(
  disposition: "NOT_RUN" | "TECHNICAL_ERROR",
  errorCode: SummaryJudgeInputErrorCode,
  message: string,
): BuildSummaryJudgeInputResult {
  return {
    ok: false,
    disposition,
    error: { status: disposition, errorCode, message },
  };
}

function manifestMatches(manifest: PipelineContractManifest): boolean {
  const expected = {
    conversationStore: [ConversationStoreV3Contract.id, "3.2.0"],
    summary: [SummaryV3Contract.id, "3.1.0"],
    summaryJudgeInput: [SummaryJudgeInputV3Contract.id, "3.0.0"],
    summaryJudges: [SummaryJudgeV3Contract.id, "3.1.0"],
  } as const;
  return Object.entries(expected).every(([role, [id, version]]) => {
    const reference = manifest.contracts[role as keyof typeof expected];
    return reference.id === id && reference.version === version;
  });
}

function exactTranscriptSources(
  store: ConversationStoreV3,
  transcript: TranscriptV3,
): boolean {
  const turns = new Map(transcript.turns.map((turn) => [turn.id, turn]));
  return turns.size === store.sources.length && store.sources.every((source) => {
    const turn = turns.get(source.turn_id);
    return turn?.speaker === source.speaker && turn.text === source.text;
  });
}

export function buildSummaryJudgeInput(input: {
  manifest: PipelineContractManifest;
  conversationStore: unknown;
  summary: unknown;
  transcript: unknown;
  criterion: SummaryCriterionV3;
  judgePromptVersion: string;
}): BuildSummaryJudgeInputResult {
  if (input.summary === null || input.summary === undefined) {
    return fail("NOT_RUN", "SUMMARY_JUDGE_SUMMARY_MISSING", "Summary v3 is missing");
  }
  if (
    typeof input.summary === "object"
    && !Array.isArray(input.summary)
    && input.summary !== null
    && "status" in input.summary
    && ["technical_error", "error"].includes(String(input.summary.status).toLowerCase())
  ) {
    return fail(
      "NOT_RUN",
      "SUMMARY_JUDGE_SUMMARY_TECHNICAL_ERROR",
      "Summary v3 ended with a technical error",
    );
  }
  try {
    validateContractManifest(input.manifest);
  } catch (error) {
    return fail(
      "TECHNICAL_ERROR",
      "SUMMARY_JUDGE_MANIFEST_MISMATCH",
      error instanceof Error ? error.message : String(error),
    );
  }
  if (!manifestMatches(input.manifest)) {
    return fail(
      "TECHNICAL_ERROR",
      "SUMMARY_JUDGE_MANIFEST_MISMATCH",
      "Manifest does not reference the Phase 6 Judge contract set",
    );
  }

  const store = ConversationStoreV3Schema.safeParse(input.conversationStore);
  const summary = SummaryV3Schema.safeParse(input.summary);
  const transcript = TranscriptV3Schema.safeParse(input.transcript);
  if (!store.success || !summary.success || !transcript.success) {
    return fail(
      "TECHNICAL_ERROR",
      "SUMMARY_JUDGE_INPUT_INVALID",
      "Store, Summary or transcript does not match its typed v3 contract",
    );
  }
  const { content_hash: _contentHash, ...hashableStore } = store.data;
  if (
    calculateConversationStoreContentHash(hashableStore) !== store.data.content_hash
    || calculateTranscriptContentHash(transcript.data) !== store.data.meta.transcript_ref.sha256
    || transcript.data.transcript_id !== store.data.meta.transcript_ref.id
    || !exactTranscriptSources(store.data, transcript.data)
  ) {
    return fail(
      "TECHNICAL_ERROR",
      "SUMMARY_JUDGE_INPUT_INVALID",
      "Judge input provenance or content hash mismatch",
    );
  }

  const candidate = {
    meta: {
      runId: store.data.meta.run_id,
      manifestHash: input.manifest.manifestHash,
      storeId: store.data.meta.store_id,
      storeContentHash: store.data.content_hash,
      transcriptHash: store.data.meta.transcript_ref.sha256,
      summaryHash: calculateSummaryContentHash(summary.data),
      summaryContractVersion: "3.1.0" as const,
      judgeCriterion: input.criterion,
      judgePromptVersion: input.judgePromptVersion,
    },
    conversationStore: store.data,
    summary: summary.data,
    transcriptContext: {
      turns: [...transcript.data.turns]
        .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id))
        .map((turn) => ({
          turnId: turn.id,
          speakerRole: turn.speaker,
          text: turn.text,
        })),
    },
    evaluationPolicy: {
      criterion: input.criterion,
      weight: 0.2 as const,
    },
  };
  const parsed = SummaryJudgeInputV3Schema.safeParse(candidate);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : fail(
      "TECHNICAL_ERROR",
      "SUMMARY_JUDGE_INPUT_INVALID",
      parsed.error.message,
    );
}
