import type { Model } from "@/entities/Model/model/types";
import type { NodeType } from "@/entities/Node/model/types";
import { CallAnalysisSummarySchema } from "@/shared/model/call-analysis-summary";
import { confidenceFromTemperature } from "@/shared/model/confidence";
import type { LLMProviderRegistry } from "@/shared/llm/provider-registry";
import type { LLMMessage } from "@/shared/llm/types";
import type { PromptRegistry } from "@/shared/prompts/prompt-registry";
import { defaultStageRegistry, type StageRegistry } from "./stage-registry";
import type { StageHandler, StageInput, StageOutput } from "./types";

/**
 * Real (non-Mock) StageHandlers. Per CLAUDE.md §13 ("Non-AI First",
 * D-001) and §20.2, only the node types that genuinely need a model
 * call get a model-calling implementation here -- `input`/`output`/
 * `store`/`router`/`function` are deterministic data-plumbing in both
 * the mock and the real registry; there is no more "real" version of
 * a passthrough than a passthrough. `human_review` cannot be made
 * "real" in headless code -- there is no actual human here; a genuine
 * approval flow is a UI concern (Playground wiring, out of scope for
 * this module) and this stays an explicit auto-approve, same as Mock
 * Stage, clearly labeled as such.
 */

export type RealStageDependencies = Readonly<{
  llmProviders: LLMProviderRegistry;
  prompts: PromptRegistry;
  models: readonly Model[];
}>;

/**
 * Rough cost per 1K tokens, USD, keyed by model name. This is an
 * estimate for cost *tracking*, not a real billing source -- provider
 * pricing changes independently of this repository. Unknown model
 * names fall back to a conservative default rather than reporting 0.
 */
const COST_PER_1K_TOKENS: Record<string, number> = {
  "gpt-4o-mini": 0.00015,
  "gpt-4o": 0.0025,
};
const DEFAULT_COST_PER_1K_TOKENS = 0.002;

/**
 * A node with genuine multi-source fan-in (e.g. the real demo
 * pipeline's "Need Extractor" llm node, fed by both `node_router` and
 * `node_tool`) receives its payload from the executor as an ARRAY of
 * every active upstream source's output, not a single value (see
 * pipeline-executor.ts). Merging that into one record is what makes
 * fan-in usable for prompt rendering: a raw string source becomes
 * `transcript` (the meaningful "content" in this domain, CLAUDE.md
 * §3.3) the first time one is seen; object sources get their fields
 * spread in, in edge order. Found and fixed via an actual in-browser
 * Playground run against the real demo pipeline, not assumed correct
 * from unit tests alone -- the original single-object-only version
 * threw "missing required variable: transcript" the first time it ran
 * against real fan-in data.
 *
 * Every object/array payload also gets a `value` key -- the whole
 * payload, JSON-stringified -- unless a more specific `value` already
 * came from a raw-string array item (spread order below preserves that
 * one). This guarantees a prompt referencing `{{value}}` always renders
 * regardless of which upstream stage produced the payload, which
 * matters once a prompt is chained after ANOTHER `llm` stage under the
 * Mock LLM Provider: a mocked upstream call never returns the real
 * field names a downstream prompt might expect (it always returns
 * `{mock, model, echo, confidence}`), so a prompt that only references
 * named upstream fields throws `PromptRenderError` the moment it runs
 * with Mock Stage active -- found via an actual Playground run of the
 * "Генерация текстов объявлений" demo pipeline (3 chained `llm` stages),
 * not assumed. Existing prompts that never reference `{{value}}` are
 * completely unaffected by this addition.
 */
function asRecord(payload: unknown): Record<string, unknown> {
  if (Array.isArray(payload)) {
    const merged = payload.reduce<Record<string, unknown>>((acc, item) => {
      if (typeof item === "string") {
        return { ...acc, transcript: acc.transcript ?? item, value: acc.value ?? item };
      }
      if (item && typeof item === "object") {
        return { ...acc, ...item };
      }
      return acc;
    }, {});
    return { value: JSON.stringify(payload), ...merged };
  }
  if (payload && typeof payload === "object") {
    return { value: JSON.stringify(payload), ...(payload as Record<string, unknown>) };
  }
  return { value: payload };
}

/**
 * Converts a stage's incoming payload into named template variables.
 * A raw string payload (e.g. the `input` node's output when the
 * pipeline's own input is plain transcript text, as in the real call-
 * analysis case, CLAUDE.md §3.3) is mapped to `transcript` -- the
 * variable name every seeded prompt template actually uses -- in
 * addition to the generic `value` key, rather than only the generic
 * key a template would never reference.
 */
