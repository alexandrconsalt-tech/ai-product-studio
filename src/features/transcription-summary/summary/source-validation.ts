import type { SummaryAgentInputV3 } from "../contracts/summary-input/v3/contract";
import {
  SummaryV3Schema,
  type SummaryV3,
} from "../contracts/summary/v3/contract";
import type { SummaryPlanV3 } from "./summary-plan";
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
      finalDiagnostics: SummaryFinalDiagnosticsV3 | null;
    }>;

function fail(errorCode: SummarySourceErrorCode, message: string): ProcessSummaryResult {
  return {
    ok: false,
    error: { status: "TECHNICAL_ERROR", errorCode, message },
    sourceValidationStatus: "invalid",
    repetitionGuardStatus: "not_run",
    transformations: [],
    finalDiagnostics: null,
  };
}

function normalized(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("ru-RU").replace(/\s+/g, " ");
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

  const structural = plan ? applySummaryPlanAndValidate(parsed.data, plan) : null;
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
      transformations: [],
      finalDiagnostics: structural.diagnostics,
    };
  }
  const finalValue = structural?.value ?? parsed.data;
  const transcriptTexts = input.transcriptContext.turns.map((turn) => normalized(turn.text));
  for (const quote of finalValue.quotes) {
    const quoteText = normalized(quote.text);
    if (!transcriptTexts.some((turnText) => turnText.includes(quoteText))) {
      return fail(
        "SUMMARY_QUOTE_SOURCE_INVALID",
        "Summary quote is not present in the full transcript",
      );
    }
  }

  const userText = [
    finalValue.conversation_result,
    ...finalValue.key_facts.flatMap((fact) => [fact.label, fact.value]),
    ...finalValue.quotes.map((quote) => quote.text),
    finalValue.next_step,
  ].join(" ");
  if (/\b(?:store[_ ]?id|manifest[_ ]?hash|confidence|verification_status|technical_error)\b/iu.test(userText)) {
    return fail("SUMMARY_SOURCE_MISMATCH", "Summary contains technical fields");
  }

  return {
    ok: true,
    value: finalValue,
    sourceValidationStatus: "valid",
    repetitionGuardStatus: structural?.status ?? "unchanged",
    transformations: structural?.transformations ?? [],
    finalDiagnostics: structural?.diagnostics ?? null,
  };
}
