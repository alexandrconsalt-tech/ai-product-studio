import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

function runtime() {
  const context = { window: {} as Record<string, any>, Intl, Date };
  for (let version = 14; version <= 26; version++)
    runInNewContext(readFileSync(resolve("public", `ai-application-attributes-pipeline-v${version}.js`), "utf8"), context);
  for (const file of ["ai-application-attributes-contract-v2.js", "ai-application-attributes-pipeline-v27.js", "ai-application-attributes-pipeline-v28.js", "ai-application-attributes-runtime-v29.js", "ai-application-attributes-pipeline-v30.js", "ai-application-attributes-pipeline-v31.js", "ai-application-attributes-pipeline-v32.js", "ai-application-attributes-pipeline-v33.js"])
    runInNewContext(readFileSync(resolve("public", file), "utf8"), context);
  return { api: context.window.ApplicationAttributesV2, config: context.window.__AI_APPLICATION_ATTRIBUTES_PIPELINE_CONFIG__ };
}
const absent = (): Record<string, any> => ({
  interest: { status: "not_determined", value: null, evidence: [], declined_values: [], decline_evidence: [] },
  funding_source: { status: "not_determined", value: null, evidence: "" },
  purchase_term: { status: "not_determined", value: null, evidence: "" },
  next_contact_date: { status: "not_determined", detected: false, next_contact_at: null, precision: "none", action: "none", actor: "none", raw_time_expression: null, evidence: null, confidence: 0 },
});
const determined = (): Record<string, any> => ({
  interest: { status: "determined", value: ["Новостройки", "Ипотека"], evidence: ["Ищу новостройку", "Нужна ипотечная консультация"], declined_values: [], decline_evidence: [] },
  funding_source: { status: "determined", value: "ипотека одобрена", evidence: "Банк одобрил ипотеку" },
  purchase_term: { status: "determined", value: "2–3 месяца", evidence: "Купим через два месяца" },
  next_contact_date: { status: "determined", detected: true, next_contact_at: "2026-09-28T15:00:00+03:00", precision: "exact", action: "callback", actor: "agent", raw_time_expression: "завтра в 15:00", evidence: "Завтра в 15:00 перезвоню", confidence: .96 },
});
function pipeline(api: any, candidates: Record<string, any>, change?: (inputs: any, verdicts: any) => void, existingAttributes?: Record<string, any>) {
  const inputs = Object.fromEntries(api.keys.map((key: string) => [key, { status: "ready", result: candidates[key] }]));
  const verdicts = Object.fromEntries(api.keys.map((key: string) => [key, { status: candidates[key].status, verdict: candidates[key].status === "not_determined" ? "not_determined" : "accepted", reason: "Подтверждено", ...(key === "next_contact_date" ? { corrected_value: null } : {}) }]));
  change?.(inputs, verdicts);
  const judge = api.judgeResult(verdicts, inputs), gate = api.gate(judge);
  return { judge, gate, crm: api.crm(gate, existingAttributes) };
}

