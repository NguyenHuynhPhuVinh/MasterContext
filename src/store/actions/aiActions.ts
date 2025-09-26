// src/store/actions/aiActions.ts
import { StateCreator } from "zustand";
import { AppState } from "../appStore";
import { ChatMessage } from "../types";
import i18n from "@/i18n";

export interface AiActions {
  setOpenRouterApiKey: (key: string) => Promise<void>;
  setAiModel: (model: string) => Promise<void>;
  sendChatMessage: (prompt: string) => Promise<void>;
  clearChatMessages: () => void;
}

export const createAiActions: StateCreator<AppState, [], [], AiActions> = (
  set,
  get
) => ({
  setOpenRouterApiKey: async (key: string) => {
    await get().actions.updateAppSettings({ openRouterApiKey: key });
  },
  setAiModel: async (model: string) => {
    await get().actions.updateAppSettings({ aiModel: model });
  },
  sendChatMessage: async (prompt: string) => {
    const { openRouterApiKey, aiModel, chatMessages } = get();
    if (!openRouterApiKey) {
      return;
    }

    const newUserMessage: ChatMessage = { role: "user", content: prompt };
    const newMessages = [...chatMessages, newUserMessage];

    set({ chatMessages: newMessages, isAiPanelLoading: true });

    try {
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openRouterApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: aiModel,
            messages: newMessages,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Unknown API error");
      }

      const data = await response.json();
      const assistantMessage = data.choices[0].message;

      set((state) => ({
        chatMessages: [...state.chatMessages, assistantMessage],
        isAiPanelLoading: false,
      }));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("OpenRouter API error:", errorMessage);

      const assistantErrorMessage: ChatMessage = {
        role: "assistant",
        content: `${t("aiPanel.error")}\n\n${errorMessage}`,
      };

      set((state) => ({
        chatMessages: [...state.chatMessages, assistantErrorMessage],
        isAiPanelLoading: false,
      }));
    }
  },
  clearChatMessages: () => {
    set({ chatMessages: [] });
  },
});

// Helper to get translations, as this file is outside React components
const t = (key: string) => i18n.t(key);
