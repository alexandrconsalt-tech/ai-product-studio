import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "tests/golden/transcription-summary-v3");
const cases = JSON.parse(
  readFileSync(join(root, "cases/scenarios.json"), "utf8"),
) as Array<{ id: string; turns: Array<{ speaker: string; text: string }> }>;
const expected = JSON.parse(
  readFileSync(join(root, "expected/expectations.json"), "utf8"),
) as Array<{
  id: string;
  judgeScoreRanges: Record<string, [number, number]>;
  crm: string | string[];
}>;

describe("Phase 9 golden Preview pack", () => {
  it("contains twenty paired scenarios including semantic-quality regressions", () => {
    expect(cases).toHaveLength(20);
    expect(expected).toHaveLength(20);
    expect(expected.map((entry) => entry.id)).toEqual(cases.map((entry) => entry.id));
    expect(cases.slice(-8).map((entry) => entry.id)).toEqual([
      "prazhskaya_cash_self_late_exit_viewing_callback",
      "bolshevikov_legal_owners_deposit_terminal_refusal",
      "conditional_viewing_not_appointment",
      "terminal_refusal_without_next_step",
      "legal_due_diligence_documents",
      "cash_without_mortgage_single_meaning",
      "listing_price_is_not_client_budget",
      "listing_feature_is_not_search_requirement",
    ]);
  });

  it("contains no obvious personal contact data or legacy CRM fields", () => {
    const serialized = JSON.stringify({ cases, expected });
    expect(serialized).not.toMatch(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
    expect(serialized).not.toMatch(/(?:\+7|8)[\s()-]*\d{3}[\s()-]*\d{3}/);
    expect(serialized).not.toMatch(/call_results|agreement_id|"status"\s*:\s*"agreed"/);
  });

  it("defines five honest Judge ranges and dry-run-safe CRM expectations", () => {
    const criteria = [
      "faithfulness",
      "completeness",
      "usefulness",
      "agreements_next_step",
      "format",
    ];
    for (const entry of expected) {
      expect(Object.keys(entry.judgeScoreRanges)).toEqual(criteria);
      for (const [minimum, maximum] of Object.values(entry.judgeScoreRanges)) {
        expect(minimum).toBeGreaterThanOrEqual(0);
        expect(maximum).toBeLessThanOrEqual(100);
        expect(minimum).toBeLessThanOrEqual(maximum);
      }
      expect([entry.crm].flat().every((status) => ["DRY_RUN", "SKIPPED"].includes(status))).toBe(true);
    }
  });
});
