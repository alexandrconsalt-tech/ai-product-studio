import { describe, expect, it } from "vitest";
import { matchSummaryQuoteV3, normalizeQuoteTextV3, selectUsefulClientQuotesV3 } from "./quote-policy";

describe("quote policy v3", () => {
  const sources = [{
    id: "turn-1",
    text: "Клиент: — Шумную квартиру не рассматриваю, потому что для меня важна тишина.",
  }];

  it("сопоставляет точную цитату без role-prefix с prefixed transcript", () => {
    expect(matchSummaryQuoteV3("Шумную квартиру не рассматриваю", sources)).toMatchObject({
      matched_source_quote_id: "turn-1",
      mismatch_reason: "NONE",
    });
  });

  it("сопоставляет точную цитату с role-prefix и внешними кавычками", () => {
    expect(matchSummaryQuoteV3("«Клиент: Шумную квартиру не рассматриваю»", sources)).toMatchObject({
      matched_source_quote_id: "turn-1",
      mismatch_reason: "NONE",
    });
  });

  it("нормализует пробелы, регистр и тип тире", () => {
    expect(normalizeQuoteTextV3("  КЛИЕНТ: — Шумную   квартиру НЕ рассматриваю  "))
      .toBe("шумную квартиру не рассматриваю");
  });

  it("не принимает парафраз или составную цитату", () => {
    expect(matchSummaryQuoteV3("Клиент категорически отказался от шумной квартиры", sources)).toMatchObject({
      matched_source_quote_id: null,
      mismatch_reason: "NOT_EXACT_SOURCE_SUBSTRING",
    });
  });

  it("оставляет максимум две содержательные клиентские цитаты", () => {
    const quotes = [
      { id: "agent", speaker: "agent", text: "Для вас важна тишина." },
      { id: "weak", speaker: "client", text: "Меня Татьяна зовут." },
      { id: "one", speaker: "client", text: "Шумную квартиру не рассматриваю, потому что для меня важна тишина." },
      { id: "two", speaker: "client", text: "Меня смущает юридическая схема, это принципиально важно." },
      { id: "three", speaker: "client", text: "Не готов покупать без проверки документов, потому что это критично." },
    ];
    expect(selectUsefulClientQuotesV3(quotes).map((quote) => quote.id)).toEqual(["one", "two"]);
  });
});
