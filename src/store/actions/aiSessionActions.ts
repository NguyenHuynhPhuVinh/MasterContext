// src/store/actions/aiSessionActions.ts
import { StateCreator } from "zustand";
import { AppState } from "../appStore";
import {
  type ChatMessage,
  type AIChatSession,
  type AIChatSessionHeader,
} from "../types";
import { invoke } from "@tauri-apps/api/core";

export interface AiSessionActions {
  saveCurrentChatSession: (messagesOverride?: ChatMessage[]) => Promise<void>;
  createNewChatSession: () => void;
  loadChatSessions: () => Promise<void>;
  loadChatSession: (sessionId: string) => Promise<void>;
  deleteChatSession: (sessionId: string) => Promise<void>;
  updateChatSessionTitle: (
    sessionId: string,
    newTitle: string
  ) => Promise<void>;
  deleteAllChatSessions: () => Promise<void>;
}

export const createAiSessionActions: StateCreator<
  AppState,
  [],
  [],
  AiSessionActions
> = (set, get) => ({
  createNewChatSession: () => {
    set({
      chatMessages: [],
      activeChatSessionId: null,
      activeChatSession: null,
    });
  },
  loadChatSessions: async () => {
    const { rootPath } = get();
    if (!rootPath) return;
    try {
      const sessions = await invoke<AIChatSessionHeader[]>(
        "list_chat_sessions",
        { projectPath: rootPath }
      );
      set({ chatSessions: sessions });
    } catch (e) {
      console.error("Failed to load chat sessions:", e);
      set({ chatSessions: [] });
    }
  },
  loadChatSession: async (sessionId: string) => {
    const { rootPath } = get();
    if (!rootPath) return;
    try {
      const session = await invoke<AIChatSession>("load_chat_session", {
        projectPath: rootPath,
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
    const { rootPath, activeChatSessionId } = get();
    if (!rootPath) return;
    await invoke("delete_chat_session", {
      projectPath: rootPath,
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
    const { rootPath } = get();
    if (!rootPath) return;
    await invoke("update_chat_session_title", {
      projectPath: rootPath,
      sessionId,
      newTitle,
    });
    set((state) => ({
      chatSessions: state.chatSessions.map((s) =>
        s.id === sessionId ? { ...s, title: newTitle } : s
      ),
    }));
  },
  deleteAllChatSessions: async () => {
    const { rootPath } = get();
    if (!rootPath) return;
    try {
      await invoke("delete_all_chat_sessions", {
        projectPath: rootPath,
      });
      set({ chatSessions: [] });
      get().actions.createNewChatSession();
    } catch (e) {
      console.error("Failed to delete all chat sessions:", e);
    }
  },
  saveCurrentChatSession: async (messagesOverride?: ChatMessage[]) => {
    const {
      rootPath,
      activeChatSession,
      chatMessages: currentMessages,
    } = get();
    if (rootPath && activeChatSession) {
      const messagesToSave = messagesOverride ?? currentMessages;

      // Find the last message with generationInfo to get the final session totals
      let totalTokens: number | undefined = undefined;
      let totalCost: number | undefined = undefined;

      // Vòng lặp chạy ngược từ cuối mảng
      for (let i = messagesToSave.length - 1; i >= 0; i--) {
        const msg = messagesToSave[i];
        if (msg.generationInfo) {
          // Lấy thông tin từ tin nhắn cuối cùng có generationInfo
          totalTokens =
            (msg.generationInfo.tokens_prompt || 0) +
            (msg.generationInfo.tokens_completion || 0);
          totalCost = msg.generationInfo.total_cost || 0;
          break; // Thoát ngay khi tìm thấy, vì chỉ cần tin cuối cùng
        }
      }

      const sessionToSave: AIChatSession = {
        ...activeChatSession,
        messages: messagesToSave,
        totalTokens:
          totalTokens !== undefined && totalTokens > 0
            ? totalTokens
            : undefined,
        totalCost:
          totalCost !== undefined && totalCost > 0 ? totalCost : undefined,
      };
      await invoke("save_chat_session", {
        projectPath: rootPath,
        session: sessionToSave,
      });
      // Keep the state in sync after saving
      set({
        activeChatSession: sessionToSave,
      });
    }
  },
});
