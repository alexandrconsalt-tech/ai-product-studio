import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type Decision = "approve" | "correct" | "reject" | "technical_error";
type CleanerInput = {
  conversationJudge?: Record<string, unknown>;
  current: Record<string, string>;
  provenance: Record<string, string>;
};
type CleanerApi = {
  implementationVersion: string;
  validateOutput(value: unknown): boolean;
  clean(input: CleanerInput): { output: Record<string, any>; provenanceValidation: Record<string, any> };
};

function api(): CleanerApi {
  const context = { window: {} as Record<string, unknown>, Object };
  runInNewContext(readFileSync(resolve(process.cwd(), "public", "ai-summary-10-08-store-cleaner.js"), "utf8"), context);
  return context.window.__AI_SUMMARY_10_08_STORE_CLEANER__ as CleanerApi;
}

const current = { run_id: "run", transcript_hash: "transcript", pipeline_configuration_hash: "pipeline" };
const case55Judge = JSON.parse(readFileSync(resolve(process.cwd(), "src", "shared", "repositories", "fixtures", "ai-summary-10-08-conversation-judge-case-55.json"), "utf8"));
function judge(overrides: Record<string, unknown> = {}) {
  return {
    verified_facts: [{ fact: "Полезный факт", evidence: "Цитата" }],
    verified_quotes: ["Полезная цитата"],
    verified_needs: { primary_need: "Потребность", requirements: [], preferences: [], objections: [], unresolved_questions: [] },
    verified_outcome: { call_result: "Продолжение общения", agreement: "Агент напишет", next_step: "Написать", responsible_party: "agent", deadline: "5 минут", channel: "Telegram" },
    decisions: { facts: "approve" as Decision, needs: "correct" as Decision, outcome: "approve" as Decision },
    issues: [],
    ...overrides,
  };
}
function clean(overrides: Record<string, unknown> = {}, inputOverrides: Partial<CleanerInput> = {}) {
  return api().clean({ conversationJudge: judge(overrides), current, provenance: current, ...inputOverrides });
}

