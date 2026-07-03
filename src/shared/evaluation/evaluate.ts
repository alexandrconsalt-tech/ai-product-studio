import type { Pipeline } from "@/entities/Pipeline/model/types";
import type { Run } from "@/entities/Run/model/types";
import { executePipeline, type ExecutePipelineOptions } from "@/shared/runtime/pipeline-executor";
import type { GoldenDataset, GoldenExample } from "./golden-dataset";
import { defaultScorers, type ScoreResult, type Scorer } from "./scorers";

export type ExampleResult = Readonly<{
  exampleId: string;
  run: Run;
  scores: readonly ScoreResult[];
  passed: boolean;
}>;

export type EvaluationReport = Readonly<{
  datasetId: string;
  datasetVersion: string;
  totalExamples: number;
  passedExamples: number;
  passRate: number;
  results: readonly ExampleResult[];
}>;

export type EvaluateOptions = Readonly<{
  scorers?: readonly Scorer[];
  executeOptions?: ExecutePipelineOptions;
}>;

function scoreExample(run: Run, example: GoldenExample, scorers: readonly Scorer[]): ExampleResult {
  const scores = scorers.map((scorer) => scorer(run, example));
  return { exampleId: example.id, run, scores, passed: scores.every((score) => score.passed) };
}

/**
 * Runs the pipeline once per golden example and scores each run.
 * "Only if the metric improved" (CLAUDE.md §18/§29, the actual
 * discipline from the real business case) is a decision the CALLER
 * makes by comparing two `EvaluationReport.passRate` values across
 * pipeline/prompt versions -- this function only produces one
 * report, it does not itself decide promote-vs-reject.
 */
export async function evaluateGoldenDataset(pipeline: Pipeline, dataset: GoldenDataset, options: EvaluateOptions = {}): Promise<EvaluationReport> {
  const scorers = options.scorers ?? defaultScorers;
  const results: ExampleResult[] = [];

  for (const example of dataset.examples) {
    const run = await executePipeline(pipeline, example.transcript, options.executeOptions);
    results.push(scoreExample(run, example, scorers));
  }

  const passedExamples = results.filter((result) => result.passed).length;

  return {
    datasetId: dataset.id,
    datasetVersion: dataset.version,
    totalExamples: dataset.examples.length,
    passedExamples,
    passRate: dataset.examples.length === 0 ? 0 : passedExamples / dataset.examples.length,
    results,
  };
}
