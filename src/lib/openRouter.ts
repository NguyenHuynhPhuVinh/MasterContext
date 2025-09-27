// src/lib/openRouter.ts
import { createPatch } from "diff";
import { invoke } from "@tauri-apps/api/core";
import { type AppState, useAppStore } from "@/store/appStore";
import { type ChatMessage, type GenerationInfo } from "@/store/types";
import axios from "axios";

const calculateDiffStats = (diff: string | undefined) => {
  if (!diff) return { added: 0, removed: 0 };
  let added = 0;
  let removed = 0;
  diff.split("\n").forEach((line) => {
    if (line.startsWith("+") && !line.startsWith("+++")) added++;
    if (line.startsWith("-") && !line.startsWith("---")) removed++;
  });
  return { added, removed };
};

type StoreApi = {
  getState: () => AppState;
  setState: (
    partial:
      | AppState
      | Partial<AppState>
      | ((state: AppState) => AppState | Partial<AppState>),
    replace?: false | undefined
  ) => void;
};

/**
 * Handles a tool call from the AI, executes the tool, and triggers a new response fetch.
 */
export const handleToolCalls = async (
  toolCalls: ChatMessage["tool_calls"],
  storeApi: StoreApi
) => {
  if (!toolCalls) return;
  const { getState, setState } = storeApi;

  // 1. Add assistant's tool call message to history (hidden)
  const assistantMessage: ChatMessage = {
    role: "assistant",
    content: null,
    tool_calls: toolCalls,
    hidden: false,
  };
  setState((state: AppState) => ({
    chatMessages: [...state.chatMessages, assistantMessage],
  }));

  // 2. Execute tool
  setState({ isAiPanelLoading: true }); // Keep loading state for the next AI call

  const tool = toolCalls[0];
  let toolResultContent = `Error: Tool '${tool.function.name}' not found or failed to execute.`;
  let toolSucceeded = false;
  if (tool.function.name === "get_project_file_tree") {
    const fileTree = getState().fileTree;
    if (fileTree && fileTree.children) {
      const children = fileTree.children;
      toolResultContent =
        "Current project structure:\n" +
        children
          .map((child, index) =>
            formatNode(child, "", index === children.length - 1)
          )
          .join("");
    }
    toolSucceeded = true;
  } else if (tool.function.name === "read_file") {
    const { rootPath } = getState();
    if (!rootPath) {
      toolResultContent = "Error: Project path is not available to read file.";
    } else {
      try {
        const args = JSON.parse(tool.function.arguments);
        const content = await invoke<string>("read_file_with_lines", {
          rootPathStr: rootPath,
          fileRelPath: args.file_path,
          startLine: args.start_line,
          endLine: args.end_line,
        });
        toolResultContent = `Here is the content of ${args.file_path}${
          args.start_line ? ` from line ${args.start_line}` : ""
        }${args.end_line ? ` to line ${args.end_line}` : ""}:\n\n${content}`;
        toolSucceeded = true;
      } catch (e) {
        toolResultContent = `Error reading file: ${e}`;
        toolSucceeded = false;
      }
    }
  } else if (tool.function.name === "get_current_context_group_files") {
    const { editingGroupId, rootPath, activeProfile } = getState();
    if (!editingGroupId || !rootPath || !activeProfile) {
      toolResultContent =
        "Error: No group is currently being edited. The user must select a group to check its files.";
    } else {
      try {
        const files = await invoke<string[]>("get_expanded_files_for_group", {
          path: rootPath,
          profileName: activeProfile,
          groupId: editingGroupId,
        });
        toolResultContent = `The current group contains the following files:\n${files.join(
          "\n"
        )}`;
        toolSucceeded = true;
      } catch (e) {
        toolResultContent = `Error getting group files: ${e}`;
        toolSucceeded = false;
      }
    }
  } else if (tool.function.name === "modify_context_group") {
    const { editingGroupId, rootPath, activeProfile } = getState();
    if (!editingGroupId || !rootPath || !activeProfile) {
      toolResultContent =
        "Error: No group is currently being edited. The user must select a group to modify first.";
    } else {
      try {
        const args = JSON.parse(tool.function.arguments);
        const pathsToAdd = args.files_to_add || [];
        const pathsToRemove = args.files_to_remove || [];

        const result = await invoke<
          import("@/store/types").AIGroupUpdateResult
        >("update_group_paths_from_ai", {
          path: rootPath,
          profileName: activeProfile,
          groupId: editingGroupId,
          pathsToAdd,
          pathsToRemove,
        });

        // Update the group state in Zustand, including tempSelectedPaths
        await getState().actions._updateGroupFromAi(result.updatedGroup);

        let resultMessage = "Successfully modified the group.";
        if (pathsToAdd.length > 0)
          resultMessage += ` Added: ${pathsToAdd.join(", ")}.`;
        if (pathsToRemove.length > 0)
          resultMessage += ` Removed: ${pathsToRemove.join(", ")}.`;
        resultMessage += `\n\nThe group now contains the following files:\n${result.finalExpandedFiles.join(
          "\n"
        )}`;
        toolResultContent = resultMessage;
        toolSucceeded = true;
      } catch (e) {
        toolResultContent = `Error modifying group: ${e}`;
        toolSucceeded = false;
      }
    }
  } else if (tool.function.name === "write_file") {
    const { actions } = getState();
    try {
      const args = JSON.parse(tool.function.arguments);
      const { file_path, content, start_line, end_line } = args;

      // UI Logic: Create a diff for visualization before writing
      const originalContent = await invoke<string>("get_file_content", {
        rootPathStr: getState().rootPath,
        fileRelPath: file_path,
      });

      let newContent;
      if (start_line) {
        const originalLines = originalContent.split("\n");
        const newLines = content.split("\n");
        const startIndex = start_line - 1;
        const endIndex = end_line ? end_line : startIndex + newLines.length;
        originalLines.splice(startIndex, endIndex - startIndex, ...newLines);
        newContent = originalLines.join("\n");
      } else {
        newContent = content;
      }

      const patch = createPatch(file_path, originalContent, newContent, "", "");
      const stats = calculateDiffStats(patch);

      // Stage the change instead of writing it
      await actions.stageFileChange(file_path, patch, stats);

      toolSucceeded = true;
      toolResultContent = `Successfully staged changes for ${file_path}. The user must review and accept them to save to disk.`;

      // Update the message with diff stats
      setState((state: AppState) => {
        const newMessages = [...state.chatMessages];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage?.role === "assistant" && lastMessage.tool_calls) {
          lastMessage.tool_calls[0].diffStats = stats;
        }
        return { chatMessages: newMessages };
      });
    } catch (e) {
      toolResultContent = `Error writing to file: ${e}`;
      toolSucceeded = false;
    }
  }

  // 3. Update the assistant message in state with the tool's execution status
  setState((state) => {
    const newMessages = [...state.chatMessages];
    const lastMessage = newMessages[newMessages.length - 1];
    if (lastMessage?.role === "assistant" && lastMessage.tool_calls) {
      lastMessage.tool_calls[0].status = toolSucceeded ? "success" : "error";
    }
    return { chatMessages: newMessages };
  });

  // 4. Add tool result as a hidden user message and re-fetch AI response
  const toolResultMessage: ChatMessage = {
    role: "user",
    content: `[TOOL_RESULT for ${tool.function.name}]\n${toolResultContent}`,
    hidden: true,
  };
  setState((state: AppState) => ({
    chatMessages: [...state.chatMessages, toolResultMessage],
  }));
  await getState().actions.saveCurrentChatSession();
  await getState().actions.fetchAiResponse();
};

