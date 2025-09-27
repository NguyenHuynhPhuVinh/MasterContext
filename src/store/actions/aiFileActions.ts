// src/store/actions/aiFileActions.ts
import { StateCreator } from "zustand";
import { AppState } from "../appStore";
import { type AiFileActions } from "../types";

export const createAiFileActions: StateCreator<
  AppState,
  [],
  [],
  AiFileActions
> = (set) => ({
  attachFileToAi: (filePath) => {
    set((state) => {
      if (state.aiAttachedFiles.includes(filePath)) {
        return {}; // Already attached, do nothing
      }
      return { aiAttachedFiles: [...state.aiAttachedFiles, filePath] };
    });
  },
  detachFileFromAi: (filePath) => {
    set((state) => ({
      aiAttachedFiles: state.aiAttachedFiles.filter((p) => p !== filePath),
    }));
  },
  clearAttachedFilesFromAi: () => {
    set({ aiAttachedFiles: [] });
  },
});
