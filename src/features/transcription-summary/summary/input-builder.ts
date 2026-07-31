import type { PipelineContractManifest } from "../contracts/contract-types";
import {
  ConversationStoreV3Contract,
  ConversationStoreV3Schema,
  type ConversationStoreV3,
} from "../contracts/conversation-store/v3/contract";
import { validateContractManifest } from "../contracts/manifest";
import { SummaryAgentInputV3Contract } from "../contracts/summary-input/v3/contract";
import { SummaryV3Contract } from "../contracts/summary/v3/contract";
import {
  TranscriptV3Schema,
  type TranscriptV3,
} from "../contracts/transcript/v3/contract";
import {
  calculateConversationStoreContentHash,
  calculateTranscriptContentHash,
} from "../store";

export const SUMMARY_PROMPT_VERSION = "summary-agent-v3.0.0" as const;

export type SummaryInputErrorCode =
  | "SUMMARY_STORE_MISSING"
  | "SUMMARY_STORE_INCOMPLETE"
  | "SUMMARY_MANIFEST_MISMATCH"
  | "SUMMARY_STORE_REFERENCE_INVALID";

export type BuildSummaryAgentInputResult =
  | Readonly<{
      ok: true;
      value: import("../contracts/summary-input/v3/contract").SummaryAgentInputV3;
    }>
  | Readonly<{
      ok: false;
      disposition: "NOT_RUN" | "TECHNICAL_ERROR";
      error: {
        status: "NOT_RUN" | "TECHNICAL_ERROR";
        errorCode: SummaryInputErrorCode;
        message: string;
      };
    }>;

function fail(
  disposition: "NOT_RUN" | "TECHNICAL_ERROR",
  errorCode: SummaryInputErrorCode,
  message: string,
): BuildSummaryAgentInputResult {
  return {
    ok: false,
    disposition,
    error: { status: disposition, errorCode, message },
  };
}

function manifestMatches(manifest: PipelineContractManifest): boolean {
  const expected = {
    conversationStore: [ConversationStoreV3Contract.id, "3.2.0"],
    summaryInput: [SummaryAgentInputV3Contract.id, "3.0.0"],
    summary: [SummaryV3Contract.id, "3.1.0"],
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
  return (
    turns.size === store.sources.length
    && store.sources.every((source) => {
      const turn = turns.get(source.turn_id);
      return turn?.speaker === source.speaker && turn.text === source.text;
    })
  );
}

export function buildSummaryAgentInput(input: {
  manifest: PipelineContractManifest;
  conversationStore: unknown;
  transcript: unknown;
  summaryPromptVersion?: string;
}): BuildSummaryAgentInputResult {
  if (input.conversationStore === null || input.conversationStore === undefined) {
    return fail("NOT_RUN", "SUMMARY_STORE_MISSING", "Conversation Store v3 is missing");
  }
  try {
    validateContractManifest(input.manifest);
  } catch (error) {
    return fail(
      "TECHNICAL_ERROR",
      "SUMMARY_MANIFEST_MISMATCH",
      error instanceof Error ? error.message : String(error),
    );
  }
  if (!manifestMatches(input.manifest)) {
    return fail(
      "TECHNICAL_ERROR",
      "SUMMARY_MANIFEST_MISMATCH",
      "Manifest does not reference the Phase 5 input/output contract set",
    );
  }

  const store = ConversationStoreV3Schema.safeParse(input.conversationStore);
  if (!store.success) {
    return fail(
      "TECHNICAL_ERROR",
      "SUMMARY_STORE_REFERENCE_INVALID",
      "Conversation Store does not match conversation.store.v3@3.2.0",
    );
  }
  const { content_hash: _contentHash, ...hashableStore } = store.data;
  if (calculateConversationStoreContentHash(hashableStore) !== store.data.content_hash) {
    return fail(
      "TECHNICAL_ERROR",
      "SUMMARY_STORE_REFERENCE_INVALID",
      "Conversation Store content hash mismatch",
    );
  }

  const transcript = TranscriptV3Schema.safeParse(input.transcript);
  if (!transcript.success) {
    return fail(
      "TECHNICAL_ERROR",
      "SUMMARY_STORE_REFERENCE_INVALID",
      "Validated transcript is unavailable",
    );
  }
  if (
    calculateTranscriptContentHash(transcript.data) !== store.data.meta.transcript_ref.sha256
    || transcript.data.transcript_id !== store.data.meta.transcript_ref.id
    || !exactTranscriptSources(store.data, transcript.data)
  ) {
    return fail(
      "TECHNICAL_ERROR",
      "SUMMARY_STORE_REFERENCE_INVALID",
      "Transcript does not match Conversation Store provenance",
    );
  }

  const candidate = {
    meta: {
      runId: store.data.meta.run_id,
      storeId: store.data.meta.store_id,
      storeContractVersion: store.data.meta.contract_version,
      manifestHash: input.manifest.manifestHash,
      transcriptHash: store.data.meta.transcript_ref.sha256,
      summaryPromptVersion: input.summaryPromptVersion ?? SUMMARY_PROMPT_VERSION,
    },
    conversationStore: store.data,
    transcriptContext: {
      turns: [...transcript.data.turns]
        .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id))
        .map((turn) => ({
          turnId: turn.id,
          speakerRole: turn.speaker,
          text: turn.text,
        })),
    },
    outputPolicy: {
      maxKeyFacts: 4 as const,
      maxQuotes: 2 as const,
      includeStructuredAttributesInText: false as const,
      duplicateCrmCardData: false as const,
    },
  };
  const parsed = SummaryAgentInputV3Contract.validator.safeParse(candidate);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : fail(
      "TECHNICAL_ERROR",
      "SUMMARY_STORE_REFERENCE_INVALID",
      parsed.error.message,
    );
}
