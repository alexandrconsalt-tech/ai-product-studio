/**
 * Prompt Registry: versioned prompt bodies, keyed by the domain
 * `Prompt.id` (src/entities/Prompt). The `Prompt` entity itself only
 * tracks metadata (purpose, status, owner) -- CLAUDE.md §15 notes it
 * has "no prompt body/text field, no template variables, no rendering
 * engine anywhere in the codebase." This registry is that missing
 * piece, deliberately kept separate from the domain entity rather
 * than added as a field on it: prompt bodies are large, versioned,
 * and change independently of the lightweight catalog record that
 * references them.
 *
 * Variables use `{{snake_case}}` interpolation per CLAUDE.md §15 PE-3.
 */

export class PromptNotFoundError extends Error {
  readonly retryable = false;
  constructor(promptId: string, version?: string) {
    super(version ? `Prompt "${promptId}" has no version "${version}" registered.` : `Prompt "${promptId}" is not registered.`);
    this.name = "PromptNotFoundError";
  }
}

export class PromptRenderError extends Error {
  readonly retryable = false;
  constructor(promptId: string, missingVariables: readonly string[]) {
    super(`Prompt "${promptId}" is missing required variable(s): ${missingVariables.join(", ")}.`);
    this.name = "PromptRenderError";
  }
}

export type PromptVersionEntry = Readonly<{
  version: string;
  template: string;
  registeredAt: string;
}>;

export type PromptTemplateVariables = Readonly<Record<string, string>>;

export type PromptRegistry = Readonly<{
  /**
   * `registeredAt` defaults to `new Date().toISOString()` when
   * omitted. Callers that seed a module-level singleton registry at
   * import time (e.g. `seed-prompts.ts`) MUST pass an explicit, fixed
   * value instead of relying on the default -- `new Date()` evaluated
   * once at module load produces a different timestamp on the server
   * (SSR) than on the client (hydration), causing a React hydration
   * mismatch. Found via an actual in-browser check (Next.js's own
   * hydration-error overlay), not assumed.
   */
  register(promptId: string, version: string, template: string, registeredAt?: string): PromptRegistry;
  versions(promptId: string): readonly PromptVersionEntry[];
  resolve(promptId: string, version?: string): PromptVersionEntry;
  render(promptId: string, variables: PromptTemplateVariables, version?: string): string;
  promptIds(): readonly string[];
}>;

const VARIABLE_PATTERN = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g;

export function extractVariableNames(template: string): string[] {
  return [...new Set([...template.matchAll(VARIABLE_PATTERN)].map((match) => match[1]))];
}

function renderTemplate(promptId: string, template: string, variables: PromptTemplateVariables): string {
  const required = new Set(extractVariableNames(template));
  const missing = [...required].filter((name) => !(name in variables));
  if (missing.length > 0) {
    throw new PromptRenderError(promptId, missing);
  }
  return template.replace(VARIABLE_PATTERN, (_, name: string) => variables[name]);
}

function createRegistry(entries: ReadonlyMap<string, readonly PromptVersionEntry[]>): PromptRegistry {
  return {
    register(promptId, version, template, registeredAt) {
      const existing = entries.get(promptId) ?? [];
      if (existing.some((entry) => entry.version === version)) {
        throw new Error(`Prompt "${promptId}" version "${version}" is already registered (versions are immutable, CLAUDE.md §17 PV-2).`);
      }
      const next = new Map(entries);
      next.set(promptId, [...existing, { version, template, registeredAt: registeredAt ?? new Date().toISOString() }]);
      return createRegistry(next);
    },
    versions(promptId) {
      return entries.get(promptId) ?? [];
    },
    resolve(promptId, version) {
      const list = entries.get(promptId);
      if (!list || list.length === 0) throw new PromptNotFoundError(promptId);
      if (version === undefined) return list[list.length - 1];
      const match = list.find((entry) => entry.version === version);
      if (!match) throw new PromptNotFoundError(promptId, version);
      return match;
    },
    render(promptId, variables, version) {
      const entry = this.resolve(promptId, version);
      return renderTemplate(promptId, entry.template, variables);
    },
    promptIds() {
      return [...entries.keys()];
    },
  };
}

export const emptyPromptRegistry: PromptRegistry = createRegistry(new Map());
