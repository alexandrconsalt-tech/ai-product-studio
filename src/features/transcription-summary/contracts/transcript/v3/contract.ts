import { z } from "zod";
import { SPEAKER_ROLES } from "../../canonical-enums";
import { defineContract } from "../../schema-utils";
import { IdentifierSchema, NonEmptyStringSchema, SpeakerRoleSchema } from "../../shared-schemas";

export const TranscriptV3Schema = z
  .object({
    transcript_id: IdentifierSchema,
    turns: z
      .array(
        z
          .object({
            id: IdentifierSchema,
            sequence: z.number().int().nonnegative(),
            speaker: SpeakerRoleSchema,
            text: NonEmptyStringSchema,
            started_at_ms: z.number().int().nonnegative().nullable(),
            ended_at_ms: z.number().int().nonnegative().nullable(),
          })
          .strict(),
      )
      .min(1),
    metadata: z.record(z.string(), z.json()),
    validation_warnings: z.array(NonEmptyStringSchema),
  })
  .strict();

const valid = {
  transcript_id: "transcript-1",
  turns: [{ id: "turn-1", sequence: 0, speaker: "client", text: "Ищу новостройку.", started_at_ms: 0, ended_at_ms: 1200 }],
  metadata: { language: "ru" },
  validation_warnings: [],
} as const;

export const TranscriptV3Contract = defineContract({
  id: "transcript.validated.v3",
  stageId: "transcript_validate",
  description: "Валидированная транскрипция с упорядоченными turns и ролями.",
  validator: TranscriptV3Schema,
  canonicalEnums: SPEAKER_ROLES,
  structuredOutput: false,
  repairPolicyId: "repair.none.v1",
  fixtures: {
    valid,
    missing_required: {
      transcript_id: valid.transcript_id,
      metadata: valid.metadata,
      validation_warnings: valid.validation_warnings,
    },
    extra_legacy_field: { ...valid, dialogue: [] },
    invalid_enum: { ...valid, turns: [{ ...valid.turns[0], speaker: "manager" }] },
    invalid_nested_type: { ...valid, turns: [{ ...valid.turns[0], sequence: "0" }] },
  },
});

export type TranscriptV3 = z.infer<typeof TranscriptV3Schema>;
