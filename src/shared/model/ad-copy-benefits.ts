import { z } from "zod";

/**
 * Output contract for "Агент извлечения преимуществ" (Benefit
 * Extraction Agent, `node_ad_benefits`) in the Ad Copy Generation demo
 * pipeline. Consumed downstream (via the Storage fan-in) by the
 * Generation and Checker `llm` stages as `{{advantages}}`/`{{usp}}`/
 * etc. template variables -- English snake_case keys for the same
 * reason as `ad-copy-crm-input.ts`.
 */

export const AdCopyBenefitsSchema = z.object({
  advantages: z.array(z.string().min(1)).min(1),
  usp: z.string().min(1),
  strengths: z.array(z.string().min(1)).readonly(),
  target_audience: z.string().min(1),
  selling_points: z.array(z.string().min(1)).min(1),
  style: z.string().min(1),
});

export type AdCopyBenefits = z.infer<typeof AdCopyBenefitsSchema>;
