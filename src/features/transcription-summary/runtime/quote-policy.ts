export type QuoteSourceV3 = Readonly<{
  id: string;
  text: string;
}>;

export type QuoteMatchDiagnosticV3 = Readonly<{
  summary_quote: string;
  normalized_summary_quote: string;
  allowed_source_quotes: readonly string[];
  normalized_allowed_source_quotes: readonly string[];
  matched_source_quote_id: string | null;
  mismatch_reason: "NONE" | "NOT_EXACT_SOURCE_SUBSTRING" | "EMPTY_AFTER_NORMALIZATION";
}>;

export function normalizeQuoteTextV3(value: string): string {
  let normalized = value.normalize("NFKC").trim();
  normalized = normalized
    .replace(/^(?:[«„“"])(.*)(?:[»“”"])$/u, "$1")
    .replace(/^(?:клиент|агент|оператор)\s*:\s*/iu, "")
    .replace(/^[-–—]\s*/u, "")
    .replace(/[–—−]/gu, "-")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/gu, "е");
  return normalized;
}

export function matchSummaryQuoteV3(
  summaryQuote: string,
  sources: readonly QuoteSourceV3[],
): QuoteMatchDiagnosticV3 {
  const normalizedSummary = normalizeQuoteTextV3(summaryQuote);
  const normalizedSources = sources.map((source) => normalizeQuoteTextV3(source.text));
  const matchedIndex = normalizedSummary
    ? normalizedSources.findIndex((source) => source.includes(normalizedSummary))
    : -1;
  return {
    summary_quote: summaryQuote,
    normalized_summary_quote: normalizedSummary,
    allowed_source_quotes: sources.map((source) => source.text),
    normalized_allowed_source_quotes: normalizedSources,
    matched_source_quote_id: matchedIndex >= 0 ? sources[matchedIndex].id : null,
    mismatch_reason: matchedIndex >= 0
      ? "NONE"
      : normalizedSummary
        ? "NOT_EXACT_SOURCE_SUBSTRING"
        : "EMPTY_AFTER_NORMALIZATION",
  };
}

function weakQuote(text: string): boolean {
  const value = normalizeQuoteTextV3(text);
  if (!value || value.split(/\s+/u).length < 4) return true;
  return /(?:здравств|меня\s+\p{L}+\s+зовут|по объявлению звон|интересует\b|бюджет|миллион|млн|наличн|ипотек|сбербанк|месяц|срок|пятниц|суббот|воскрес|понедель|вторник|сред[ау]|четверг|\d{1,2}:\d{2}|встретим|просмотр|показ|договорились|давайте|до встречи)/iu.test(value);
}

function meaningfulPosition(text: string): boolean {
  return /(?:смущ|беспоко|сомнева|опаса|возраж|не рассматрива|не хочу|не готов|важн|критич|принципиаль|огранич|для меня|потому что|при условии)/iu.test(normalizeQuoteTextV3(text));
}

export function selectUsefulClientQuotesV3<T extends Readonly<{ speaker: string; text: string }>>(
  quotes: readonly T[],
): readonly T[] {
  return quotes
    .filter((quote) => quote.speaker === "client")
    .filter((quote) => !weakQuote(quote.text) && meaningfulPosition(quote.text))
    .slice(0, 2);
}
