import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

function contract() {
  const context = { window: {} as Record<string, any>, Date };
  runInNewContext(readFileSync(resolve("public/ai-application-attributes-contract-v2.js"), "utf8"), context);
  return context.window.ApplicationAttributesV2;
}

const noTime = (action: "callback" | "message") => ({
  status: "determined", detected: true, next_contact_at: null, precision: "none", action,
  actor: "agent", raw_time_expression: null, evidence: "Я тогда свяжусь с ней и вам перезвоню.",
  confidence: .9, event_anchor: null,
});

const absent = () => ({
  status: "not_determined", detected: false, next_contact_at: null, precision: "none",
  action: "none", actor: "none", raw_time_expression: null, evidence: null,
  confidence: 0, event_anchor: null,
});

describe("контракт Next Contact v4", () => {
  it.each(["callback", "message"] as const)("принимает подтверждённый %s без времени", action => {
    const api = contract(), candidate = noTime(action);
    expect(api.validateExtractor("next_contact_date_extractor", candidate, true)).toBe(candidate);
    const normalized = { ...candidate, normalization_status: "unresolved" };
    expect(api.validateExtractor("next_contact_date_extractor", normalized)).toBe(normalized);

    const inputs = Object.fromEntries(api.keys.map((key: string) => [key, {
      status: "ready", result: key === "next_contact_date" ? normalized : key === "interest"
        ? { status: "not_determined", value: null, evidence: [], declined_values: [], decline_evidence: [] }
        : { status: "not_determined", value: null, evidence: "", context: null },
    }]));
    const verdicts = Object.fromEntries(api.keys.map((key: string) => [key, {
      verdict: key === "next_contact_date" ? "accepted" : "not_determined",
      status: key === "next_contact_date" ? "determined" : "not_determined", reason: "Подтверждено",
      ...(key === "next_contact_date" ? { corrected_value: null } : {}),
      ...(key === "funding_source" || key === "purchase_term" ? { context_verdict: "not_present", context_reason: "" } : {}),
    }]));
    const judge = api.judgeResult(verdicts, inputs);
    const gate = api.gate(judge);
    const crm = api.crm(gate);
    expect(judge.validation_errors).toEqual({});
    expect(judge.judge_verdicts.next_contact_date).toBe("accepted");
    expect(gate.pending_attributes).toEqual(["next_contact_date"]);
    expect(gate.technical_errors).toEqual([]);
    expect(gate.next_contact_resolution).toMatchObject({ status: "unresolved", action, raw_time_expression: null });
    expect(crm.attributes.next_contact_date).toBeNull();
    expect(crm.update_actions.next_contact_date).toBe("SKIP");
    const fallback = api.crm(api.applySystemFallback(gate, "2026-09-28T10:00:00+03:00"));
    expect(fallback.update_actions.next_contact_date).toBe("KEEP_FALLBACK");
    expect(fallback.pending_attributes).toEqual(["next_contact_date"]);
    expect(fallback.next_contact_resolution).toMatchObject({ status: "unresolved", action });
  });

  it("сохраняет отсутствие контакта валидным", () => {
    const api = contract(), candidate = absent();
    expect(api.validateExtractor("next_contact_date_extractor", candidate, true)).toBe(candidate);
    expect(api.validateExtractor("next_contact_date_extractor", { ...candidate, normalization_status: "not_applicable" })).toBeTruthy();
  });

  it("определяет клиента по дословной цитате и принимает callback на выходных", () => {
    const api = contract();
    const raw = { ...noTime("callback"), actor: "none", precision: "range", raw_time_expression: "на выходных",
      evidence: "Ну тогда на выходных, наверное, я вам позвоню, чтобы... Или как?", confidence: .86 };
    const transcript = "Клиент:\n— Ну тогда на выходных, наверное, я вам позвоню, чтобы... Или как?\n"
      + "Агент:\n— Звоните в любое время, когда удобно. Я всегда на связи.";
    const semantic = api.normalizeNextContactActor(raw, transcript);
    expect(semantic).toMatchObject({ actor: "client", precision: "range", confidence: .86 });
    expect(api.validateExtractor("next_contact_date_extractor", semantic, true)).toBe(semantic);
    expect(api.validateExtractor("next_contact_date_extractor", { ...semantic, normalization_status: "unresolved" })).toBeTruthy();
    expect(api.normalizeNextContactActor(raw, "Клиент: Неясная короткая реплика.")).toBe(raw);
  });

  it("берёт инициатора из последней подтверждённой договорённости", () => {
    const api = contract();
    const raw = {
      ...noTime("callback"),
      actor: "client",
      evidence: "Агент: «Сейчас перезвоню вам». Клиент: «Хорошо»",
    };
    const transcript = [
      "Агент: Тогда перезвоню вам чуть-чуть попозже.",
      "Клиент: Хорошо.",
      "Агент: Сейчас перезвоню вам.",
      "Клиент: Хорошо.",
    ].join("\n");

    expect(api.normalizeNextContactActor(raw, transcript)).toMatchObject({
      actor: "agent",
      next_contact_at: null,
      precision: "none",
      raw_time_expression: null,
    });
  });

  it("передаёт спорную точность Judge без технической ошибки parser", () => {
    const api = contract();
    const weekend = { ...noTime("callback"), actor: "client", precision: "daypart", raw_time_expression: "на выходных" };
    expect(api.validateExtractor("next_contact_date_extractor", weekend, true)).toBe(weekend);
    const tomorrow = { ...noTime("callback"), precision: "date", raw_time_expression: "завтра" };
    expect(api.validateExtractor("next_contact_date_extractor", tomorrow, true)).toBe(tomorrow);
  });

  it("позволяет Judge исправить очевидный вид подтверждённого контакта", () => {
    const api = contract();
    const source = { ...noTime("message"), next_contact_at: "2026-09-28T18:30:00+03:00", precision: "exact",
      raw_time_expression: "18:30", evidence: "В 18:30 могу быть на месте. Давайте 18:30. Тогда буду вас ждать.", normalization_status: "resolved" };
    const corrected = { ...source, action: "meeting", confidence: .95 };
    delete corrected.normalization_status;
    const inputs = Object.fromEntries(api.keys.map((key: string) => [key, {
      status: "ready", result: key === "next_contact_date" ? source : key === "interest"
        ? { status: "not_determined", value: null, evidence: [], declined_values: [], decline_evidence: [] }
        : { status: "not_determined", value: null, evidence: "", context: null },
    }]));
    const verdicts = Object.fromEntries(api.keys.map((key: string) => [key, key === "next_contact_date"
      ? { verdict: "corrected", status: "determined", reason: "Согласована встреча", corrected_value: corrected }
      : { verdict: "not_determined", status: "not_determined", reason: "Не определено",
          ...(key === "funding_source" || key === "purchase_term" ? { context_verdict: "not_present", context_reason: "" } : {}) }]));
    const judge = api.judgeResult(verdicts, inputs);
    const gate = api.gate(judge);
    const crm = api.crm(gate);
    expect(judge.validation_errors).toEqual({});
    expect(judge.judge_verdicts.next_contact_date).toBe("corrected");
    expect(judge.attributes.next_contact_date).toMatchObject({ detected: true, action: "meeting", actor: "agent", raw_time_expression: "18:30", next_contact_at: "2026-09-28T18:30:00+03:00" });
    expect(gate.decisions.next_contact_date).toBe("AUTO_SAVE");
    expect(crm.update_actions.next_contact_date).toBe("SET");
  });

  it.each(["exact", "date", "daypart", "range"])("сохраняет контракт времени %s", precision => {
    const api = contract();
    const semantic = { ...noTime("callback"), precision, raw_time_expression: "завтра в 15:00" };
    expect(api.validateExtractor("next_contact_date_extractor", semantic, true)).toBe(semantic);
    const normalized = { ...semantic, next_contact_at: precision === "exact" ? "2026-09-28T15:00:00+03:00" : null,
      normalization_status: precision === "exact" ? "resolved" : "unresolved" };
    expect(api.validateExtractor("next_contact_date_extractor", normalized)).toBe(normalized);
  });

  it("сохраняет смещение callback на час до встречи", () => {
    const api = contract();
    const semantic = { ...noTime("callback"), precision: "exact", raw_time_expression: "за час до встречи",
      event_anchor: { raw_time_expression: "завтра в 15:00", evidence: "Встреча завтра в 15:00", offset_minutes: -60 } };
    expect(api.validateExtractor("next_contact_date_extractor", semantic, true)).toBe(semantic);
    const normalized = { ...semantic, next_contact_at: "2026-09-28T14:00:00+03:00", normalization_status: "resolved" };
    expect(api.validateExtractor("next_contact_date_extractor", normalized)).toBe(normalized);
  });

  it("не принимает отсутствие времени без цитаты или с посторонним временем", () => {
    const api = contract();
    expect(() => api.validateExtractor("next_contact_date_extractor", { ...noTime("callback"), evidence: " " }, true)).toThrow("evidence: contact evidence required");
    expect(() => api.validateExtractor("next_contact_date_extractor", { ...noTime("callback"), raw_time_expression: "суббота в 11:00" }, true)).toThrow("precision: incomplete contact without time");
  });
});
