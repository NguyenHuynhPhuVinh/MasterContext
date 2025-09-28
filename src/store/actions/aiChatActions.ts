// src/store/actions/aiChatActions.ts
import { StateCreator } from "zustand";
import { AppState } from "../appStore";
import {
  type ChatMessage,
  type AIChatSession,
  type AttachedItem,
} from "../types";
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

export interface AiChatActions {
  sendChatMessage: (prompt: string) => Promise<void>;
  fetchAiResponse: () => Promise<void>;
  stopAiResponse: () => void;
  regenerateResponse: (fromIndex: number) => Promise<void>;
  editAndResubmit: (prompt: string, fromIndex: number) => Promise<void>;
  revertToTurnCheckpoint: (checkpointId: string) => Promise<void>;
}

/**
 * (Private helper) Generates the hidden context string from attached items.
 * @param get A Zustand `get` function to access the store's state.
 * @param items The array of items to process.
 * @returns A promise that resolves to the combined context string or undefined.
 */
const _generateHiddenContent = async (
  get: () => AppState,
  items: AttachedItem[]
): Promise<string | undefined> => {
  const { rootPath, activeProfile } = get();
  if (items.length === 0 || !rootPath || !activeProfile) {
    return undefined;
  }

  const contentPromises = items.map(async (item: AttachedItem) => {
    if (item.type === "folder") {
      const treeStructure = await invoke<string>("generate_directory_tree", {
        rootPathStr: rootPath,
        dirRelPath: item.id,
      });
      return `--- START OF DIRECTORY STRUCTURE FOR ${item.name} ---\n${treeStructure}\n--- END OF DIRECTORY STRUCTURE FOR ${item.name} ---`;
    } else if (item.type === "group") {
      const groupContext = await invoke<string>(
        "generate_group_context_for_ai",
        {
          rootPathStr: rootPath,
          profileName: activeProfile,
          groupId: item.id,
        }
      );
      return `--- START OF CONTEXT FOR GROUP "${item.name}" ---\n${groupContext}\n--- END OF CONTEXT FOR GROUP "${item.name}" ---`;
    } else {
      // 'file'
      const fileContent = await invoke<string>("get_file_content", {
        rootPathStr: rootPath,
        fileRelPath: item.id,
      });
      return `--- START OF FILE ${item.name} ---\n${fileContent}\n--- END OF FILE ${item.name} ---`;
    }
  });
  const allContents = await Promise.all(contentPromises);
  return allContents.join("\n\n");
};

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
      rootPath,
      allAvailableModels,
      selectedAiModel,
      editingMessageIndex,
      aiChatMode,
    } = get();
    // Reset editing state regardless of the outcome
    set({ editingMessageIndex: null });

    if (editingMessageIndex !== null) {
      get().actions.editAndResubmit(prompt, editingMessageIndex);
      return;
    }
    const model = allAvailableModels.find((m) => m.id === selectedAiModel);
    const aiAttachedFiles = get().aiAttachedFiles;

    if (
      (model?.provider === "openrouter" && !openRouterApiKey) ||
      (model?.provider === "google" && !googleApiKey)
    ) {
      return;
    }

    set({ isAiPanelLoading: true });

    // For agent mode, this new message starts a new "turn", so reset the checkpoint ID.
    if (aiChatMode === "agent") {
      set({ currentTurnCheckpointId: null });
    }

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

      const hiddenContent = await _generateHiddenContent(get, aiAttachedFiles);
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
      set({
        abortController: null,
        isAiPanelLoading: false,
        editingMessageIndex: null,
      });
    }
  },
  regenerateResponse: async (fromIndex: number) => {
    // Dừng mọi phản hồi đang diễn ra trước để tránh race condition.
    if (get().isAiPanelLoading) {
      get().actions.stopAiResponse();
    }
    const { chatMessages, rootPath, activeProfile } = get();

    // Find the index of the last VISIBLE user message at or before the assistant message index
    let lastUserMessageIndex = -1;
    for (let i = fromIndex - 1; i >= 0; i--) {
      // Find a user message that is NOT hidden (i.e., not a tool result)
      if (chatMessages[i].role === "user" && !chatMessages[i].hidden) {
        lastUserMessageIndex = i;
        break;
      }
    }

    if (lastUserMessageIndex === -1) {
      console.error(
        "Could not find a visible user message to regenerate from."
      );
      return;
    }

    // --- NEW LOGIC: DISCARD OLD CHECKPOINT ---
    const userMessage = chatMessages[lastUserMessageIndex];
    if (userMessage.checkpointId && rootPath && activeProfile) {
      try {
        await invoke("delete_checkpoint", {
          projectPath: rootPath,
          profileName: activeProfile,
          checkpointId: userMessage.checkpointId,
        });
      } catch (e) {
        console.error(
          "Failed to discard old checkpoint during regeneration:",
          e
        );
      }
    }
    set({ currentTurnCheckpointId: null });

    // Truncate the history to include up to the last visible user message
    const truncatedMessages = chatMessages.slice(0, lastUserMessageIndex + 1);

    // Remove checkpointId from the user message we are keeping
    const lastMessage = truncatedMessages[truncatedMessages.length - 1];
    if (lastMessage && lastMessage.checkpointId) {
      delete lastMessage.checkpointId;
    }

    set({
      isAiPanelLoading: true,
      chatMessages: truncatedMessages,
    });

    try {
      await get().actions.saveCurrentChatSession(truncatedMessages);
      await get().actions.fetchAiResponse();
    } catch (error) {
      console.error("Error during regeneration:", error);
      set({ isAiPanelLoading: false });
    }
  },
  editAndResubmit: async (newPrompt, fromIndex) => {
    // Dừng mọi phản hồi đang diễn ra trước
    if (get().isAiPanelLoading) {
      get().actions.stopAiResponse();
    }

    const { chatMessages, aiAttachedFiles, rootPath, activeProfile } = get();

    // --- NEW LOGIC: DISCARD OLD CHECKPOINT ---
    const originalMessage = chatMessages[fromIndex];
    if (originalMessage.checkpointId && rootPath && activeProfile) {
      try {
        await invoke("delete_checkpoint", {
          projectPath: rootPath,
          profileName: activeProfile,
          checkpointId: originalMessage.checkpointId,
        });
      } catch (e) {
        console.error(
          "Failed to discard old checkpoint during edit/resubmit:",
          e
        );
      }
    }
    // Reset the current turn's checkpoint ID so a new one can be created if needed.
    set({ currentTurnCheckpointId: null });

    // Cắt lịch sử chat đến ngay trước tin nhắn đang được sửa
    const truncatedMessages = chatMessages.slice(0, fromIndex);

    // Chuẩn bị tin nhắn mới với nội dung đã sửa và các file đính kèm hiện tại
    const hiddenContent = await _generateHiddenContent(get, aiAttachedFiles);

    const newUserMessage: ChatMessage = {
      role: "user",
      content: newPrompt,
      hiddenContent,
      attachedFiles: [...aiAttachedFiles], // Use current attachments
    };

    const finalMessages = [...truncatedMessages, newUserMessage];

    set({
      isAiPanelLoading: true,
      chatMessages: finalMessages,
      editingMessageIndex: null, // Thoát chế độ edit
    });

    // Xóa các file đính kèm sau khi đã chuẩn bị xong tin nhắn
    get().actions.clearAttachedFilesFromAi();

    await get().actions.saveCurrentChatSession(finalMessages);
    await get().actions.fetchAiResponse();
  },
  revertToTurnCheckpoint: async (checkpointId: string) => {
    const { rootPath, activeProfile, chatMessages, actions, isAiPanelLoading } =
      get();

    // Stop any ongoing AI response before reverting
    if (isAiPanelLoading) {
      actions.stopAiResponse();
    }

    if (!rootPath || !activeProfile) return;

    // Find the user message and the subsequent messages to identify created files
    const turnStartIndex = chatMessages.findIndex(
      (msg) => msg.checkpointId === checkpointId
    );
    if (turnStartIndex === -1) {
      console.error("Could not find turn for checkpoint", checkpointId);
      return;
    }

    const userMessageToRevert = chatMessages[turnStartIndex];

    // Find the end of the turn (next user message or end of chat)
    let turnEndIndex = chatMessages.length;
    for (let i = turnStartIndex + 1; i < chatMessages.length; i++) {
      if (chatMessages[i].role === "user" && !chatMessages[i].hidden) {
        turnEndIndex = i;
        break;
      }
    }

    const turnMessages = chatMessages.slice(turnStartIndex, turnEndIndex);
    const createdFilesInTurn: string[] = [];
    turnMessages.forEach((msg) => {
      msg.tool_calls?.forEach((tc) => {
        if (tc.function.name === "create_file") {
          try {
            const args = JSON.parse(tc.function.arguments);
            if (args.file_path) {
              createdFilesInTurn.push(args.file_path);
            }
          } catch {}
        }
      });
    });

    try {
      const restoredStagedChangesJson = await invoke<string | null>(
        "revert_to_checkpoint",
        {
          projectPath: rootPath,
          profileName: activeProfile,
          checkpointId,
          createdFilesInTurn,
        }
      );
      let finalStagedChanges = new Map();
      // Only restore staged changes if there are currently un-applied changes.
      // If the user already applied/discarded them, we don't bring them back.
      if (get().stagedFileChanges.size > 0 && restoredStagedChangesJson) {
        try {
          const parsedArray = JSON.parse(restoredStagedChangesJson);
          if (Array.isArray(parsedArray)) {
            finalStagedChanges = new Map(parsedArray);
          }
        } catch (e) {
          console.error("Failed to parse restored staged changes:", e);
          // Fallback to empty if parsing fails
          finalStagedChanges = new Map();
        }
      }

      // Truncate chat history
      const newMessages = chatMessages.slice(0, turnStartIndex); // Cut before the user message
      set({
        chatMessages: newMessages,
        stagedFileChanges: finalStagedChanges,
        currentTurnCheckpointId: null, // Reset this
        // Set the prompt and attachments for the UI to restore
        revertedPromptContent: userMessageToRevert.content,
        aiAttachedFiles: userMessageToRevert.attachedFiles || [],
      });

      await actions.saveCurrentChatSession(newMessages);
      await actions.rescanProject();
    } catch (e) {
      console.error("Failed to revert to checkpoint:", e);
    }
  },
});

// Helper to get translations, as this file is outside React components
const t = (key: string) => i18n.t(key);