describe("Политика обновления существующих CRM-атрибутов", () => {
  it("заменяет подтверждённый Funding Source и сохраняет существующий при not_determined", () => {
    const { api } = runtime(), values = determined();
    values.funding_source.value = "ипотека одобрена";
    expect(pipeline(api, values, undefined, { funding_source: "ипотека в процессе" }).crm).toMatchObject({
      attributes: { funding_source: "ипотека одобрена" }, update_actions: { funding_source: "SET" },
    });
    const missing = absent();
    expect(pipeline(api, missing, undefined, { funding_source: "ипотека одобрена" }).crm).toMatchObject({
      attributes: { funding_source: null }, update_actions: { funding_source: "SKIP" },
    });
    expect(pipeline(api, values, (_, verdicts) => { verdicts.funding_source.verdict = "rejected"; }, { funding_source: "ипотека в процессе" }).crm).toMatchObject({
      attributes: { funding_source: null }, update_actions: { funding_source: "SKIP" },
    });
  });

  it("заменяет подтверждённый Purchase Term", () => {
    const { api } = runtime(), values = determined();
    values.purchase_term.value = "до 1 месяца";
    expect(pipeline(api, values, undefined, { purchase_term: "3–6 месяцев" }).crm).toMatchObject({
      attributes: { purchase_term: "до 1 месяца" }, update_actions: { purchase_term: "SET" },
    });
  });

  it.each([
    ["funding_source", "ипотека одобрена"],
    ["purchase_term", "3–6 месяцев"],
  ])("explicit_declined для scalar %s формирует SKIP и не возвращает старое значение", (key, existingValue) => {
    const { api } = runtime(), values = absent();
    values[key] = { ...values[key], status: "explicitly_declined", evidence: "Не хочу это обсуждать" };
    const { gate, crm } = pipeline(api, values, undefined, { [key]: existingValue });
    expect(gate.decisions[key]).toBe("DO_NOT_UPDATE");
    expect(crm.update_actions[key]).toBe("SKIP");
    expect(crm.attributes[key]).toBeNull();
  });

  it.each([
    { name: "ADD", existing: ["Ипотека"], confirmed: ["Новостройки"], declined: [], action: "ADD" },
    { name: "REMOVE", existing: ["Ипотека", "Новостройки"], confirmed: [], declined: ["Новостройки"], action: "REMOVE" },
    { name: "KEEP", existing: ["Ипотека", "Новостройки"], confirmed: [], declined: [], action: "KEEP" },
    { name: "ADD + REMOVE", existing: ["Новостройки", "Ипотека"], confirmed: ["Строительство"], declined: ["Новостройки"], action: "ADD_REMOVE" },
  ])("Interest $name передаёт только атомарные операции", ({ existing, confirmed, declined, action }) => {
    const { api } = runtime(), values = absent();
    if(confirmed.length) values.interest = { status: "determined", value: confirmed, evidence: confirmed.map(value => `Подтверждено: ${value}`), declined_values: declined, decline_evidence: declined.map(value => `Отказ: ${value}`) };
    else if(declined.length) values.interest = { status: "explicitly_declined", value: null, evidence: declined.map(value => `Отказ: ${value}`), declined_values: declined, decline_evidence: declined.map(value => `Отказ: ${value}`) };
    const { gate, crm } = pipeline(api, values, undefined, { interest: existing });
    expect(crm.attributes.interest).toBeNull();
    expect(gate.interest_operations).toEqual({ add: confirmed, remove: declined, keep: !confirmed.length && !declined.length });
    expect(crm.interest_operations).toEqual(gate.interest_operations);
    expect(crm.update_actions.interest).toBe(action);
  });

  it("новый Next Contact заменяет существующий, а отсутствие контакта сохраняет его и не включает fallback", () => {
    const { api } = runtime(), existing = { next_contact_date: "2026-09-29T10:00:00+03:00" };
    const updated = pipeline(api, determined(), undefined, existing);
    expect(updated.crm).toMatchObject({ attributes: { next_contact_date: "2026-09-28T15:00:00+03:00" }, update_actions: { next_contact_date: "SET" } });
    const missing = pipeline(api, absent(), undefined, existing);
    api.applySystemFallback(missing.gate, "2026-09-30T10:00:00+03:00", existing);
    const crm = api.crm(missing.gate, existing);
    expect(crm).toMatchObject({ attributes: { next_contact_date: null }, update_actions: { next_contact_date: "SKIP" } });
  });

  it("техническая ошибка не возвращает старое значение как payload", () => {
    const { api } = runtime(), existing = { funding_source: "ипотека в процессе" };
    const { crm } = pipeline(api, determined(), (inputs) => { inputs.funding_source.status = "technical_error"; }, existing);
    expect(crm).toMatchObject({ attributes: { funding_source: null, purchase_term: "2–3 месяца" }, update_actions: { funding_source: "ERROR", purchase_term: "SET" } });
  });

  it("CRM result не зависит от устаревшего снимка current_attributes", () => {
    const { api } = runtime(), { gate } = pipeline(api, determined());
    const oldSnapshot = api.crm(gate, { interest: ["Ипотека"], funding_source: "ипотека в процессе", purchase_term: "более 6 месяцев" });
    const latestSnapshot = api.crm(gate, { interest: ["Безопасность сделок"], funding_source: "наличные / депозит", purchase_term: "до 1 месяца" });
    expect(oldSnapshot).toEqual(latestSnapshot);
    expect(oldSnapshot.attributes.interest).toBeNull();
    expect(oldSnapshot.interest_operations.add).toEqual(["Новостройки", "Ипотека"]);
  });
});
describe("Строгое заполнение четырёх атрибутов v33", () => {
  it.each([
    ["funding_source", "наличные / депозит"], ["funding_source", "ипотека одобрена"],
    ["funding_source", "ипотека в процессе"], ["funding_source", "продажа своей квартиры"],
    ["purchase_term", "до 1 месяца"], ["purchase_term", "2–3 месяца"],
    ["purchase_term", "3–6 месяцев"], ["purchase_term", "более 6 месяцев"],
  ])("сохраняет точное значение %s: %s без свободного текста", (key, value) => {
    const { api } = runtime(), candidates = determined();
    candidates[key].value = value;
    const { crm } = pipeline(api, candidates);
    expect(Object.keys(crm.attributes)).toEqual(api.keys);
    expect(crm.attributes[key]).toBe(value);
    expect(crm.update_actions[key]).toBe("SET");
  });
  it.each(["не определено", "семейная ипотека", "ипотека планируется", "кредит", "наличные"])("отклоняет недопустимый источник %s независимо от остальных полей", value => {
    const { api } = runtime(), candidates = determined();
    candidates.funding_source.value = value;
    const { crm } = pipeline(api, candidates);
    expect(crm.attributes.funding_source).toBeNull();
    expect(crm.update_actions.funding_source).toBe("ERROR");
    expect(crm.update_actions.purchase_term).toBe("SET");
  });
  it.each(["не определено", "срочно", "1–2 месяца", "до сентября", "2-3 месяца"])("отклоняет значение срока вне справочника: %s", value => {
    const { api } = runtime(), candidates = determined();
    candidates.purchase_term.value = value;
    const { crm } = pipeline(api, candidates);
    expect(crm.attributes.purchase_term).toBeNull();
    expect(crm.update_actions.purchase_term).toBe("ERROR");
    expect(crm.update_actions.funding_source).toBe("SET");
  });
  it.each(["date", "daypart", "range"])("Gate не сохраняет произвольный час при точности %s, даже после accepted", precision => {
    const { api } = runtime(), candidates = determined();
    candidates.next_contact_date.precision = precision;
    const { gate, crm } = pipeline(api, candidates);
    expect(crm.attributes.next_contact_date).toBeNull();
    expect(crm.update_actions.next_contact_date).toBe("SKIP");
    expect(crm.next_contact_resolution.reason).toBe("EXACT_CONTACT_TIME_REQUIRED");
    expect(crm.pending_attributes).toEqual(["next_contact_date"]);
    expect(crm.update_actions.funding_source).toBe("SET");
    const fallback = api.crm(api.applySystemFallback(gate, "2026-09-28T10:00:00+03:00"));
    expect(fallback.update_actions.next_contact_date).toBe("KEEP_FALLBACK");
    expect(fallback.sources.next_contact_date).toBe("fallback");
  });
  it("актуальные промпты не назначают стандартный час и возвращают context=null", () => {
    const { config } = runtime();
    for (const stage of config.stages.slice(0, 5)) {
      expect(stage.prompt).toContain("ОБЯЗАТЕЛЬНЫЙ АЛГОРИТМ ЧЕТЫРЁХ АТРИБУТОВ v33");
      expect(stage.prompt.match(/\{\{transcript\}\}/g)).toHaveLength(1);
    }
    expect(config.stages.find((stage: any) => stage.outKey === "funding_source_extractor").prompt).toContain("Поле context возвращай null");
    expect(config.stages.find((stage: any) => stage.outKey === "purchase_term_extractor").prompt).toContain("Не округляй срок");
  });
});
describe("AI Атрибуты: согласованный контракт v2", () => {
  it("updates seven stages, schemas and prompts together", () => {
    const { api, config } = runtime();
    expect(config.revision).toBe(33);
    expect(config.canonicalVersion).toBe(33);
    expect(config.stages.map((s: any) => s.outKey)).toEqual([...api.keys.map((key: string) => key + "_extractor"), "attributes_judge", "attributes_quality_gate", "crm_attributes_result"]);
    for (const stage of config.stages.slice(0, 5)) {
      expect(stage.responseContract).toBe(`application_${stage.outKey}_${["next_contact_date_extractor", "attributes_judge"].includes(stage.outKey) ? "v4" : "v3"}`);
      expect(stage.prompt.match(/\{\{transcript\}\}/g)).toHaveLength(1);
      expect(stage.prompt).not.toMatch(/call_datetime|call_end_datetime/);
    }
    expect(api.schemas.interest_extractor.properties.value.items.enum).toEqual(["Новостройки", "Ипотека", "Инвестиции в регионах", "Безопасность сделок", "Юридическое сопровождение", "Строительство"]);
    expect(config.stages.slice(5).every((stage: any) => stage.actualExecutor === "code")).toBe(true);
  });
  it("passes all four confirmed values unchanged into CRM", () => {
    const { api } = runtime(), result = pipeline(api, determined());
    expect(result.gate.gate_status).toBe("READY");
    expect(Object.values(result.crm.update_actions)).toEqual(["ADD", "SET", "SET", "SET"]);
    expect(result.crm.attributes.next_contact_date).toBe("2026-09-28T15:00:00+03:00");
    expect(result.crm.sources.next_contact_date).toBe("ai");
  });
  it("does not clear existing values when information is absent", () => {
    const { api } = runtime(), { crm } = pipeline(api, absent());
    expect(Object.values(crm.update_actions)).toEqual(["KEEP", "SKIP", "SKIP", "SKIP"]);
    expect(Object.values(crm.attribute_states)).toEqual(Array(4).fill("not_determined"));
    expect(crm.next_contact_policy).toBe("PRESERVE_SYSTEM_FALLBACK_24H");
  });
  it.each(["interest", "funding_source", "purchase_term", "next_contact_date"])("keeps refusal distinct for %s", key => {
    const { api } = runtime(), candidates = absent();
    candidates[key] = { ...candidates[key], status: "explicitly_declined", evidence: key === "interest" ? ["Не хочу отвечать"] : "Не хочу отвечать" };
    const { crm } = pipeline(api, candidates);
    expect(crm.attribute_states[key]).toBe("explicitly_declined");
    expect(crm.attributes[key]).toBeNull();
    expect(crm.update_actions[key]).toBe(key === "interest" ? "KEEP" : key === "next_contact_date" ? "SET_DECLINED" : "SKIP");
    if (key === "next_contact_date") expect(crm.next_contact_policy).toBe("NO_CONTACT");
  });
  it("retains declined interest alongside another confirmed interest", () => {
    const { api } = runtime(), candidates = determined();
    candidates.interest = { status: "determined", value: ["Строительство"], evidence: ["Хотим построить дом"], declined_values: ["Ипотека"], decline_evidence: ["Ипотека не нужна"] };
    const { crm } = pipeline(api, candidates);
    expect(crm.attributes.interest).toBeNull();
    expect(crm.update_actions.interest).toBe("ADD_REMOVE");
    expect(crm.interest_operations).toEqual({ add: ["Строительство"], remove: ["Ипотека"], keep: false });
    expect(crm.declined_interest_values).toEqual(["Ипотека"]);
  });
  it("does not save a refusal rejected by Judge", () => {
    const { api } = runtime(), candidates = absent();
    candidates.funding_source = { status: "explicitly_declined", value: null, evidence: "Не знаю" };
    const { crm } = pipeline(api, candidates, (_, verdicts) => verdicts.funding_source.verdict = "rejected");
    expect(crm.update_actions.funding_source).toBe("SKIP");
    expect(crm.attribute_states.funding_source).toBe("not_determined");
  });
  it.each(["bad_judge", "changed_status", "invented_value", "bad_extractor", "upstream_error"])("isolates %s to its attribute", fault => {
    const { api } = runtime();
    const { crm } = pipeline(api, determined(), (inputs, verdicts) => {
      if (fault === "bad_judge") delete verdicts.funding_source;
      if (fault === "changed_status") verdicts.funding_source.status = "explicitly_declined";
      if (fault === "invented_value") verdicts.funding_source.value = "наличные / депозит";
      if (fault === "bad_extractor") inputs.funding_source.result.value = "кредит";
      if (fault === "upstream_error") inputs.funding_source.status = "technical_error";
    });
    expect(crm.update_actions.funding_source).toBe("ERROR");
    expect(crm.update_actions).toMatchObject({ interest: "ADD", purchase_term: "SET", next_contact_date: "SET" });
    expect(crm.pipeline_status).toBe("PARTIAL_READY");
  });
  it("does not save a rejected candidate", () => {
    const { api } = runtime(), { crm } = pipeline(api, determined(), (_, verdicts) => verdicts.interest.verdict = "rejected");
    expect(crm.update_actions.interest).toBe("KEEP");
    expect(crm.attributes.interest).toBeNull();
    expect(crm.update_actions.funding_source).toBe("SET");
  });
  it("preserves the server fallback without calling it an AI agreement", () => {
    const { api } = runtime(), { gate } = pipeline(api, absent());
    const crm = api.crm(api.applySystemFallback(gate, "2026-09-28T10:00:00+03:00"));
    expect(crm.attributes.next_contact_date).toBe("2026-09-28T10:00:00+03:00");
    expect(crm.attribute_states.next_contact_date).toBe("not_determined");
    expect(crm.sources.next_contact_date).toBe("fallback");
    expect(crm.update_actions.next_contact_date).toBe("KEEP_FALLBACK");
  });
  it("does not replace a confirmed contact or refusal with fallback", () => {
    const { api } = runtime(), candidates = determined();
    for (const state of ["determined", "explicitly_declined"]) {
      if (state === "explicitly_declined") candidates.next_contact_date = { ...absent().next_contact_date, status: state, evidence: "Больше не звоните" };
      const { gate } = pipeline(api, candidates), before = JSON.stringify(gate);
      api.applySystemFallback(gate, "2026-09-30T10:00:00+03:00");
      expect(JSON.stringify(gate)).toBe(before);
    }
  });
  it.each(["2026-02-30T10:00:00+03:00", "2026-09-30", "2026-09-30T25:00:00Z", "bad"])("rejects invalid timestamp %s", date => {
    expect(runtime().api.validDate(date)).toBe(false);
  });
  it("inserts transcript once even in a duplicated custom template", () => {
    const { api } = runtime();
    expect(api.renderPrompt("{{transcript}} {{ctx.__transcript}} {{transcript}}", {}, "UNIQUE_TRANSCRIPT_123").split("UNIQUE_TRANSCRIPT_123")).toHaveLength(2);
  });
  it("rejects unsupported interest, legacy statuses and incompatible nulls", () => {
    const { api } = runtime();
    for (const invalid of [
      { ...determined().interest, value: ["Вторичная недвижимость"] },
      { ...determined().interest, status: "unknown" },
      { ...absent().interest, status: "explicitly_declined" },
      { ...absent().interest, value: [] },
    ]) expect(() => api.validateExtractor("interest_extractor", invalid)).toThrow();
  });
});

