import { afterEach, describe, expect, it, vi } from "vitest";
import { AI_SUMMARY_TEN_AUGUST_PROJECT_ID } from "@/shared/repositories/local-storage-repository";
import type { RepositorySnapshot } from "@/shared/repositories/types";
import { useRepositoryStore } from "./repository-store";

const emptySnapshot = (): RepositorySnapshot => ({
  projects: [], products: [], architectures: [], pipelines: [], runs: [], reviews: [], frameworks: [], knowledgeModules: [], models: [], prompts: [],
});

function stubBrowserStorage() {
  const values = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    },
  });
  return values;
}

afterEach(() => {
  vi.unstubAllGlobals();
  useRepositoryStore.setState({ snapshot: null, selectedProjectId: null });
});

describe("repository-store fresh-browser recovery", () => {
  it("does not let an empty server snapshot erase recovery products", async () => {
    stubBrowserStorage();
    vi.stubGlobal("fetch", vi.fn(async (_input: string, init?: RequestInit) => {
      if (init?.method === "POST") return { ok: true, json: async () => ({ ok: true }) };
      return { ok: true, json: async () => ({ configured: true, snapshot: emptySnapshot() }) };
    }));

    useRepositoryStore.getState().load();

    await vi.waitFor(() => {
      expect(useRepositoryStore.getState().snapshot?.projects.some((project) => project.id === AI_SUMMARY_TEN_AUGUST_PROJECT_ID)).toBe(true);
    });
    expect(useRepositoryStore.getState().snapshot?.projects).not.toHaveLength(0);
  });
});
