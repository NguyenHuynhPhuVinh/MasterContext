import { useState, useEffect } from "react";
import { useAppStore, useAppActions } from "@/store/appStore";
import { useShallow } from "zustand/react/shallow";
import { ChatHistoryList } from "./ChatHistoryList";
// New imports
import { AIPanelHeader } from "./ai/AIPanelHeader";
import { ChatMessageList } from "./ai/ChatMessageList";
import { AIPromptInput } from "./ai/AIPromptInput";
import { NoApiKeyView } from "./ai/NoApiKeyView";

export function AIPanel() {
  const {
    sendChatMessage,
    createNewChatSession,
    stopAiResponse,
    loadChatSessions,
    loadChatSession,
    setAiChatMode,
    setSelectedAiModel,
    detachItemFromAi,
  } = useAppActions();
  const {
    chatMessages,
    isAiPanelLoading,
    openRouterApiKey,
    activeChatSessionId,
    aiModels,
    selectedAiModel,
    aiChatMode,
    activeChatSession,
    aiAttachedFiles,
  } = useAppStore(
    useShallow((state) => ({
      chatMessages: state.chatMessages,
      isAiPanelLoading: state.isAiPanelLoading,
      openRouterApiKey: state.openRouterApiKey,
      activeChatSessionId: state.activeChatSessionId,
      aiModels: state.aiModels,
      selectedAiModel: state.selectedAiModel,
      aiChatMode: state.aiChatMode,
      activeChatSession: state.activeChatSession,
      aiAttachedFiles: state.aiAttachedFiles,
    }))
  );

  const [prompt, setPrompt] = useState("");
  const [view, setView] = useState<"chat" | "history">("chat");

  // Effect để cuộn xuống cuối khi tin nhắn mới được thêm (khi đang stream)
  useEffect(() => {
    // Removed
  }, [chatMessages]);

  useEffect(() => {
    loadChatSessions();
  }, [loadChatSessions]);

  const handleSelectSession = async (sessionId: string) => {
    await loadChatSession(sessionId);
    setView("chat");
  };

  // Effect để cuộn xuống cuối khi một session mới được tải
  useEffect(() => {
    // Removed
  }, [activeChatSessionId]);

  const handleSend = () => {
    if (prompt.trim()) {
      sendChatMessage(prompt.trim());
      setPrompt("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isAiPanelLoading) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderChatView = () => {
    if (!openRouterApiKey) {
      return <NoApiKeyView />;
    }

    return (
      <>
        <ChatMessageList
          chatMessages={chatMessages}
          isAiPanelLoading={isAiPanelLoading}
        />
        <AIPromptInput
          prompt={prompt}
          setPrompt={setPrompt}
          onSend={handleSend}
          onKeyDown={handleKeyDown}
          onStop={stopAiResponse}
          isLoading={isAiPanelLoading}
          attachedFiles={aiAttachedFiles}
          onDetachFile={detachItemFromAi}
          chatMode={aiChatMode}
          setChatMode={setAiChatMode}
          models={aiModels}
          selectedModel={selectedAiModel}
          setSelectedModel={setSelectedAiModel}
        />
      </>
    );
  };

  return (
    <div className="flex flex-col h-full bg-card">
      <AIPanelHeader
        view={view}
        setView={setView}
        activeChatSession={activeChatSession}
        onNewChat={createNewChatSession}
        onStop={stopAiResponse}
        isLoading={isAiPanelLoading}
      />

      {view === "chat" ? (
        renderChatView()
      ) : (
        <ChatHistoryList onSelectSession={handleSelectSession} />
      )}
    </div>
  );
}
