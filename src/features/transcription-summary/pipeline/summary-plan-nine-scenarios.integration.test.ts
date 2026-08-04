import { describe, expect, it } from "vitest";
import type { SummaryCriterionV3 } from "../contracts/summary-judge-input/v3/contract";
import type { StructuredProviderTransport } from "../runtime/structured-output";
import { InMemoryCrmPublicationRepositoryV3 } from "../crm-publication";
import { executeTranscriptionSummaryV3Pipeline } from "./execute";
import { RuntimeTranscriptionSummaryV3StageExecutor } from "./runtime-executor";

type Case = Readonly<{
  id: string;
  turns: readonly Readonly<{ speaker: "client" | "agent"; text: string }>[];
  goal: string;
  requirements: readonly string[];
  callResult: string;
  next: Readonly<{ action: string; deadline: string; channel: string }>;
  funding?: "наличные / депозит" | "ипотека одобрена";
  purchaseTerm?: "2–3 месяца";
  interest?: "Новостройки";
}>;

const cases: readonly Case[] = [
  {
    id: "mystolovo",
    turns: [
      { speaker: "client", text: "Ищу участок ИЖС для строительства дома, бюджет до 5,5 миллиона, площадь от 6 соток. Рассматриваю Мистолово, Капитолово и Лаврики. В объявлении было Охтинское Раздолье за 4,65 миллиона, но ежемесячный взнос 9 600 рублей меня смущает." },
      { speaker: "agent", text: "После звонка отправлю видеообзор и подборку альтернатив в MAX." },
    ],
    goal: "Ищу участок ИЖС для строительства дома",
    requirements: ["бюджет до 5,5 миллиона", "площадь от 6 соток", "Мистолово, Капитолово и Лаврики", "ежемесячный взнос 9 600 рублей меня смущает"],
    callResult: "Согласована отправка видеообзора и альтернатив.",
    next: { action: "отправить видеообзор и подборку альтернатив", deadline: "после звонка", channel: "MAX" },
  },
  {
    id: "repeat_viewing",
    turns: [
      { speaker: "client", text: "Да, я готов приехать завтра." },
      { speaker: "agent", text: "Тогда встречаемся завтра в 19:00 у входа в дом." },
      { speaker: "client", text: "Подтверждаю. Связываемся только если что-то изменится." },
    ],
    goal: "Клиент готов приехать на просмотр",
    requirements: [],
    callResult: "Просмотр согласован.",
    next: { action: "встретиться у входа в дом", deadline: "завтра в 19:00", channel: "" },
  },
  {
    id: "granddaughter",
    turns: [
      { speaker: "client", text: "Ищу квартиру для внучки, ей 17 лет. Нужна студия или небольшая квартира от 25–26 квадратных метров, чтобы было удобно ездить к вузу. Бюджет до 9 миллионов, покупаю за наличные. Важны юридическая чистота и возможность торга." },
      { speaker: "agent", text: "Завтра позвоню вам с альтернативными вариантами." },
    ],
    goal: "Ищу квартиру для внучки",
    requirements: ["студия или небольшая квартира от 25–26 квадратных метров", "бюджет до 9 миллионов", "юридическая чистота", "возможность торга"],
    callResult: "Согласован подбор альтернативных вариантов.",
    next: { action: "позвонить с альтернативными вариантами", deadline: "завтра", channel: "телефон" },
    funding: "наличные / депозит",
  },
  {
    id: "medikova",
    turns: [
      { speaker: "client", text: "Смотрю квартиру на Медикова для собственного проживания, у меня наличные. Хочу посмотреть квартиру." },
      { speaker: "agent", text: "Утром позвоню и подтвержу время просмотра." },
    ],
    goal: "Смотрю квартиру на Медикова для собственного проживания",
    requirements: ["оригиналы документов есть", "обременений и долгов нет", "возможно титульное страхование"],
    callResult: "Клиент хочет посмотреть квартиру.",
    next: { action: "позвонить и подтвердить время просмотра", deadline: "утром", channel: "телефон" },
    funding: "наличные / депозит",
  },
  {
    id: "short_call",
    turns: [
      { speaker: "client", text: "Сейчас неудобно, пожалуйста, перезвоните сегодня после 18:00." },
      { speaker: "agent", text: "Хорошо, перезвоню сегодня после 18:00." },
    ],
    goal: "Клиенту сейчас неудобно говорить",
    requirements: [],
    callResult: "Разговор перенесён.",
    next: { action: "перезвонить клиенту", deadline: "сегодня после 18:00", channel: "телефон" },
  },
  {
    id: "legal",
    turns: [
      { speaker: "client", text: "Для меня важно, чтобы квартира была юридически чистой: без обременений, с оригиналами документов. Пришлите документы для проверки." },
      { speaker: "agent", text: "Сегодня отправлю документы на электронную почту." },
    ],
    goal: "Проверить юридическую чистоту квартиры",
    requirements: ["без обременений", "с оригиналами документов"],
    callResult: "Согласована отправка документов для проверки.",
    next: { action: "отправить документы", deadline: "сегодня", channel: "электронная почта" },
  },
  {
    id: "requirements_objection",
    turns: [
      { speaker: "client", text: "Ищу двухкомнатную квартиру от 60 квадратных метров рядом с метро. Обязательно нужен лифт. Шум для меня критичен, шумную квартиру не рассматриваю." },
      { speaker: "agent", text: "Завтра отправлю подборку на электронную почту." },
    ],
    goal: "Ищу двухкомнатную квартиру рядом с метро",
    requirements: ["от 60 м²", "рядом с метро", "обязательно нужен лифт", "не рассматривает шумную квартиру"],
    callResult: "Согласована подготовка подходящей подборки.",
    next: { action: "отправить подборку", deadline: "завтра", channel: "электронная почта" },
  },
  {
    id: "cash_mortgage",
    turns: [
      { speaker: "client", text: "Покупаю квартиру за наличные, деньги уже на счёте. Ипотека не нужна. Нужна однокомнатная квартира до 8 миллионов рядом с парком." },
      { speaker: "agent", text: "Сегодня вечером отправлю три варианта в Telegram." },
    ],
    goal: "Клиент покупает однокомнатную квартиру рядом с парком",
    requirements: ["до 8 миллионов", "рядом с парком", "ипотека не нужна"],
    callResult: "Согласован подбор трёх вариантов.",
    next: { action: "отправить три варианта", deadline: "сегодня вечером", channel: "Telegram" },
    funding: "наличные / депозит",
  },
  {
    id: "noise_filter",
    turns: [
      { speaker: "client", text: "Мне нужна тихая квартира от 45 квадратных метров, бюджет до 10 миллионов." },
      { speaker: "agent", text: "Завтра отправлю подборку в WhatsApp." },
    ],
    goal: "Клиент ищет тихую квартиру",
    requirements: ["тихая квартира", "от 45 м²", "бюджет до 10 миллионов"],
    callResult: "Согласован подбор тихих вариантов.",
    next: { action: "отправить подборку", deadline: "завтра", channel: "WhatsApp" },
  },
  {
    id: "tatiana_exact_production_regression",
    turns: [
      { speaker: "agent", text: "Добрый день, агентство недвижимости, Анна." },
      { speaker: "client", text: "Здравствуйте, меня Татьяна зовут. Я по объявлению, интересуют новостройки в центре." },
      { speaker: "agent", text: "Какой у вас бюджет?" },
      { speaker: "client", text: "До 8 миллионов, ипотека уже одобрена в Сбербанке." },
      { speaker: "agent", text: "В какой срок планируете покупку?" },
      { speaker: "client", text: "В ближайшие 2–3 месяца." },
      { speaker: "agent", text: "Предлагаю посмотреть варианты в пятницу, 15-го, в 14:00." },
      { speaker: "client", text: "Да, договорились." },
    ],
    goal: "Клиент ищет новостройку в центре",
    requirements: ["Бюджет до 8 миллионов", "Ипотека одобрена в Сбербанке", "Покупка в ближайшие 2–3 месяца"],
    callResult: "Просмотр согласован.",
    next: { action: "Провести просмотр", deadline: "в пятницу, 15-го, в 14:00", channel: "личная встреча" },
    funding: "ипотека одобрена",
    purchaseTerm: "2–3 месяца",
    interest: "Новостройки",
  },
];

