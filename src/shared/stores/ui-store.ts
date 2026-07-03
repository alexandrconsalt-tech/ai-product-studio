"use client";

import { create } from "zustand";

type ThemeMode = "light" | "dark";

type UiStore = Readonly<{
  theme: ThemeMode;
  sidebarCollapsed: boolean;
  assistantOpen: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleSidebar: () => void;
  toggleAssistant: () => void;
}>;

export const useUiStore = create<UiStore>((set) => ({
  theme: "dark",
  sidebarCollapsed: false,
  assistantOpen: true,
  setTheme: (theme) => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
    set({ theme });
  },
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleAssistant: () => set((state) => ({ assistantOpen: !state.assistantOpen })),
}));

