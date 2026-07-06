import { z } from "zod";

/**
 * Output contract for "Агент извлечения преимуществ" (Benefit
 * Extraction Agent, `node_ad_benefits`) in the Ad Copy Generation demo
 * pipeline. Consumed downstream (via the Storage fan-in, nested under
 * `stored.benefits`) by the Generation and Checker `llm` stages --
 * English snake_case keys for the same reason as `ad-copy-crm-input.ts`.
 *
 * Simplified 2026-07-06 (production-quality audit) to exactly the 3
 * fields the Generator actually needs -- `usp`/`advantages`/
 * `selling_points` -- per explicit instruction to remove duplicate
 * shapes. `strengths` was dropped (it overlapped with `advantages`/
 * `selling_points` -- three separate "list of good things" arrays with
 * no clear boundary between them) and `target_audience` was dropped
 * (redundant with `user_settings.target_audience`, which is already the
 * input this stage reads -- there is no reason to copy it back out as
 * a second, parallel list).
 *
 * Each `advantages` entry must itself be a ready-to-use customer
 * *benefit*, not a raw characteristic -- "Две лоджии" is not valid here,
 * "Две лоджии позволяют организовать дополнительную зону отдыха и
 * хранения" is. This is enforced by the prompt (`BENEFITS_PROMPT`,
 * `ad-copy-test-bench.ts`), not by the schema (a schema can't verify
 * *meaning*), but every array item is still required to be a non-empty
 * sentence so a one-word "characteristic" leftover at minimum fails the
 * length floor below.
 */

export const AdCopyBenefitsSchema = z.object({
  usp: z.string().min(1),
  advantages: z.array(z.string().min(10)).min(3),
  selling_points: z.array(z.string().min(1)).min(1),
});

export type AdCopyBenefits = z.infer<typeof AdCopyBenefitsSchema>;
