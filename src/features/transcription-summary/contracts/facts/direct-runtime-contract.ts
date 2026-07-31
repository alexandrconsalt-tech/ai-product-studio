import { z } from "zod";

export const DIRECT_FACT_TYPES = [
  "client_goal",
  "client_need",
  "client_finance",
  "client_question",
  "client_objection",
  "client_constraint",
  "client_preference",
  "client_motivation",
  "object_fact",
  "legal_context",
  "agreement_signal",
  "other_important",
] as const;

const DirectFactValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.array(z.number()),
]);

export const DirectFactSchema = z.object({
  id: z.string().trim().min(1),
  type: z.enum(DIRECT_FACT_TYPES),
  value: DirectFactValueSchema,
  speaker: z.enum(["Клиент", "Агент", "Оператор", "Третье лицо"]),
  evidence: z.string().trim().min(1),
  source_turn_ids: z.array(z.string().trim().min(1)),
  confidence: z.number().min(0).max(1),
}).strict();

export const DirectFactQuoteSchema = z.object({
  id: z.string().trim().min(1),
  text: z.string().trim().min(1),
  speaker: z.literal("Клиент"),
  supports_fact_ids: z.array(z.string().trim().min(1)),
  source_turn_ids: z.array(z.string().trim().min(1)),
  confidence: z.number().min(0).max(1),
}).strict();

export const DirectFactsRuntimeSchema = z.object({
  facts: z.array(DirectFactSchema),
  quotes: z.array(DirectFactQuoteSchema),
}).strict();

export type DirectFact = z.infer<typeof DirectFactSchema>;
export type DirectFactQuote = z.infer<typeof DirectFactQuoteSchema>;
export type DirectFactsRuntime = z.infer<typeof DirectFactsRuntimeSchema>;
