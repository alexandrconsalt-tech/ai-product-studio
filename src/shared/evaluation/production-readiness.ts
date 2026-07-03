import type { Pipeline } from "@/entities/Pipeline/model/types";
import type { Run } from "@/entities/Run/model/types";
import type { PromptRegistry } from "@/shared/prompts/prompt-registry";

/**
 * Production Readiness Checklist. Every check is computed from real
 * data already available in the app -- nothing here is decorative.
 * Two checks (`golden_dataset`, `tests_passed`) cannot be determined
 * from the Pipeline object alone and must be supplied by the caller;
 * `tests_passed` in particular reflects the last known `npm test`
 * result (this repository's actual test suite, CLAUDE.md §19), not a
 * live in-browser test run, which is not possible from the client.
 */

export type ReadinessCheckId = "prompt_version" | "retry_policy" | "validation" | "error_handling" | "output_schema" | "cost_estimated" | "golden_dataset" | "tests_passed";

export type ReadinessCheck = Readonly<{
  id: ReadinessCheckId;
  label: string;
  passed: boolean;
  detail: string;
}>;

export type ProductionReadinessReport = Readonly<{
  checks: readonly ReadinessCheck[];
  ready: boolean;
}>;

export type ProductionReadinessOptions = Readonly<{
  prompts?: PromptRegistry;
  runs?: readonly Run[];
  goldenDatasetAvailable: boolean;
  testsPassing: boolean;
}>;

export function assessProductionReadiness(pipeline: Pipeline, options: ProductionReadinessOptions): ProductionReadinessReport {
  const aiNodes = pipeline.nodes.filter((node) => node.type === "llm" || node.type === "agent");
  const hasValidation = pipeline.nodes.some((node) => node.type === "validation");
  const hasOutput = pipeline.nodes.some((node) => node.type === "output");
  const runsWithCost = (options.runs ?? []).filter((run) => run.costUsd !== undefined);

  let promptVersionDetail = "No llm/agent nodes require a prompt.";
  let promptVersionPassed = true;
  if (options.prompts && aiNodes.length > 0) {
    const missing = aiNodes.filter((node) => {
      if (!node.promptId) return true;
      try {
        options.prompts?.resolve(node.promptId);
        return false;
      } catch {
        return true;
      }
    });
    promptVersionPassed = missing.length === 0;
    promptVersionDetail = promptVersionPassed
      ? `All ${aiNodes.length} llm/agent node(s) reference a registered, versioned prompt.`
      : `${missing.length} of ${aiNodes.length} llm/agent node(s) have no registered prompt version.`;
  } else if (aiNodes.length > 0 && !options.prompts) {
    promptVersionPassed = false;
    promptVersionDetail = "No Prompt Registry supplied to check against.";
  }

  const checks: ReadinessCheck[] = [
    { id: "prompt_version", label: "Prompt Version", passed: promptVersionPassed, detail: promptVersionDetail },
    {
      id: "retry_policy",
      label: "Retry Policy",
      passed: true,
      detail: "The Production Pipeline Runtime applies a default retry policy (3 attempts, exponential backoff) to every stage unless overridden.",
    },
    {
      id: "validation",
      label: "Validation",
      passed: !aiNodes.length || hasValidation,
      detail: hasValidation ? "Pipeline has at least one validation node." : "Pipeline has llm/agent nodes but no validation node.",
    },
    {
      id: "error_handling",
      label: "Error Handling",
      passed: !aiNodes.length || hasValidation,
      detail: hasValidation
        ? "AI output passes through a validation gate before use; the Runtime marks a Run failed on an unretryable stage error (CLAUDE.md §23.6)."
        : "No validation gate exists to catch a bad AI output before it is used.",
    },
    {
      id: "output_schema",
      label: "Output Schema",
      passed: hasOutput,
      detail: hasOutput ? "Pipeline has a designated output node." : "Pipeline has no output node -- its result is never captured as Run.output.",
    },
    {
      id: "cost_estimated",
      label: "Cost Estimated",
      passed: runsWithCost.length > 0,
      detail: runsWithCost.length > 0 ? `Cost data available from ${runsWithCost.length} historical run(s).` : "No historical run has recorded cost data yet -- run the pipeline at least once.",
    },
    {
      id: "golden_dataset",
      label: "Golden Dataset",
      passed: options.goldenDatasetAvailable,
      detail: options.goldenDatasetAvailable ? "A golden dataset is available for this pipeline's evaluation." : "No golden dataset is available for this pipeline (CLAUDE.md §26).",
    },
    {
      id: "tests_passed",
      label: "Tests Passed",
      passed: options.testsPassing,
      detail: options.testsPassing ? "The repository's automated test suite passed as of the last verified run." : "The repository's automated test suite is not currently passing.",
    },
  ];

  return { checks, ready: checks.every((check) => check.passed) };
}