describe("Контакт относительно события и незавершённый расчёт", () => {
  it.each(["missing_reference", "unresolved"])("preserves approved agreement with %s without an AI date", normalization_status => {
    const { api } = runtime(), inputs = determined();
    inputs.next_contact_date = { ...inputs.next_contact_date, next_contact_at: null, normalization_status,
      event_anchor: { raw_time_expression: "завтра в 15:00", evidence: "Завтра в 15:00. За час позвоню.", offset_minutes: -60 } };
    const { judge, gate, crm } = pipeline(api, inputs);
    expect(judge.judge_verdicts.next_contact_date).toBe("accepted");
    expect(gate.decisions.next_contact_date).toBe("DO_NOT_UPDATE");
    expect(crm).toMatchObject({ pending_attributes: ["next_contact_date"], technical_errors: [], pipeline_status: "PARTIAL_READY",
      attributes: { next_contact_date: null }, update_actions: { next_contact_date: "SKIP", interest: "ADD" },
      next_contact_resolution: { status: normalization_status, evidence: inputs.next_contact_date.evidence } });
    api.applySystemFallback(gate, "2026-09-28T10:00:00+03:00");
    expect(api.crm(gate)).toMatchObject({ pending_attributes: ["next_contact_date"],
      sources: { next_contact_date: "fallback" }, update_actions: { next_contact_date: "KEEP_FALLBACK" },
      next_contact_resolution: { status: normalization_status } });
  });
  it("requires event fields in live v3 JSON and rejects invented normalization metadata", () => {
    const { api } = runtime(), value = { ...determined().next_contact_date, next_contact_at: null, event_anchor: null };
    expect(() => api.validateExtractor("next_contact_date_extractor", value, true)).not.toThrow();
    for (const event_anchor of [{ raw_time_expression: "завтра", offset_minutes: -60 }, { raw_time_expression: "завтра", evidence: "", offset_minutes: -60 }, { raw_time_expression: "завтра", evidence: "Завтра", offset_minutes: -.5 }])
      expect(() => api.validateExtractor("next_contact_date_extractor", { ...value, event_anchor }, true)).toThrow();
    expect(() => api.validateExtractor("next_contact_date_extractor", { ...value, normalization_status: "missing_reference" }, true)).toThrow();
  });
  it("a rejected event relation is never saved or presented as an approved pending agreement", () => {
    const { api } = runtime(), inputs = determined();
    inputs.next_contact_date = { ...inputs.next_contact_date, next_contact_at: null, normalization_status: "unresolved" };
    const { crm } = pipeline(api, inputs, (_, verdicts) => verdicts.next_contact_date.verdict = "rejected");
    expect(crm.pending_attributes).toEqual([]);
    expect(crm.blocked_attributes).toContain("next_contact_date");
    expect(crm.update_actions.next_contact_date).toBe("SKIP");
  });
});