function transcript(item: Case) {
  return {
    transcript_id: `transcript-${item.id}`,
    turns: item.turns.map((turn, index) => ({
      id: `turn-${index + 1}`,
      sequence: index,
      speaker: turn.speaker,
      text: turn.text,
      started_at_ms: null,
      ended_at_ms: null,
    })),
    metadata: {},
    validation_warnings: [],
  };
}

function extracted(item: Case) {
  const evidence = item.turns[0].text;
  const base = (id: string) => ({ id, source_turn_ids: ["turn-1"], evidence, confidence: 1, verification_status: "extracted" as const });
  return {
    facts: {
      confirmed_facts: [{ ...base("client-goal-1"), kind: "client_fact", subject: "client", predicate: "client_goal", value: item.goal }],
      client_questions: [], quotes: [], contextual_statements: [], rejected_assumptions: [],
    },
    needs: {
      business_needs: [],
      property_requirements: item.requirements.map((value, index) => ({
        ...base(`requirement-${index + 1}`),
        need_type: "client_requirement",
        value,
        evidence: `Клиент подтвердил требование: ${value}`,
      })),
      structured_crm_attributes: {
        interested_in: item.interest ? [{ ...base("interest"), value: item.interest }] : [],
        funding_source: { ...base("funding-source"), value: item.funding ?? "не определено" },
        purchase_term: { ...base("purchase-term"), value: item.purchaseTerm ?? "не определено" },
      },
      communication_preferences: [], client_questions: [],
    },
    outcome: {
      call_result: item.callResult,
      agreements: [{ id: "agreement-1", action: item.next.action, owner: "Агент", deadline: item.next.deadline, channel: item.next.channel, status: "confirmed", evidence: item.turns.at(-1)?.text ?? evidence }],
      primary_next_step: { action: item.next.action, owner: "Агент", deadline: item.next.deadline, channel: item.next.channel, status: "confirmed" },
    },
  };
}

