import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

function contract() {
  const context = { window: {} as Record<string, any>, Date };
  runInNewContext(readFileSync(resolve("public/ai-application-attributes-contract-v2.js"), "utf8"), context);
  return context.window.ApplicationAttributesV2;
}

const absent = (): Record<string, any> => ({
  interest: { status: "not_determined", value: null, evidence: [], declined_values: [], decline_evidence: [] },
  funding_source: { status: "not_determined", value: null, evidence: "", context: null },
  purchase_term: { status: "not_determined", value: null, evidence: "", context: null },
  next_contact_date: { status: "not_determined", detected: false, next_contact_at: null, precision: "none", action: "none", actor: "none", raw_time_expression: null, evidence: null, confidence: 0, event_anchor: null, normalization_status: "not_applicable" },
});

function inputs(values = absent()) {
  return Object.fromEntries(Object.entries(values).map(([key, result]) => [key, { status: "ready", result }]));
}

function verdicts(values = absent()) {
  return Object.fromEntries(Object.entries(values).map(([key, value]: [string, any]) => [key, {
    verdict: value.status === "not_determined" ? "not_determined" : "accepted",
    status: value.status, reason: "Подтверждено",
    ...(key === "next_contact_date" ? { corrected_value: null } : {}),
    ...(["funding_source", "purchase_term"].includes(key) ? { context_verdict: "not_present", context_reason: "" } : {}),
  }]));
}

describe("контракт AI Attributes", () => {
  it("принимает несколько Interest с несколькими подтверждающими цитатами", () => {
    const api = contract(), values = absent();
    values.interest = { status: "determined", value: ["Новостройки", "Ипотека"],
      evidence: ["Цитата о строящемся доме", "Цитата о просмотре", "Вопрос об ипотеке", "Ответ агента", "Уточнение клиента"],
      declined_values: [], decline_evidence: [] };
    expect(api.validateExtractor("interest_extractor", values.interest)).toBeTruthy();
    const judge = api.judgeResult(verdicts(values), inputs(values));
    expect(judge.validation_errors).toEqual({});
    expect(api.gate(judge).decisions.interest).toBe("AUTO_SAVE");
  });

  it.each(["interest", "funding_source", "purchase_term"])("подтверждённое отсутствие %s не становится technical_error", key => {
    const api = contract(), values = absent(), decisions = verdicts(values);
    decisions[key].verdict = "accepted";
    const judge = api.judgeResult(decisions, inputs(values));
    expect(judge.validation_errors).toEqual({});
    expect(judge.judge_verdicts[key]).toBe("not_determined");
    expect(api.gate(judge).decisions[key]).toBe("DO_NOT_UPDATE");
  });

  it("сохраняет явный отказ Interest без изменения других атрибутов", () => {
    const api = contract(), values = absent();
    values.interest = { status: "explicitly_declined", value: null, evidence: ["Ипотека не нужна"], declined_values: ["Ипотека"], decline_evidence: ["Ипотека не нужна"] };
    const judge = api.judgeResult(verdicts(values), inputs(values));
    const gate = api.gate(judge);
    expect(gate.decisions.interest).toBe("SAVE_DECLINED");
    expect(gate.declined_interest_values).toEqual(["Ипотека"]);
    expect(gate.decisions.funding_source).toBe("DO_NOT_UPDATE");
  });

  it("принимает один Interest с одной цитатой", () => {
    const api=contract(), values=absent();
    values.interest={status:"determined",value:["Новостройки"],evidence:["Хочу посмотреть строящийся объект"],declined_values:[],decline_evidence:[]};
    expect(api.gate(api.judgeResult(verdicts(values),inputs(values))).decisions.interest).toBe("AUTO_SAVE");
  });

  it.each([
    ["funding_source","наличные / депозит"],["funding_source","ипотека одобрена"],
    ["funding_source","ипотека в процессе"],["funding_source","продажа своей квартиры"],
    ["purchase_term","до 1 месяца"],["purchase_term","2–3 месяца"],
    ["purchase_term","3–6 месяцев"],["purchase_term","более 6 месяцев"],
  ])("сохраняет определённое %s: %s", (key,value) => {
    const api=contract(),values=absent();
    values[key]={status:"determined",value,evidence:"Подтверждающая цитата",context:null};
    const judge=api.judgeResult(verdicts(values),inputs(values));
    const gate=api.gate(judge);
    expect(judge.validation_errors).toEqual({});
    expect(gate.decisions[key]).toBe("AUTO_SAVE");
    expect(api.crm(gate).attributes[key]).toBe(value);
  });

  it("отклонение пропущенного значения остаётся отказом Judge, а не ошибкой", () => {
    const api=contract(),values=absent(),decisions=verdicts(values);
    decisions.funding_source.verdict="rejected";
    const judge=api.judgeResult(decisions,inputs(values));
    expect(judge.validation_errors).toEqual({});
    expect(judge.judge_verdicts.funding_source).toBe("rejected");
    expect(api.gate(judge).decisions.funding_source).toBe("DO_NOT_UPDATE");
  });

  it("техническая ошибка Interest изолирована от остальных", () => {
    const api=contract(),values=absent(),source=inputs(values);
    source.interest={status:"technical_error",immutable:true,source:"interest_extractor",error_code:"PROVIDER_ERROR"};
    const judge=api.judgeResult(verdicts(values),source),gate=api.gate(judge),crm=api.crm(gate);
    expect(gate.decisions.interest).toBe("TECHNICAL_ERROR");
    expect(crm.update_actions.interest).toBe("ERROR");
    expect(crm.update_actions.funding_source).toBe("SKIP");
    expect(crm.update_actions.purchase_term).toBe("SKIP");
  });
});
