"use client";

import { create } from "zustand";
import type { Architecture } from "@/entities/Architecture/model/types";
import { createTimestamp } from "@/entities/shared";
import { useRepositoryStore } from "./repository-store";

type ArchitectureStore = Readonly<{
  updateArchitecture: (architecture: Architecture) => void;
}>;

export const useArchitectureStore = create<ArchitectureStore>(() => ({
  updateArchitecture: (architecture) => {
    const repository = useRepositoryStore.getState();
    const snapshot = repository.snapshot;
    if (!snapshot) return;
    repository.setSnapshot({
      ...snapshot,
      architectures: snapshot.architectures.map((item) => (item.id === architecture.id ? { ...architecture, updatedAt: createTimestamp() } : item)),
    });
  },
}));

