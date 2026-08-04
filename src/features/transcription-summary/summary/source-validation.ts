import type { SummaryAgentInputV3 } from "../contracts/summary-input/v3/contract";
import {
  SummaryV3Schema,
  type SummaryV3,
} from "../contracts/summary/v3/contract";
import type { SummaryPlanV3 } from "./summary-plan";
import {
  matchSummaryQuoteV3,
  type QuoteMatchDiagnosticV3,
  type QuoteSourceV3,
} from "../runtime/quote-policy";
import {
  applySummaryPlanAndValidate,
  type SummaryFinalDiagnosticsV3,
  type SummaryStructuralTransformation,
} from "./structural-validation";

export type SummarySourceErrorCode =
  | "SUMMARY_SOURCE_MISMATCH"
  | "SUMMARY_QUOTE_SOURCE_INVALID"
  | "SUMMARY_OUTPUT_SCHEMA_INVALID"
  | "SUMMARY_STRUCTURAL_VALIDATION_FAILED";

export type RepetitionTransformation = SummaryStructuralTransformation;

export type ProcessSummaryResult =
  | Readonly<{
      ok: true;
      value: SummaryV3;
      sourceValidationStatus: "valid";
      repetitionGuardStatus: "unchanged" | "transformed";
      transformations: readonly RepetitionTransformation[];
      finalDiagnostics: SummaryFinalDiagnosticsV3 | null;
      quoteDiagnostics: readonly QuoteMatchDiagnosticV3[];
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
      transformations: readonly RepetitionTransformation[];
      finalDiagnostics: SummaryFinalDiagnosticsV3 | null;
      quoteDiagnostics: readonly QuoteMatchDiagnosticV3[];
    }>;

function fail(
  errorCode: SummarySourceErrorCode,
  message: string,
  quoteDiagnostics: readonly QuoteMatchDiagnosticV3[] = [],
): ProcessSummaryResult {
  return {
    ok: false,
    error: { status: "TECHNICAL_ERROR", errorCode, message },
    sourceValidationStatus: "invalid",
    repetitionGuardStatus: "not_run",
    transformations: [],
    finalDiagnostics: null,
    quoteDiagnostics,
  };
}

function quoteSources(input: SummaryAgentInputV3): readonly QuoteSourceV3[] {
  const values: QuoteSourceV3[] = [
    ...input.conversationStore.quotes.map((quote) => ({ id: String(quote.id), text: String(quote.text) })),
    ...input.transcriptContext.turns.map((turn) => ({ id: turn.turnId, text: turn.text })),
  ];
  return values.filter((source, index) => values.findIndex((item) => item.id === source.id && item.text === source.text) === index);
}

export function processSummaryOutput(
  input: SummaryAgentInputV3,
  output: unknown,
  plan?: SummaryPlanV3,
): ProcessSummaryResult {
  const parsed = SummaryV3Schema.safeParse(output);
  if (!parsed.success) {
    return fail("SUMMARY_OUTPUT_SCHEMA_INVALID", parsed.error.message);
  }

  const allowedQuotes = quoteSources(input);
  const quoteDiagnostics = parsed.data.quotes.map((quote) => matchSummaryQuoteV3(quote.text, allowedQuotes));
  const quoteTransformations: RepetitionTransformation[] = quoteDiagnostics.flatMap((diagnostic, index) =>
    diagnostic.matched_source_quote_id ? [] : [{
      ruleId: "summary.invalid-quote-removed.v1" as const,
      fieldPath: `quotes.${index}`,
      meaningId: null,
      reason: JSON.stringify(diagnostic),
    }]);
  const quoteSafeOutput: SummaryV3 = {
    ...parsed.data,
    quotes: parsed.data.quotes.filter((_, index) => quoteDiagnostics[index].matched_source_quote_id !== null),
  };

  const structural = plan ? applySummaryPlanAndValidate(quoteSafeOutput, plan) : null;
  if (structural && !structural.ok) {
    return {
      ok: false,
      error: {
        status: "TECHNICAL_ERROR",
        errorCode: "SUMMARY_STRUCTURAL_VALIDATION_FAILED",
        message: `${structural.error}: ${JSON.stringify(structural.diagnostics)}`,
      },
      sourceValidationStatus: "invalid",
      repetitionGuardStatus: "not_run",
      transformations: structural.transformations,
      finalDiagnostics: structural.diagnostics,
      quoteDiagnostics,
    };
  }
  const finalValue = structural?.value ?? quoteSafeOutput;

  const userText = [
    finalValue.conversation_result,
    ...finalValue.key_facts.flatMap((fact) => [fact.label, fact.value]),
    ...finalValue.quotes.map((quote) => quote.text),
    finalValue.next_step,
  ].join(" ");
  if (/\b(?:store[_ ]?id|manifest[_ ]?hash|confidence|verification_status|technical_error)\b/iu.test(userText)) {
    return fail("SUMMARY_SOURCE_MISMATCH", "Summary contains technical fields", quoteDiagnostics);
  }

  return {
    ok: true,
    value: finalValue,
    sourceValidationStatus: "valid",
    repetitionGuardStatus: structural?.status === "transformed" || quoteTransformations.length ? "transformed" : "unchanged",
    transformations: [...quoteTransformations, ...(structural?.transformations ?? [])],
    finalDiagnostics: structural?.diagnostics ?? null,
    quoteDiagnostics,
  };
}
