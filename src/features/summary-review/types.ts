export type AiDecision = "AUTO_SAVE" | "MANUAL_REVIEW" | "RETRY" | string;

export type HumanDecision = "EXCELLENT" | "GOOD" | "ACCEPTABLE" | "NEEDS_REWORK";

export type ReviewerRole = "Агент" | "РОП" | "Продакт" | "QA" | "Другое";

export type CriterionValue = "yes" | "partial" | "no" | "na";

export type ReviewBlockId = "truth" | "criticalFacts" | "utility" | "action" | "format";

export type DifferenceStatus = "Совпадает" | "Допустимое расхождение" | "Требует анализа";

export type ReviewStatus = "Не оценено" | "Оценено";

export type SummaryRun = {
  id: string;
  createdAt: string;
  clientName: string;
  transcript: string;
  summary: string;
  aiScore: number;
  aiDecision: AiDecision;
  aiJudgesJson: unknown;
  sourceRunJson: unknown;
};

export type HumanReview = {
  id: string;
  runId: string;
  reviewerName: string;
  reviewerRole: ReviewerRole;
  truthScore: number;
  criticalFactsScore: number;
  utilityScore: number;
  actionScore: number;
  formatScore: number;
  humanScore: number;
  humanDecision: HumanDecision;
  criteriaJson: Record<string, CriterionValue>;
  comment: string;
  createdAt: string;
};

export type GoldenDatasetItem = {
  id: string;
  runId: string;
  summary: string;
  transcript: string;
  aiScore: number;
  humanScore: number;
  criteria: Record<string, CriterionValue>;
  approvedBy: string;
  createdAt: string;
};

export type ReviewRecord = {
  run: SummaryRun;
  review?: HumanReview;
  isGolden: boolean;
  difference: number | null;
  differenceStatus: DifferenceStatus | "Нет оценки";
  reviewStatus: ReviewStatus;
};

