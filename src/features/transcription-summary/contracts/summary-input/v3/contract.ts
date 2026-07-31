import { z } from "zod";
import { ConversationStoreV3Schema } from "../../conversation-store/v3/contract";
import { SPEAKER_ROLES } from "../../canonical-enums";
import { defineContract } from "../../schema-utils";
import {
  IdentifierSchema,
  NonEmptyStringSchema,
  SpeakerRoleSchema,
} from "../../shared-schemas";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const SummaryAgentInputV3Schema = z.object({
  meta: z.object({
    runId: IdentifierSchema,
    storeId: IdentifierSchema,
    storeContractVersion: z.literal("3.2.0"),
    manifestHash: Sha256Schema,
    transcriptHash: Sha256Schema,
    summaryPromptVersion: NonEmptyStringSchema,
  }).strict(),
  conversationStore: ConversationStoreV3Schema,
  transcriptContext: z.object({
    turns: z.array(z.object({
      turnId: IdentifierSchema,
      speakerRole: SpeakerRoleSchema,
      text: NonEmptyStringSchema,
    }).strict()).min(1),
  }).strict(),
  outputPolicy: z.object({
    maxKeyFacts: z.literal(4),
    maxQuotes: z.literal(2),
    includeStructuredAttributesInText: z.literal(false),
    duplicateCrmCardData: z.literal(false),
  }).strict(),
}).strict().superRefine((input, context) => {
  if (
    input.meta.runId !== input.conversationStore.meta.run_id
    || input.meta.storeId !== input.conversationStore.meta.store_id
    || input.meta.storeContractVersion !== input.conversationStore.meta.contract_version
    || input.meta.manifestHash !== input.conversationStore.meta.manifest_hash
    || input.meta.transcriptHash !== input.conversationStore.meta.transcript_ref.sha256
  ) {
    context.addIssue({
      code: "custom",
      message: "Summary input metadata must match Conversation Store provenance",
    });
  }
  const sourceIds = new Set(input.conversationStore.sources.map((source) => source.turn_id));
  const contextTurns = new Map(input.transcriptContext.turns.map((turn) => [turn.turnId, turn]));
  if (
    sourceIds.size !== contextTurns.size
    || input.conversationStore.sources.some((source) => {
      const turn = contextTurns.get(source.turn_id);
      return turn?.speakerRole !== source.speaker || turn.text !== source.text;
    })
  ) {
    context.addIssue({
      code: "custom",
      message: "Transcript context must exactly cover Conversation Store sources",
    });
  }
});

const store = {
  meta: {
    store_id: "store-0123456789abcdef01234567",
    run_id: "run-1",
    schema_id: "conversation.store.v3",
    contract_version: "3.2.0",
    publication_status: "published",
    manifest_hash: "a".repeat(64),
    transcript_ref: { id: "transcript-1", sha256: "b".repeat(64) },
  },
  facts: [],
  quotes: [],
  attributes: {},
  requirements: [],
  call_results: [],
  agreements: [],
  primary_next_step: {
    agreement_ids: [],
    action: "",
    owner: "",
    recipient: "",
    deadline: "",
    channel: "",
    status: "not_defined",
    confidence: 0,
  },
  source_quality: {},
  transcript_available: true,
  partial: false,
  source_errors: [],
  sources: [{ turn_id: "turn-1", speaker: "client", text: "Спасибо." }],
  content_hash: "c".repeat(64),
} as const;

const valid = {
  meta: {
    runId: "run-1",
    storeId: "store-0123456789abcdef01234567",
    storeContractVersion: "3.2.0",
    manifestHash: "a".repeat(64),
    transcriptHash: "b".repeat(64),
    summaryPromptVersion: "summary-agent-v3.0.0",
  },
  conversationStore: store,
  transcriptContext: {
    turns: [{ turnId: "turn-1", speakerRole: "client", text: "Спасибо." }],
  },
  outputPolicy: {
    maxKeyFacts: 4,
    maxQuotes: 2,
    includeStructuredAttributesInText: false,
    duplicateCrmCardData: false,
  },
} as const;

export const SummaryAgentInputV3Contract = defineContract({
  id: "summary.agent.input.v3",
  version: "3.0.0",
  stageId: "summary_input_build",
  description: "Typed input Summary Agent v3 из Conversation Store и полной транскрипции.",
  validator: SummaryAgentInputV3Schema,
  canonicalEnums: SPEAKER_ROLES,
  structuredOutput: false,
  repairPolicyId: "repair.none.v1",
  fixtures: {
    valid,
    missing_required: { ...valid, conversationStore: null },
    extra_legacy_field: { ...valid, legacy_store: {} },
    invalid_enum: {
      ...valid,
      transcriptContext: {
        turns: [{ turnId: "turn-1", speakerRole: "manager", text: "Спасибо." }],
      },
    },
    invalid_nested_type: {
      ...valid,
      outputPolicy: { ...valid.outputPolicy, maxKeyFacts: 5 },
    },
  },
});

export type SummaryAgentInputV3 = z.infer<typeof SummaryAgentInputV3Schema>;
