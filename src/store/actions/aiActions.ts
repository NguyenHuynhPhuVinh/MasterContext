// src/store/actions/aiActions.ts
import { StateCreator } from "zustand";
import { AppState } from "../appStore";
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
    const {
      openRouterApiKey,
      aiModel,
      chatMessages,
      streamResponse,
      systemPrompt,
    } = get();
    if (!openRouterApiKey) {
      return;
    }

    const newUserMessage: ChatMessage = { role: "user", content: prompt };
    const newUiMessages = [...chatMessages, newUserMessage];

    const messagesToSend: ChatMessage[] = [];
    if (systemPrompt && systemPrompt.trim()) {
      messagesToSend.push({ role: "system", content: systemPrompt });
    }
    // Important: send the whole history for context
    messagesToSend.push(...chatMessages);
    messagesToSend.push(newUserMessage);

    set({ chatMessages: newUiMessages, isAiPanelLoading: true });

    // Handle non-streaming case first
    if (!streamResponse) {
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
              messages: messagesToSend,
              stream: false, // Explicitly false
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || response.statusText);
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
      return;
    }

    // --- Streaming Logic ---
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
            messages: messagesToSend,
            stream: true,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || response.statusText);
      }

      if (!response.body) {
        throw new Error("Response body is null");
      }

      // Add a placeholder for the assistant's message
      const placeholderMessage: ChatMessage = {
        role: "assistant",
        content: "",
      };
      set((state) => ({
        chatMessages: [...state.chatMessages, placeholderMessage],
      }));

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep the last, possibly incomplete line

        for (const line of lines) {
          if (line.trim() === "" || !line.startsWith("data:")) continue;
          if (line.includes("data: [DONE]")) {
            set({ isAiPanelLoading: false });
            return;
          }

          try {
            const json = JSON.parse(line.substring(5)); // Remove "data: "
            const delta = json.choices[0]?.delta?.content;

            if (delta) {
              set((state) => {
                const lastMessage =
                  state.chatMessages[state.chatMessages.length - 1];
                if (lastMessage && lastMessage.role === "assistant") {
                  const updatedMessage = {
                    ...lastMessage,
                    content: lastMessage.content + delta,
                  };
                  return {
                    chatMessages: [
                      ...state.chatMessages.slice(0, -1),
                      updatedMessage,
                    ],
                  };
                }
                return state;
              });
            }
          } catch (e) {
            console.error("Error parsing stream chunk:", e, "Line:", line);
          }
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("OpenRouter API streaming error:", errorMessage);

      const assistantErrorMessage: ChatMessage = {
        role: "assistant",
        content: `${t("aiPanel.error")}\n\n${errorMessage}`,
      };

      set((state) => ({
        chatMessages: [...state.chatMessages, assistantErrorMessage],
        isAiPanelLoading: false,
      }));
    } finally {
      set({ isAiPanelLoading: false });
    }
  },
  clearChatMessages: () => {
    set({ chatMessages: [] });
  },
});

// Helper to get translations, as this file is outside React components
const t = (key: string) => i18n.t(key);
