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
} from "@/lib/googleAI";

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
        const fileContents = await Promise.all(
          aiAttachedFiles.map((filePath) =>
            invoke<string>("get_file_content", {
              rootPathStr: rootPath,
              fileRelPath: filePath,
            })
          )
        );

        hiddenContent = aiAttachedFiles
          .map(
            (filePath, index) =>
              `--- START OF FILE ${filePath} ---\n${fileContents[index]}\n--- END OF FILE ${filePath} ---`
          )
          .join("\n\n");
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
      const { toGooglePayload } = await import("@/lib/googleAI");
      const payload = toGooglePayload(messagesToSend, {
        systemPrompt,
        temperature,
        topP,
        topK,
        maxTokens,
      });

      // TODO: Add Google tool definitions if needed

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
      };

      if (temperature) payload.temperature = temperature;
      if (topP) payload.top_p = topP;
      if (topK > 0) payload.top_k = topK;
      if (maxTokens > 0) payload.max_tokens = maxTokens;
      if (aiChatMode === "link" || aiChatMode === "diff") {
        payload.tools = [
          {
            type: "function",
            function: {
              name: "get_project_file_tree",
              description:
                "Get the complete file and directory structure of the current project.",
              parameters: {
                type: "object",
                properties: {},
              },
            },
          },
          {
            type: "function",
            function: {
              name: "read_file",
              description:
                "Reads the content of a specific file within the project. Can read the entire file or a specific range of lines.",
              parameters: {
                type: "object",
                properties: {
                  file_path: {
                    type: "string",
                    description:
                      "The relative path to the file from the project root.",
                  },
                  start_line: {
                    type: "number",
                    description:
                      "Optional. The 1-based starting line number to read from.",
                  },
                  end_line: {
                    type: "number",
                    description:
                      "Optional. The 1-based ending line number to read to.",
                  },
                },
                required: ["file_path"],
              },
            },
          },
        ];
      }
      // Add group-related tools only if a group is being edited
      if ((aiChatMode === "link" || aiChatMode === "diff") && editingGroupId) {
        if (!payload.tools) payload.tools = [];
        payload.tools.push({
          type: "function",
          function: {
            name: "get_current_context_group_files",
            description:
              "Gets a list of all files currently included in the context group that the user is editing.",
            parameters: {
              type: "object",
              properties: {},
              required: [],
            },
          },
        });

        // The "modify" tool is specific to "link" mode
        if (aiChatMode === "link") {
          payload.tools.push({
            type: "function",
            function: {
              name: "modify_context_group",
              description:
                "Adds or removes files and folders from the currently selected context group. This is the primary way to help the user manage their context groups.",
              parameters: {
                type: "object",
                properties: {
                  files_to_add: {
                    type: "array",
                    description:
                      "An array of file or folder paths to add to the group. Paths must be relative to the project root.",
                    items: {
                      type: "string",
                    },
                  },
                  files_to_remove: {
                    type: "array",
                    description:
                      "An array of file or folder paths to remove from the group.",
                    items: {
                      type: "string",
                    },
                  },
                },
              },
            },
          });
        }
      }

      // Add diff tool only in diff mode
      if (aiChatMode === "diff") {
        if (!payload.tools) payload.tools = [];
        payload.tools.push({
          type: "function",
          function: {
            name: "apply_diff_to_file",
            description: `Applies a diff patch to a specified file in the project. The diff must be in the standard unified diff format.

**IMPORTANT HINTS for using this tool:**

1.  **Be Precise:** The line numbers and original content in the diff (lines starting with ' ' or '-') MUST EXACTLY match the current file content, including whitespace. Use the 'read_file' tool first if you are unsure of the exact content.
2.  **Be Minimal:** Create the smallest possible diff. Only include the lines that are changing, plus a minimal number of surrounding (unchanged) context lines (usually 1-3) if absolutely necessary for uniqueness.
3.  **Focus on the Change:** If you only need to change one line, your diff should ideally target only that one line.

**GOOD EXAMPLE (Changing only line 2 of a file):**
--- a/README.md
+++ b/README.md
@@ -2 +2 @@
-[![Version](https://img.shields.io/badge/version-0.1.4-blue.svg)](src-tauri/tauri.conf.json)
+[![Version](https://img.shields.io/badge/version-0.1.5-blue.svg)](src-tauri/tauri.conf.json)

**BAD EXAMPLE (Too broad, likely to fail because other lines might not match exactly):**
--- a/README.md
+++ b/README.md
@@ -1,5 +1,5 @@
 # Master Context...
-[![Version](https://img.shields.io/badge/version-0.1.4-blue.svg)](src-tauri/tauri.conf.json)
+[![Version](https://img.shields.io/badge/version-0.1.5-blue.svg)](src-tauri/tauri.conf.json)
 [![License]...
 ...
`,
            parameters: {
              type: "object",
              properties: {
                file_path: {
                  type: "string",
                  description:
                    "The relative path to the file that the diff should be applied to.",
                },
                diff_content: {
                  type: "string",
                  description: "The content of the diff patch to apply.",
                },
              },
              required: ["file_path", "diff_content"],
            },
          },
        });
      }

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