/**
 * Fetches generation info from OpenRouter with a retry mechanism.
 */
export const fetchGenerationInfoWithRetry = async (
  generationId: string,
  apiKey: string,
  retries = 3,
  delay = 500
): Promise<GenerationInfo | null> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(
        `https://openrouter.ai/api/v1/generation?id=${generationId}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      return response.data.data as GenerationInfo;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        console.log(`Attempt ${i + 1} failed (404). Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(
          "Failed to fetch generation info with non-retriable error:",
          error
        );
        return null;
      }
    }
  }
  console.warn(
    `All ${retries} attempts to fetch generation info failed for id: ${generationId}`
  );
  return null;
};

/**
 * Handles a non-streaming response from OpenRouter.
 */
export const handleNonStreamingResponse = async (
  response: Response,
  apiKey: string
): Promise<ChatMessage> => {
  const data = await response.json();
  const assistantMessage = data.choices[0].message;
  const generationId = data.id;

  if (generationId) {
    const fetchedInfo = await fetchGenerationInfoWithRetry(
      generationId,
      apiKey
    );
    if (fetchedInfo) {
      assistantMessage.generationInfo = fetchedInfo;
    }
  }

  // Check for tool calls
  if (assistantMessage.tool_calls) {
    await handleToolCalls(assistantMessage.tool_calls, {
      getState: useAppStore.getState,
      setState: useAppStore.setState,
    });
    return assistantMessage; // Return immediately, the recursive call will handle the final message
  }

  return assistantMessage;
};

