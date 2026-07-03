import { z } from "zod";

/**
 * Structured output schema for the "call analysis" LLM summary step.
 *
 * This is not a generic domain entity (it does not follow the
 * README/factory/schema/types entity structure in CLAUDE.md §9.1) --
 * it is the concrete structured-output contract for one specific
 * pipeline step, taken verbatim from the only real business case in
 * this repository (the call-transcription-and-analysis plan in
 * `pdf-notes.txt`, summarized in CLAUDE.md §3.3 and required as the
 * minimum shape for any future Pipeline DSL output in CLAUDE.md
 * §14.3): `{кто, тип_контакта, потребность, бюджет, срок,
 * способ_оплаты, вопросы[], статус, действие, цитаты[]}`.
 *
 * Field names are kept in Russian to match the source material and
 * the repository-wide convention (CLAUDE.md §2 principle 9 / R-009)
 * of Russian for product/domain content, English for code identifiers
 * and schemas.
 *
 * `цитаты` (quotes) is required and non-empty on purpose: CLAUDE.md
 * §14.3 requires every key field to be grounded in a literal quote
 * from the source transcript as a testable hallucination control. An
 * empty citation list would defeat that requirement.
 */

export const CallAnalysisContactTypeSchema = z.enum(["contact_center", "agent"]);
export type CallAnalysisContactType = z.infer<typeof CallAnalysisContactTypeSchema>;

export const CallAnalysisStatusSchema = z.enum(["new", "thinking", "in_progress", "won", "lost"]);
export type CallAnalysisStatus = z.infer<typeof CallAnalysisStatusSchema>;

export const CallAnalysisSummarySchema = z.object({
  кто: z.string().min(1),
  тип_контакта: CallAnalysisContactTypeSchema,
  потребность: z.string().min(1),
  бюджет: z.string().optional(),
  срок: z.string().optional(),
  способ_оплаты: z.string().optional(),
  вопросы: z.array(z.string().min(1)).readonly(),
  статус: CallAnalysisStatusSchema,
  действие: z.string().min(1),
  цитаты: z.array(z.string().min(1)).min(1),
});

export type CallAnalysisSummary = z.infer<typeof CallAnalysisSummarySchema>;
