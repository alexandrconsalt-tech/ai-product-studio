import { describe, expect, it } from "vitest";
import type { z } from "zod";
import type { StructuredLlmResponse } from "./structured-llm";
import {
  buildConversationStore,
  executeSummaryPipelineV2,
  normalizeExtractorOutput,
  normalizeMoneyAmount,
  qualityGate,
  transcriptGuard,
} from "./runtime";
import type { ExtractorOutput, JudgeOutput, SummaryV2Config, TechnicalEnvelope, VerifierOutput } from "./contracts";

const evidence = [{ speaker: "client" as const, quote: "Бюджет до восьми миллионов", turn_id: "turn-2" }];

const extractor: ExtractorOutput = {
  call_type: "OBJECT_INQUIRY",
  client_intent: { value: "Купить новостройку", evidence },
  facts: [{ id: "fact-budget", category: "budget", value: "до 8 млн ₽", evidence }],
  requirements: [{ id: "req-object", category: "property_type", value: "новостройка", evidence }],
  objections: [],
  open_questions: [],
  agreements: [{ id: "agreement-send", category: "agreement", value: "агент отправит варианты", evidence }],
  next_step: { status: "CONFIRMED", action: "Отправить варианты", responsible: "AGENT", deadline: null, channel: "WhatsApp", evidence },
  call_outcome: { type: "FOLLOW_UP_REQUIRED", description: "Согласована отправка вариантов", evidence },
  structured_attributes: { interested_in: ["Новостройки"], funding_source: "ипотека одобрена", purchase_timeline: "2–3 месяца" },
  financial_data: {
    budget: { amount_min: null, amount_max: 8_000_000, currency: "RUB", evidence },
    funding_source: { value: "ипотека одобрена", evidence },
    mortgage_status: { value: "APPROVED", evidence },
    down_payment: { amount: null, currency: "RUB", evidence: [] },
    sale_of_existing_property: { value: "NOT_DEFINED", evidence: [] },
  },
  critical_information: ["Бюджет до 8 млн ₽"],
  summary_inputs: { primary_goal: "Купить новостройку", main_result: "Согласована отправка", key_requirements: ["новостройка"], main_objection: null, agreement_and_next_step: "Агент отправит варианты" },
};

const verifier: VerifierOutput = {
  items: [
    { id: "fact-budget", verdict: "VERIFIED", reason: "Есть дословная цитата" },
    { id: "req-object", verdict: "VERIFIED", reason: "Есть дословная цитата" },
    { id: "agreement-send", verdict: "VERIFIED", reason: "Подтверждено клиентом" },
  ],
  next_step: { verdict: "VERIFIED", reason: "Подтверждено" },
  outcome: { verdict: "VERIFIED", reason: "Подтверждено" },
  structured_attributes: { interested_in: "VERIFIED", funding_source: "VERIFIED", purchase_timeline: "VERIFIED" },
  issues: [],
};

const config: SummaryV2Config = {
  extractorModel: "gpt-5-mini",
  verifierModel: "claude-sonnet-4.5",
  generatorModel: "gpt-5-mini",
  judgeModel: "claude-sonnet-4.5",
};

