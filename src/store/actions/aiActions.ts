// src/store/actions/aiActions.ts
import { StateCreator } from "zustand";
import { AppState } from "../appStore";
import {
  type ChatMessage,
  type AIChatSession,
  type AIChatSessionHeader,
} from "../types";
import i18n from "@/i18n";
import { invoke } from "@tauri-apps/api/core";

export interface AiActions {
  setOpenRouterApiKey: (key: string) => Promise<void>;
  setAiModel: (model: string) => Promise<void>;
  sendChatMessage: (prompt: string) => Promise<void>;
  fetchOpenRouterResponse: () => Promise<void>;
  saveCurrentChatSession: () => Promise<void>;
  createNewChatSession: () => void;
  loadChatSessions: () => Promise<void>;
  loadChatSession: (sessionId: string) => Promise<void>;
  deleteChatSession: (sessionId: string) => Promise<void>;
  updateChatSessionTitle: (
    sessionId: string,
    newTitle: string
  ) => Promise<void>;
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
    const { openRouterApiKey } = get();
    if (!openRouterApiKey) {
      return;
    }

    set({ isAiPanelLoading: true });

    try {
      let currentSession = get().activeChatSession;

      // If there's no active session, create one on the backend first
      if (!currentSession) {
        const { rootPath, activeProfile } = get();
        if (!rootPath || !activeProfile) {
          throw new Error("Project path or profile not set.");
        }
        const newSession = await invoke<AIChatSession>("create_chat_session", {
          projectPath: rootPath,
          profileName: activeProfile,
          title: prompt.substring(0, 50),
        });

        currentSession = newSession;

        set((state) => ({
          activeChatSession: newSession,
          activeChatSessionId: newSession.id,
          chatMessages: [], // Start with empty messages
          chatSessions: [
            {
              id: newSession.id,
              title: newSession.title,
              createdAt: newSession.createdAt,
            },
            ...state.chatSessions,
          ],
        }));
      }

      const newUserMessage: ChatMessage = { role: "user", content: prompt };

      // Optimistically update UI
      set((state) => ({
        chatMessages: [...state.chatMessages, newUserMessage],
      }));

      await get().actions.saveCurrentChatSession(); // Save with the new user message

      // Now proceed with the API call
      await get().actions.fetchOpenRouterResponse();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Error in sendChatMessage:", errorMessage);
      const assistantErrorMessage: ChatMessage = {
        role: "assistant",
        content: `${t("aiPanel.error")}\n\n${errorMessage}`,
      };
      set((state) => ({
        chatMessages: [...state.chatMessages, assistantErrorMessage],
        isAiPanelLoading: false,
      }));
      await get().actions.saveCurrentChatSession();
    }
  },
  // New helper action to fetch response from OpenRouter
  fetchOpenRouterResponse: async () => {
    const {
      openRouterApiKey,
      aiModel,
      chatMessages,
      activeChatSession,
      streamResponse,
      systemPrompt,
      temperature,
      topP,
      topK,
      maxTokens,
    } = get();
    if (!openRouterApiKey || !activeChatSession) return;
    const messagesToSend: ChatMessage[] = [];
    if (systemPrompt && systemPrompt.trim()) {
      messagesToSend.push({ role: "system", content: systemPrompt });
    }
    // Important: send the whole history for context
    messagesToSend.push(...chatMessages);

    // Build payload with advanced parameters
    const payload: Record<string, any> = {
      model: aiModel,
      messages: messagesToSend,
    };

    if (temperature) payload.temperature = temperature;
    if (topP) payload.top_p = topP;
    if (topK > 0) payload.top_k = topK;
    if (maxTokens > 0) payload.max_tokens = maxTokens;

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
              ...payload,
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
        await get().actions.saveCurrentChatSession();
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
        await get().actions.saveCurrentChatSession();
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
            ...payload,
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

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let isFirstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep the last, possibly incomplete line

        for (const line of lines) {
          if (line.trim() === "" || !line.startsWith("data:")) continue;
          if (line.includes("data: [DONE]")) {
            // Use break to exit the loop and proceed to the finally block for saving.
            break;
          }

          try {
            const json = JSON.parse(line.substring(5)); // Remove "data: "
            const delta = json.choices[0]?.delta?.content;

            if (delta) {
              if (isFirstChunk) {
                isFirstChunk = false;
                const newAssistantMessage: ChatMessage = {
                  role: "assistant",
                  content: delta,
                };
                set((state) => ({
                  chatMessages: [...state.chatMessages, newAssistantMessage],
                }));
              } else {
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

      const finalMessages = [...get().chatMessages, assistantErrorMessage];
      set({
        chatMessages: finalMessages,
        isAiPanelLoading: false,
      });
    } finally {
      set({ isAiPanelLoading: false });
      // Always save the session after the stream attempt is finished.
      await get().actions.saveCurrentChatSession();
    }
  },
  createNewChatSession: () => {
    set({
      chatMessages: [],
      activeChatSessionId: null,
      activeChatSession: null,
    });
  },
  loadChatSessions: async () => {
    const { rootPath, activeProfile } = get();
    if (!rootPath || !activeProfile) return;
    try {
      const sessions = await invoke<AIChatSessionHeader[]>(
        "list_chat_sessions",
        { projectPath: rootPath, profileName: activeProfile }
      );
      set({ chatSessions: sessions });
    } catch (e) {
      console.error("Failed to load chat sessions:", e);
      set({ chatSessions: [] });
    }
  },
  loadChatSession: async (sessionId: string) => {
    const { rootPath, activeProfile } = get();
    if (!rootPath || !activeProfile) return;
    try {
      const session = await invoke<AIChatSession>("load_chat_session", {
        projectPath: rootPath,
        profileName: activeProfile,
        sessionId,
      });
      set({
        activeChatSession: session,
        activeChatSessionId: session.id,
        chatMessages: session.messages,
      });
    } catch (e) {
      console.error(`Failed to load chat session ${sessionId}:`, e);
    }
  },
  deleteChatSession: async (sessionId: string) => {
    const { rootPath, activeProfile, activeChatSessionId } = get();
    if (!rootPath || !activeProfile) return;
    await invoke("delete_chat_session", {
      projectPath: rootPath,
      profileName: activeProfile,
      sessionId,
    });
    set((state) => ({
      chatSessions: state.chatSessions.filter((s) => s.id !== sessionId),
    }));
    if (activeChatSessionId === sessionId) {
      get().actions.createNewChatSession();
    }
  },
  updateChatSessionTitle: async (sessionId: string, newTitle: string) => {
    const { rootPath, activeProfile } = get();
    if (!rootPath || !activeProfile) return;
    await invoke("update_chat_session_title", {
      projectPath: rootPath,
      profileName: activeProfile,
      sessionId,
      newTitle,
    });
    set((state) => ({
      chatSessions: state.chatSessions.map((s) =>
        s.id === sessionId ? { ...s, title: newTitle } : s
      ),
    }));
  },
  saveCurrentChatSession: async () => {
    const { rootPath, activeProfile, activeChatSession, chatMessages } = get();
    if (rootPath && activeProfile && activeChatSession) {
      const sessionToSave: AIChatSession = {
        ...activeChatSession,
        messages: chatMessages, // Use the latest messages from the UI state
      };
      await invoke("save_chat_session", {
        projectPath: rootPath,
        profileName: activeProfile,
        session: sessionToSave,
      });
      // Keep the state in sync after saving
      set({ activeChatSession: sessionToSave });
    }
  },
});

// Helper to get translations, as this file is outside React components
const t = (key: string) => i18n.t(key);
