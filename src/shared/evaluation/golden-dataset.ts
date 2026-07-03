import type { CallAnalysisContactType, CallAnalysisStatus } from "@/shared/model/call-analysis-summary";

/**
 * Golden Dataset mechanism (CLAUDE.md §26). No real golden dataset
 * exists anywhere in this repository -- the actual 40-call set
 * described in `pdf-notes.txt` (§3.3, Этап 1) was never imported; it
 * references real customer call recordings this repository does not
 * have. `ILLUSTRATIVE_CALL_ANALYSIS_DATASET` below is a small,
 * clearly-labeled SYNTHETIC fixture for exercising the evaluation
 * mechanism end to end -- do not present it as real evaluation
 * evidence (CLAUDE.md §2 principle 4, §4 AD-6). Replacing it with the
 * real 40-call set is future work requiring access to actual
 * transcripts, per CLAUDE.md §26.
 */

export type GoldenExampleExpectation = Readonly<{
  тип_контакта?: CallAnalysisContactType;
  статус?: CallAnalysisStatus;
  minCitations: number;
}>;

export type GoldenExample = Readonly<{
  id: string;
  transcript: string;
  expected: GoldenExampleExpectation;
}>;

export type GoldenDataset = Readonly<{
  id: string;
  version: string;
  examples: readonly GoldenExample[];
}>;

/**
 * Illustrative only -- see module doc comment above. 6 synthetic
 * examples covering both branches of the demo pipeline's confidence
 * routing (agent vs contact_center, resolved vs still-thinking).
 */
export const ILLUSTRATIVE_CALL_ANALYSIS_DATASET: GoldenDataset = {
  id: "call_analysis_illustrative",
  version: "1.0.0",
  examples: [
    {
      id: "ex_01",
      transcript: "Клиент: Здравствуйте, хочу трёхкомнатную квартиру с видом на парк, бюджет 12-14 миллионов, хотим переехать до конца квартала.",
      expected: { тип_контакта: "agent", minCitations: 1 },
    },
    {
      id: "ex_02",
      transcript: "Оператор КЦ: Заявка принята, клиент интересуется двухкомнатной квартирой, перезвоним для уточнения деталей.",
      expected: { тип_контакта: "contact_center", minCitations: 1 },
    },
    {
      id: "ex_03",
      transcript: "Клиент: Мне нужно подумать, пока не готов принимать решение по ипотеке.",
      expected: { статус: "thinking", minCitations: 1 },
    },
    {
      id: "ex_04",
      transcript: "Клиент: Отлично, готовы подписывать договор на квартиру, когда можно встретиться?",
      expected: { статус: "in_progress", minCitations: 1 },
    },
    {
      id: "ex_05",
      transcript: "Клиент: Ищу однокомнатную квартиру рядом с метро, срок покупки — как можно скорее.",
      expected: { тип_контакта: "agent", minCitations: 1 },
    },
    {
      id: "ex_06",
      transcript: "Оператор КЦ: Клиент просил перезвонить позже, сейчас занят.",
      expected: { тип_контакта: "contact_center", minCitations: 1 },
    },
  ],
};
