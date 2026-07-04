import type { Pipeline } from "@/entities/Pipeline/model/types";
import { evaluateGoldenDataset, type EvaluateOptions, type EvaluationReport } from "./evaluate";
import type { GoldenDataset } from "./golden-dataset";

/**
 * Benchmark Framework (CLAUDE.md §28): runs the SAME Golden Dataset
 * against MULTIPLE pipeline variants to produce comparative metrics --
 * distinct from Evaluation (§27), which checks one version against a
 * bar. Reuses `evaluateGoldenDataset` per variant rather than a
 * second execution mechanism (§2 principle 6). Directly maps to the
 * real business case in `pdf-notes.txt` Этап 4 ("Модель-агностичность
 * и стоимость"): benchmark a cheaper model against the current
 * baseline on the same examples.
 *
 * §28's mandatory rule -- "never declare a winning model/prompt
 * version without the underlying per-example results being
 * inspectable" -- is why `BenchmarkVariantResult.evaluation` carries
 * the full `EvaluationReport` (including every `ExampleResult`), not
 * just an aggregate pass rate.
 */

export type BenchmarkVariant = Readonly<{
  id: string;
  label: string;
  pipeline: Pipeline;
}>;

export type BenchmarkVariantResult = Readonly<{
  variantId: string;
  variantLabel: string;
  evaluation: EvaluationReport;
}>;

export type BenchmarkReport = Readonly<{
  datasetId: string;
  datasetVersion: string;
  results: readonly BenchmarkVariantResult[];
}>;

/**
 * Swaps a single node's `modelId` and returns a new `Pipeline` --
 * the pure building block for constructing benchmark variants (e.g.
 * "same pipeline, but the summary node uses model_fast instead of
 * model_reasoning"). Never mutates the input pipeline.
 */
export function withNodeModel(pipeline: Pipeline, nodeId: string, modelId: string): Pipeline {
  return {
    ...pipeline,
    nodes: pipeline.nodes.map((node) => (node.id === nodeId ? { ...node, modelId } : node)),
  };
}

export async function runBenchmark(variants: readonly BenchmarkVariant[], dataset: GoldenDataset, options: EvaluateOptions = {}): Promise<BenchmarkReport> {
  const results: BenchmarkVariantResult[] = [];
  for (const variant of variants) {
    const evaluation = await evaluateGoldenDataset(variant.pipeline, dataset, options);
    results.push({ variantId: variant.id, variantLabel: variant.label, evaluation });
  }
  return { datasetId: dataset.id, datasetVersion: dataset.version, results };
}