function fakeStructuredLlm(concurrency?: { active: number; max: number }) {
  return async function call<T>(
    _prompt: string,
    schemaName: string,
    _jsonSchema: Record<string, unknown>,
    validator: z.ZodType<T>,
    model: string,
  ): Promise<StructuredLlmResponse<T>> {
    let output: unknown;
    if (schemaName === "call_intelligence_v2") output = extractor;
    else if (schemaName === "evidence_verifier_v2") output = verifier;
    else if (schemaName === "summary_generator_v2") {
      output = { overview: "Клиент ищет новостройку с бюджетом до 8 млн ₽. Согласована отправка подходящих вариантов.", key_facts: ["Бюджет до 8 млн ₽", "Ипотека одобрена"], quotes: ["Бюджет до восьми миллионов"], agreement_next_step: "Агент отправит варианты в WhatsApp." };
    } else {
      const criterion = schemaName.replace("_judge_v2", "");
      if (concurrency) {
        concurrency.active += 1;
        concurrency.max = Math.max(concurrency.max, concurrency.active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        concurrency.active -= 1;
      }
      output = { criterion, decision: "PASS", score: 100, confidence: 0.91, critical_error: false, issues: [], passed_checks: ["ok"], failed_checks: [], recommendation: null };
    }
    return { data: validator.parse(output), model, durationMs: 5 };
  };
}

describe("Summary Pipeline v2 — детерминированные гарантии", () => {
  it("boolean не превращается в деньги", () => {
    expect(normalizeMoneyAmount(true)).toBeNull();
    expect(normalizeMoneyAmount(false)).toBeNull();
    expect(normalizeMoneyAmount(1)).toBe(1);
  });

  it("null не превращается в строку и финансовые поля остаются разделёнными", () => {
    const normalized = normalizeExtractorOutput(extractor).normalized_data;
    expect(normalized.financial_data.budget.amount_min).toBeNull();
    expect(normalized.financial_data.down_payment.amount).toBeNull();
    expect(normalized.financial_data.mortgage_status.value).toBe("APPROVED");
  });

  it("дубли удаляются, но evidence сохраняется", () => {
    const normalized = normalizeExtractorOutput({ ...extractor, facts: [extractor.facts[0], extractor.facts[0]] });
    expect(normalized.normalized_data.facts).toHaveLength(1);
    expect(normalized.normalized_data.facts[0].evidence).toEqual(evidence);
  });

  it("conditional не превращается в confirmed, proposed не превращается в agreement", () => {
    const conditional = normalizeExtractorOutput({ ...extractor, next_step: { ...extractor.next_step, status: "CONDITIONAL" } });
    expect(conditional.normalized_data.next_step.status).toBe("CONDITIONAL");
    const proposed = normalizeExtractorOutput({ ...extractor, next_step: { ...extractor.next_step, status: "PROPOSED" }, agreements: [] });
    expect(proposed.normalized_data.next_step.status).toBe("PROPOSED");
    expect(proposed.normalized_data.agreements).toEqual([]);
  });

  it("регрессия запуска summary_v2_52cbff87: сохраняет интерес к ипотеке и условный звонок клиента", () => {
    const clientEvidence = [
      { speaker: "client" as const, quote: "Мне нужна консультация по ипотеке и первоначальному взносу", turn_id: "turn-8" },
      { speaker: "client" as const, quote: "Я обсужу с женой и, если интерес останется, сам вам позвоню", turn_id: "turn-14" },
    ];
    const target: ExtractorOutput = {
      ...extractor,
      facts: [{ id: "fact-mortgage", category: "mortgage_interest", value: "Нужна консультация по ипотеке", evidence: [clientEvidence[0]] }],
      requirements: [],
      agreements: [],
      next_step: {
        status: "CONFIRMED",
        action: "Позвонить агенту после обсуждения с женой",
        responsible: "CLIENT",
        deadline: "завтра",
        channel: "PHONE",
        evidence: [clientEvidence[1]],
      },
      structured_attributes: { interested_in: [], funding_source: "не определено", purchase_timeline: "не определено" },
      financial_data: {
        ...extractor.financial_data,
        funding_source: { value: "не определено", evidence: [] },
        mortgage_status: { value: "INTERESTED", evidence: [clientEvidence[0]] },
      },
    };
    const normalized = normalizeExtractorOutput(target).normalized_data;
    expect(normalized.structured_attributes).toEqual({
      interested_in: ["Ипотека"],
      funding_source: "не определено",
      purchase_timeline: "не определено",
    });
    expect(normalized.next_step).toMatchObject({ status: "CONDITIONAL", responsible: "CLIENT", deadline: null, channel: "PHONE" });
  });

  it("rejected и uncertain не попадают в verified Store", () => {
    const mixedVerifier: VerifierOutput = {
      ...verifier,
      items: [
        { id: "fact-budget", verdict: "REJECTED", reason: "Не подтверждено" },
        { id: "req-object", verdict: "UNCERTAIN", reason: "Неясно" },
        { id: "agreement-send", verdict: "VERIFIED", reason: "Подтверждено" },
      ],
    };
    const store = buildConversationStore("call-1", extractor, mixedVerifier, "2026-07-28T00:00:00.000Z");
    expect(store.verified.facts).toEqual([]);
    expect(store.verified.requirements).toEqual([]);
    expect(store.rejected[0].id).toBe("fact-budget");
    expect(store.uncertain[0].id).toBe("req-object");
  });

  it("неподтверждённый следующий шаг удаляется из verified", () => {
    const store = buildConversationStore("call-1", extractor, { ...verifier, next_step: { verdict: "REJECTED", reason: "Предложение агента" } }, "2026-07-28T00:00:00.000Z");
    expect(store.verified.next_step.status).toBe("NOT_DEFINED");
    expect(store.verified.next_step.action).toBeNull();
  });

  it("короткий содержательный звонок не блокируется", () => {
    const result = transcriptGuard("Клиент: Нет, спасибо.\nАгент: Понял.");
    expect(result.is_processable).toBe(true);
    expect(result.dialogue_type).toBe("SHORT");
  });
});

describe("Summary Pipeline v2 — интеграция", () => {
  it("выполняет 13 этапов, запускает Judge параллельно и публикует только AUTO_SAVE", async () => {
    const concurrency = { active: 0, max: 0 };
    const result = await executeSummaryPipelineV2(
      "Агент: Что ищете?\nКлиент: Новостройку. Бюджет до восьми миллионов.\nАгент: Отправлю варианты.\nКлиент: Хорошо.",
      config,
      { structuredLlm: fakeStructuredLlm(concurrency), randomId: (() => { let id = 0; return () => `id-${++id}`; })() },
    );
    expect(result.stages).toHaveLength(13);
    expect(concurrency.max).toBe(5);
    expect(result.quality.score).toBe(100);
    expect(result.quality.decision).toBe("AUTO_SAVE");
    expect(result.crm_publish.status).toBe("PUBLISHED");
    expect(result.crm_publish.payload).toMatchObject({ attributes: { interested_in: ["Новостройки"] } });
  });

  it("TECHNICAL_ERROR не получает score и блокирует CRM", async () => {
    const failing = async () => { throw new Error("schema_validation_failed"); };
    const result = await executeSummaryPipelineV2("Клиент: Интересует квартира.\nАгент: Расскажите подробнее.", config, { structuredLlm: failing });
    const failed = result.stages.find((stage) => stage.stage_id === "call_intelligence_extractor");
    expect(failed?.status).toBe("TECHNICAL_ERROR");
    expect(failed?.score).toBeNull();
    expect(result.quality.score).toBeNull();
    expect(result.quality.decision).toBe("TECHNICAL_ERROR");
    expect(result.crm_publish.status).toBe("BLOCKED");
  });

  it("сбой одной проверки не отменяет остальные, а контроль качества остаётся технически успешным", async () => {
    const llm = fakeStructuredLlm();
    const partiallyFailing: typeof llm = async (...args) => {
      if (args[1] === "usefulness_judge_v2") throw new Error("timeout");
      return llm(...args);
    };
    const result = await executeSummaryPipelineV2(
      "Агент: Что ищете?\nКлиент: Новостройку. Бюджет до восьми миллионов.\nАгент: Отправлю варианты.\nКлиент: Хорошо.",
      config,
      { structuredLlm: partiallyFailing },
    );
    expect(result.stages.filter((stage) => stage.stage_id.endsWith("_judge") && stage.status === "SUCCESS")).toHaveLength(4);
    expect(result.stages.find((stage) => stage.stage_id === "usefulness_judge")?.status).toBe("TECHNICAL_ERROR");
    expect(result.stages.find((stage) => stage.stage_id === "quality_gate_v2")).toMatchObject({
      status: "SUCCESS",
      decision: "TECHNICAL_ERROR",
      score: null,
      technical_error: null,
      output: { reason: "REQUIRED_JUDGE_RESULTS_MISSING" },
    });
  });

  it("Judge TECHNICAL_ERROR не усредняется по четырём", () => {
    const successful = (criterion: JudgeOutput["criterion"]): TechnicalEnvelope<JudgeOutput> => ({
      stage_id: `${criterion}_judge`, stage_version: "v2", execution_id: criterion, status: "SUCCESS", decision: "PASS", score: 100, confidence: 0.9, input_hash: "x",
      output: { criterion, decision: "PASS", score: 100, confidence: 0.9, critical_error: false, issues: [], passed_checks: [], failed_checks: [], recommendation: null },
      issues: [], technical_error: null, duration_ms: 1, model: "judge", prompt_version: "v1", input_contract_version: "v1", output_contract_version: "v1", created_at: "2026-07-28T00:00:00.000Z",
    });
    const judges = ["faithfulness", "completeness", "usefulness", "agreements_next_step", "format"].map((criterion) => successful(criterion as JudgeOutput["criterion"]));
    judges[2] = {
      ...judges[2],
      status: "TECHNICAL_ERROR",
      decision: "TECHNICAL_ERROR",
      score: null,
      confidence: null,
      output: null,
      technical_error: {
        error_code: "timeout",
        error_message: "timeout",
        provider: "anthropic-direct",
        model: "claude-sonnet-4.5",
        stage_id: "usefulness_judge",
        schema_version: "summary-quality-v2",
        retry_count: 1,
        raw_response_available: false,
        validation_errors: [],
      },
    };
    expect(qualityGate(judges, [])).toMatchObject({ score: null, decision: "TECHNICAL_ERROR", reason: "REQUIRED_JUDGE_RESULTS_MISSING" });
  });

  it("FAIL Judge или противоречие Verifier блокируют публикацию даже при высоком среднем", () => {
    const judge = (criterion: JudgeOutput["criterion"]): TechnicalEnvelope<JudgeOutput> => ({
      stage_id: `${criterion}_judge`, stage_version: "v2", execution_id: criterion, status: "SUCCESS", decision: "PASS", score: 100, confidence: 0.9, input_hash: "x",
      output: { criterion, decision: "PASS", score: 100, confidence: 0.9, critical_error: false, issues: [], passed_checks: [], failed_checks: [], recommendation: null },
      issues: [], technical_error: null, duration_ms: 1, model: "judge", prompt_version: "v1", input_contract_version: "v1", output_contract_version: "v1", created_at: "2026-07-28T00:00:00.000Z",
    });
    const judges = ["faithfulness", "completeness", "usefulness", "agreements_next_step", "format"].map((criterion) => judge(criterion as JudgeOutput["criterion"]));
    judges[0] = { ...judges[0], decision: "FAIL", output: { ...judges[0].output!, decision: "FAIL" } };
    expect(qualityGate(judges, []).decision).toBe("REVIEW_REQUIRED");
    const allPass = judges.map((item, index) => index === 0 ? judge("faithfulness") : item);
    expect(qualityGate(allPass, ["critical_contradiction"]).decision).toBe("REVIEW_REQUIRED");
  });
});
