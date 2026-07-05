import { z } from "zod";

/**
 * Output contract for "Генерация объявления" (`node_ad_generate`) --
 * and the pipeline's overall stated output per the task spec: Заголовок
 * / Описание / CTA / Confidence Score. `confidence` (not
 * `confidence_score`) matches the field name `real-stage.ts`'s
 * `createLlmHandler` actually attaches to every `llm` node's output
 * (`confidenceFromTemperature`, 0-1 scale per DEC-002) -- kept
 * consistent with runtime reality rather than the task's literal label,
 * which is rendered as "Confidence Score" in the UI instead.
 */

export const AdCopySchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  cta: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
});

export type AdCopy = z.infer<typeof AdCopySchema>;
