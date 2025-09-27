// src/store/actions/aiChatActions.ts
import { StateCreator } from "zustand";
import { AppState } from "../appStore";
import { type ChatMessage, type AIChatSession } from "../types";
import i18n from "@/i18n";
import { invoke } from "@tauri-apps/api/core";
import {
  handleNonStreamingResponse,
  handleStreamingResponse,
} from "@/lib/openRouter";
import {
  handleNonStreamingResponseGoogle,
  handleStreamingResponseGoogle,
  toGooglePayload,
} from "@/lib/googleAI";
import { getGoogleTools, getOpenRouterTools } from "@/lib/aiTools";
import { type FileNode } from "../types";

export interface AiChatActions {
  sendChatMessage: (prompt: string) => Promise<void>;
  fetchAiResponse: () => Promise<void>;
  stopAiResponse: () => void;
}

export const createAiChatActions: StateCreator<
  AppState,
  [],
  [],
  AiChatActions
> = (set, get) => ({
  sendChatMessage: async (prompt: string) => {
    const {
      openRouterApiKey,
      googleApiKey,
      aiAttachedFiles,
      rootPath,
      allAvailableModels,
      selectedAiModel,
    } = get();
    const model = allAvailableModels.find((m) => m.id === selectedAiModel);

    if (
      (model?.provider === "openrouter" && !openRouterApiKey) ||
      (model?.provider === "google" && !googleApiKey)
    ) {
      return;
    }

    set({ isAiPanelLoading: true });

    try {
      let currentSession = get().activeChatSession;

      // If there's no active session, create one on the backend first
      if (!currentSession) {
        const { activeProfile } = get();
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

      let hiddenContent: string | undefined = undefined;
      if (aiAttachedFiles.length > 0 && rootPath) {
        const isDirectory = (path: string, tree: FileNode | null): boolean => {
          if (!tree) return false;
          if (path === "") return true;
          const parts = path.split("/").filter((p) => p);
          let currentNode = tree;
          for (const part of parts) {
            const child = currentNode.children?.find((c) => c.name === part);
            if (!child) return false;
            currentNode = child;
          }
          return Array.isArray(currentNode.children);
        };

        const fileTree = get().fileTree;

        const contentPromises = aiAttachedFiles.map(async (filePath) => {
          if (isDirectory(filePath, fileTree)) {
            const treeStructure = await invoke<string>(
              "generate_directory_tree",
              {
                rootPathStr: rootPath,
                dirRelPath: filePath,
              }
            );
            return `--- START OF DIRECTORY STRUCTURE FOR ${filePath} ---\n${treeStructure}\n--- END OF DIRECTORY STRUCTURE FOR ${filePath} ---`;
          } else {
            const fileContent = await invoke<string>("get_file_content", {
              rootPathStr: rootPath,
              fileRelPath: filePath,
            });
            return `--- START OF FILE ${filePath} ---\n${fileContent}\n--- END OF FILE ${filePath} ---`;
          }
        });

        const allContents = await Promise.all(contentPromises);
        hiddenContent = allContents.join("\n\n");
      }
      const newUserMessage: ChatMessage = {
        role: "user",
        content: prompt,
        hiddenContent,
        attachedFiles: [...aiAttachedFiles], // Copy attachments to the message
      };

      const newMessages = [...get().chatMessages, newUserMessage];
      // Optimistically update UI
      set({ chatMessages: newMessages });

      await get().actions.saveCurrentChatSession(newMessages); // Save with the new user message

      // Clear attachments after preparing the message
      get().actions.clearAttachedFilesFromAi();

      // Now proceed with the API call
      await get().actions.fetchAiResponse();
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
  // New helper action to fetch response from AI provider
  fetchAiResponse: async () => {
    const {
      openRouterApiKey,
      googleApiKey,
      allAvailableModels,
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
      aiChatMode,
    } = get();
    const { editingGroupId } = get(); // Lấy ID nhóm đang chỉnh sửa

    const controller = new AbortController();
    set({ abortController: controller });

    const model = allAvailableModels.find((m) => m.id === selectedAiModel);
    if (!model || !activeChatSession) return;

    const apiKey =
      model.provider === "google" ? googleApiKey : openRouterApiKey;
    if (!apiKey) {
      console.error(`API key for ${model.provider} is not set.`);
      set({ isAiPanelLoading: false });
      return;
    }
    const messagesToSend: ChatMessage[] = [];
    if (systemPrompt && systemPrompt.trim()) {
      messagesToSend.push({ role: "system", content: systemPrompt });
    }
    // Important: send the whole history for context
    messagesToSend.push(...chatMessages);

    // --- Provider-specific logic ---
    if (model.provider === "google") {
      // --- GOOGLE AI LOGIC ---
      const tools = getGoogleTools(aiChatMode, editingGroupId); // Now from aiTools.ts
      const payload = toGooglePayload(messagesToSend, {
        systemPrompt,
        temperature,
        topP,
        topK,
        maxTokens,
        tools,
      });

      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${
          model.id
        }:${streamResponse ? "streamGenerateContent" : "generateContent"}`;
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "x-goog-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || response.statusText);
        }

        if (streamResponse) {
          await handleStreamingResponseGoogle(response, {
            getState: get,
            setState: set,
          });
        } else {
          const assistantMessage = await handleNonStreamingResponseGoogle(
            response
          );
          set((state) => ({
            chatMessages: [...state.chatMessages, assistantMessage],
          }));
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          console.log("AI response aborted by user.");
          return;
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("Google AI API error:", errorMessage);

        const assistantErrorMessage: ChatMessage = {
          role: "assistant",
          content: `${t("aiPanel.error")}\n\n${errorMessage}`,
        };

        set((state) => ({
          chatMessages: [...state.chatMessages, assistantErrorMessage],
        }));
      } finally {
        set({ isAiPanelLoading: false, abortController: null });
        await get().actions.saveCurrentChatSession();
      }
    } else {
      // --- OPENROUTER LOGIC (existing logic) ---
      const tools = getOpenRouterTools(aiChatMode, editingGroupId);
      const payload: Record<string, any> = {
        model: selectedAiModel || aiModels[0]?.id,
        messages: messagesToSend.map(
          // Filter out UI-specific properties before sending
          ({ hidden, hiddenContent, attachedFiles, ...msg }) => {
            const fullContent = (hiddenContent || "") + (msg.content || "");
            // Filter out the hidden property before sending
            return { ...msg, content: fullContent };
          }
        ),
        tools,
      };

      try {
        const response = await fetch(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${openRouterApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...payload, stream: streamResponse }),
            signal: controller.signal, // Pass the signal
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || response.statusText);
        }

        if (streamResponse) {
          await handleStreamingResponse(response, {
            getState: get,
            setState: set,
          });
        } else {
          const assistantMessage = await handleNonStreamingResponse(
            response,
            apiKey
          );
          set((state) => ({
            chatMessages: [...state.chatMessages, assistantMessage],
          }));
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          console.log("AI response aborted by user.");
          return;
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("OpenRouter API error:", errorMessage);

        const assistantErrorMessage: ChatMessage = {
          role: "assistant",
          content: `${t("aiPanel.error")}\n\n${errorMessage}`,
        };

        set((state) => ({
          chatMessages: [...state.chatMessages, assistantErrorMessage],
        }));
      } finally {
        set({ isAiPanelLoading: false });
        set({ abortController: null });
        // Always save the session after the stream attempt is finished.
        await get().actions.saveCurrentChatSession();
      }
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
