import { createTimestamp } from "@/entities/shared";

/**
 * Common envelope for every JSON report exportable from the app
 * (Execution Report, Run Report, Pipeline Configuration, Evaluation
 * Report -- CLAUDE.md Iteration 25 item 7). A shared shape rather than
 * four bespoke ones, since all four are "here is a real object from
 * the repository, plus when/what it is" -- the only thing that varies
 * is `reportType` and `data`.
 */
export type ReportEnvelope<T> = Readonly<{
  reportType: string;
  generatedAt: string;
  data: T;
}>;

export function buildReportEnvelope<T>(reportType: string, data: T, generatedAt: string = createTimestamp()): ReportEnvelope<T> {
  return { reportType, generatedAt, data };
}
