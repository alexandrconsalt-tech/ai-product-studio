/**
 * Confidence is always represented on the 0-1 float scale per
 * CLAUDE.md §25 / DEC-002 (docs/decisions/DEC-002-confidence-scale.md)
 * -- never the 0-100 integer scale from knowledge-import/03.
 *
 * Shared by both the Simulation Engine and the Production Pipeline
 * Runtime's Mock Stage so the two don't each maintain their own copy
 * of the same heuristic (CLAUDE.md CS-2, no duplicated logic).
 */

/**
 * Higher temperature simulates a more variable, less deterministic
 * model call, so confidence drops as temperature rises. This is a
 * heuristic, not a real calibration -- there is no real model call
 * behind it in either consumer.
 */
export function confidenceFromTemperature(temperature: number | undefined): number {
  const effective = temperature ?? 0.3;
  const bounded = Math.max(0, Math.min(2, effective));
  return Math.round(Math.max(0.5, Math.min(0.95, 0.95 - bounded * 0.15)) * 100) / 100;
}