function relativeRuntime() {
  const context = { window: {} as Record<string, any>, AbortController, setTimeout, clearTimeout };
  runInNewContext(readFileSync(resolve("public/ai-application-attributes-runtime-v29.js"), "utf8"), context);
  return context.window.ApplicationAttributesRuntime;
}
describe("Относительные договорённости без выдуманного года", () => {
  it.each([
    ["завтра в 15:00", -60, "завтра в 14:00", 1],
    ["завтра в 00:30", -60, "сегодня в 23:30", 0],
    ["сегодня в 23:30", 60, "завтра в 00:30", 1],
    ["послезавтра в 15:00", -90, "послезавтра в 13:30", 2],
    ["завтра в 3 дня", -60, "завтра в 14:00", 1],
  ])("normalizes %s offset %s without inventing a calendar date", (raw, minutes, label, day) => {
    expect(relativeRuntime().relativeTime(raw, minutes)).toMatchObject({ label, day_offset: day, calendar_date_known: false, reference: "conversation_day" });
  });
  it.each(["завтра", "завтра вечером", "завтра в 15:00 или 17:00", "завтра в 15:00–16:00", "завтра примерно в 15:00", "27 сентября в 15:00", "если получится завтра в 15:00"])("does not invent a precise relative time for %s", raw => {
    expect(relativeRuntime().relativeTime(raw, -60)).toBeNull();
  });
  it("keeps meeting and callback separate without a reference timestamp", () => {
    expect(relativeRuntime().relativeSchedule({ status: "missing_reference", event_anchor: { raw_time_expression: "завтра в 15:00", offset_minutes: -60 } })).toMatchObject({ event: { label: "завтра в 15:00" }, contact: { label: "завтра в 14:00" } });
  });
  it("requires the server version to match before a run", async () => {
    const runtime = relativeRuntime();
    expect(await runtime.checkVersion(async () => ({ ok: true, json: async () => ({ revision: 33 }) }))).toMatchObject({ current: true });
    expect(await runtime.checkVersion(async () => ({ ok: true, json: async () => ({ revision: 34 }) }))).toMatchObject({ current: false, loaded_revision: 33, available_revision: 34 });
    await expect(runtime.checkVersion(async () => ({ ok: false }))).rejects.toThrow("VERSION_CHECK_UNAVAILABLE");
  });
});

