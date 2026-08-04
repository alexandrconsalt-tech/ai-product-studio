import { createHash } from "node:crypto";
import {
  SUMMARY_JUDGE_ISSUE_CODES,
  SummaryJudgeV3Contract,
} from "../contracts/summary-judges/v3/contract";
import { stableStringify } from "../contracts/schema-utils";
import type {
  SummaryCriterionV3,
  SummaryJudgeInputV3,
} from "../contracts/summary-judge-input/v3/contract";

export const SUMMARY_JUDGE_PROMPTS = Object.freeze({
  faithfulness: {
    id: "summary-judge-faithfulness",
    version: "summary-judge-faithfulness-v3.0.0",
  },
  completeness: {
    id: "summary-judge-completeness",
    version: "summary-judge-completeness-v3.0.0",
  },
  usefulness: {
    id: "summary-judge-usefulness",
    version: "summary-judge-usefulness-v3.0.0",
  },
  agreements_next_step: {
    id: "summary-judge-agreements-next-step",
    version: "summary-judge-agreements-next-step-v3.0.0",
  },
  format: {
    id: "summary-judge-format",
    version: "summary-judge-format-v3.0.0",
  },
} as const);

export type SummaryJudgeResolvedPromptV3 = Readonly<{
  promptId: string;
  promptVersion: string;
  criterion: SummaryCriterionV3;
  basePrompt: string;
  resolvedPrompt: string;
  promptHash: string;
  contractId: string;
  contractVersion: string;
  schemaHash: string;
}>;

type CriterionPromptConfig = Readonly<{
  role: string;
  checks: readonly string[];
  exclusions: readonly string[];
  rules: readonly string[];
}>;

const SCORE_SCALE = [
  "SCORE SCALE",
  "score — целое число от 0 до 100.",
  "PASS = полностью соответствует критерию.",
  "NEEDS_REWORK = есть исправимые некритичные проблемы.",
  "FAIL = есть существенные или критические проблемы.",
  "TECHNICAL_ERROR = оценка технически невозможна.",
  "Не рассчитывай общий weighted score.",
].join("\n");

function renderPrompt(
  input: SummaryJudgeInputV3,
  criterion: SummaryCriterionV3,
  config: CriterionPromptConfig,
): SummaryJudgeResolvedPromptV3 {
  if (input.meta.judgeCriterion !== criterion || input.evaluationPolicy.criterion !== criterion) {
    throw new Error(`Prompt criterion mismatch: expected ${criterion}`);
  }
  const promptIdentity = SUMMARY_JUDGE_PROMPTS[criterion];
  if (input.meta.judgePromptVersion !== promptIdentity.version) {
    throw new Error(`Prompt version mismatch: expected ${promptIdentity.version}`);
  }
  const basePrompt = [
    "JUDGE ROLE",
    config.role,
    "",
    `ONLY CRITERION: ${criterion}`,
    "Оценивай только этот criterion. Не используй verdicts, scores или issues других Judges.",
    "",
    "CHECK",
    ...config.checks.map((item) => `- ${item}`),
    "",
    "DO NOT CHECK",
    ...config.exclusions.map((item) => `- ${item}`),
    "",
    "CRITERION RULES",
    ...config.rules.map((item) => `- ${item}`),
    "",
    SCORE_SCALE,
  ].join("\n");
  const resolvedPrompt = [
    basePrompt,
    `INPUT STORE\n${stableStringify(input.conversationStore)}`,
    `INPUT SUMMARY\n${stableStringify(input.summary)}`,
    `TRANSCRIPT CONTEXT\n${stableStringify(input.transcriptContext)}`,
    [
      "OUTPUT CONTRACT",
      `${SummaryJudgeV3Contract.id}@${SummaryJudgeV3Contract.version}`,
      `schema_hash=${SummaryJudgeV3Contract.schemaHash}`,
      `JSON_SCHEMA=${stableStringify(SummaryJudgeV3Contract.schema)}`,
      `Оцени только criterion=${criterion}, но не добавляй criterion в JSON.`,
      `Допустимые violation.code: ${SUMMARY_JUDGE_ISSUE_CODES[criterion].join(", ")}.`,
      "Верни только score, decision, summary и violations по JSON Schema.",
      "Не изменяй Summary и не возвращай chain-of-thought.",
    ].join("\n"),
  ].join("\n\n");
  return Object.freeze({
    promptId: promptIdentity.id,
    promptVersion: promptIdentity.version,
    criterion,
    basePrompt,
    resolvedPrompt,
    promptHash: createHash("sha256").update(resolvedPrompt).digest("hex"),
    contractId: SummaryJudgeV3Contract.id,
    contractVersion: SummaryJudgeV3Contract.version,
    schemaHash: SummaryJudgeV3Contract.schemaHash,
  });
}

export function buildFaithfulnessJudgePrompt(
  input: SummaryJudgeInputV3,
): SummaryJudgeResolvedPromptV3 {
  return renderPrompt(input, "faithfulness", {
    role: "Ты — независимый Faithfulness Judge v3. Проверяй подтверждаемость Summary по Store и транскрипции.",
    checks: [
      "unsupported claims и сведения, отсутствующие в Store",
      "искажённые факты и неверный результат разговора",
      "перепутанные роли",
      "неточные цитаты и их source turn IDs",
      "выдуманные owner, deadline или channel",
      "несовпадение structured attributes",
      "ложно подтверждённый просмотр, перенос времени звонка на просмотр и несовместимый channel=phone для просмотра",
      "технические фрагменты вроде next_step), JSON или error",
    ],
    exclusions: [
      "не считай omission ошибкой faithfulness",
      "не оценивай формат, краткость и полезность",
      "не исправляй Summary",
    ],
    rules: [
      "Conversation Store v3 — основной источник фактов",
      "транскрипция используется только для проверки цитат и ролей",
      "если Outcome был преобразован deterministic policy, сверяй action, deadline и channel с transcript context",
    ],
  });
}

