// src/components/AIPanel.tsx
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import "highlight.js/styles/github-dark.css";
import { useAppStore, useAppActions } from "@/store/appStore";
import { useShallow } from "zustand/react/shallow";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Plus, Loader2, History, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatHistoryList } from "./ChatHistoryList";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

export function AIPanel() {
  const { t } = useTranslation();
  const {
    sendChatMessage,
    createNewChatSession,
    stopAiResponse,
    loadChatSessions,
    loadChatSession,
  } = useAppActions();
  const { chatMessages, isAiPanelLoading, openRouterApiKey } = useAppStore(
    useShallow((state) => ({
      chatMessages: state.chatMessages,
      isAiPanelLoading: state.isAiPanelLoading,
      openRouterApiKey: state.openRouterApiKey,
    }))
  );

  const [prompt, setPrompt] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"chat" | "history">("chat");

  useEffect(() => {
    loadChatSessions();
  }, [loadChatSessions]);

  const handleSelectSession = async (sessionId: string) => {
    await loadChatSession(sessionId);
    setView("chat");
  };

  const handleSend = () => {
    if (prompt.trim()) {
      sendChatMessage(prompt.trim());
      setPrompt("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderContent = () => {
    if (!openRouterApiKey) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
          <p className="text-muted-foreground">{t("aiPanel.noApiKey")}</p>
        </div>
      );
    }

    return (
      <>
        <ScrollArea className="flex-1 p-4 min-h-0">
          <div className="space-y-4">
            {chatMessages.map((msg, index) => (
              <div
                key={index}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-xs md:max-w-md lg:max-w-lg text-sm",
                    msg.role === "user"
                      ? "bg-muted rounded-lg px-4 py-2 whitespace-pre-wrap"
                      : "markdown-content"
                  )}
                >
                  {msg.role === "assistant" ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeHighlight]}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {isAiPanelLoading && (
              <div className="flex items-center justify-start gap-2 text-muted-foreground italic text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <p>{t("aiPanel.responding")}</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        <div className="p-4 border-t">
          <div className="relative">
            <Textarea
              placeholder={t("aiPanel.placeholder")}
              className="pr-20 min-h-[60px] resize-none"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <Button
              variant={isAiPanelLoading ? "destructive" : "default"}
              size="icon"
              className="absolute right-2 top-2 h-8 w-8"
              onClick={isAiPanelLoading ? stopAiResponse : handleSend}
              disabled={!isAiPanelLoading && !prompt.trim()}
            >
              {isAiPanelLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="flex flex-col h-full bg-card">
      <header className="flex items-center justify-between p-4 border-b shrink-0">
        <h1 className="text-xl font-bold">
          {view === "history" ? t("aiPanel.history") : t("aiPanel.title")}
        </h1>
        <div className="flex items-center gap-2">
          {view === "chat" ? (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => {
                        createNewChatSession();
                        setView("chat");
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("aiPanel.newChat")}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={"outline"}
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setView("history")}
                    >
                      <History className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("aiPanel.viewHistory")}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          ) : (
            <Button
              variant="outline"
              size="icon"
              onClick={() => setView("chat")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      {view === "chat" ? (
        <>{renderContent()}</>
      ) : (
        <ChatHistoryList onSelectSession={handleSelectSession} />
      )}
    </div>
  );
}