describe("AI Summary 10.08 Store Cleaner", () => {
  it("removes exact duplicates after whitespace/case normalization and trims values", () => {
    const result = clean({
      verified_facts: [{ fact: "  Факт   один ", evidence: " Цитата " }, { fact: "факт один", evidence: "цитата" }],
      verified_needs: { primary_need: " Потребность  клиента ", requirements: [" Дом  ", "дом"], preferences: [" Тихо "], objections: [], unresolved_questions: [] },
    }).output;
    expect(result.facts).toEqual([{ fact: "Факт один", evidence: "Цитата" }]);
    expect(result.needs).toMatchObject({ primary_need: "Потребность клиента", requirements: ["Дом"], preferences: ["Тихо"] });
    expect(result.cleaning.deduplicated_items).toEqual(expect.arrayContaining(["fact[1]: EXACT_DUPLICATE", "requirements[1]: EXACT_DUPLICATE"]));
  });

  it("normalizes repeated whitespace without changing meaning", () => {
    const result = clean({ verified_quotes: ["  Полезная   цитата  "] }).output;
    expect(result.quotes).toEqual(["Полезная цитата"]);
    expect(result.cleaning.normalizations).toContain("quote[0]: WHITESPACE_NORMALIZED");
  });

  it("removes empty array items", () => {
    const result = clean({ verified_quotes: [null, " ", "Цитата"], verified_needs: { primary_need: "", requirements: [undefined, "Дом"], preferences: [], objections: [], unresolved_questions: [] } }).output;
    expect(result.quotes).toEqual(["Цитата"]);
    expect(result.needs.requirements).toEqual(["Дом"]);
    expect(result.cleaning.removed_items).toEqual(expect.arrayContaining(["quote[0]: EMPTY_VALUE", "quote[1]: EMPTY_VALUE", "requirements[0]: EMPTY_VALUE"]));
  });

  it("removes standalone address facts, phone quotes and listing source noise", () => {
    const result = clean({
      verified_facts: [
        { fact: "Клиент заинтересован в объекте по адресу: Санкт-Петербург, улица Печатника Григорьева, 16/3", evidence: "Адрес" },
        { fact: "Клиент интересуется конкретным объектом: Россия, Санкт-Петербург, улица Печатника Григорьева, 16/3.", evidence: "Адрес" },
        { fact: "Клиент интересуется объектом в Санкт-Петербурге — ЖК Печатников, улица Печатника Григорьева, 16/3", evidence: "Адрес" },
        { fact: "Источник объявления — uladis.su", evidence: "uladis.su" },
        { fact: "Клиент готов покупать при снижении цены", evidence: "Готов покупать" },
      ],
      verified_quotes: ["+7 (999) 123-45-67", "Полезная цитата"],
    }).output;
    expect(result.facts).toEqual([{ fact: "Клиент готов покупать при снижении цены", evidence: "Готов покупать" }]);
    expect(result.quotes).toEqual(["Полезная цитата"]);
    expect(result.cleaning.removed_items).toEqual(expect.arrayContaining(["fact[0]: CRM_OBJECT_ADDRESS", "fact[1]: CRM_OBJECT_ADDRESS", "fact[2]: CRM_OBJECT_ADDRESS", "fact[3]: LISTING_SOURCE_NOISE", "quote[0]: PHONE_NUMBER"]));
  });

  it("removes a standalone phone quote", () => {
    const result = clean({ verified_quotes: ["+7 (999) 123-45-67"] }).output;
    expect(result.quotes).toEqual([]);
    expect(result.cleaning.removed_items).toContain("quote[0]: PHONE_NUMBER");
  });

  it("removes deterministic listing-source URL noise", () => {
    const result = clean({ verified_facts: [{ fact: "Источник объявления — example.ru", evidence: "example.ru" }] }).output;
    expect(result.facts).toEqual([]);
    expect(result.cleaning.removed_items).toContain("fact[0]: LISTING_SOURCE_NOISE");
  });

  it("caps facts at seven and quotes at two after cleaning", () => {
    const result = clean({
      verified_facts: Array.from({ length: 9 }, (_, index) => ({ fact: `Факт ${index}`, evidence: `Цитата ${index}` })),
      verified_quotes: ["Раз", "Два", "Три"],
    }).output;
    expect(result.facts).toHaveLength(7);
    expect(result.quotes).toEqual(["Раз", "Два"]);
    expect(result.cleaning.normalizations).toEqual(expect.arrayContaining(["facts: priority cap 9 → 7", "quotes: capped 3 → 2"]));
  });

  it("caps quotes at two independently", () => {
    const result = clean({ verified_quotes: ["Раз", "Два", "Три"] }).output;
    expect(result.quotes).toEqual(["Раз", "Два"]);
    expect(result.cleaning.normalizations).toContain("quotes: capped 3 → 2");
  });

  it("normalizes deadline without next step and reports structural warnings", () => {
    const result = clean({ verified_outcome: { call_result: "Канал Telegram", agreement: "", next_step: "", responsible_party: "agent", deadline: "завтра", channel: "Telegram" } }).output;
    expect(result.outcome).toEqual({ call_result: "Канал Telegram", agreement: "", next_step: "", responsible_party: "", deadline: "", channel: "Telegram" });
    expect(result.cleaning.normalizations).toEqual(expect.arrayContaining(["deadline: removed because next_step empty"]));

    const warning = clean({ verified_outcome: { call_result: "", agreement: "", next_step: "Написать", responsible_party: "", deadline: "", channel: "" } }).output;
    expect(warning.cleaning.warnings).toEqual(["MISSING_RESPONSIBLE_PARTY", "NEXT_STEP_WITHOUT_AGREEMENT"]);
  });

  it("returns partial ready for a technical source block and preserves decisions", () => {
    const decisions = { facts: "approve", needs: "technical_error", outcome: "reject" };
    const result = clean({ decisions }).output;
    expect(result.status).toBe("PARTIAL_READY");
    expect(result.source_decisions).toEqual(decisions);
  });

  it("preserves source decisions exactly", () => {
    const decisions = { facts: "reject", needs: "correct", outcome: "approve" };
    expect(clean({ decisions }).output.source_decisions).toEqual(decisions);
  });

  it("rejects stale provenance deterministically", () => {
    const result = clean({}, { provenance: { ...current, run_id: "stale" } });
    expect(result.provenanceValidation.valid).toBe(false);
    expect(result.output).toMatchObject({ status: "TECHNICAL_ERROR", source_decisions: { facts: "technical_error", needs: "technical_error", outcome: "technical_error" } });
  });

  it("does not semantically mutate or invent business facts", () => {
    const sourceFacts = [
      { fact: "Клиент ищет студию", evidence: "Мы смотрим студию" },
      { fact: "Клиент ещё не обращался напрямую к застройщику", evidence: "Не звонил" },
      { fact: "Клиент планирует сам написать агенту", evidence: "Я вас буду искать" },
    ];
    const result = clean({ verified_facts: sourceFacts }).output;
    expect(result.facts).toEqual(sourceFacts);
    expect(result.facts.every((item: { fact: string }) => sourceFacts.some(source => source.fact === item.fact))).toBe(true);
  });

  it("does not create new business facts from needs or outcome", () => {
    const result = clean({
      verified_facts: [],
      verified_needs: { primary_need: "Купить квартиру", requirements: ["Студия"], preferences: [], objections: [], unresolved_questions: [] },
      verified_outcome: { call_result: "Продолжить общение", agreement: "Написать", next_step: "Написать", responsible_party: "agent", deadline: "", channel: "Telegram" },
    }).output;
    expect(result.facts).toEqual([]);
  });

  it("preserves a useful search-location constraint", () => {
    const source = { fact: "Клиент рассматривает покупку только в Мистолово и Лавриках", evidence: "Только в Мистолово и Лавриках" };
    expect(clean({ verified_facts: [source] }).output.facts).toEqual([source]);
  });

  it("removes explicit STT meta-noise without inventing a replacement", () => {
    const meta = { fact: "Клиент продиктовал цену, транскрипция повреждена: значение неоднозначно и не нормализовано", evidence: "7 м00000" };
    const result = clean({ verified_facts: [meta] }).output;
    expect(result.facts).toEqual([]);
    expect(result.cleaning.removed_items).toContain("fact[0]: STT_META_NOISE");
  });

  it("removes malformed numeric quotes but preserves readable financial wording", () => {
    const result = clean({ verified_quotes: ["Располагаю в районе миллион четырчеста", "Располагаю в районе миллион четыреста"] }).output;
    expect(result.quotes).toEqual(["Располагаю в районе миллион четыреста"]);
    expect(result.cleaning.removed_items).toContain("quote[0]: LOW_VALUE_QUOTE");
  });

  it("keeps a valid financial fact when no cap is required", () => {
    const financial = { fact: "Клиент располагает первоначальным взносом примерно 1 400 000 ₽ (около 20%)", evidence: "Миллион четыреста, около 20%" };
    expect(clean({ verified_facts: [financial] }).output.facts).toContainEqual(financial);
  });

  it("preserves a financial fact over low-priority facts when priority cap applies", () => {
    const financial = { fact: "Клиент располагает первоначальным взносом примерно 1 400 000 ₽ (около 20%)", evidence: "Миллион четыреста" };
    const low = Array.from({ length: 8 }, (_, index) => ({ fact: `Контекст текущего объекта ${index}`, evidence: `Контекст ${index}` }));
    const result = clean({ verified_facts: [...low, financial] }).output;
    expect(result.facts).toContainEqual(financial);
    expect(result.facts).not.toContainEqual(low[7]);
    expect(result.cleaning.normalizations).toContain("facts: priority cap 9 → 7");
  });

  it("keeps original Judge order inside the same priority tier", () => {
    const important = [
      { fact: "Клиенту нужна ипотека", evidence: "Да" },
      { fact: "Клиент рассматривает рассрочку", evidence: "Рассматриваю" },
      { fact: "Нужно уточнить юридический статус", evidence: "Вопрос" },
    ];
    const low = Array.from({ length: 6 }, (_, index) => ({ fact: `Контекст ${index}`, evidence: `Цитата ${index}` }));
    expect(clean({ verified_facts: [...important, ...low] }).output.facts.slice(0, 3)).toEqual(important);
  });

  it("validates the final strict output schema", () => {
    const cleaner = api();
    const result = cleaner.clean({ conversationJudge: judge(), current, provenance: current }).output;
    expect(cleaner.implementationVersion).toBe("v4");
    expect(cleaner.validateOutput(result)).toBe(true);
    expect(cleaner.validateOutput({ ...result, unexpected: true })).toBe(false);
  });

  it("processes the pipeline_report 55 Judge fixture without losing finance or changing outcome", () => {
    const result = api().clean({ conversationJudge: case55Judge, current, provenance: current }).output;
    expect(result.cleaning.removed_items).toEqual(expect.arrayContaining(["fact[0]: CRM_OBJECT_ADDRESS", "fact[6]: STT_META_NOISE"]));
    expect(result.facts.some((item: { fact: string }) => /первоначальн[а-яё]* взнос/i.test(item.fact))).toBe(true);
    expect(result.facts.length).toBeLessThanOrEqual(7);
    expect(result.quotes.length).toBeLessThanOrEqual(2);
    expect(result.outcome).toEqual(case55Judge.verified_outcome);
    expect(result.facts.every((item: { fact: string }) => case55Judge.verified_facts.some((source: { fact: string }) => source.fact === item.fact))).toBe(true);
  });

  it("removes current-object price, agent name, location and room-count facts with explicit reasons", () => {
    const result = clean({
      verified_facts: [
        { fact: "Агент назвал цену объекта 15 990", evidence: "15 990" },
        { fact: "Объект курирует агент Дмитрий", evidence: "Меня зовут Дмитрий" },
        { fact: "Объект расположен в посёлке Ильинский Раменского района", evidence: "Ильинский посёлок" },
        { fact: "Текущий объект — двухкомнатная квартира площадью 44 кв. м", evidence: "двухкомнатная, 44 кв. м" },
      ],
      verified_quotes: ["«Юрловский проезд, 19, меня интересует.»"],
    }).output;
    expect(result.facts).toEqual([]);
    expect(result.quotes).toEqual([]);
    expect(result.cleaning.removed_items).toEqual(expect.arrayContaining([
      "fact[0]: CRM_OBJECT_PRICE",
      "fact[1]: CRM_AGENT_NAME",
      "fact[2]: CRM_OBJECT_LOCATION",
      "fact[3]: CRM_OBJECT_CHARACTERISTIC",
      "quote[0]: CRM_OBJECT_ADDRESS",
    ]));
  });

  it("removes CRM-object noise from needs sections but preserves an actionable unresolved question", () => {
    const result = clean({
      verified_needs: {
        primary_need: "Посмотреть выставленную двухкомнатную квартиру площадью 44 кв. м",
        requirements: ["Адрес объекта: Юрловский проезд, 19", "Клиенту принципиально нужен второй этаж", "Квартира должна быть на втором этаже"],
        preferences: ["Объект расположен в посёлке Ильинский Раменского района"],
        objections: [],
        unresolved_questions: ["Цена текущего объекта — 6 500", "Нужно уточнить актуальную цену и наличие квартиры", "Код/идентификатор объявления не предоставлен"],
      },
    }).output;
    expect(result.needs).toEqual({
      primary_need: "",
      requirements: ["Клиенту принципиально нужен второй этаж", "Квартира должна быть на втором этаже"],
      preferences: [],
      objections: [],
      unresolved_questions: [],
    });
    expect(result.cleaning.removed_items).toEqual(expect.arrayContaining([
      "needs.primary_need: CRM_OBJECT_CHARACTERISTIC",
      "requirements[0]: CRM_OBJECT_ADDRESS",
      "preferences[0]: CRM_OBJECT_LOCATION",
      "unresolved_questions[0]: CRM_OBJECT_PRICE",
      "unresolved_questions[1]: CRM_OBJECT_PRICE",
      "unresolved_questions[2]: OBJECT_CODE",
    ]));
  });

  it("preserves a floor requirement and its motivation while removing a neutral current-object floor", () => {
    const requirement = { fact: "Клиенту принципиально нужен второй этаж", evidence: "Мне именно второй этаж нужен" };
    const motivation = { fact: "Клиенту тяжело подниматься на пятый этаж, поэтому нужен второй", evidence: "На пятый очень тяжело добираться" };
    const neutral = { fact: "Текущий объект находится на втором этаже", evidence: "Второй этаж" };
    const result = clean({ verified_facts: [neutral, requirement, motivation] }).output;
    expect(result.facts).toEqual([requirement, motivation]);
    expect(result.cleaning.removed_items).toContain("fact[0]: CRM_OBJECT_CHARACTERISTIC");
  });

  it("preserves client financial parameters while removing a numeric current-object price", () => {
    const financial = { fact: "Первоначальный взнос клиента — около 1,4 млн ₽, примерно 20%", evidence: "Миллион четыреста, около 20%" };
    const result = clean({ verified_facts: [{ fact: "Цена текущего объекта — 7 000 000 ₽", evidence: "Семь миллионов" }, financial] }).output;
    expect(result.facts).toEqual([financial]);
    expect(result.cleaning.removed_items).toContain("fact[0]: CRM_OBJECT_PRICE");
  });

  it("removes facts and quotes linked to ROLE_INCONSISTENCY issues", () => {
    const reliable = { fact: "Клиент не может приехать завтра", evidence: "Завтра нет, однозначно" };
    const inconsistent = { fact: "Клиент обновил фотографии объявления сегодня", evidence: "я сегодня фотографировал объект" };
    const result = clean({
      verified_facts: [reliable, inconsistent],
      verified_quotes: ["я сегодня фотографировал объект", "Завтра нет, однозначно"],
      issues: ["ROLE_INCONSISTENCY: клиент обновил фотографии объявления и фотографировал объект"],
    }).output;
    expect(result.facts).toEqual([reliable]);
    expect(result.quotes).toEqual(["Завтра нет, однозначно"]);
    expect(result.cleaning.removed_items).toEqual(expect.arrayContaining(["fact[1]: ROLE_INCONSISTENCY", "quote[0]: ROLE_INCONSISTENCY"]));
  });

  it("keeps report 61 positive finance/outcome while removing address, STT meta-noise and a damaged quote", () => {
    const outcome = { call_result: "Согласована связь в Telegram", agreement: "Агент напишет", next_step: "Агент напишет клиенту", responsible_party: "agent", deadline: "5 минут", channel: "Telegram" };
    const result = clean({
      verified_facts: [
        { fact: "Клиент заинтересован в объекте по адресу: Санкт-Петербург, улица Печатника Григорьева, 16/3", evidence: "Адрес" },
        { fact: "Первоначальный взнос клиента — около 1,4 млн ₽, примерно 20%", evidence: "Миллион четыреста" },
        { fact: "Устная передача цены частично повреждена, значение в записи нечитабельно", evidence: "7 м00000" },
      ],
      verified_quotes: ["Располагаю в районе миллион четырхста"],
      verified_outcome: outcome,
    }).output;
    expect(result.facts).toEqual([{ fact: "Первоначальный взнос клиента — около 1,4 млн ₽, примерно 20%", evidence: "Миллион четыреста" }]);
    expect(result.quotes).toEqual([]);
    expect(result.outcome).toEqual(outcome);
    expect(result.cleaning.removed_items).toEqual(expect.arrayContaining(["fact[0]: CRM_OBJECT_ADDRESS", "fact[2]: STT_META_NOISE", "quote[0]: LOW_VALUE_QUOTE"]));
  });

  it("keeps report 63 purchase purpose, floor motivation and strong interest without CRM card facts", () => {
    const useful = [
      { fact: "Клиент рассматривает квартиру для себя", evidence: "Для себя" },
      { fact: "Клиенту нужен второй этаж", evidence: "Мне именно второй этаж нужен" },
      { fact: "Клиенту тяжело подниматься на пятый этаж, поэтому ищет второй", evidence: "На пятый тяжело добираться" },
      { fact: "Клиент выразил сильный интерес и сразу бы взял квартиру", evidence: "Я прямо сразу бы взяла её" },
    ];
    const result = clean({
      verified_facts: [
        ...useful,
        { fact: "Объект: посёлок Ильинский, цена 6 500", evidence: "Ильинский, 6500" },
        { fact: "Объект курирует агент Дмитрий", evidence: "Дмитрий" },
      ],
    }).output;
    expect(result.facts).toEqual(useful);
    expect(result.cleaning.removed_items).toEqual(expect.arrayContaining(["fact[4]: CRM_OBJECT_PRICE", "fact[5]: CRM_AGENT_NAME"]));
  });

  it("applies Store Cleaner v4 deterministic low-value classes without deleting deal-relevant meaning", () => {
    const preserved = [
      { fact: "Если собственник снизит цену до 7,2 млн ₽ — клиент готов рассматривать покупку", evidence: "Если снизит до 7,2, готов рассматривать" },
      { fact: "Клиент работает риелтором и представляет покупателя по доверенности", evidence: "Я риелтор, представляю покупателя" },
      { fact: "Клиент хочет оценить состояние ремонта и понять, потребуется ли что-то переделывать", evidence: "Хочу посмотреть, насколько ремонт убитый" },
    ];
    const result = clean({
      verified_facts: [
        { fact: "Клиент обращается как частное лицо", evidence: "Как частное лицо" },
        { fact: "Клиент подтвердил, что его контактный номер актуален", evidence: "Да, номер актуален" },
        { fact: "Клиент уточняет, верна ли цена 7,99 млн ₽ из объявления", evidence: "Правильно, цена такая?" },
        { fact: "Клиент звонит по объявлению и хочет посмотреть апартаменты", evidence: "Звоню по объявлению, хочу посмотреть апартаменты" },
        { fact: "Оператор соединил клиента с агентом", evidence: "Соединяю со специалистом" },
        ...preserved,
      ],
      verified_quotes: ["Звоню по объявлению, хочу посмотреть апартаменты", "Хочу посмотреть, насколько ремонт убитый"],
      verified_needs: { primary_need: "Организовать просмотр апартаментов", requirements: [], preferences: [], objections: [], unresolved_questions: [] },
    }).output;

    expect(result.facts).toEqual(preserved);
    expect(result.quotes).toEqual(["Хочу посмотреть, насколько ремонт убитый"]);
    expect(result.cleaning.removed_items).toEqual(expect.arrayContaining([
      "fact[0]: CRM_CLIENT_TYPE",
      "fact[1]: CRM_CONTACT_VALIDATION",
      "fact[2]: CRM_OBJECT_PRICE_CONFIRMATION",
      "fact[3]: LOW_VALUE_CALL_CONTEXT",
      "fact[4]: CONTACT_CENTER_SERVICE_FACT",
      "quote[0]: LOW_VALUE_CALL_CONTEXT",
    ]));
  });

  it("preserves useful current-object context from report 2026-08-11T162211.349", () => {
    const useful = [
      { fact: "Клиент хочет оценить состояние ремонта и понять, потребуется ли что-то переделывать", evidence: "Хочу посмотреть состояние ремонта" },
      { fact: "Клиент готов посмотреть объект в ближайшие 2–3 дня и живёт недалеко", evidence: "В ближайшие два-три дня, я рядом живу" },
      { fact: "Клиент готов рассмотреть просмотр вечером", evidence: "Можно вечером" },
      { fact: "Клиент выясняет, повлияла ли посуточная аренда на состояние объекта", evidence: "Она посуточно сдаётся? Убитая, нет?" },
    ];
    expect(clean({ verified_facts: useful }).output.facts).toEqual(useful);
  });

  it("reduces report 2026-08-11T162211.349 to the two useful facts when daily rent only proxies repair condition", () => {
    const useful = [
      { fact: "Клиент хочет оценить состояние ремонта и понять, нужно ли что-то переделывать", evidence: "Меня интересует состояние ремонта, насколько он требует что-то переделывать" },
      { fact: "Клиент готов посмотреть объект в ближайшие 2–3 дня и живёт недалеко", evidence: "В ближайшие два-три дня, я не так далеко живу" },
    ];
    const result = clean({
      verified_facts: [
        { fact: "Клиент интересуется, сдаётся ли апартаменты посуточно", evidence: "Она посуточно сдаётся? Убитая, нет?" },
        ...useful,
        { fact: "Агент сообщил, что объект не сдавался посуточно", evidence: "Не посуточно она и не сдавалась" },
      ],
    }).output;
    expect(result.facts).toEqual(useful);
    expect(result.cleaning.removed_items).toEqual(expect.arrayContaining([
      "fact[0]: LOW_VALUE_CALL_CONTEXT",
      "fact[3]: LOW_VALUE_CALL_CONTEXT",
    ]));
  });
});