export function buildCompletenessJudgePrompt(
  input: SummaryJudgeInputV3,
): SummaryJudgeResolvedPromptV3 {
  return renderPrompt(input, "completeness", {
    role: "Ты — независимый Completeness Judge v3. Проверяй только критически важные пропуски.",
    checks: [
      "цель обращения и ключевые требования",
      "существенное ограничение или возражение",
      "важный подтверждённый финансовый контекст",
      "результат разговора, agreement и primary next step",
      "незакрытый критический вопрос",
    ],
    exclusions: [
      "не требуй каждый блок во всех звонках",
      "не считай отсутствующие в Store данные пропуском",
      "не считай вопрос об авансе пропуском, если клиент не задавал его и он не сохранён как verified open question в Store",
      "не штрафуй за неопределённые funding source или purchase term",
      "не считай пропуском funding_source, purchase_term или interest, если значение присутствует в conversationStore.attributes: эти поля отображаются пользователю в секции «Потребности клиента» и являются частью финального результата",
      "не требуй agreement или next step, если их нет в Store",
      "не оценивай достоверность, стиль или краткость",
    ],
    rules: [
      "каждый missing item должен ссылаться на существующий Store item или turn, когда ссылка применима",
      `USER_VISIBLE_CUSTOMER_NEEDS=${stableStringify(input.conversationStore.attributes)}`,
    ],
  });
}

export function buildUsefulnessJudgePrompt(
  input: SummaryJudgeInputV3,
): SummaryJudgeResolvedPromptV3 {
  return renderPrompt(input, "usefulness", {
    role: "Ты — независимый Usefulness Judge v3. Определи, сможет ли агент продолжить работу без записи.",
    checks: [
      "понятны ли результат, потребность и ограничения",
      "видно ли подтверждённое дальнейшее действие",
      "нет ли двусмысленности и потери практической ценности",
      "нет ли перегрузки второстепенными сведениями",
      "Summary с техническим мусором или противоречивым следующим шагом не может иметь usabilityAssessment=ready и score=100",
    ],
    exclusions: [
      "не перепроверяй точность фактов",
      "не оценивай красоту стиля",
      "не требуй отсутствующие в Store данные",
      "не исправляй Summary",
    ],
    rules: [
      "usabilityAssessment должен быть ready, partially_ready или not_ready",
    ],
  });
}

export function buildAgreementsJudgePrompt(
  input: SummaryJudgeInputV3,
): SummaryJudgeResolvedPromptV3 {
  return renderPrompt(input, "agreements_next_step", {
    role: "Ты — независимый Agreements and Next Step Judge v3. Проверяй только договорённости и следующий шаг.",
    checks: [
      "action, owner, recipient, deadline, channel и status",
      "выдуманные детали",
      "пропущенный primary next step",
      "соответствие Store",
      "при transformations сверка action, deadline и channel с transcript context обязательна",
    ],
    exclusions: [
      "не требуй deadline или channel, если их нет в Store",
      "не оценивай прочие факты, формат или полезность",
      "не исправляй Summary",
    ],
    rules: [
      "если agreement/next step отсутствуют в Store и Summary ничего не добавляет, score должен быть 100",
      "выдуманный deadline или channel — critical finding",
      "просмотр по телефону или перенос времени статусного звонка на просмотр — critical finding",
    ],
  });
}

export function buildFormatJudgePrompt(
  input: SummaryJudgeInputV3,
): SummaryJudgeResolvedPromptV3 {
  return renderPrompt(input, "format", {
    role: "Ты — независимый Format, Structure and Brevity Judge v3. Проверяй только представление Summary.",
    checks: [
      "semantic repetition и бесполезные дубли между conversationResult и keyFacts",
      "next_step), JSON/error, служебные имена полей и незакрытые скобки",
      "повтор label/value, повтор цены и перегрузку адресом, этажом, площадью или CRM-card data",
      "дубли keyFacts и CRM-card data",
      "многословие, покадровый пересказ и сложные формулировки",
      "лимиты 4 key facts и 2 quotes, перегрузку цитатами",
      "читаемость и утечки technical fields",
    ],
    exclusions: [
      "не оценивай достоверность, полноту или договорённости",
      "не считай умеренное тематическое пересечение повтором",
      "не считай повтором общий итог с конкретизирующим фактом, возражением, сроком или каналом",
      "не исправляй Summary",
    ],
    rules: [
      "semantic repetition существует только когда конкретный key fact повторяет ту же мысль без новой конкретики",
    ],
  });
}

export function buildSummaryJudgePrompt(
  input: SummaryJudgeInputV3,
): SummaryJudgeResolvedPromptV3 {
  switch (input.meta.judgeCriterion) {
    case "faithfulness":
      return buildFaithfulnessJudgePrompt(input);
    case "completeness":
      return buildCompletenessJudgePrompt(input);
    case "usefulness":
      return buildUsefulnessJudgePrompt(input);
    case "agreements_next_step":
      return buildAgreementsJudgePrompt(input);
    case "format":
      return buildFormatJudgePrompt(input);
  }
}