function asStringVariables(payload: unknown): Record<string, string> {
  if (typeof payload === "string") {
    return { transcript: payload, value: payload };
  }
  const record = asRecord(payload);
  const variables: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    variables[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return variables;
}

function resolveModel(models: readonly Model[], modelId: string | undefined): Model | undefined {
  return models.find((model) => model.id === modelId);
}

function costForTokens(modelName: string, totalTokens: number): number {
  const perThousand = COST_PER_1K_TOKENS[modelName] ?? DEFAULT_COST_PER_1K_TOKENS;
  return Number(((totalTokens / 1000) * perThousand).toFixed(6));
}

/**
 * Extracts citation-style evidence from a stage's output payload if
 * it looks like the CallAnalysisSummary shape (has a `цитаты` array)
 * -- CLAUDE.md §14.3's grounding requirement. Falls back to an empty
 * list for any other output shape; not every prompt produces
 * citations, and that's fine for prompts that were never asked to.
 */
function extractEvidence(payload: unknown): string[] {
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const quotes = record["цитаты"];
  if (Array.isArray(quotes) && quotes.every((quote) => typeof quote === "string")) {
    return quotes;
  }
  return [];
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function createLlmHandler(deps: RealStageDependencies): StageHandler {
  return async ({ node, payload }: StageInput): Promise<StageOutput> => {
    if (!node.promptId) {
      throw new Error(`Node "${node.id}" is type "${node.type}" but has no promptId -- a real llm/agent stage needs a prompt to render.`);
    }

    const model = resolveModel(deps.models, node.modelId);
    const modelName = model?.name ?? node.modelId ?? "unknown-model";
    const llmProvider = deps.llmProviders.resolve(model?.provider ?? "local");

    const variables = asStringVariables(payload);
    const prompt = deps.prompts.render(node.promptId, variables);
    const messages: LLMMessage[] = [{ role: "user", content: prompt }];

    const result = await llmProvider.complete({
      model: modelName,
      messages,
      temperature: node.temperature,
      responseFormat: "json",
    });

    const parsed = tryParseJson(result.content);
    const confidence = confidenceFromTemperature(node.temperature);
    const evidence = extractEvidence(parsed);

    return {
      payload: typeof parsed === "object" && parsed !== null ? { ...(parsed as Record<string, unknown>), confidence } : { content: result.content, confidence },
      evidence,
      metrics: [
        { name: "tokens", value: result.usage.totalTokens, unit: "tokens" },
        { name: "cost", value: costForTokens(modelName, result.usage.totalTokens), unit: "usd" },
        { name: "latency", value: result.latencyMs, unit: "ms" },
        { name: "confidence", value: confidence },
      ],
    };
  };
}

async function passthrough({ payload }: StageInput): Promise<StageOutput> {
  return { payload };
}

/**
 * A `store` node's whole purpose is to hold merged context for every
 * downstream stage ("Единое хранилище", CLAUDE.md's Ad Copy Generation
 * demo pipeline) -- but with more than one incoming edge, the executor
 * hands it a raw array of its sources' outputs (pipeline-executor.ts),
 * and a plain `passthrough` would forward that array untouched. The
 * next `llm` stage's `asStringVariables` would then try to spread each
 * array element as an object -- and since `Array.isArray(x)` items are
 * themselves `typeof "object"`, a *nested* array (a store fed by a
 * store that was itself fan-in-merged) spreads into numeric-string
 * keys ("0","1") instead of hoisting the real fields up, silently
 * breaking every `{{field}}` reference two hops downstream. Found via
 * an actual Playground run of the Ad Copy Generation pipeline's
 * Checker stage (fed by Storage + Generation), not assumed. A single
 * incoming edge (every pre-existing demo pipeline's `store` node) is
 * unaffected: `asRecord` on a plain object behaves exactly like the
 * passthrough it replaces.
 */
async function realStore({ payload }: StageInput): Promise<StageOutput> {
  return { payload: asRecord(payload) };
}

async function realTool({ node, payload }: StageInput): Promise<StageOutput> {
  // No real tool integration exists yet -- there is nothing concrete
  // to call. Kept as an explicit, labeled stand-in rather than a
  // silent no-op, distinct from the LLM-calling handlers above.
  return { payload: { ...asRecord(payload), toolResult: `no-real-tool-integration:${node.id}` } };
}

/**
 * Deterministic (non-AI) validation, per CLAUDE.md §13's "Non-AI
 * First" principle applied literally: a validation step should be
 * code, not another model call. If the payload matches
 * CallAnalysisSummarySchema, this actually validates it and surfaces
 * real issues; for any other shape it passes through, since there is
 * no universal schema to check against generically.
 */
async function realValidation({ payload }: StageInput): Promise<StageOutput> {
  const parsed = CallAnalysisSummarySchema.safeParse(payload);
  if (!parsed.success) {
    return { payload: { ...asRecord(payload), validated: false } };
  }
  return { payload: { ...parsed.data, validated: true }, evidence: parsed.data.цитаты };
}

async function realHumanReview({ node, payload }: StageInput): Promise<StageOutput> {
  return { payload: { ...asRecord(payload), reviewed: true, reviewedBy: "auto-approved (no real reviewer wired up)", reviewNodeId: node.id } };
}

export function createRealStageHandlers(deps: RealStageDependencies): Readonly<Record<NodeType, StageHandler>> {
  const llmHandler = createLlmHandler(deps);
  return {
    input: passthrough,
    output: passthrough,
    store: realStore,
    router: passthrough,
    function: passthrough,
    llm: llmHandler,
    agent: llmHandler,
    tool: realTool,
    validation: realValidation,
    human_review: realHumanReview,
  };
}

/**
 * Convenience: a full StageRegistry built from `createRealStageHandlers`,
 * for callers that just want to pass `{ registry: realStageRegistry(deps) }`
 * to `executePipeline` instead of building the registry themselves.
 */
export function realStageRegistry(deps: RealStageDependencies): StageRegistry {
  const handlers = createRealStageHandlers(deps);
  return (Object.keys(handlers) as NodeType[]).reduce((registry, type) => registry.withOverride(type, handlers[type]), defaultStageRegistry);
}
