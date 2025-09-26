// src/store/actions/aiActions.ts
import { StateCreator } from "zustand";
import { AppState } from "../appStore";
import axios, { isAxiosError } from "axios";
import { type ChatMessage } from "../types";
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
      // Sử dụng axios để có xử lý lỗi tốt hơn và tự động chuyển đổi JSON
      const response = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          // body
          model: aiModel,
          messages: newMessages,
        },
        {
          // config
          headers: {
            Authorization: `Bearer ${openRouterApiKey}`,
          },
        }
      );

      const data = response.data;
      const assistantMessage = data.choices[0].message;

      set((state) => ({
        chatMessages: [...state.chatMessages, assistantMessage],
        isAiPanelLoading: false,
      }));
    } catch (error) {
      // Xử lý lỗi của axios một cách cụ thể hơn
      let errorMessage = "An unknown error occurred.";
      if (isAxiosError(error) && (error as any).response) {
        errorMessage =
          (error as any).response.data?.error?.message ||
          (error as any).message ||
          "Failed to fetch from OpenRouter API.";
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      console.error("OpenRouter API error:", errorMessage);

      const assistantErrorMessage: ChatMessage = {
        role: "assistant",
        content: `${t("aiPanel.error")}\n\n${String(errorMessage)}`,
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
