"use client";

import { create } from "zustand";
import type { Product } from "@/entities/Product/model/types";
import { createTimestamp } from "@/entities/shared";
import { useRepositoryStore } from "./repository-store";

type ProductStore = Readonly<{
  updateProduct: (product: Product) => void;
}>;

export const useProductStore = create<ProductStore>(() => ({
  updateProduct: (product) => {
    const repository = useRepositoryStore.getState();
    const snapshot = repository.snapshot;
    if (!snapshot) return;
    repository.setSnapshot({
      ...snapshot,
      products: snapshot.products.map((item) => (item.id === product.id ? { ...product, updatedAt: createTimestamp() } : item)),
    });
  },
}));

