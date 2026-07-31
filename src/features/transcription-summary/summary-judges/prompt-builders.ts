import { createHash } from "node:crypto";
import { SummaryJudgeV3Contract } from "../contracts/summary-judges/v3/contract";
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
  "100 = полностью соответствует → verdict pass.",
  "75 = отдельные некритичные проблемы → verdict warning.",
  "50 = существенные проблемы → verdict fail.",
  "25 = критические проблемы → verdict fail.",
  "0 = результат непригоден → verdict fail.",
  "Произвольные score запрещены. technical_error требует score=null и confidence=null.",
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
      `Верни payload только для criterion=${criterion}.`,
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
    ],
    exclusions: [
      "не считай omission ошибкой faithfulness",
      "не оценивай формат, краткость и полезность",
      "не исправляй Summary",
    ],
    rules: [
      "Conversation Store v3 — основной источник фактов",
      "транскрипция используется только для проверки цитат и ролей",
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
      "не штрафуй за неопределённые funding source или purchase term",
      "не требуй agreement или next step, если их нет в Store",
      "не оценивай достоверность, стиль или краткость",
    ],
    rules: [
      "каждый missing item должен ссылаться на существующий Store item или turn, когда ссылка применима",
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
    ],
    exclusions: [
      "не требуй deadline или channel, если их нет в Store",
      "не оценивай прочие факты, формат или полезность",
      "не исправляй Summary",
    ],
    rules: [
      "если agreement/next step отсутствуют в Store и Summary ничего не добавляет, score должен быть 100",
      "выдуманный deadline или channel — critical finding",
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
