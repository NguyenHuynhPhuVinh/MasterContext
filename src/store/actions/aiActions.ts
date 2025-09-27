// src/store/actions/aiActions.ts
import { StateCreator } from "zustand";
import { AppState } from "../appStore";

export interface AiSettingsActions {
  setAiChatMode: (mode: "ask" | "context" | "agent") => void;
  setOpenRouterApiKey: (key: string) => Promise<void>;
  setSelectedAiModel: (model: string) => void;
}

export const createAiSettingsActions: StateCreator<
  AppState,
  [],
  [],
  AiSettingsActions
> = (set, get) => ({
  setAiChatMode: (mode) => set({ aiChatMode: mode }),
  setOpenRouterApiKey: async (key: string) => {
    await get().actions.updateAppSettings({ openRouterApiKey: key });
  },
  setSelectedAiModel: (model: string) => {
    set({ selectedAiModel: model });
  },
});
