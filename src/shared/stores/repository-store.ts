"use client";

import { create } from "zustand";
import type { RepositorySnapshot } from "@/shared/repositories/types";
import { projectRepository, REPOSITORY_STORAGE_KEY } from "@/shared/repositories/local-storage-repository";

type RepositoryState = Readonly<{
  snapshot: RepositorySnapshot | null;
  selectedProjectId: string | null;
  load: () => void;
  reset: () => void;
  setSnapshot: (snapshot: RepositorySnapshot) => void;
  selectProject: (projectId: string) => void;
}>;

const selectedProjectStorageKey = "ai-product-studio.selected-project-id.v1";

const readSelectedProjectId = (): string | null => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(selectedProjectStorageKey);
};

const writeSelectedProjectId = (projectId: string): void => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(selectedProjectStorageKey, projectId);
  }
};

/**
 * Best-effort background sync with /api/repository (Postgres, see
 * postgres-store.ts), layered additively on top of the synchronous
 * localStorage repository -- never blocks or changes the synchronous
 * load()/setSnapshot() contract every existing screen/store already
 * depends on (CLAUDE.md §8.7, §63 debt item 5: a full async migration of
 * this interface is a distinct, larger initiative, deliberately deferred).
 *
 * pushSnapshotToServer is fire-and-forget: a failed/offline push is logged,
 * never thrown, since losing durability for one save must never break the
 * UI that already has the correct data in memory and in localStorage.
 */
function pushSnapshotToServer(snapshot: RepositorySnapshot): void {
  if (typeof fetch === "undefined") return;
  fetch("/api/repository", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snapshot) }).catch((error) => {
    console.warn("Background sync to /api/repository failed (data is still saved locally):", error);
  });
}

export const useRepositoryStore = create<RepositoryState>((set, get) => ({
  snapshot: null,
  selectedProjectId: null,
  load: () => {
    // Captured before projectRepository.load(), which auto-seeds localStorage
    // with demo data on a first run -- by the time load() returns, "was this
    // browser empty" can no longer be told apart from "freshly seeded".
    const hadLocalData = typeof window !== "undefined" && Boolean(window.localStorage.getItem(REPOSITORY_STORAGE_KEY));
    const snapshot = projectRepository.load();
    const storedProjectId = readSelectedProjectId();
    const selectedProjectId = storedProjectId && snapshot.projects.some((project) => project.id === storedProjectId) ? storedProjectId : snapshot.projects[0]?.id ?? null;
    if (selectedProjectId) writeSelectedProjectId(selectedProjectId);
    set({ snapshot, selectedProjectId });

    if (typeof fetch === "undefined") return;
    fetch("/api/repository")
      .then((res) => res.json())
      .then((body: { configured?: boolean; snapshot?: RepositorySnapshot | null }) => {
        if (!body?.configured) return;
        if (!hadLocalData && body.snapshot) {
          // Fresh browser (cleared storage, new device, first deploy visit)
          // recovers real data from the server, then passes it through the
          // same non-destructive migrations/recovery seeds as local data.
          // Applying the raw server snapshot directly used to replace a valid
          // local seed with an empty or stale product list.
          projectRepository.save(body.snapshot);
          const recoveredSnapshot = projectRepository.load();
          const recoveredProjectId = recoveredSnapshot.projects.some((project) => project.id === get().selectedProjectId) ? get().selectedProjectId : recoveredSnapshot.projects[0]?.id ?? null;
          if (recoveredProjectId) writeSelectedProjectId(recoveredProjectId);
          set({ snapshot: recoveredSnapshot, selectedProjectId: recoveredProjectId });
          if (JSON.stringify(recoveredSnapshot) !== JSON.stringify(body.snapshot)) pushSnapshotToServer(recoveredSnapshot);
        } else if (!body.snapshot) {
          // Database provisioned but empty (first time it's been connected
          // to a browser that already has real local data) -- seed it.
          pushSnapshotToServer(snapshot);
        }
      })
      .catch((error) => {
        console.warn("Background fetch from /api/repository failed (using local data):", error);
      });
  },
  reset: () => {
    const snapshot = projectRepository.reset();
    const selectedProjectId = snapshot.projects[0]?.id ?? null;
    if (selectedProjectId) writeSelectedProjectId(selectedProjectId);
    set({ snapshot, selectedProjectId });
    pushSnapshotToServer(snapshot);
  },
  setSnapshot: (snapshot) => {
    projectRepository.save(snapshot);
    set((state) => ({
      snapshot,
      selectedProjectId: state.selectedProjectId && snapshot.projects.some((project) => project.id === state.selectedProjectId) ? state.selectedProjectId : snapshot.projects[0]?.id ?? null,
    }));
    pushSnapshotToServer(snapshot);
  },
  selectProject: (projectId) => {
    writeSelectedProjectId(projectId);
    set({ selectedProjectId: projectId });
  },
}));