/**
 * Handles a streaming response from OpenRouter, updating state incrementally.
 */
export const handleStreamingResponse = async (
  response: Response,
  storeApi: StoreApi
): Promise<void> => {
  if (!response.body) {
    throw new Error("Response body is null");
  }

  const { getState, setState } = storeApi;
  const apiKey = getState().openRouterApiKey;
  let generationId: string | null = null;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let isFirstChunk = true;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.trim() === "" || !line.startsWith("data:")) continue;
      if (line.includes("data: [DONE]")) break;

      try {
        const json = JSON.parse(line.substring(5));
        if (json.id && !generationId) {
          generationId = json.id;
        }

        const toolCallsChunk = json.choices[0]?.delta?.tool_calls;
        if (toolCallsChunk && toolCallsChunk.length > 0) {
          reader.cancel(); // Stop stream processing
          await handleToolCalls(toolCallsChunk, storeApi);
          return; // Exit fetch function
        }

        const delta = json.choices[0]?.delta?.content;
        if (delta) {
          if (isFirstChunk) {
            isFirstChunk = false;
            const newAssistantMessage: ChatMessage = {
              role: "assistant",
              content: delta,
            };
            setState((state) => ({
              chatMessages: [...state.chatMessages, newAssistantMessage],
            }));
          } else {
            setState((state) => {
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

  // After stream is complete, fetch generation info
  if (generationId && apiKey) {
    const generationInfo = await fetchGenerationInfoWithRetry(
      generationId,
      apiKey
    );
    if (generationInfo) {
      setState((state) => {
        const lastMessage = state.chatMessages[state.chatMessages.length - 1];
        if (lastMessage && lastMessage.role === "assistant") {
          const updatedMessage = { ...lastMessage, generationInfo };
          const finalMessages = [
            ...state.chatMessages.slice(0, -1),
            updatedMessage,
          ];
          // This is a good place to also trigger a save of the final message state
          getState().actions.saveCurrentChatSession(finalMessages);
          return {
            chatMessages: finalMessages,
          };
        }
        return state;
      });
    }
  }
};

const formatNode = (
  node: import("@/store/types").FileNode,
  prefix: string,
  isLast: boolean
): string => {
  let res = prefix;
  if (prefix.length > 0 || node.children) {
    res += isLast ? "└── " : "├── ";
  } else {
    res += "    "; // for top-level files
  }
  res += `${node.name}\n`;
  if (node.children) {
    const childPrefix = prefix + (isLast ? "    " : "│   ");
    node.children.forEach((child, index) => {
      res += formatNode(
        child,
        childPrefix,
        index === node.children!.length - 1
      );
    });
  }
  return res;
};
