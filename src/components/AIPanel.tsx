// src/components/AIPanel.tsx
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { useAppStore, useAppActions } from "@/store/appStore";
import { useShallow } from "zustand/react/shallow";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Trash, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function AIPanel() {
  const { t } = useTranslation();
  const { sendChatMessage, clearChatMessages } = useAppActions();
  const { chatMessages, isAiPanelLoading, openRouterApiKey } = useAppStore(
    useShallow((state) => ({
      chatMessages: state.chatMessages,
      isAiPanelLoading: state.isAiPanelLoading,
      openRouterApiKey: state.openRouterApiKey,
    }))
  );

  const [prompt, setPrompt] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    // Also trigger scroll when loading state changes (e.g., to show the spinner)
  }, [chatMessages, isAiPanelLoading]);

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
                    <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {isAiPanelLoading && (
              <div className="flex justify-start">
                <div className="bg-background border rounded-lg px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
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
              size="icon"
              className="absolute right-2 top-2 h-8 w-8"
              onClick={handleSend}
              disabled={isAiPanelLoading || !prompt.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="flex flex-col h-full bg-card">
      <header className="flex items-center justify-between p-4 border-b shrink-0">
        <h1 className="text-xl font-bold">{t("aiPanel.title")}</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={clearChatMessages}
          disabled={chatMessages.length === 0}
        >
          <Trash className="h-4 w-4" />
        </Button>
      </header>
      {renderContent()}
    </div>
  );
}
