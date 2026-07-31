import type { SummaryAgentInputV3 } from "../contracts/summary-input/v3/contract";
import {
  SummaryV3Schema,
  type SummaryV3,
} from "../contracts/summary/v3/contract";

export type SummarySourceErrorCode =
  | "SUMMARY_SOURCE_MISMATCH"
  | "SUMMARY_QUOTE_SOURCE_INVALID"
  | "SUMMARY_OUTPUT_SCHEMA_INVALID";

export type RepetitionTransformation = Readonly<{
  ruleId: "summary.no-transform.v1";
  removedPath: never;
  normalizedValue: never;
}>;

export type ProcessSummaryResult =
  | Readonly<{
      ok: true;
      value: SummaryV3;
      sourceValidationStatus: "valid";
      repetitionGuardStatus: "unchanged";
      transformations: readonly [];
    }>
  | Readonly<{
      ok: false;
      error: {
        status: "TECHNICAL_ERROR";
        errorCode: SummarySourceErrorCode;
        message: string;
      };
      sourceValidationStatus: "invalid";
      repetitionGuardStatus: "not_run";
      transformations: readonly [];
    }>;

function fail(errorCode: SummarySourceErrorCode, message: string): ProcessSummaryResult {
  return {
    ok: false,
    error: { status: "TECHNICAL_ERROR", errorCode, message },
    sourceValidationStatus: "invalid",
    repetitionGuardStatus: "not_run",
    transformations: [],
  };
}

function normalized(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("ru-RU").replace(/\s+/g, " ");
}

export function processSummaryOutput(
  input: SummaryAgentInputV3,
  output: unknown,
): ProcessSummaryResult {
  const parsed = SummaryV3Schema.safeParse(output);
  if (!parsed.success) {
    return fail("SUMMARY_OUTPUT_SCHEMA_INVALID", parsed.error.message);
  }

  const transcriptTexts = input.transcriptContext.turns.map((turn) => normalized(turn.text));
  for (const quote of parsed.data.quotes) {
    const quoteText = normalized(quote.text);
    if (!transcriptTexts.some((turnText) => turnText.includes(quoteText))) {
      return fail(
        "SUMMARY_QUOTE_SOURCE_INVALID",
        "Summary quote is not present in the full transcript",
      );
    }
  }

  const userText = [
    parsed.data.conversation_result,
    ...parsed.data.key_facts.flatMap((fact) => [fact.label, fact.value]),
    ...parsed.data.quotes.map((quote) => quote.text),
    parsed.data.next_step,
  ].join(" ");
  if (/\b(?:store[_ ]?id|manifest[_ ]?hash|confidence|verification_status|technical_error)\b/iu.test(userText)) {
    return fail("SUMMARY_SOURCE_MISMATCH", "Summary contains technical fields");
  }

  return {
    ok: true,
    value: parsed.data,
    sourceValidationStatus: "valid",
    repetitionGuardStatus: "unchanged",
    transformations: [],
  };
}
