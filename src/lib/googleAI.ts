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
    // Google's stream sends chunks of a JSON array. We can't process line by line.
    // We'll process what we can and leave partial data in the buffer.
    // A simple approach is to find the last complete JSON object.
    const lastCompleteObjectEnd = buffer.lastIndexOf("}\n,");
    if (lastCompleteObjectEnd !== -1) {
      const processableChunk = buffer.substring(0, lastCompleteObjectEnd + 2);
      buffer = buffer.substring(lastCompleteObjectEnd + 3);

      try {
        // Wrap in array brackets to make it valid JSON
        const chunks = JSON.parse(`[${processableChunk.slice(0, -1)}]`);
        let combinedText = "";
        for (const chunk of chunks) {
          combinedText += chunk.candidates[0].content.parts[0].text;
          if (chunk.usageMetadata) {
            finalUsage = {
              tokens_prompt: chunk.usageMetadata.promptTokenCount || 0,
              tokens_completion: chunk.usageMetadata.candidatesTokenCount || 0,
              total_cost: 0,
            };
          }
        }

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
      } catch (e) {
        console.error("Error processing Google stream chunk:", e);
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
