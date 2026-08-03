import { expect, test, type Page } from "@playwright/test";
import goldenDataset from "../fixtures/canonical-summary-context-golden.json";

const moduleUrl = "/pipeline-lab-v3.html?projectId=project_transcription_summary_module&productName=" +
  encodeURIComponent("Модуль транскрибации и AI-саммари звонков");

type Item = Record<string, unknown>;

const fact = (id: string, type: string, value: unknown, evidence?: string, extra: Item = {}) => ({
  id, type, value, speaker: "Клиент", evidence: evidence ?? String(value), source_turn_ids: [`turn_${id}`],
  confidence: 0.99, business_priority: "important", source: "fact_check", ...extra,
});
const requirement = (id: string, type: string, value: unknown, evidence?: string, extra: Item = {}) => ({
  id, type, value, evidence: evidence ?? String(value), source_fact_ids: [`fact_${id}`], confidence: 0.99,
  priority: "required", source: "need_check", ...extra,
});
const attribute = (id: string, value: string, evidence?: string) => ({
  id, value, evidence: evidence ?? value, source_fact_ids: [`fact_${id}`], confidence: 0.99, source: "need_check",
});
const primary = (action: string, deadline = "", channel = "", extra: Item = {}) => ({
  action, owner: "агент", recipient: "клиент", deadline, channel, status: "promised",
  agreement_ids: ["agreement_primary"], confidence: 0.99, evidence: [action, deadline, channel].filter(Boolean).join(" "), ...extra,
});
const store = (input: Item = {}) => ({
  conversation: {
    facts: [], quotes: [], requirements: [],
    attributes: { interest: [], funding_source: {}, purchase_term: {} },
    call_result: "Консультация завершена.", agreements: [], primary_next_step: {},
    ...(input.conversation as Item ?? input),
  },
  quality: { fact_check_score: 1, need_check_score: 1, outcome_check_score: 1, overall_confidence: 1 },
  store_meta: { schema_version: "conversation_store_v2", status: "READY" },
});

