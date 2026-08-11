import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import fixtures from "./fixtures/ai-summary-10-08-outcome-determinism.json";

type Outcome = {
  call_result: string;
  agreement: string;
  next_step: string;
  responsible_party: string;
  deadline: string;
  channel: string;
};

type JudgeOutput = {
  verified_facts: unknown[];
  verified_quotes: string[];
  verified_needs: { primary_need: string; requirements: string[]; preferences: string[]; objections: string[]; unresolved_questions: string[] };
  verified_outcome: Outcome;
  decisions: { facts: string; needs: string; outcome: string };
  issues: string[];
};

type Guard = {
  validateConversationJudge(output: JudgeOutput, input: { transcript: string; outcomeExtractor: Outcome }): { output: JudgeOutput; audit: Record<string, unknown> };
  applySummaryJudgeEvidence(output: Record<string, unknown>, input: { transcript: string; outcomeExtractor: Outcome; cleanOutcome: Outcome; summary: Record<string, unknown> }): { output: Record<string, any>; audit: Record<string, any> };
};

function loadGuard(): Guard {
  const context = { window: {} as Record<string, unknown> };
  runInNewContext(readFileSync(resolve(process.cwd(), "public", "ai-summary-10-08-conversation-judge-v5.js"), "utf8"), context);
  return context.window.__AI_SUMMARY_10_08_CONVERSATION_JUDGE_V5__ as Guard;
}

const guard = loadGuard();
const emptyOutcome = (): Outcome => ({ call_result: "", agreement: "", next_step: "", responsible_party: "", deadline: "", channel: "" });
const judge = (outcome: Outcome): JudgeOutput => ({
  verified_facts: [], verified_quotes: [],
  verified_needs: { primary_need: "", requirements: [], preferences: [], objections: [], unresolved_questions: [] },
  verified_outcome: outcome,
  decisions: { facts: "approve", needs: "approve", outcome: "approve" }, issues: [],
});
const run = (transcript: string, source: Outcome, proposed: Outcome = source) => guard.validateConversationJudge(judge(proposed), { transcript, outcomeExtractor: source });

