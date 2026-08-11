import type {
  CriterionValue,
  DifferenceStatus,
  HumanDecision,
  HumanReview,
  LegacyCriterionValue,
  ReviewBlockId,
  ReviewerRole,
  StoredCriterionValue,
  SummaryRun,
} from "./types";

export const reviewBlocks: Array<{
  id: ReviewBlockId;
  title: string;
  weight: number;
  description: string;
  legacyCriterionIds: string[];
}> = [
  {
    id: "truth",
    title: "Проверка достоверности",
    weight: 0.2,
    description: "Проверьте, нет ли выдуманных или искажённых фактов и не перепутаны ли роли участников.",
    legacyCriterionIds: ["truth_no_fiction", "truth_not_distorted", "truth_roles"],
  },
  {
    id: "criticalFacts",
    title: "Проверка критически важных фактов",
    weight: 0.2,
    description: "Сверьте цель, потребности, ограничения, мотивацию и важные условия сделки с транскрибацией.",
    legacyCriterionIds: ["critical_goal", "critical_motivation", "critical_needs", "critical_objections", "critical_deal_terms"],
  },
  {
    id: "utility",
    title: "Проверка полезности для агента",
    weight: 0.2,
    description: "Оцените, понятен ли рабочий контекст за несколько секунд и можно ли продолжить работу без прослушивания звонка.",
    legacyCriterionIds: ["utility_continue", "utility_context", "utility_no_noise"],
  },
  {
    id: "action",
    title: "Проверка договоренностей и следующего шага",
    weight: 0.2,
    description: "Проверьте итог звонка, подтверждённые договорённости, действие, ответственного, срок и канал следующего шага.",
    legacyCriterionIds: ["action_result", "action_agreements", "action_next_step", "action_no_fiction"],
  },
  {
    id: "format",
    title: "Проверка формата и правил",
    weight: 0.2,
    description: "Оцените структуру, краткость и читаемость: без дублей карточки, пересказа диалога, лишней воды и запрещённых формулировок.",
    legacyCriterionIds: ["format_readable", "format_no_object_duplicates", "format_facts", "format_no_forbidden"],
  },
];

export const reviewerRoles: ReviewerRole[] = ["Агент", "РОП", "Продакт", "QA", "Другое"];

const legacyCriterionScores: Record<LegacyCriterionValue, number | null> = {
  yes: 100,
  partial: 50,
  no: 0,
  na: null,
};

export const criterionScores: Record<CriterionValue, number> = {
  0: 0,
  1: 50,
  2: 70,
  3: 90,
  4: 100,
};

export function createDefaultCriteria(): Record<string, CriterionValue> {
  return Object.fromEntries(reviewBlocks.map((block) => [block.id, 4]));
}

function isCriterionValue(value: unknown): value is CriterionValue {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 4;
}

function closestCriterionValue(score: number): CriterionValue {
  return (Object.entries(criterionScores) as Array<[`${CriterionValue}`, number]>)
    .reduce<CriterionValue>((closest, [value, criterionScore]) => {
      return Math.abs(criterionScore - score) < Math.abs(criterionScores[closest] - score)
        ? Number(value) as CriterionValue
        : closest;
    }, 4);
}

export function normalizeCriteria(criteria: Record<string, StoredCriterionValue>): Record<string, CriterionValue> {
  return Object.fromEntries(reviewBlocks.map((block) => {
    const blockValue = criteria[block.id];
    if (isCriterionValue(blockValue)) return [block.id, blockValue];

    const legacyValues = block.legacyCriterionIds
      .map((id) => criteria[id])
      .filter((value): value is LegacyCriterionValue => typeof value === "string")
      .map((value) => legacyCriterionScores[value])
      .filter((value): value is number => value !== null);
    const legacyScore = legacyValues.length
      ? legacyValues.reduce((sum, value) => sum + value, 0) / legacyValues.length
      : 100;
    return [block.id, closestCriterionValue(legacyScore)];
  }));
}

export function getBlockScore(blockId: ReviewBlockId, criteria: Record<string, StoredCriterionValue>): number {
  const block = reviewBlocks.find((item) => item.id === blockId);
  if (!block) return 0;
  return criterionScores[normalizeCriteria(criteria)[block.id] ?? 4];
}

export function getAllBlockScores(criteria: Record<string, StoredCriterionValue>) {
  return {
    truthScore: getBlockScore("truth", criteria),
    criticalFactsScore: getBlockScore("criticalFacts", criteria),
    utilityScore: getBlockScore("utility", criteria),
    actionScore: getBlockScore("action", criteria),
    formatScore: getBlockScore("format", criteria),
  };
}

export function getHumanScore(criteria: Record<string, StoredCriterionValue>): number {
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
  const criteria = normalizeCriteria(review.criteriaJson);
  const hasTruthNo = criteria.truth === 0;

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
