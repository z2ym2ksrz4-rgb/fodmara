import { create } from "zustand";

export type SheetMode = "quick" | "live" | "journey" | "full";
export type InfoSheet = "redFlags" | "widget" | "plan" | "gut" | "bristol" | "fodmap" | null;

/** Cross-screen UI state: open sheets (flare-up, meal, toilet, foods), info sheets, and a bump counter so screens reload after writes. */
type Ui = {
  episodeSheetId: string | null;
  episodeSheetMode: SheetMode;
  mealId: string | null;
  stoolId: string | null;
  foodsOpen: boolean;
  medsOpen: boolean;
  infoSheet: InfoSheet;
  version: number;
  openEpisode: (id: string, mode?: SheetMode) => void;
  closeEpisode: () => void;
  setMode: (mode: SheetMode) => void;
  openMeal: (id: string | null) => void;
  openStool: (id: string | null) => void;
  setFoodsOpen: (v: boolean) => void;
  setMedsOpen: (v: boolean) => void;
  openInfo: (which: InfoSheet) => void;
  bump: () => void;
};
export const useUi = create<Ui>((set) => ({
  episodeSheetId: null,
  episodeSheetMode: "full",
  mealId: null,
  stoolId: null,
  foodsOpen: false,
  medsOpen: false,
  infoSheet: null,
  version: 0,
  openEpisode: (id, mode = "full") => set({ episodeSheetId: id, episodeSheetMode: mode }),
  closeEpisode: () => set({ episodeSheetId: null }),
  setMode: (episodeSheetMode) => set({ episodeSheetMode }),
  openMeal: (mealId) => set({ mealId }),
  openStool: (stoolId) => set({ stoolId }),
  setFoodsOpen: (foodsOpen) => set({ foodsOpen }),
  setMedsOpen: (medsOpen) => set({ medsOpen }),
  openInfo: (infoSheet) => set({ infoSheet }),
  bump: () => set((s) => ({ version: s.version + 1 })),
}));