describe("AI Summary 10.08 Conversation Judge v5 deterministic outcome evidence", () => {
  it("proposal_without_confirmation_does_not_create_agreement", () => {
    const transcript = "Агент:\n— Я могу завтра вам перезвонить.";
    const proposed = { ...emptyOutcome(), agreement: "Агент перезвонит", next_step: "Агент перезвонит", responsible_party: "agent", deadline: "завтра", channel: "телефон" };
    expect(run(transcript, emptyOutcome(), proposed).output.verified_outcome).toEqual(emptyOutcome());
  });

  it("model_recovery_reason_is_removed_when_guard_rejects_recovery", () => {
    const transcript = "Агент:\n— Я могу завтра вам перезвонить.";
    const proposed = { ...emptyOutcome(), agreement: "Агент перезвонит", next_step: "Агент перезвонит", responsible_party: "agent", deadline: "завтра", channel: "телефон" };
    const output = judge(proposed);
    output.issues = ["RECOVERED_FROM_EXPLICIT_CONFIRMATION: модель предположила согласие", "Модель восстановила outcome (RECOVERED_FROM_EXPLICIT_CONFIRMATION)"];
    expect(guard.validateConversationJudge(output, { transcript, outcomeExtractor: emptyOutcome() }).output.issues.join(" ")).not.toContain("RECOVERED_FROM_EXPLICIT_CONFIRMATION");
  });

  it("unsupported_action_claim_is_removed_from_call_result", () => {
    const transcript = "Агент:\n— Я могу завтра вам перезвонить.\nКлиент:\n— Не знаю, пока не могу сказать.";
    const proposed = { ...emptyOutcome(), call_result: "Согласовано, что агент перезвонит завтра для назначения просмотра", agreement: "Агент перезвонит клиенту завтра", next_step: "Агент перезвонит клиенту", responsible_party: "agent", deadline: "завтра", channel: "телефон" };
    expect(run(transcript, proposed, proposed).output.verified_outcome).toEqual({
      call_result: "Просмотр не назначен; подтверждённой договорённости о следующем шаге нет",
      agreement: "", next_step: "", responsible_party: "", deadline: "", channel: "",
    });
  });

  it("explicit_confirmation_allows_recovery", () => {
    const transcript = "Агент:\n— Я вам завтра позвоню.\nКлиент:\n— Да, хорошо.";
    const result = run(transcript, emptyOutcome());
    expect(result.output.verified_outcome).toMatchObject({ agreement: "Агент позвонит клиенту", next_step: "Агент позвонит клиенту", responsible_party: "agent", deadline: "завтра", channel: "телефон" });
    expect(result.audit).toMatchObject({ recovery_reason: "RECOVERED_FROM_EXPLICIT_CONFIRMATION" });
  });

  it("ambiguous_confirmation_does_not_create_agreement", () => {
    const transcript = "Агент:\n— Давайте я вам завтра перезвоню.\nНеизвестный спикер:\n— Дава... не слышно.";
    expect(run(transcript, emptyOutcome()).output.verified_outcome).toEqual(emptyOutcome());
  });

  it("deadline_without_direct_binding_is_removed", () => {
    const fixture = fixtures.report_96_97;
    expect(run(fixture.transcript, fixture.outcome_extractor).output.verified_outcome).toMatchObject({ next_step: fixture.outcome_extractor.next_step, deadline: "" });
  });

  it("channel_without_direct_binding_is_removed", () => {
    const source = { ...emptyOutcome(), agreement: "Агент отправит информацию", next_step: "Агент отправит информацию", responsible_party: "agent", channel: "Telegram" };
    const transcript = "Агент:\n— Я отправлю вам информацию.\nКлиент:\n— Хорошо.";
    expect(run(transcript, source).output.verified_outcome.channel).toBe("");
  });

  it("responsible_party_without_direct_binding_is_removed", () => {
    const source = { ...emptyOutcome(), agreement: "Созвонимся", next_step: "Созвонимся", responsible_party: "agent", channel: "телефон" };
    const transcript = "Неизвестный спикер:\n— Созвонимся завтра.\nКлиент:\n— Хорошо.";
    expect(run(transcript, source).output.verified_outcome).toMatchObject({ agreement: "", next_step: "", responsible_party: "" });
  });

  it("later_agreement_overrides_earlier", () => {
    const transcript = "Агент:\n— Я позвоню вам завтра.\nКлиент:\n— Хорошо.\nКлиент:\n— Лучше я сама вам напишу в Telegram.\nАгент:\n— Да, договорились.";
    expect(run(transcript, emptyOutcome()).output.verified_outcome).toMatchObject({ next_step: "Клиент напишет агенту", responsible_party: "client", deadline: "", channel: "Telegram" });
  });

  it("same_input_5_runs_same_business_outcome", () => {
    const fixture = fixtures.report_94_95;
    const values = Array.from({ length: 5 }, () => run(fixture.transcript, fixture.outcome_extractor).output.verified_outcome);
    expect(new Set(values.map(JSON.stringify)).size).toBe(1);
  });

  it("report_94_95_regression", () => {
    const fixture = fixtures.report_94_95;
    expect(run(fixture.transcript, fixture.outcome_extractor).output.verified_outcome).toEqual({
      call_result: "Просмотр не назначен; подтверждённой договорённости о следующем шаге нет",
      agreement: "", next_step: "", responsible_party: "", deadline: "", channel: "",
    });
  });

  it("report_96_97_deadline_regression", () => {
    const fixture = fixtures.report_96_97;
    const values = Array.from({ length: 5 }, () => run(fixture.transcript, fixture.outcome_extractor).output.verified_outcome.deadline);
    expect(values).toEqual(["", "", "", "", ""]);
  });

  it("report_92_positive_regression", () => {
    const fixture = fixtures.report_92_positive;
    expect(run(fixture.transcript, fixture.outcome_extractor).output.verified_outcome).toMatchObject({ responsible_party: "agent", deadline: "сегодня или завтра", channel: "WhatsApp" });
  });

  it("report_98_positive_regression", () => {
    const fixture = fixtures.report_98_positive;
    expect(run(fixture.transcript, fixture.outcome_extractor).output.verified_outcome).toEqual(fixture.outcome_extractor);
  });

  it("case_1_preserves_confirmed_clarify_and_call_without_semantic_compression", () => {
    const transcript = "Агент:\n— Сейчас уточню у собственника и перезвоню вам.\nКлиент:\n— Хорошо.";
    const outcome = { ...emptyOutcome(), call_result: "Агент уточнит возможность показа и перезвонит клиенту", agreement: "Агент уточнит у собственника возможность показа и перезвонит клиенту", next_step: "Агент уточнит у собственника возможность показа и перезвонит клиенту", responsible_party: "agent", channel: "телефон" };
    const result = run(transcript, outcome);
    expect(result.output.verified_outcome).toEqual(outcome);
    expect(result.audit).toMatchObject({
      fields: { agreement: "SUPPORTED", next_step: "SUPPORTED", responsible_party: "SUPPORTED", deadline: "NOT_APPLICABLE", channel: "SUPPORTED" },
      event: { primary_action: "clarify", communication_action: "call", responsible_party: "agent", channel: "телефон" },
      changed: false,
    });
  });

  it("case_2_preserves_compound_action_and_direct_deadline", () => {
    const transcript = "Агент:\n— Уточню торг и завтра вам перезвоню.\nКлиент:\n— Хорошо.";
    const outcome = { ...emptyOutcome(), agreement: "Агент уточнит возможность торга и перезвонит клиенту завтра", next_step: "Агент уточнит возможность торга и перезвонит клиенту завтра", responsible_party: "agent", deadline: "завтра", channel: "телефон" };
    expect(run(transcript, outcome).output.verified_outcome).toEqual(outcome);
  });

  it("case_3_preserves_select_and_send_with_MAX_channel", () => {
    const transcript = "Агент:\n— Подберу варианты и отправлю вам в MAX.\nКлиент:\n— Да.";
    const outcome = { ...emptyOutcome(), agreement: "Агент подберёт варианты и отправит их клиенту в MAX", next_step: "Агент подберёт варианты и отправит их клиенту в MAX", responsible_party: "agent", channel: "MAX" };
    const result = run(transcript, outcome);
    expect(result.output.verified_outcome).toEqual(outcome);
    expect(result.audit).toMatchObject({ event: { primary_action: "select", communication_action: "send", channel: "MAX" }, changed: false });
  });

  it("case_4_preserves_simple_call_only_next_step", () => {
    const transcript = "Агент:\n— Я вам перезвоню.\nКлиент:\n— Хорошо.";
    const outcome = { ...emptyOutcome(), agreement: "Агент перезвонит клиенту", next_step: "Агент перезвонит клиенту", responsible_party: "agent", channel: "телефон" };
    expect(run(transcript, outcome).output.verified_outcome).toEqual(outcome);
  });

  it("case_5_does_not_accept_unconfirmed_compound_proposal", () => {
    const transcript = "Агент:\n— Я могу уточнить и перезвонить.\nКлиент:\n— ...";
    const proposed = { ...emptyOutcome(), agreement: "Агент уточнит и перезвонит клиенту", next_step: "Агент уточнит и перезвонит клиенту", responsible_party: "agent", channel: "телефон" };
    expect(run(transcript, proposed).output.verified_outcome).toEqual(emptyOutcome());
  });

  it("case_6_empty_deadline_is_not_unsupported", () => {
    const transcript = "Агент:\n— Я вам перезвоню.\nКлиент:\n— Хорошо.";
    const outcome = { ...emptyOutcome(), agreement: "Агент перезвонит клиенту", next_step: "Агент перезвонит клиенту", responsible_party: "agent", channel: "телефон" };
    const result = run(transcript, outcome);
    expect(result.output.verified_outcome.deadline).toBe("");
    expect(result.audit).toMatchObject({ fields: { deadline: "NOT_APPLICABLE" }, changed: false });
    expect(result.output.issues.join(" ")).not.toContain("UNSUPPORTED_DEADLINE");
  });

  it("case_7_removes_only_an_unsupported_middle_action", () => {
    const transcript = "Агент:\n— Уточню возможность показа и перезвоню вам.\nКлиент:\n— Хорошо.";
    const proposed = { ...emptyOutcome(), agreement: "Агент уточнит возможность показа, отправит документы и перезвонит", next_step: "Агент уточнит возможность показа, отправит документы и перезвонит", responsible_party: "agent", channel: "телефон" };
    const result = run(transcript, proposed);
    expect(result.output.verified_outcome).toMatchObject({
      agreement: "Агент уточнит возможность показа и перезвонит клиенту",
      next_step: "Агент уточнит возможность показа и перезвонит клиенту",
      responsible_party: "agent",
      deadline: "",
      channel: "телефон",
    });
    expect(result.audit).toMatchObject({ removed_actions: { agreement: ["send"], next_step: ["send"] }, changed: true });
  });

  it.each([
    {
      name: "check_and_write",
      transcript: "Агент:\n— Проверю документы и напишу вам в Telegram.\nКлиент:\n— Хорошо.",
      nextStep: "Агент проверит документы и напишет клиенту в Telegram",
      channel: "Telegram",
      primaryAction: "check",
      communicationAction: "write",
    },
    {
      name: "coordinate_and_notify",
      transcript: "Агент:\n— Согласую время и сообщу вам в MAX.\nКлиент:\n— Договорились.",
      nextStep: "Агент согласует время и сообщит клиенту в MAX",
      channel: "MAX",
      primaryAction: "coordinate",
      communicationAction: "write",
    },
    {
      name: "request_and_send",
      transcript: "Агент:\n— Запрошу документы и пришлю их вам.\nКлиент:\n— Да.",
      nextStep: "Агент запросит документы и пришлёт их клиенту",
      channel: "",
      primaryAction: "request",
      communicationAction: "send",
    },
  ])("preserves $name compound action", ({ transcript, nextStep, channel, primaryAction, communicationAction }) => {
    const outcome = { ...emptyOutcome(), agreement: nextStep, next_step: nextStep, responsible_party: "agent", channel };
    const result = run(transcript, outcome);
    expect(result.output.verified_outcome).toEqual(outcome);
    expect(result.audit).toMatchObject({ event: { primary_action: primaryAction, communication_action: communicationAction }, changed: false });
  });

  it("report_2026_08_11_165400_preserves_the_validated_compound_outcome", () => {
    const transcript = "Агент:\n— Я могу уточнить у собственника, когда девушка сможет показать апартаменты.\nКлиент:\n— Хорошо.\nАгент:\n— Да, давайте, сейчас уточню и перезвоню вам тогда, хорошо?\nКлиент:\n— Да, всё, тогда я жду звонка.";
    const source = { call_result: "Просмотр пока не назначен; агент уточнит возможность показа и перезвонит клиенту", agreement: "Агент уточнит у собственника, когда девочка сможет показать апартаменты, и перезвонит клиенту", next_step: "Агент уточнит у собственника возможность и время показа и перезвонит клиенту", responsible_party: "agent", deadline: "", channel: "телефон" };
    const proposed = { ...source, agreement: "Агент уточнит у собственника, когда девушка сможет показать апартаменты, и перезвонит клиенту" };
    const result = run(transcript, source, proposed);
    expect(result.output.verified_outcome).toEqual(proposed);
    expect(result.audit).toMatchObject({
      fields: { agreement: "SUPPORTED", next_step: "SUPPORTED", responsible_party: "SUPPORTED", deadline: "NOT_APPLICABLE", channel: "SUPPORTED" },
      event: { primary_action: "clarify", communication_action: "call", responsible_party: "agent", channel: "телефон" },
      changed: false,
    });
  });

  it.each([
    ["я вас понял", "Я вас понял."],
    ["угу", "Угу."],
    ["отлично", "Отлично."],
  ])("accepts contextual acknowledgement: %s", (_name, acknowledgement) => {
    const transcript = `Агент:\n— Я напишу вам и отправлю расчёт.\nКлиент:\n— ${acknowledgement}`;
    const outcome = { ...emptyOutcome(), agreement: "Агент напишет клиенту и отправит расчёт", next_step: "Агент напишет клиенту и отправит расчёт", responsible_party: "agent" };
    expect(run(transcript, outcome).output.verified_outcome).toEqual(outcome);
  });

  it("accepts thanks only after a repeated concrete commitment", () => {
    const transcript = "Агент:\n— Я напишу вам расчёт.\nКлиент:\n— Я вас понял.\nАгент:\n— Тогда повторю: напишу вам расчёт.\nКлиент:\n— Всё, спасибо.";
    const outcome = { ...emptyOutcome(), agreement: "Агент напишет клиенту расчёт", next_step: "Агент напишет клиенту расчёт", responsible_party: "agent" };
    expect(run(transcript, outcome).output.verified_outcome).toEqual(outcome);
  });

  it("does not treat silence or an unrelated continuation as acceptance", () => {
    const transcript = "Агент:\n— Я могу завтра вам написать.\nКлиент:\n— А какая площадь квартиры?";
    const proposed = { ...emptyOutcome(), agreement: "Агент напишет клиенту завтра", next_step: "Агент напишет клиенту завтра", responsible_party: "agent", deadline: "завтра" };
    expect(run(transcript, proposed).output.verified_outcome).toEqual(emptyOutcome());
  });

  it("keeps supported actions while clearing an ambiguous channel independently", () => {
    const transcript = "Агент:\n— Я напишу и отправлю фотографии и варианты. Можно в Telegram или MAX.\nКлиент:\n— Да, отлично, буду ждать.";
    const proposed = { ...emptyOutcome(), agreement: "Агент напишет клиенту и отправит фотографии и варианты", next_step: "Агент напишет клиенту и отправит фотографии и варианты", responsible_party: "agent", channel: "Telegram" };
    const result = run(transcript, proposed);
    expect(result.output.verified_outcome).toMatchObject({ agreement: proposed.agreement, next_step: proposed.next_step, responsible_party: "agent", channel: "" });
    expect(result.audit).toMatchObject({ fields: { agreement: "SUPPORTED", next_step: "SUPPORTED", responsible_party: "SUPPORTED", deadline: "NOT_APPLICABLE", channel: "AMBIGUOUS" } });
  });

  it("clears an unsupported deadline without clearing a supported agreement", () => {
    const transcript = "Агент:\n— Я вам напишу.\nКлиент:\n— Хорошо.";
    const proposed = { ...emptyOutcome(), agreement: "Агент напишет клиенту", next_step: "Агент напишет клиенту", responsible_party: "agent", deadline: "завтра" };
    const result = run(transcript, proposed);
    expect(result.output.verified_outcome).toMatchObject({ agreement: proposed.agreement, next_step: proposed.next_step, responsible_party: "agent", deadline: "" });
    expect(result.audit).toMatchObject({ fields: { agreement: "SUPPORTED", next_step: "SUPPORTED", deadline: "NOT_SUPPORTED" } });
  });

  it("a later cancellation removes the earlier confirmed plan", () => {
    const transcript = "Агент:\n— Я вам завтра позвоню.\nКлиент:\n— Хорошо.\nКлиент:\n— Не надо, я сам наберу.";
    const proposed = { ...emptyOutcome(), agreement: "Агент позвонит клиенту завтра", next_step: "Агент позвонит клиенту завтра", responsible_party: "agent", deadline: "завтра", channel: "телефон" };
    expect(run(transcript, proposed).output.verified_outcome).toEqual(emptyOutcome());
  });

  it("records an unconfirmed client intention without creating an agreement", () => {
    const transcript = "Агент:\n— Если будет актуально до пятницы, тогда я вам позвоню.\nКлиент:\n— Я в любом случае позвоню, а вы скажете, актуально или нет.";
    const result = run(transcript, emptyOutcome());
    expect(result.output.verified_outcome).toEqual(emptyOutcome());
    expect(result.output.issues).toContain("CLIENT_DECLARED_NEXT_ACTION");
    expect(result.audit).toMatchObject({ reasons: ["CLIENT_DECLARED_NEXT_ACTION"], fields: { agreement: "NOT_APPLICABLE", next_step: "NOT_APPLICABLE" } });
  });

  it("removes stale contradictory field issues before emitting final statuses", () => {
    const transcript = "Агент:\n— Я вам напишу.\nКлиент:\n— Я вас понял.";
    const outcome = { ...emptyOutcome(), agreement: "Агент напишет клиенту", next_step: "Агент напишет клиенту", responsible_party: "agent" };
    const output = judge(outcome);
    output.issues = ["Сохранён подтверждённый next step", "OUTCOME_NEXT_STEP: NOT_SUPPORTED"];
    const result = guard.validateConversationJudge(output, { transcript, outcomeExtractor: outcome });
    expect(result.audit).toMatchObject({ fields: { next_step: "SUPPORTED" } });
    expect(result.output.issues).toEqual(["Сохранён подтверждённый next step"]);
  });

  it("real report 171340 keeps the mortgage consultation next step identically in 5 runs", () => {
    const transcript = "Агент:\n— Мне нужно будет, я минут через 30 вам пару вопросиков напишу, чтобы ввести в курс дела управляющего.\nКлиент:\n— Я вас понял.\nАгент:\n— Всё, хорошо, тогда вам напишу.\nКлиент:\n— Угу.\nАгент:\n— Через 30–40 минут.\nКлиент:\n— Всё, спасибо тогда.";
    const source = { call_result: "Согласовано дальнейшее общение по вопросам новостроек", agreement: "Агент напишет клиенту и задаст уточняющие вопросы для подготовки дальнейшей консультации.", next_step: "Агент напишет клиенту через 30–40 минут, задаст уточняющие вопросы и передаст информацию управляющему для подготовки дальнейшей консультации.", responsible_party: "agent", deadline: "через 30–40 минут", channel: "телефон (сообщение/звонок)" };
    const proposed = { ...source, next_step: "Агент напишет клиенту, задаст уточняющие вопросы и передаст информацию управляющему для подготовки дальнейшей консультации." };
    const values = Array.from({ length: 5 }, () => run(transcript, source, proposed));
    expect(new Set(values.map(value => JSON.stringify(value.output.verified_outcome))).size).toBe(1);
    expect(values[0].output.verified_outcome).toEqual({ ...source, channel: "" });
    expect(values[0].audit).toMatchObject({ fields: { agreement: "SUPPORTED", next_step: "SUPPORTED", responsible_party: "SUPPORTED", deadline: "SUPPORTED", channel: "NOT_SUPPORTED" } });
  });

  it("real report 172300 keeps photos and variants agreement identically in 5 runs", () => {
    const transcript = "Агент:\n— Я вам вышлю. Вы есть MAX, в Telegram?\nКлиент:\n— Отлично, тогда да.\nАгент:\n— Я вам напишу, отправлю фотографии, дополнительно ещё пришлю варианты, которые можно будет рассмотреть.\nКлиент:\n— Ну да, было бы отлично.\nАгент:\n— Условия сотрудничества тоже вам напишу.\nКлиент:\n— Всё, тогда я на Максе жду. Угу. Благодарю.";
    const proposed = { call_result: "Агент подтвердил отправку фотографий и вариантов; просмотр не назначен", agreement: "Агент отправит фотографии объекта, дополнительные варианты и условия сотрудничества", next_step: "Агент пришлёт фотографии объекта, дополнительные варианты и условия сотрудничества", responsible_party: "agent", deadline: "", channel: "Telegram" };
    const values = Array.from({ length: 5 }, () => run(transcript, proposed));
    expect(new Set(values.map(value => JSON.stringify(value.output.verified_outcome))).size).toBe(1);
    expect(values[0].output.verified_outcome).toEqual({ ...proposed, channel: "" });
    expect(values[0].audit).toMatchObject({ fields: { agreement: "SUPPORTED", next_step: "SUPPORTED", responsible_party: "SUPPORTED", deadline: "NOT_APPLICABLE", channel: "AMBIGUOUS" } });
  });

  it("real report 172744 keeps agreement empty and records client declared action", () => {
    const transcript = "Агент:\n— Если будет ещё актуально до пятницы-субботы, тогда я вам позвоню.\nКлиент:\n— Я в любом вам случае позвоню, а вы мне уже скажете, актуально или нет? Хорошо.";
    const outcome = { ...emptyOutcome(), call_result: "Просмотр не назначен; дальнейшее действие не согласовано" };
    const result = run(transcript, outcome);
    expect(result.output.verified_outcome).toEqual(outcome);
    expect(result.audit).toMatchObject({ reasons: ["CLIENT_DECLARED_NEXT_ACTION"] });
  });
});

