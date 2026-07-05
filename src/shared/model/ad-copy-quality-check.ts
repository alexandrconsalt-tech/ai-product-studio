import { z } from "zod";

/**
 * Output contract for "Проверка объявления" (`node_ad_checker`, the
 * LLM Checker / self-check stage). Each check surfaces as its own
 * boolean field per the task spec ("Все проверки должны отображаться
 * отдельно") rather than one aggregate pass/fail -- Dashboard/stage
 * detail cards render them individually. `title`/`description`/`cta`
 * are the checker's corrected text (identical to the input if no
 * correction was needed); `confidence` is attached automatically by
 * `real-stage.ts`, not produced by the prompt itself.
 */

export const AdCopyQualityCheckSchema = z.object({
  facts_ok: z.boolean(),
  style_ok: z.boolean(),
  language_ok: z.boolean(),
  prohibited_words_ok: z.boolean(),
  readability_score: z.number().min(0).max(100),
  seo_ok: z.boolean(),
  duplicates_ok: z.boolean(),
  title: z.string().min(1),
  description: z.string().min(1),
  cta: z.string().min(1),
  issues: z.array(z.string()).readonly(),
  confidence: z.number().min(0).max(1).optional(),
});

export type AdCopyQualityCheck = z.infer<typeof AdCopyQualityCheckSchema>;
