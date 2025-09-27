// src/lib/googleAI.ts

import { type AppState } from "@/store/appStore";
import { type ChatMessage, type GenerationInfo } from "@/store/types";

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

// Maps our ChatMessage role to Google's role
const toGoogleRole = (role: ChatMessage["role"]): "user" | "model" => {
  return role === "assistant" ? "model" : "user";
};

// Transforms our chat history and settings into Google's payload format
export const toGooglePayload = (
  messages: ChatMessage[],
  config: {
    systemPrompt?: string;
    temperature: number;
    topP: number;
    topK: number;
    maxTokens: number;
  }
) => {
  const contents = messages
    .filter(
      (msg) => msg.role !== "system" && (msg.content || msg.hiddenContent)
    )
    .map((msg) => ({
      role: toGoogleRole(msg.role),
      parts: [{ text: (msg.hiddenContent || "") + (msg.content || "") }],
    }));

  let system_instruction: { parts: { text: string }[] } | undefined = undefined;
  if (config.systemPrompt) {
    system_instruction = { parts: [{ text: config.systemPrompt }] };
  }

  const payload: Record<string, any> = {
    contents,
    system_instruction,
    generationConfig: {
      temperature: config.temperature,
      topP: config.topP,
      topK: config.topK > 0 ? config.topK : undefined,
      maxOutputTokens: config.maxTokens > 0 ? config.maxTokens : undefined,
    },
  };

  return payload;
};

/**
 * Handles a non-streaming response from Google Gemini.
 */
export const handleNonStreamingResponseGoogle = async (
  response: Response
): Promise<ChatMessage> => {
  const data = await response.json();
  const candidate = data.candidates[0];
  const content = candidate.content.parts[0].text;
  const usage = data.usageMetadata;

  const generationInfo: GenerationInfo = {
    tokens_prompt: usage.promptTokenCount || 0,
    tokens_completion: usage.candidatesTokenCount || 0,
    total_cost: 0, // Google pricing is complex, skip for now
  };

  const assistantMessage: ChatMessage = {
    role: "assistant",
    content: content,
    generationInfo: generationInfo,
  };

  // Check for tool calls (future implementation)
  // if (candidate.content.parts.some(p => p.functionCall)) { ... }

  return assistantMessage;
};

/**
 * Handles a streaming response from Google Gemini.
 */
export const handleStreamingResponseGoogle = async (
  response: Response,
  storeApi: StoreApi
): Promise<void> => {
  if (!response.body) {
    throw new Error("Response body is null");
  }
  const { setState, getState } = storeApi;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let isFirstChunk = true;
  let finalUsage: GenerationInfo | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    // We might get multiple JSON objects in one chunk, or partial objects.
    // We need to find and parse complete objects from the buffer using brace-counting.
    const objectsToProcess = [];
    let lastProcessedIndex = 0;

    const findNextObjectStart = (startIndex: number) => {
      for (let i = startIndex; i < buffer.length; i++) {
        if (buffer[i] === "{") return i;
      }
      return -1;
    };

    let searchFrom = 0;
    while (searchFrom < buffer.length) {
      const start = findNextObjectStart(searchFrom);
      if (start === -1) break; // No more objects start in the buffer

      let braceCount = 1;
      let end = -1;
      for (let i = start + 1; i < buffer.length; i++) {
        if (buffer[i] === "{") braceCount++;
        if (buffer[i] === "}") braceCount--;
        if (braceCount === 0) {
          end = i;
          break;
        }
      }

      if (end !== -1) {
        // We found a complete object
        const objectStr = buffer.substring(start, end + 1);
        try {
          const parsedObject = JSON.parse(objectStr);
          objectsToProcess.push(parsedObject);
          // Continue searching after this object
          searchFrom = end + 1;
          lastProcessedIndex = searchFrom;
        } catch (e) {
          // This shouldn't happen if brace counting is correct, but as a safeguard
          // we assume the object is incomplete and wait for more data.
          searchFrom = start + 1; // Move past the initial brace to avoid infinite loops
        }
      } else {
        // Incomplete object, wait for more data
        break;
      }
    }

    // If we processed any objects, slice them from the main buffer
    if (lastProcessedIndex > 0) {
      buffer = buffer.substring(lastProcessedIndex);
    }

    if (objectsToProcess.length > 0) {
      let combinedText = "";
      for (const chunk of objectsToProcess) {
        const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          combinedText += text;
        }
        if (chunk.usageMetadata) {
          finalUsage = {
            tokens_prompt: chunk.usageMetadata.promptTokenCount || 0,
            tokens_completion: chunk.usageMetadata.candidatesTokenCount || 0,
            total_cost: 0,
          };
        }
      }

      if (combinedText) {
        if (isFirstChunk) {
          isFirstChunk = false;
          const newAssistantMessage: ChatMessage = {
            role: "assistant",
            content: combinedText,
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
                content: (lastMessage.content || "") + combinedText,
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
    }
  }

  // After stream is complete, add generation info
  if (finalUsage) {
    setState((state) => {
      const lastMessage = state.chatMessages[state.chatMessages.length - 1];
      if (lastMessage && lastMessage.role === "assistant") {
        const updatedMessage = { ...lastMessage, generationInfo: finalUsage };
        const finalMessages = [
          ...state.chatMessages.slice(0, -1),
          updatedMessage,
        ];
        getState().actions.saveCurrentChatSession(finalMessages);
        return {
          chatMessages: finalMessages,
        };
      }
      return state;
    });
  }
};