describe("AI Summary 10.08 Summary Judge evidence cap", () => {
  const baseScores = { faithfulness: 100, completeness: 100, usefulness: 100, agreements_next_step: 100, format: 100 };
  const summaryJudge = () => ({ scores: { ...baseScores }, quality_score: 100, confidence: 0.95, decision: "pass", issues: [] });
  const unsupportedInput = (nextStep: string) => ({ transcript: fixtures.report_94_95.transcript, outcomeExtractor: fixtures.report_94_95.outcome_extractor, cleanOutcome: { ...emptyOutcome(), agreement: "Агент перезвонит", next_step: "Агент перезвонит", responsible_party: "agent", deadline: "завтра", channel: "телефон" }, summary: { conversation_result: "Согласован повторный звонок.", key_facts: [], quotes: [], next_step: nextStep } });

  it("unsupported_agreement_is_critical", () => {
    const result = guard.applySummaryJudgeEvidence(summaryJudge(), unsupportedInput("Агент перезвонит клиенту завтра по телефону.")).output;
    expect(result.scores.agreements_next_step).toBeLessThanOrEqual(25);
    expect(result.issues.join(" ")).toContain("UNSUPPORTED_AGREEMENT");
  });

  it("unsupported_next_step_is_critical", () => {
    const result = guard.applySummaryJudgeEvidence(summaryJudge(), unsupportedInput("Агент перезвонит клиенту.")).output;
    expect(result.issues.join(" ")).toContain("UNSUPPORTED_NEXT_STEP");
  });

  it("negated_agreement_statement_is_not_critical", () => {
    const input = unsupportedInput("");
    input.cleanOutcome = emptyOutcome();
    input.summary = { conversation_result: "Просмотр не назначен, договорённостей нет; дальнейшие шаги не согласованы.", key_facts: [], quotes: [], next_step: "" };
    const result = guard.applySummaryJudgeEvidence(summaryJudge(), input).output;
    expect(result).toMatchObject({ scores: baseScores, quality_score: 100, decision: "pass", issues: [] });
  });

  it("an_unsupported_deadline_is_attribute_severity_75", () => {
    const transcript = "Агент:\n— Я вам перезвоню.\nКлиент:\n— Хорошо.";
    const cleanOutcome = { ...emptyOutcome(), agreement: "Агент перезвонит клиенту", next_step: "Агент перезвонит клиенту", responsible_party: "agent", channel: "телефон" };
    const result = guard.applySummaryJudgeEvidence(summaryJudge(), { transcript, outcomeExtractor: cleanOutcome, cleanOutcome, summary: { conversation_result: "Согласован звонок.", key_facts: [], quotes: [], next_step: "Агент перезвонит клиенту завтра." } }).output;
    expect(result.issues.join(" ")).toContain("UNSUPPORTED_DEADLINE");
    expect(result.scores.agreements_next_step).toBe(75);
    expect(result.decision).toBe("warning");
  });

  it("a_missing_confirmed_next_step_has_severity_50", () => {
    const transcript = "Агент:\n— Я вам напишу.\nКлиент:\n— Я вас понял.";
    const cleanOutcome = { ...emptyOutcome(), agreement: "Агент напишет клиенту", next_step: "Агент напишет клиенту", responsible_party: "agent" };
    const result = guard.applySummaryJudgeEvidence(summaryJudge(), { transcript, outcomeExtractor: cleanOutcome, cleanOutcome, summary: { conversation_result: "Разговор завершён.", key_facts: [], quotes: [], next_step: "" } }).output;
    expect(result.scores.agreements_next_step).toBe(50);
    expect(result.issues.join(" ")).toContain("MISSING_CONFIRMED_NEXT_STEP");
  });

  it("an_ambiguous_channel_has_severity_75_and_does_not_block", () => {
    const transcript = "Агент:\n— Я отправлю фотографии в Telegram или MAX.\nКлиент:\n— Отлично, буду ждать.";
    const cleanOutcome = { ...emptyOutcome(), agreement: "Агент отправит фотографии", next_step: "Агент отправит фотографии", responsible_party: "agent", channel: "" };
    const result = guard.applySummaryJudgeEvidence(summaryJudge(), { transcript, outcomeExtractor: { ...cleanOutcome, channel: "Telegram" }, cleanOutcome, summary: { conversation_result: "Агент отправит фотографии.", key_facts: [], quotes: [], next_step: "Агент отправит фотографии в Telegram." } }).output;
    expect(result.scores.agreements_next_step).toBe(75);
    expect(result.decision).toBe("warning");
    expect(result.issues.join(" ")).toContain("UNSUPPORTED_CHANNEL");
  });

  it("does_not_penalize_an_unsupported_channel_when_summary_does_not_claim_it", () => {
    const transcript = "Агент:\n— Я отправлю фотографии.\nКлиент:\n— Отлично, буду ждать.";
    const cleanOutcome = { ...emptyOutcome(), agreement: "Агент отправит фотографии", next_step: "Агент отправит фотографии", responsible_party: "agent", channel: "" };
    const result = guard.applySummaryJudgeEvidence(summaryJudge(), { transcript, outcomeExtractor: cleanOutcome, cleanOutcome, summary: { conversation_result: "Агент отправит фотографии.", key_facts: [], quotes: [], next_step: "Агент отправит фотографии." } }).output;
    expect(result).toMatchObject({ scores: baseScores, quality_score: 100, decision: "pass", issues: [] });
  });

  it("clean_supported_outcome_keeps_high_score", () => {
    const fixture = fixtures.report_92_positive;
    const checked = run(fixture.transcript, fixture.outcome_extractor).output.verified_outcome;
    const result = guard.applySummaryJudgeEvidence(summaryJudge(), { transcript: fixture.transcript, outcomeExtractor: fixture.outcome_extractor, cleanOutcome: checked, summary: { conversation_result: "Согласована обратная связь.", key_facts: [], quotes: [], next_step: "Агент напишет клиенту в WhatsApp сегодня или завтра." } }).output;
    expect(result).toMatchObject({ scores: baseScores, quality_score: 100, decision: "pass", issues: [] });
  });
});