describe("Контекст для уточнения сохраняется отдельно от подтверждённых значений", () => {
  const transcript = "Клиент: Реально ли семейную ипотеку нам оформить? Нет, ещё не одобряли.\nАгент: Одобрение нужно до 30 сентября.\nКлиент: Поняла.";
  const context = { summary: "Рассматривает семейную ипотеку", evidence: ["Реально ли семейную ипотеку нам оформить?"], limitation: "Подача заявки не подтверждена" };
  function review(fault?: string) {
    const { api } = runtime(), values = absent();
    values.funding_source.context = structuredClone(context);
    values.purchase_term.context = { summary: "Ипотечное одобрение — до 30 сентября", evidence: ["Одобрение нужно до 30 сентября."], limitation: "Срок покупки клиент не подтвердил" };
    const inputs = Object.fromEntries(api.keys.map((key: string) => [key, { status: "ready", result: values[key] }]));
    const verdicts: any = Object.fromEntries(api.keys.map((key: string) => [key, { status: "not_determined", verdict: "not_determined", reason: "Нет подтверждённого значения", ...(key === "next_contact_date" ? { corrected_value: null } : {}), ...(["funding_source", "purchase_term"].includes(key) ? { context_verdict: "accepted", context_reason: "Цитаты проверены" } : {}) }]));
    if (fault === "rejected") verdicts.funding_source.context_verdict = "rejected";
    if (fault === "invented_quote") {
      values.funding_source.context.evidence = ["Подали заявку вчера, банк рассматривает"];
      verdicts.funding_source.context_verdict = "rejected";
    }
    if (fault === "added_value") verdicts.funding_source.value = "ипотека в процессе";
    const judge = api.judgeResult(verdicts, inputs, transcript);
    return { api, judge, crm: api.crm(api.gate(judge)) };
  }
  it("passes reviewed context through Judge → Gate → CRM without setting unsupported enum values", () => {
    const { crm } = review();
    expect(crm.attribute_context.funding_source).toEqual(context);
    expect(crm.attribute_context.purchase_term.summary).toContain("30 сентября");
    expect(crm.attributes.funding_source).toBeNull();
    expect(crm.attributes.purchase_term).toBeNull();
    expect(crm.update_actions.funding_source).toBe("SKIP");
    expect(crm.update_actions.purchase_term).toBe("SKIP");
  });
  it.each(["rejected", "invented_quote", "added_value"])("isolates %s; another attribute's context survives", fault => {
    const { crm, judge } = review(fault);
    expect(crm.attribute_context.funding_source).toBeNull();
    expect(crm.attribute_context.purchase_term.summary).toContain("30 сентября");
    if (fault === "invented_quote") expect(judge.context_validation_errors.funding_source).toBeUndefined();
  });
  it("проверяет структуру context без повторной проверки смысла цитат", () => {
    const { api } = runtime();
    for (const value of [absent().funding_source, { ...determined().funding_source, context }, { status: "explicitly_declined", value: null, evidence: "Не хочу говорить", context }])
      expect(() => api.validateExtractor("funding_source_extractor", value, true)).toThrow();
    expect(() => api.validateExtractor("funding_source_extractor", { ...absent().funding_source, context: { ...context, evidence: [] } }, true)).not.toThrow();
    expect(() => api.validateExtractor("funding_source_extractor", { ...absent().funding_source, context: null }, true)).not.toThrow();
  });
  it("exports relative event and contact in CRM even without a calendar date", () => {
    const { api } = runtime(), values = determined();
    values.next_contact_date = { ...values.next_contact_date, next_contact_at: null, normalization_status: "missing_reference", event_anchor: { raw_time_expression: "завтра в 15:00", evidence: "Завтра в 15:00, за час позвоню", offset_minutes: -60 } };
    const { crm } = pipeline(api, values);
    expect(crm.attributes.next_contact_date).toBeNull();
    expect(crm.next_contact_schedule).toMatchObject({ event: { time: "15:00", calendar_date_known: false }, contact: { time: "14:00", reference: "conversation_day" } });
  });
});

