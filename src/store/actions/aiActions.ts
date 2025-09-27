// src/store/actions/aiActions.ts
import { StateCreator } from "zustand";
import { AppState } from "../appStore";
import {
  type ChatMessage,
  type AIChatSession,
  type AIChatSessionHeader,
  type GenerationInfo,
} from "../types";
import i18n from "@/i18n";
import { invoke } from "@tauri-apps/api/core";
import axios from "axios";

/**
 * Fetches generation info from OpenRouter with a retry mechanism to handle delays.
 * @param generationId The ID of the generation to fetch.
 * @param apiKey The OpenRouter API key.
 * @param retries Number of times to retry on failure.
 * @param delay Delay in milliseconds between retries.
 * @returns The generation info or null if all retries fail.
 */
const fetchGenerationInfoWithRetry = async (
  generationId: string,
  apiKey: string,
  retries = 3,
  delay = 500 // Increased delay to 1.5 seconds
): Promise<GenerationInfo | null> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(
        `https://openrouter.ai/api/v1/generation?id=${generationId}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      return response.data.data as GenerationInfo; // Success
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        console.log(`Attempt ${i + 1} failed (404). Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(
          "Failed to fetch generation info with non-retriable error:",
          error
        );
        return null; // Don't retry on other errors like 401, 500 etc.
      }
    }
  }
  console.warn(
    `All ${retries} attempts to fetch generation info failed for id: ${generationId}`
  );
  return null;
};

export interface AiActions {
  setAiChatMode: (mode: "ask" | "link") => void;
  setOpenRouterApiKey: (key: string) => Promise<void>;
  setSelectedAiModel: (model: string) => void;
  sendChatMessage: (prompt: string) => Promise<void>;
  fetchOpenRouterResponse: () => Promise<void>;
  saveCurrentChatSession: (messagesOverride?: ChatMessage[]) => Promise<void>;
  stopAiResponse: () => void;
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
  setAiChatMode: (mode) => set({ aiChatMode: mode }),
  setOpenRouterApiKey: async (key: string) => {
    await get().actions.updateAppSettings({ openRouterApiKey: key });
  },
  setSelectedAiModel: (model: string) => {
    set({ selectedAiModel: model });
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

      const newMessages = [...get().chatMessages, newUserMessage];
      // Optimistically update UI
      set({ chatMessages: newMessages });

      await get().actions.saveCurrentChatSession(newMessages); // Save with the new user message

      // Now proceed with the API call
      await get().actions.fetchOpenRouterResponse();
    } catch (error) {
      const errorMessage =
        error instanceof Error && error.name !== "AbortError"
          ? error.message
          : String(error);
      console.error("Error in sendChatMessage:", errorMessage);
      // Don't show an error message if the user aborted it
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
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
      aiModels,
      selectedAiModel,
      chatMessages,
      activeChatSession,
      streamResponse,
      systemPrompt,
      temperature,
      topP,
      topK,
      maxTokens,
      actions,
    } = get();

    // Create a new AbortController for this request
    const controller = new AbortController();
    set({ abortController: controller });

    if (!openRouterApiKey || !activeChatSession) return;
    const messagesToSend: ChatMessage[] = [];
    if (systemPrompt && systemPrompt.trim()) {
      messagesToSend.push({ role: "system", content: systemPrompt });
    }
    // Important: send the whole history for context
    messagesToSend.push(...chatMessages);

    // Build payload with advanced parameters
    const payload: Record<string, any> = {
      model: selectedAiModel || aiModels[0],
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
            signal: controller.signal, // Pass the signal
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || response.statusText);
        }

        const data = await response.json();
        const assistantMessage = data.choices[0].message;
        const generationId = data.id;

        if (generationId) {
          const fetchedInfo = await fetchGenerationInfoWithRetry(
            generationId,
            openRouterApiKey
          );
          if (fetchedInfo) {
            assistantMessage.generationInfo = fetchedInfo;
          }
        }

        const finalMessages = [...get().chatMessages, assistantMessage];
        set({
          chatMessages: finalMessages,
          isAiPanelLoading: false,
        });
        await get().actions.saveCurrentChatSession();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("OpenRouter API error:", errorMessage);

        const assistantErrorMessage: ChatMessage = {
          role: "assistant",
          content: `${t("aiPanel.error")}\n\n${errorMessage}`,
        };
        const finalMessages = [...get().chatMessages, assistantErrorMessage];
        set({
          chatMessages: finalMessages,
          isAiPanelLoading: false,
        });
        await get().actions.saveCurrentChatSession();
      } finally {
        // Always save and clean up
        set({ abortController: null });
        await actions.saveCurrentChatSession(); // Use destructured actions
      }
      return;
    }

    // --- Streaming Logic ---
    let generationId: string | null = null;
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
          signal: controller.signal, // Pass the signal
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
            if (json.id && !generationId) {
              generationId = json.id;
            }

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
      if (error instanceof Error && error.name === "AbortError") {
        console.log("AI response aborted by user.");
        // The finally block will handle saving and cleanup.
        return;
      }
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
      // Fetch generation info after stream is complete
      if (generationId) {
        const generationInfo = await fetchGenerationInfoWithRetry(
          generationId,
          openRouterApiKey
        );

        if (generationInfo) {
          // Update the last message with the generation info
          set((state) => {
            const lastMessage =
              state.chatMessages[state.chatMessages.length - 1];
            if (lastMessage && lastMessage.role === "assistant") {
              const updatedMessage = { ...lastMessage, generationInfo };
              const finalMessages = [
                ...state.chatMessages.slice(0, -1),
                updatedMessage,
              ];
              // Directly save the final state to avoid race conditions
              actions.saveCurrentChatSession(finalMessages);
              return {
                chatMessages: finalMessages,
              };
            }
            return state;
          });
        } else {
          // If we couldn't get generation info, still save the session.
          await actions.saveCurrentChatSession();
        }
      }

      set({ isAiPanelLoading: false });
      set({ abortController: null });
      // Always save the session after the stream attempt is finished.
      await actions.saveCurrentChatSession();
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
  saveCurrentChatSession: async (messagesOverride?: ChatMessage[]) => {
    const {
      rootPath,
      activeProfile,
      activeChatSession,
      chatMessages: currentMessages,
    } = get();
    if (rootPath && activeProfile && activeChatSession) {
      const messagesToSave = messagesOverride ?? currentMessages;

      // Recalculate total tokens for the session
      const totalTokens = messagesToSave.reduce((acc, msg) => {
        if (msg.generationInfo) {
          return (
            acc +
            (msg.generationInfo.tokens_prompt || 0) +
            (msg.generationInfo.tokens_completion || 0)
          );
        }
        // A simple approximation for user messages if needed, though prompt_tokens is better
        // For now, we only sum up assistant messages with generationInfo
        return acc;
      }, 0);

      const sessionToSave: AIChatSession = {
        ...activeChatSession,
        messages: messagesToSave,
        totalTokens: totalTokens > 0 ? totalTokens : undefined,
      };
      await invoke("save_chat_session", {
        projectPath: rootPath,
        profileName: activeProfile,
        session: sessionToSave,
      });
      // Keep the state in sync after saving
      set({
        activeChatSession: sessionToSave,
      });
    }
  },
  stopAiResponse: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      set({ abortController: null, isAiPanelLoading: false });
    }
  },
});

// Helper to get translations, as this file is outside React components
const t = (key: string) => i18n.t(key);
