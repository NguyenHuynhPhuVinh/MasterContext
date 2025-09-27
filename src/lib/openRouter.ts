// src/lib/openRouter.ts
import { type AppState } from "@/store/appStore";
import { type ChatMessage, type GenerationInfo } from "@/store/types";
import axios from "axios";

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