describe("Актуальный справочник интереса: шесть направлений", () => {
  it("preserves all six confirmed directions through Extractor → Judge → Gate → CRM", () => {
    const { api } = runtime(), candidates = determined();
    candidates.interest = { ...candidates.interest, value: [...api.interest], evidence: api.interest.map((value: string) => `Клиент: Меня интересует ${value}`) };
    const { crm } = pipeline(api, candidates);
    expect(crm.attributes.interest).toBeNull();
    expect(crm.interest_operations.add).toEqual(["Новостройки", "Ипотека", "Инвестиции в регионах", "Безопасность сделок", "Юридическое сопровождение", "Строительство"]);
    expect(crm.update_actions.interest).toBe("ADD");
  });
  it("keeps a legal-services refusal separate from confirmed investment and safety interests", () => {
    const { api } = runtime(), candidates = determined();
    candidates.interest = { status: "determined", value: ["Инвестиции в регионах", "Безопасность сделок"], evidence: ["Ищу инвестиции в регионах", "Нужна безопасность расчётов"], declined_values: ["Юридическое сопровождение"], decline_evidence: ["Юридическое сопровождение не нужно"] };
    const { crm } = pipeline(api, candidates);
    expect(crm.attributes.interest).toBeNull();
    expect(crm.interest_operations).toEqual({ add: candidates.interest.value, remove: ["Юридическое сопровождение"], keep: false });
    expect(crm.declined_interest_values).toEqual(["Юридическое сопровождение"]);
  });
});


