"use client";

import { create } from "zustand";

import type { Gender } from "@/generated/prisma/enums";

export type SortMode = "name_asc" | "category" | "availability";

export type DraftPlayerBoardDensity = "comfortable" | "compact";

interface DraftBoardUiState {
  search: string;
  categoryFilter: string | "ALL";
  genderFilter: Gender | "ALL";
  sortMode: SortMode;
  playerBoardDensity: DraftPlayerBoardDensity;
  setSearch: (value: string) => void;
  setCategoryFilter: (value: string | "ALL") => void;
  setGenderFilter: (value: Gender | "ALL") => void;
  setSortMode: (value: SortMode) => void;
  togglePlayerBoardDensity: () => void;
}

export const useDraftBoardUiStore = create<DraftBoardUiState>((set) => ({
  search: "",
  categoryFilter: "ALL",
  genderFilter: "ALL",
  sortMode: "availability",
  playerBoardDensity: "comfortable",
  setSearch: (search) => set({ search }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
  setGenderFilter: (genderFilter) => set({ genderFilter }),
  setSortMode: (sortMode) => set({ sortMode }),
  togglePlayerBoardDensity: () =>
    set((state) => ({
      playerBoardDensity: state.playerBoardDensity === "comfortable" ? "compact" : "comfortable",
    })),
}));
