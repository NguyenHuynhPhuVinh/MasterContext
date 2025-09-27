// src/store/actions/aiFileActions.ts
import { StateCreator } from "zustand";
import { AppState } from "../appStore";
import { type AiFileActions, type AttachedItem } from "../types";

export const createAiFileActions: StateCreator<
  AppState,
  [],
  [],
  AiFileActions
> = (set) => ({
  attachItemToAi: (item: AttachedItem) => {
    set((state) => {
      if (state.aiAttachedFiles.some((existing) => existing.id === item.id)) {
        return {}; // Already attached, do nothing
      }
      return { aiAttachedFiles: [...state.aiAttachedFiles, item] };
    });
  },
  detachItemFromAi: (itemId: string) => {
    set((state) => ({
      aiAttachedFiles: state.aiAttachedFiles.filter(
        (item) => item.id !== itemId
      ),
    }));
  },
  clearAttachedFilesFromAi: () => {
    set({ aiAttachedFiles: [] });
  },
});