describe("Встреча и контекст часа v33", () => {
  it("передаёт подтверждённую встречу через Judge/Gate/CRM и не заменяет её fallback", () => {
    const { api } = runtime(), values = absent();
    values.interest = determined().interest;
    values.next_contact_date = { ...determined().next_contact_date, action: "meeting", event_anchor: null,
      next_contact_at: "2026-09-30T16:00:00+03:00", raw_time_expression: "в среду в 16:00" };
    expect(() => api.validateExtractor("next_contact_date_extractor", { ...values.next_contact_date, next_contact_at: null }, true)).not.toThrow();
    const { judge, gate } = pipeline(api, values);
    const crm = api.crm(api.applySystemFallback(gate, "2026-09-28T11:13:58+03:00"));
    for (const result of [judge, gate, crm]) expect(result.next_contact_resolution.action).toBe("meeting");
    expect(crm.attributes).toEqual({ interest: null, funding_source: null, purchase_term: null, next_contact_date: "2026-09-30T16:00:00+03:00" });
    expect(crm.update_actions).toEqual({ interest: "ADD", funding_source: "SKIP", purchase_term: "SKIP", next_contact_date: "SET" });
  });
  it.each([
    ["завтра в 4:00", null], ["завтра в 4", null], ["завтра в 4:00 через 2 дня", null],
    ["завтра в 04:00", "завтра в 04:00"], ["завтра в 4 утра", "завтра в 04:00"],
    ["завтра в 4 дня", "завтра в 16:00"], ["завтра в 4:00 вечера", "завтра в 16:00"],
    ["завтра в 16:00", "завтра в 16:00"], ["завтра в 12 ночи", "завтра в 00:00"],
  ])("не угадывает период суток для %s", (raw, expected) => {
    expect(relativeRuntime().relativeTime(raw)?.label ?? null).toBe(expected);
  });
});