function scenario(id: string) {
  if (id === "mystolovo") return store({
    facts: [
      fact("goal", "client_goal", "Покупка участка ИЖС для строительства дома", undefined, { business_priority: "critical" }),
      fact("objection", "client_objection", "Сомнение по ежемесячному взносу 9 600 ₽", "Взнос 9 600 ₽ меня смущает", { business_priority: "critical" }),
      fact("video", "agent_information", "Агент предложил видеообзор", "Могу отправить видеообзор"),
      fact("hello", "client_context", "Здравствуйте", "Здравствуйте", { business_priority: "secondary" }),
      fact("listing", "other_important", "Текущее объявление: Охтинское Раздолье за 4,65 млн ₽", undefined, { business_priority: "secondary" }),
    ],
    requirements: [
      requirement("property", "property_type", "ИЖС"), requirement("area", "minimum_land_area", "участок от 6 соток"),
      requirement("location", "search_location", ["Мистолово", "Капитолово", "Лаврики"]), requirement("budget", "price_limit", "до 5,5 млн ₽"),
    ],
    call_result: "Агент подготовит подбор альтернативных участков.",
    agreements: [{ id: "agreement_primary", action: "отправить видеообзор и подборку альтернативных участков", owner: "агент", recipient: "клиент", deadline: "после звонка", channel: "MAX", status: "promised", evidence: "Отправлю видео и подборку в MAX", confidence: 0.99 }],
    primary_next_step: primary("отправить видеообзор и подборку альтернативных участков", "после звонка", "MAX"),
    quotes: [{ id: "quote_objection", text: "Взнос 9 600 ₽ меня смущает", speaker: "Клиент", supports_fact_ids: ["objection"], confidence: 0.99 }],
  });
  if (id === "repeat_viewing") return store({
    facts: [fact("repeat", "client_context", "Повторный контакт для согласования просмотра"), fact("ready", "client_goal", "Клиент подтвердил готовность приехать")],
    call_result: "Повторный просмотр согласован.",
    agreements: [{ id: "agreement_primary", action: "приехать на просмотр к точке встречи у входа; связаться только при изменениях", owner: "оба", recipient: "none", deadline: "завтра в 19:00", channel: "телефон", status: "confirmed", evidence: "Завтра в 19:00 у входа, звоним только если что-то изменится", confidence: 0.99 }],
    primary_next_step: primary("приехать на просмотр к точке встречи у входа; связаться только при изменениях", "завтра в 19:00", "телефон", { owner: "оба", status: "confirmed" }),
  });
  if (id === "granddaughter") return store({
    facts: [fact("goal", "client_goal", "Покупка квартиры для 17-летней внучки", undefined, { business_priority: "critical" }), fact("travel", "client_requirement", "Удобные поездки к вузу"), fact("legal", "client_requirement", "Юридическая чистота"), fact("bargain", "client_objection", "Нужна возможность торга")],
    requirements: [requirement("type", "property_type", "студия или квартира"), requirement("area", "minimum_area", "от 25–26 м²"), requirement("budget", "price_limit", "до 9 млн ₽")],
    attributes: { interest: [], funding_source: attribute("cash", "наличные / депозит", "Оплата наличными"), purchase_term: {} },
    call_result: "Агент предложит альтернативные варианты.",
    agreements: [{ id: "agreement_primary", action: "позвонить с альтернативными вариантами", owner: "агент", recipient: "клиент", deadline: "завтра", channel: "телефон", status: "promised", evidence: "Позвоню завтра с вариантами", confidence: 0.99 }],
    primary_next_step: primary("позвонить с альтернативными вариантами", "завтра", "телефон"),
    quotes: [{ id: "quote_goal", text: "Ищу квартиру для внучки, ей семнадцать лет", speaker: "Клиент", supports_fact_ids: ["goal"], confidence: 0.99 }],
  });
  if (id === "medikova") return store({
    facts: [
      fact("goal", "client_goal", "Покупка для собственного проживания", undefined, { business_priority: "critical" }),
      fact("inheritance", "open_question", "Юридический вопрос по наследству", "Как оформлялось наследство?", { question_status: "answered", answer: "Право получено по наследству, оригиналы документов есть", answer_evidence: "Оригиналы документов есть", business_priority: "critical" }),
      fact("encumbrance", "agent_information", "Обременений и долгов нет", "Обременений и долгов нет", { business_priority: "critical" }),
      fact("insurance", "agent_information", "Возможно титульное страхование", "Можно оформить титульное страхование"),
      fact("queue", "client_context", "Клиент третий на просмотре"), fact("lock", "other_important", "Показ перенесли из-за другого замка и двери"),
      fact("family", "other_important", "История тёти и племянника"), fact("address", "other_important", "Медикова, 26, корп. 1"),
    ],
    attributes: { interest: [], funding_source: attribute("cash", "наличные / депозит", "У меня наличные"), purchase_term: {} },
    call_result: "Просмотр согласован.",
    agreements: [{ id: "agreement_primary", action: "позвонить утром и подтвердить просмотр", owner: "агент", recipient: "клиент", deadline: "утром", channel: "телефон", status: "promised", evidence: "Утром позвоню и подтвержу просмотр", confidence: 0.99 }],
    primary_next_step: primary("позвонить утром и подтвердить просмотр", "утром", "телефон"),
    quotes: [{ id: "quote_useless", text: "Себе рассматриваю", speaker: "Клиент", supports_fact_ids: ["goal"], confidence: 0.99 }],
  });
  if (id === "short_call") return store({ call_result: "Клиент попросил перезвонить.", agreements: [{ id: "agreement_primary", action: "перезвонить клиенту", owner: "агент", recipient: "клиент", deadline: "позже", channel: "телефон", status: "promised", evidence: "Перезвоните позже", confidence: 0.99 }], primary_next_step: primary("перезвонить клиенту", "позже", "телефон") });
  if (id === "no_next_step") return store({ call_result: "Консультация завершена, решение не принято.", primary_next_step: { status: "not_defined" } });
  if (id === "legal") return store({
    facts: [fact("inheritance", "client_constraint", "Юридическое условие: наследство и оригиналы документов", undefined, { business_priority: "critical" }), fact("encumbrance", "agent_information", "Обременений нет"), fact("insurance", "agent_information", "Доступно титульное страхование")],
    call_result: "Клиент ожидает документы.", agreements: [{ id: "agreement_primary", action: "отправить документы", owner: "агент", recipient: "клиент", deadline: "сегодня", channel: "email", status: "promised", evidence: "Сегодня отправлю документы", confidence: 0.99 }], primary_next_step: primary("отправить документы", "сегодня", "email"),
    quotes: [{ id: "quote_legal", text: "Для меня важно, чтобы не было обременений", speaker: "Клиент", supports_fact_ids: ["inheritance"], confidence: 0.99 }],
  });
  return store({
    facts: [fact("objection", "client_objection", "Клиента смущает шум", undefined, { business_priority: "critical" })],
    requirements: [requirement("lift", "other_requirement", "Наличие лифта"), requirement("area", "minimum_area", "от 60 м²"), requirement("metro", "search_location", "рядом с метро"), requirement("rooms", "property_type", "двухкомнатная квартира")],
    call_result: "Агент подготовит подборку.", agreements: [{ id: "agreement_primary", action: "подготовить подборку", owner: "агент", recipient: "клиент", deadline: "завтра", channel: "email", status: "promised", evidence: "Завтра подготовлю подборку", confidence: 0.99 }], primary_next_step: primary("подготовить подборку", "завтра", "email"),
    quotes: [{ id: "quote_noise", text: "Шум для меня критичен, такую квартиру не возьму", speaker: "Клиент", supports_fact_ids: ["objection"], confidence: 0.99 }],
  });
}

