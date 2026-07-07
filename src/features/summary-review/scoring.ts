import type {
  CriterionValue,
  DifferenceStatus,
  HumanDecision,
  HumanReview,
  ReviewBlockId,
  ReviewerRole,
  SummaryRun,
} from "./types";

export const reviewBlocks: Array<{
  id: ReviewBlockId;
  title: string;
  weight: number;
  criteria: Array<{ id: string; label: string; allowNa?: boolean; naLabel?: string }>;
}> = [
  {
    id: "truth",
    title: "Проверка достоверности",
    weight: 0.3,
    criteria: [
      { id: "truth_no_fiction", label: "Нет выдуманных фактов" },
      { id: "truth_not_distorted", label: "Факты не искажены" },
      { id: "truth_roles", label: "Роли клиента/агента/оператора не перепутаны" },
    ],
  },
  {
    id: "criticalFacts",
    title: "Проверка критически важных фактов",
    weight: 0.25,
    criteria: [
      { id: "critical_goal", label: "Отражена главная цель клиента", allowNa: true, naLabel: "Не обсуждалось" },
      { id: "critical_motivation", label: "Отражена главная мотивация клиента", allowNa: true, naLabel: "Не обсуждалось" },
      { id: "critical_needs", label: "Отражены ключевые потребности", allowNa: true, naLabel: "Не обсуждалось" },
      { id: "critical_objections", label: "Отражены возражения / ограничения", allowNa: true, naLabel: "Не обсуждалось" },
      { id: "critical_deal_terms", label: "Отражены важные условия сделки", allowNa: true, naLabel: "Не обсуждалось" },
    ],
  },
  {
    id: "utility",
    title: "Проверка полезности для агента",
    weight: 0.2,
    criteria: [
      { id: "utility_continue", label: "Агент может продолжить работу без прослушивания записи" },
      { id: "utility_context", label: "Контекст клиента понятен за 5-10 секунд" },
      { id: "utility_no_noise", label: "В саммари нет лишней информации" },
    ],
  },
  {
    id: "action",
    title: "Проверка договоренностей и следующего шага",
    weight: 0.15,
    criteria: [
      { id: "action_result", label: "Итог звонка отражен корректно", allowNa: true, naLabel: "Не было в звонке" },
      { id: "action_agreements", label: "Договоренности отражены корректно", allowNa: true, naLabel: "Не было в звонке" },
      { id: "action_next_step", label: "Следующий шаг отражен корректно", allowNa: true, naLabel: "Не было в звонке" },
      { id: "action_no_fiction", label: "Нет выдуманных действий или завышенного статуса", allowNa: true, naLabel: "Не было в звонке" },
    ],
  },
  {
    id: "format",
    title: "Проверка формата и правил",
    weight: 0.1,
    criteria: [
      { id: "format_readable", label: "Саммари краткое и читаемое" },
      { id: "format_no_object_duplicates", label: "Нет дублей карточки объекта: адрес, цена, площадь, этаж, телефон" },
      { id: "format_facts", label: "Саммари написано фактами, а не пересказом диалога" },
      { id: "format_no_forbidden", label: "Нет запрещенных формулировок и лишней воды" },
    ],
  },
];

export const reviewerRoles: ReviewerRole[] = ["Агент", "РОП", "Продакт", "QA", "Другое"];

export const criterionScores: Record<CriterionValue, number | null> = {
  yes: 100,
  partial: 50,
  no: 0,
  na: null,
};

export function createDefaultCriteria(): Record<string, CriterionValue> {
  return Object.fromEntries(reviewBlocks.flatMap((block) => block.criteria.map((criterion) => [criterion.id, "yes"])));
}

export function getBlockScore(blockId: ReviewBlockId, criteria: Record<string, CriterionValue>): number {
  const block = reviewBlocks.find((item) => item.id === blockId);
  if (!block) return 0;

  const values = block.criteria
    .map((criterion) => criterionScores[criteria[criterion.id] ?? "yes"])
    .filter((value): value is number => value !== null);

  if (values.length === 0) return 100;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function getAllBlockScores(criteria: Record<string, CriterionValue>) {
  return {
    truthScore: getBlockScore("truth", criteria),
    criticalFactsScore: getBlockScore("criticalFacts", criteria),
    utilityScore: getBlockScore("utility", criteria),
    actionScore: getBlockScore("action", criteria),
    formatScore: getBlockScore("format", criteria),
  };
}

export function getHumanScore(criteria: Record<string, CriterionValue>): number {
  const score = reviewBlocks.reduce((sum, block) => sum + getBlockScore(block.id, criteria) * block.weight, 0);
  return Math.round(score * 10) / 10;
}

export function getHumanDecision(score: number): HumanDecision {
  if (score >= 95) return "EXCELLENT";
  if (score >= 90) return "GOOD";
  if (score >= 80) return "ACCEPTABLE";
  return "NEEDS_REWORK";
}

export function getDifferenceStatus(diff: number): DifferenceStatus {
  if (diff <= 5) return "Совпадает";
  if (diff <= 10) return "Допустимое расхождение";
  return "Требует анализа";
}

export function hasAiCriticalErrors(aiJudgesJson: unknown): boolean {
  const json = JSON.stringify(aiJudgesJson ?? {}).toLowerCase();
  return json.includes("critical") && (json.includes("error") || json.includes("ошиб"));
}

export function isGoldenDataset(run: SummaryRun, review?: HumanReview): boolean {
  if (!review) return false;
  const criteria = review.criteriaJson;
  const hasTruthNo =
    criteria.truth_no_fiction === "no" || criteria.truth_not_distorted === "no" || criteria.truth_roles === "no";

  return run.aiScore >= 95 && review.humanScore >= 95 && !hasAiCriticalErrors(run.aiJudgesJson) && !hasTruthNo;
}

export function buildReview(params: {
  runId: string;
  reviewerName: string;
  reviewerRole: ReviewerRole;
  criteria: Record<string, CriterionValue>;
  comment: string;
}): HumanReview {
  const blockScores = getAllBlockScores(params.criteria);
  const humanScore = getHumanScore(params.criteria);

  return {
    id: `review-${params.runId}-${Date.now()}`,
    runId: params.runId,
    reviewerName: params.reviewerName.trim() || "Без имени",
    reviewerRole: params.reviewerRole,
    ...blockScores,
    humanScore,
    humanDecision: getHumanDecision(humanScore),
    criteriaJson: params.criteria,
    comment: params.comment.trim(),
    createdAt: new Date().toISOString(),
  };
}

