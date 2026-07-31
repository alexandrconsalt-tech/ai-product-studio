import { z } from "zod";
import { CONFIDENCE_TRANSPORT_STRING_PATTERN } from "./policies/numbers";

export const TransportNonEmptyStringSchema = z
  .string()
  .refine((value) => value.trim().length > 0, "string must contain non-whitespace characters");

export const TransportIdentifierSchema = z
  .string()
  .min(1)
  .refine((value) => value === value.trim(), "identifier must not contain edge whitespace");

export const TransportSourceTurnIdsSchema = z
  .array(TransportIdentifierSchema)
  .min(1);

export const TransportConfidenceSchema = z.union([
  z.number().min(0).max(1),
  z.string().regex(CONFIDENCE_TRANSPORT_STRING_PATTERN),
]);

export const TransportPendingCandidateBaseSchema = z
  .object({
    id: TransportIdentifierSchema,
    source_turn_ids: TransportSourceTurnIdsSchema,
    evidence: TransportNonEmptyStringSchema,
    confidence: TransportConfidenceSchema,
    verification_status: z.literal("extracted"),
  })
  .strict();
