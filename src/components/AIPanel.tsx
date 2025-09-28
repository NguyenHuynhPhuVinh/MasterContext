import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore, useAppActions } from "@/store/appStore";
import { useShallow } from "zustand/react/shallow";
import { ChatHistoryList } from "./ChatHistoryList";
// New imports
import { AIPanelHeader } from "./ai/AIPanelHeader";
import { ChatMessageList } from "./ai/ChatMessageList";
import { AIPromptInput } from "./ai/AIPromptInput";
import { NoApiKeyView } from "./ai/NoApiKeyView";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "./ui/button";

export function AIPanel() {
  const { t } = useTranslation();
  const {
    sendChatMessage,
    createNewChatSession,
    stopAiResponse,
    loadChatSessions,
    loadChatSession,
    confirmRevert,
    declineRevertAndProceed,
    cancelRevertConfirmation,
    setAiChatMode,
    setSelectedAiModel,
    detachItemFromAi,
    attachItemToAi,
    applyAllStagedChanges,
    discardAllStagedChanges,
  } = useAppActions();
  const {
    chatMessages,
    isAiPanelLoading,
    openRouterApiKey,
    aiModels,
    selectedAiModel,
    aiChatMode,
    activeChatSession,
    aiAttachedFiles,
    stagedFileChanges,
    revertedPromptContent,
  } = useAppStore(
    useShallow((state) => ({
      chatMessages: state.chatMessages,
      isAiPanelLoading: state.isAiPanelLoading,
      openRouterApiKey: state.openRouterApiKey,
      aiModels: state.aiModels,
      selectedAiModel: state.selectedAiModel,
      aiChatMode: state.aiChatMode,
      activeChatSession: state.activeChatSession,
      aiAttachedFiles: state.aiAttachedFiles,
      stagedFileChanges: state.stagedFileChanges,
      revertedPromptContent: state.revertedPromptContent,
      revertConfirmation: state.revertConfirmation,
    }))
  );
  const editingMessageIndex = useAppStore((state) => state.editingMessageIndex);
  const revertConfirmation = useAppStore((state) => state.revertConfirmation);

  const { _clearRevertedPrompt } = useAppActions();

  const [prompt, setPrompt] = useState("");
  const [view, setView] = useState<"chat" | "history">("chat");
  const [isStagingDialogOpen, setIsStagingDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    loadChatSessions();
  }, [loadChatSessions]);

  useEffect(() => {
    // When a revert happens, the action populates this state.
    if (revertedPromptContent) {
      setPrompt(revertedPromptContent);
      _clearRevertedPrompt(); // Clear the state so it doesn't trigger again
    }
  }, [revertedPromptContent, _clearRevertedPrompt]);

  const confirmAndExecute = (action: () => void) => {
    if (stagedFileChanges.size > 0) {
      setPendingAction(() => action);
      setIsStagingDialogOpen(true);
    } else {
      action();
    }
  };

  const handleDialogAction = async (actionType: "apply" | "discard") => {
    if (actionType === "apply") {
      await applyAllStagedChanges();
    } else {
      await discardAllStagedChanges();
    }
    const actionToRun = pendingAction;
    setIsStagingDialogOpen(false);
    setPendingAction(null);

    if (actionToRun) {
      actionToRun();
    }
  };

  const handleSend = () => {
    if (prompt.trim()) {
      sendChatMessage(prompt.trim());
      setPrompt("");
    }
  };

  const handleStartEdit = (index: number) => {
    const messageToEdit = chatMessages[index];
    if (messageToEdit && messageToEdit.role === "user") {
      // Clear any currently attached files before loading the old ones
      useAppStore.getState().actions.clearAttachedFilesFromAi();

      setPrompt(messageToEdit.content || "");
      useAppStore.setState({ editingMessageIndex: index });

      // Load attachments from the message being edited
      messageToEdit.attachedFiles?.forEach((item) => attachItemToAi(item));
    }
  };

  const handleCancelEdit = () => {
    useAppStore.setState({ editingMessageIndex: null });
    setPrompt(""); // Clear the input when cancelling edit
    useAppStore.getState().actions.clearAttachedFilesFromAi();
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
          editingMessageIndex={editingMessageIndex}
          onStartEdit={handleStartEdit}
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
          isEditing={editingMessageIndex !== null}
          onCancelEdit={handleCancelEdit}
        />
      </>
    );
  };

  const handleNewChat = () => {
    confirmAndExecute(() => {
      if (isAiPanelLoading) {
        stopAiResponse();
      }
      createNewChatSession();
      setView("chat");
    });
  };

  return (
    <div className="flex flex-col h-full bg-card">
      <AIPanelHeader
        view={view}
        setView={setView}
        activeChatSession={activeChatSession}
        onNewChat={handleNewChat}
      />

      {view === "chat" ? (
        renderChatView()
      ) : (
        <ChatHistoryList
          onSelectSession={(id) => {
            confirmAndExecute(() => {
              if (isAiPanelLoading) {
                stopAiResponse();
              }
              loadChatSession(id);
              setView("chat");
            });
          }}
        />
      )}
      <AlertDialog
        open={isStagingDialogOpen}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
          setIsStagingDialogOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("aiPanel.stagingDialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("aiPanel.stagingDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingAction(null)}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => handleDialogAction("discard")}
            >
              {t("aiPanel.stagingDialog.discardAll")}
            </Button>
            <AlertDialogAction onClick={() => handleDialogAction("apply")}>
              {t("aiPanel.stagingDialog.acceptAll")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={!!revertConfirmation}
        onOpenChange={(open) => {
          if (!open) cancelRevertConfirmation();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("aiPanel.revertDialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("aiPanel.revertDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelRevertConfirmation}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <Button variant="outline" onClick={() => declineRevertAndProceed()}>
              {t("aiPanel.revertDialog.proceed")}
            </Button>
            <AlertDialogAction onClick={() => confirmRevert()}>
              {t("aiPanel.revertDialog.revertAndProceed")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