const normalize = (value: unknown) => JSON.stringify(value).toLowerCase().replace(/ё/g, "е").replace(/(?<=\d)\s+(?=\d)/g, "").replace(/\s+/g, " ");
const selectedValues = (context: Item) => [
  ...(["client_context", "financial_context", "critical_requirements", "objections", "open_questions", "important_agent_information", "quote_candidates"] as const).flatMap((slot) => (context[slot] as Item[] ?? []).map((item) => String(item.value ?? ""))),
  ...(["conversation_result", "primary_next_step"] as const).map((slot) => String((context[slot] as Item | null)?.value ?? "")).filter(Boolean),
];
const meaningPresent = (text: string, tokens: string[]) => tokens.every((token) => text.includes(normalize(token).slice(1, -1)));

async function build(page: Page, data: ReturnType<typeof store>, transcript = "", cardMetadata: Item = {}) {
  return page.evaluate(({ data, transcript, cardMetadata }) => buildCanonicalSummaryContext(data, transcript, cardMetadata), { data, transcript, cardMetadata });
}

test.beforeEach(async ({ page }) => { await page.goto(moduleUrl); });

test("Мистолово: приоритетные смыслы и канал MAX не вытесняются шумом", async ({ page }) => {
  const context = await build(page, scenario("mystolovo"));
  const text = normalize(selectedValues(context).join(" "));
  for (const tokens of goldenDataset[0].required_meanings) expect(meaningPresent(text, tokens), `missing ${tokens.join("+")} in ${text}`).toBe(true);
  expect(text).not.toContain("4,65");
  expect(context.ranking_diagnostics.selected_total).toBeLessThanOrEqual(12);
});

test("повторный просмотр не создаёт искусственные потребности", async ({ page }) => {
  const context = await build(page, scenario("repeat_viewing"));
  const text = normalize(selectedValues(context).join(" "));
  expect(text).toContain("повторный контакт"); expect(text).toContain("19:00"); expect(text).toContain("точк");
  expect(context.financial_context).toEqual([]); expect(context.objections).toEqual([]);
});

test("aggregate call_result не вытесняется отдельным communication_result", async ({ page }) => {
  const data = scenario("repeat_viewing");
  data.conversation.facts.push(fact("communication", "communication_result", "связь только при изменениях"));
  const context = await build(page, data);
  expect(normalize(context.conversation_result?.value)).toContain("просмотр согласован");
  expect(normalize(context.important_agent_information.map((item: Item) => item.value).join(" "))).toContain("связь только при изменениях");
  expect(context.ranking_diagnostics.critical_meanings_lost, JSON.stringify(context.excluded_items)).toBe(0);
});