function transportFor(item: Case): StructuredProviderTransport {
  const values = extracted(item);
  return async (request) => {
    let structuredValue: unknown;
    if (request.schemaId === "facts.agent.output.v3") structuredValue = values.facts;
    else if (request.schemaId === "needs.agent.output.v3") structuredValue = values.needs;
    else if (request.schemaId === "outcome.agent.output.v3") structuredValue = values.outcome;
    else if (request.schemaId === "summary.content.v3") {
      structuredValue = {
        conversation_result: `${item.goal}. ${item.callResult} {\"error\":\"provider residue\"}`,
        key_facts: item.requirements.map(() => ({ label: "Требование", value: "не объект м²" })),
        quotes: [],
        next_step: "Агент выполнит действие объект:00.",
      };
    } else if (request.schemaId === "summary.judge.verdict.v3") {
      const criterion = request.prompt.match(/ONLY CRITERION: (\w+)/u)?.[1] as SummaryCriterionV3;
      const rawFundingFalsePositive = criterion === "completeness" && item.funding;
      structuredValue = {
        score: rawFundingFalsePositive ? 50 : 100,
        decision: rawFundingFalsePositive ? "FAIL" : "PASS",
        summary: rawFundingFalsePositive ? "В Summary отсутствует источник средств клиента." : "Критерий выполнен.",
        violations: rawFundingFalsePositive ? [{ code: "missing_financial_context", severity: "medium", description: "В Summary отсутствует источник средств клиента." }] : [],
      };
    } else throw new Error(`Unexpected Structured Output contract: ${request.schemaId}`);
    return {
      ok: true,
      structuredValue,
      rawResponse: { id: `controlled-${item.id}-${request.schemaId}` },
      attestation: { requested: true, forwarded: true, accepted: true, structuredResponseReturned: true },
    };
  };
}

function expectedConversationOutcome(item: Case): string {
  const next = item.next.action.toLocaleLowerCase("ru-RU");
  if (/(?:позвон|перезвон|созвон|связ)/u.test(next)) return "Договорились о повторном звонке";
  if (/(?:осмотр|просмотр|встреч)/u.test(next)) return "Просмотр согласован";
  if (/(?:документ)/u.test(next)) return "Отправка документов согласована";
  if (/(?:подбор|вариант)/u.test(next)) return "Отправка подборки согласована";
  if (/(?:видео|материал)/u.test(next)) return "Отправка материалов согласована";
  return item.callResult.replace(/[.]$/u, "");
}

