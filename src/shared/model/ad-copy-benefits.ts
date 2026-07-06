import { z } from "zod";

/**
 * Output contract for "Агент извлечения преимуществ" (Benefit
 * Extraction Agent, `node_ad_benefits`) in the Ad Copy Generation demo
 * pipeline. Consumed downstream (via the Storage fan-in) by the
 * Generation and Checker `llm` stages as `{{advantages}}`/`{{usp}}`/
 * etc. template variables -- English snake_case keys for the same
 * reason as `ad-copy-crm-input.ts`.
 *
 * `target_audience` is an array, not a single string, matching
 * `AdCopyUserSettingsSchema.target_audience` (a list of segments, e.g.
 * "Семьи с детьми"/"Пары без детей") -- this stage refines/confirms
 * that list against the property's actual facts rather than inventing
 * a single free-text description. There is no separate `style` field
 * here: `style` is user input (`user_settings.style`), not something
 * this agent generates.
 */

export const AdCopyBenefitsSchema = z.object({
  advantages: z.array(z.string().min(1)).min(1),
  usp: z.string().min(1),
  strengths: z.array(z.string().min(1)).readonly(),
  selling_points: z.array(z.string().min(1)).min(1),
  target_audience: z.array(z.string().min(1)).min(1),
});

export type AdCopyBenefits = z.infer<typeof AdCopyBenefitsSchema>;