test("структурированное объединённое требование покрывает отдельные локации", async ({ page }) => {
  const data = scenario("mystolovo");
  data.conversation.facts.push(
    fact("location_m", "client_requirement", "Мистолово"),
    fact("location_k", "client_requirement", "Капитолово"),
    fact("location_l", "client_requirement", "Лаврики"),
  );
  const combinedLocation = data.conversation.requirements.find((item: Item) => item.id === "location");
  if (combinedLocation) combinedLocation.confidence = 0.9;
  const context = await build(page, data);
  const text = normalize(context.critical_requirements.map((item: Item) => item.value).join(" "));
  expect(text).toContain("мистолово, капитолово, лаврики");
  expect(context.ranking_diagnostics.critical_meanings_lost, JSON.stringify(context.excluded_items)).toBe(0);
});

test("покупка для внучки сохраняет цель, бюджет, требования, юридический смысл и звонок", async ({ page }) => {
  const context = await build(page, scenario("granddaughter")); const text = normalize(selectedValues(context).join(" "));
  for (const tokens of goldenDataset[2].required_meanings) expect(meaningPresent(text, tokens)).toBe(true);
});

test("Медикова исключает карточку, очередь, замок, биографию и слабую цитату", async ({ page }) => {
  const context = await build(page, scenario("medikova"), "Клиент: Себе рассматриваю. Агент: Обременений и долгов нет. Утром позвоню и подтвержу просмотр.", { address: "Медикова, 26, корп. 1" });
  const text = normalize(selectedValues(context).join(" "));
  for (const tokens of goldenDataset[3].forbidden_meanings) expect(meaningPresent(text, tokens)).toBe(false);
  expect(text).toContain("наслед"); expect(text).toContain("обремен"); expect(text).toContain("титульн"); expect(text).toContain("просмотр");
});

test("закрытый вопрос объединяется с ответом в один смысловой элемент", async ({ page }) => {
  const context = await build(page, scenario("medikova"));
  const combined = context.important_agent_information.filter((item: Item) => normalize(item.value).includes("вопрос:") && normalize(item.value).includes("ответ:"));
  expect(combined).toHaveLength(1); expect(context.open_questions).toEqual([]);
});

test("организационный шум не проходит порог", async ({ page }) => {
  const noisy = store({ facts: [fact("hello", "client_context", "Здравствуйте"), fact("route", "client_context", "Доеду на метро"), fact("queue", "client_context", "Я третий в очереди просмотров"), fact("lock", "other_important", "Перенос из-за другого ключа и замка")], call_result: "Консультация завершена." });
  const context = await build(page, noisy); const text = normalize(selectedValues(context).join(" "));
  expect(text).not.toMatch(/здравств|метро|очеред|ключ|замок/); expect(context.ranking_diagnostics.excluded_by_reason.organizational_noise).toBeGreaterThanOrEqual(4);
});

test("короткий звонок не порождает бюджет, требования и возражения", async ({ page }) => {
  const context = await build(page, scenario("short_call"));
  expect(context.financial_context).toEqual([]); expect(context.critical_requirements).toEqual([]); expect(context.objections).toEqual([]);
  expect(normalize(context.primary_next_step?.value)).toContain("перезвон");
});

test("Builder детерминирован относительно порядка массивов", async ({ page }) => {
  const original = scenario("granddaughter"); const shuffled = JSON.parse(JSON.stringify(original));
  shuffled.conversation.facts.reverse(); shuffled.conversation.requirements.reverse(); shuffled.conversation.quotes.reverse();
  const [left, right] = await Promise.all([build(page, original), build(page, shuffled)]);
  expect(left).toEqual(right);
});

test("частичный Store безопасно деградирует без ложных элементов", async ({ page }) => {
  const context = await build(page, { quality: {}, store_meta: { status: "READY_WITH_WARNINGS" } } as ReturnType<typeof store>);
  expect(context.ranking_diagnostics.technical_error).toBe(false); expect(context.ranking_diagnostics.warnings).not.toEqual([]);
  expect(context.financial_context).toEqual([]); expect(context.critical_requirements).toEqual([]); expect(context.objections).toEqual([]);
});