describe("nine audited scenarios through production typed v3 orchestrator", () => {
  it.each(cases)("$id has clean post-final diagnostics and reaches CRM DRY_RUN", async (item) => {
    const executor = new RuntimeTranscriptionSummaryV3StageExecutor({
      provider: "openai-direct",
      models: { default: "gpt-5-mini-2025-08-07" },
      transport: transportFor(item),
      crmRepository: new InMemoryCrmPublicationRepositoryV3(),
      crmClient: { async publishSummary() { throw new Error("CRM must stay DRY_RUN"); } },
      now: () => new Date("2026-08-03T12:00:00.000Z"),
    });
    const capturedErrors: string[] = [];
    const result = await executeTranscriptionSummaryV3Pipeline({
      transcript: transcript(item),
      executor: { async execute(stageId, context) { try { return await executor.execute(stageId, context); } catch (error) { capturedErrors.push(`${stageId}:${error instanceof Error ? error.message : String(error)}`); throw error; } } },
      runId: `run-${item.id}`,
      now: () => new Date("2026-08-03T12:00:00.000Z"),
    });
    const summary = result.outputs.summary_agent as { conversation_result: string; key_facts: { value: string }[]; next_step: string };
    const gate = result.outputs.quality_gate as { qualityScore: number; decision: string; criticalIssues: unknown[] };
    const summaryStage = result.report.stages.find((stage) => stage.stage_id === "summary_agent");
    const gateStage = result.report.stages.find((stage) => stage.stage_id === "quality_gate");
    const diagnostics = JSON.parse(summaryStage?.validation_result.issues.find((issue) => issue.code === "POST_FINAL_DIAGNOSTICS")?.message ?? "null");
    expect(result.report.stages).toHaveLength(13);
    expect(result.report.status, JSON.stringify({ capturedErrors, stages: result.report.stages.map((stage) => ({ id: stage.stage_id, status: stage.status, error: stage.error_code, issues: stage.validation_result.issues })) })).toBe("SUCCESS");
    expect(result.report.crm_status).toBe("DRY_RUN");
    if (item.id === "repeat_viewing") {
      expect(summary.conversation_result).not.toContain(item.goal);
    } else {
      expect(summary.conversation_result).toContain(item.goal);
    }
    expect([
      item.callResult.replace(/[.]$/u, ""),
      expectedConversationOutcome(item),
    ].some((outcome) => summary.conversation_result.includes(outcome)), JSON.stringify(summary)).toBe(true);
    expect(summary.conversation_result).not.toContain(item.next.deadline);
    expect(summary.next_step).toContain(item.next.deadline);
    const visibleSummary = [summary.conversation_result, ...summary.key_facts.map((entry) => entry.value), summary.next_step].join(" ");
    expect(visibleSummary).not.toMatch(/объект:00|не объект|\berror\b|[{]["']?/iu);
    item.requirements.forEach((requirement) => expect(summary.key_facts.map((entry) => entry.value)).toContain(requirement));
    expect(diagnostics).toMatchObject({ missingMeaningIds: [], duplicatedMeaningIds: [], protectedValueViolations: [], technicalResidue: [], nextStepDuplicationCount: 0 });
    expect(gate).toMatchObject({ qualityScore: 100, decision: "QUALITY_RECORDED", criticalIssues: [] });
    expect(gateStage?.validation_result.issues.find((issue) => issue.code === "POST_FINAL_DIAGNOSTICS")).toBeTruthy();
    const llmStages = result.report.stages.filter((stage) => stage.model !== null);
    expect(llmStages.every((stage) => stage.provider === "openai-direct" && stage.structured_output.requested && stage.structured_output.applied)).toBe(true);
    if (item.funding) {
      const completeness = result.report.stages.find((stage) => stage.stage_id === "summary_judge_completeness");
      const scoreAudit = completeness?.validation_result.issues.find((issue) => issue.code === "JUDGE_SCORE_AUDIT");
      expect(JSON.parse(scoreAudit?.message ?? "null")).toMatchObject({ raw_score: 50, effective_score: 100 });
    }
  });
});
