import { z } from "zod";
import { defineContract } from "../../schema-utils";
import {
  IdentifierSchema,
  NonEmptyStringSchema,
} from "../../shared-schemas";
import { PrimaryNextStepV3Schema } from "../../outcome/v3/contract";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const JsonObjectSchema = z.record(z.string(), z.unknown());

export const ConversationStoreV3Schema = z.object({
  meta: z.object({
    store_id: IdentifierSchema,
    run_id: IdentifierSchema,
    schema_id: z.literal("conversation.store.v3"),
    contract_version: z.literal("3.2.0"),
    publication_status: z.literal("published"),
    manifest_hash: Sha256Schema,
    transcript_ref: z.object({
      id: IdentifierSchema,
      sha256: Sha256Schema,
    }).strict(),
  }).strict(),
  facts: z.array(JsonObjectSchema),
  quotes: z.array(JsonObjectSchema),
  attributes: JsonObjectSchema,
  requirements: z.array(JsonObjectSchema),
  call_results: z.array(JsonObjectSchema),
  agreements: z.array(JsonObjectSchema),
  primary_next_step: PrimaryNextStepV3Schema,
  source_quality: JsonObjectSchema,
  transcript_available: z.literal(true),
  partial: z.boolean(),
  source_errors: z.array(z.enum(["facts", "needs", "outcome"])),
  sources: z.array(z.object({
    turn_id: IdentifierSchema,
    speaker: NonEmptyStringSchema,
    text: NonEmptyStringSchema,
  }).strict()),
  content_hash: Sha256Schema,
}).strict();

const valid = {
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
  sources: [],
  content_hash: "c".repeat(64),
} as const;

export const PROVISIONAL_CONVERSATION_STORE_FIXTURE = {
  ...valid,
  partial: true,
  source_errors: ["outcome"],
} as const;

export const ConversationStoreV3Contract = defineContract({
  id: "conversation.store.v3",
  version: "3.2.0",
  stageId: "conversation_store_build",
  description: "Conversation Store из исходных валидных результатов Extractor без зависимостей от Judge.",
  validator: ConversationStoreV3Schema,
  structuredOutput: false,
  repairPolicyId: "repair.none.v1",
  backwardCompatibility: {
    reads: ["conversation.store.v3@3.1.0", "conversation.store.v3@3.2.0"],
    writes: "conversation.store.v3@3.2.0",
  },
  fixtures: {
    valid,
    missing_required: { meta: valid.meta },
    extra_legacy_field: { ...valid, verified_facts: [] },
    invalid_enum: { ...valid, source_errors: ["judge"] },
    invalid_nested_type: { ...valid, call_results: ["назначен звонок"] },
  },
});

export type ConversationStoreV3 = z.infer<typeof ConversationStoreV3Schema>;

export const DeprecatedConversationStoreV3_0Contract = defineContract({
  id: "conversation.store.v3",
  version: "3.0.0",
  stageId: "conversation_store_build",
  description: "Deprecated verified-only Store.",
  validator: z.object({ store_id: IdentifierSchema }).passthrough(),
  status: "deprecated",
  structuredOutput: false,
  repairPolicyId: "repair.none.v1",
  fixtures: {
    valid: { store_id: "legacy-store-1" },
    missing_required: {},
    extra_legacy_field: { store_id: "legacy-store-1", raw_response: "legacy" },
    invalid_enum: { store_id: null },
    invalid_nested_type: { store_id: 1 },
  },
});
