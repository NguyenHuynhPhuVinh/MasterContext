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
    const {
      openRouterApiKey,
      aiModel,
      activeChatSessionId,
      chatMessages,
      streamResponse,
      systemPrompt,
      temperature,
      topP,
      topK,
      maxTokens,
    } = get();
    if (!openRouterApiKey) {
      return;
    }

    let currentSessionId = activeChatSessionId;
    let isNewSession = false;

    // If there's no active session, create one
    if (!currentSessionId) {
      isNewSession = true;
      const newSession: AIChatSession = {
        id: Date.now().toString(),
        title: prompt.substring(0, 50), // Use first prompt as title
        createdAt: new Date().toISOString(),
        messages: [],
      };
      currentSessionId = newSession.id;
      set((state) => ({
        activeChatSessionId: newSession.id,
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
    const newUiMessages = [...chatMessages, newUserMessage];

    // Optimistically update UI
    set({ chatMessages: newUiMessages, isAiPanelLoading: true });

    const messagesToSend: ChatMessage[] = [];
    if (systemPrompt && systemPrompt.trim()) {
      messagesToSend.push({ role: "system", content: systemPrompt });
    }
    // Important: send the whole history for context
    messagesToSend.push(...chatMessages);
    messagesToSend.push(newUserMessage);

    // Build payload with advanced parameters
    const payload: Record<string, any> = {
      model: aiModel,
      messages: messagesToSend,
    };

    if (temperature) payload.temperature = temperature;
    if (topP) payload.top_p = topP;
    if (topK > 0) payload.top_k = topK;
    if (maxTokens > 0) payload.max_tokens = maxTokens;

    const saveSession = async (finalMessages: ChatMessage[]) => {
      const { rootPath, activeProfile, chatSessions } = get();
      const currentSessionHeader = chatSessions.find(
        (s) => s.id === currentSessionId
      );
      if (
        rootPath &&
        activeProfile &&
        currentSessionId &&
        currentSessionHeader
      ) {
        const sessionToSave: AIChatSession = {
          ...currentSessionHeader,
          messages: finalMessages,
        };
        await invoke("save_chat_session", {
          projectPath: rootPath,
          profileName: activeProfile,
          session: sessionToSave,
        });
      }
    };

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

        const finalMessages = [...newUiMessages, assistantMessage];
        set((state) => ({
          chatMessages: finalMessages,
          isAiPanelLoading: false,
        }));
        await saveSession(finalMessages);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("OpenRouter API error:", errorMessage);

        const assistantErrorMessage: ChatMessage = {
          role: "assistant",
          content: `${t("aiPanel.error")}\n\n${errorMessage}`,
        };

        const finalMessages = [...newUiMessages, assistantErrorMessage];
        set((state) => ({
          chatMessages: finalMessages,
          isAiPanelLoading: false,
        }));
        await saveSession(finalMessages);
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
            set({ isAiPanelLoading: false });
            return;
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
                  chatMessages: [...newUiMessages, newAssistantMessage],
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

      // Save after stream is complete
      await saveSession(get().chatMessages);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("OpenRouter API streaming error:", errorMessage);

      const assistantErrorMessage: ChatMessage = {
        role: "assistant",
        content: `${t("aiPanel.error")}\n\n${errorMessage}`,
      };

      const finalMessages = [...newUiMessages, assistantErrorMessage];
      set((state) => ({
        chatMessages: finalMessages,
        isAiPanelLoading: false,
      }));
      await saveSession(finalMessages);
    } finally {
      set({ isAiPanelLoading: false });
    }
  },
  createNewChatSession: () => {
    set({ chatMessages: [], activeChatSessionId: null });
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
});

// Helper to get translations, as this file is outside React components
const t = (key: string) => i18n.t(key);