test("Summary Agent получает только Canonical Context, без raw Store и transcript", async ({ page }) => {
  const result = await page.evaluate((data) => {
    const ctx = { conversation_store: data, __transcript: "СЕКРЕТНЫЙ RAW TRANSCRIPT", card_metadata: { address: "Адрес карточки" } };
    const audit = moduleSummaryPrompt({ prompt: "Summary Agent\n{{ctx.conversation_store}}\n{{ctx.transcript}}" }, ctx);
    return { prompt: audit.prompt, input: audit.promptInput, diagnostics: audit.summaryContext.ranking_diagnostics };
  }, scenario("mystolovo"));
  expect(result.prompt).not.toContain("СЕКРЕТНЫЙ RAW TRANSCRIPT"); expect(result.prompt).not.toContain("conversation_store");
  expect(result.prompt).toContain("SUMMARY AGENT INPUT"); expect(result.input.summary_context).toBeTruthy(); expect(result.diagnostics.ranking_version).toBe("canonical-summary-context-v1");
});

test("Golden Dataset достигает заданных бизнес-метрик", async ({ page }) => {
  let requiredTotal = 0, requiredHit = 0, selectedTotal = 0, selectedRelevant = 0, forbiddenTotal = 0, forbiddenRejected = 0, duplicateTotal = 0, duplicateRejected = 0, nextCorrect = 0, quoteTotal = 0, quoteCorrect = 0;
  for (const golden of goldenDataset) {
    const context = await build(page, scenario(golden.id)); const values = selectedValues(context); const text = normalize(values.join(" "));
    requiredTotal += golden.required_meanings.length; requiredHit += golden.required_meanings.filter((tokens) => meaningPresent(text, tokens)).length;
    forbiddenTotal += golden.forbidden_meanings.length; forbiddenRejected += golden.forbidden_meanings.filter((tokens) => !meaningPresent(text, tokens)).length;
    const relevant = [...golden.required_meanings, ...golden.allowed_meanings]; selectedTotal += values.length;
    selectedRelevant += values.filter((value) => relevant.some((tokens) => tokens.some((token) => normalize(value).includes(normalize(token).slice(1, -1)))) || /консультац|просмотр|подбор|ожидает|согласован/.test(normalize(value))).length;
    for (let left = 0; left < values.length; left++) for (let right = left + 1; right < values.length; right++) { duplicateTotal++; const a = normalize(values[left]), b = normalize(values[right]); if (!(a === b || a.length > 12 && b.includes(a) || b.length > 12 && a.includes(b))) duplicateRejected++; }
    const next = normalize(context.primary_next_step?.value ?? ""); nextCorrect += golden.expected_next_step.length ? Number(golden.expected_next_step.every((token) => next.includes(normalize(token).slice(1, -1)))) : Number(context.primary_next_step == null);
    for (const quote of context.quote_candidates) { quoteTotal++; quoteCorrect += Number(golden.allowed_quotes.some((tokens) => tokens.every((token) => normalize(quote.value).includes(normalize(token).slice(1, -1))))); }
  }
  const metrics = {
    critical_meaning_recall: requiredHit / requiredTotal,
    selected_fact_precision: selectedRelevant / selectedTotal,
    noise_rejection_rate: forbiddenRejected / forbiddenTotal,
    duplicate_rejection_rate: duplicateTotal ? duplicateRejected / duplicateTotal : 1,
    next_step_accuracy: nextCorrect / goldenDataset.length,
    quote_precision: quoteTotal ? quoteCorrect / quoteTotal : 1,
  };
  console.log("CANONICAL_GOLDEN_METRICS", JSON.stringify(metrics));
  expect(metrics.critical_meaning_recall).toBeGreaterThanOrEqual(0.95);
  expect(metrics.selected_fact_precision).toBeGreaterThanOrEqual(0.85);
  expect(metrics.noise_rejection_rate).toBeGreaterThanOrEqual(0.95);
  expect(metrics.duplicate_rejection_rate).toBeGreaterThanOrEqual(0.95);
  expect(metrics.next_step_accuracy).toBeGreaterThanOrEqual(0.95);
  expect(metrics.quote_precision).toBeGreaterThanOrEqual(0.90);
});
