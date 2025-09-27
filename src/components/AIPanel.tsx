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
import {
  Send,
  Plus,
  Loader2,
  History,
  X,
  Square,
  AlignJustify,
  HelpCircle,
  Link as LinkIcon,
  BrainCircuit,
  Coins,
} from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { ChatHistoryList } from "./ChatHistoryList";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AIPanel() {
  const { t } = useTranslation();
  const {
    sendChatMessage,
    createNewChatSession,
    stopAiResponse,
    loadChatSessions,
    loadChatSession,
    setAiChatMode,
    setSelectedAiModel,
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
    }))
  );

  const [prompt, setPrompt] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"chat" | "history">("chat");

  // Effect để cuộn xuống cuối khi tin nhắn mới được thêm (khi đang stream)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    loadChatSessions();
  }, [loadChatSessions]);

  const selectedModelDetails = aiModels.find(
    (m) => m.id === (selectedAiModel || aiModels[0]?.id)
  );

  const handleSelectSession = async (sessionId: string) => {
    await loadChatSession(sessionId);
    setView("chat");
  };

  // Effect để cuộn xuống cuối khi một session mới được tải
  useEffect(() => {
    if (activeChatSessionId) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView(), 0);
    }
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
                  {msg.role === "assistant" && msg.generationInfo && (
                    <div className="mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground flex items-center justify-end gap-3">
                      <span
                        className="flex items-center gap-1"
                        title="Prompt Tokens + Completion Tokens"
                      >
                        <BrainCircuit className="h-3 w-3" />
                        {msg.generationInfo.tokens_prompt} +{" "}
                        {msg.generationInfo.tokens_completion}
                      </span>
                      {msg.generationInfo.total_cost > 0 && (
                        <span className="flex items-center gap-1" title="Cost">
                          <Coins className="h-3 w-3" />$
                          {msg.generationInfo.total_cost.toFixed(6)}
                        </span>
                      )}
                    </div>
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
          <div className="relative flex flex-col min-h-[80px] max-h-48 w-full rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 overflow-hidden">
            {selectedModelDetails?.context_length && (
              <div className="flex-shrink-0 flex items-center justify-end gap-1.5 px-3 py-1 text-xs text-muted-foreground border-b bg-muted/50">
                <BrainCircuit className="h-3 w-3" />
                <span>
                  Max Context:{" "}
                  {selectedModelDetails.context_length.toLocaleString()} tokens
                </span>
              </div>
            )}
            <Textarea
              placeholder={t("aiPanel.placeholder")}
              className="flex-1 w-full !rounded-none resize-none border-none bg-transparent px-3 py-3 shadow-none focus-visible:ring-0 custom-scrollbar"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {/* Container cho các nút, nằm ở dưới cùng */}
            <div className="flex-shrink-0 flex h-12 items-center justify-between px-3 pt-1">
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-8 gap-2 px-2 text-muted-foreground"
                    >
                      {aiChatMode === "ask" ? (
                        <HelpCircle className="h-4 w-4 shrink-0" />
                      ) : (
                        <LinkIcon className="h-4 w-4 shrink-0" />
                      )}
                      <span className="capitalize text-xs font-medium">
                        {t(`aiPanel.modes.${aiChatMode}`)}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[180px]">
                    <DropdownMenuRadioGroup
                      value={aiChatMode}
                      onValueChange={(value) =>
                        setAiChatMode(value as "ask" | "link")
                      }
                    >
                      <DropdownMenuRadioItem value="ask">
                        {t("aiPanel.modes.ask")}
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="link">
                        {t("aiPanel.modes.link")}
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                {aiModels.length > 1 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="h-8 gap-2 px-2 text-muted-foreground"
                      >
                        <div className="flex items-center gap-2">
                          <AlignJustify className="h-4 w-4 shrink-0" />
                          <span className="truncate max-w-[120px] text-xs font-medium">
                            {selectedModelDetails?.name || "..."}
                          </span>
                        </div>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[350px]">
                      <DropdownMenuRadioGroup
                        value={selectedAiModel || aiModels[0]?.id}
                        onValueChange={setSelectedAiModel}
                      >
                        {aiModels.map((model) => (
                          <DropdownMenuRadioItem
                            key={model.id}
                            value={model.id}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{model.name}</span>
                              <div className="text-xs text-muted-foreground flex gap-2">
                                <span>
                                  {model.context_length?.toLocaleString()} ctx
                                </span>
                                <span>
                                  In: {formatPrice(model.pricing.prompt)}/M
                                </span>
                                <span>
                                  Out: {formatPrice(model.pricing.completion)}/M
                                </span>
                              </div>
                            </div>
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              {/* Nút bên phải */}
              <Button
                variant={isAiPanelLoading ? "destructive" : "default"}
                size="icon"
                className="h-8 w-8"
                onClick={isAiPanelLoading ? stopAiResponse : handleSend}
                disabled={!isAiPanelLoading && !prompt.trim()}
              >
                {isAiPanelLoading ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="flex flex-col h-full bg-card">
      <header className="flex items-center justify-between p-4 pl-5 border-b shrink-0">
        <div className="flex-1 min-w-0">
          <h1
            className="text-xl font-bold truncate"
            title={view === "chat" ? activeChatSession?.title : ""}
          >
            {view === "history"
              ? t("aiPanel.history")
              : activeChatSession?.title || t("aiPanel.title")}
          </h1>
          {view === "chat" &&
            activeChatSession?.totalTokens != null &&
            selectedModelDetails?.context_length != null && (
              <div
                className={cn(
                  "text-xs text-muted-foreground flex items-center gap-1.5 mt-1",
                  selectedModelDetails.context_length > 0 &&
                    activeChatSession.totalTokens /
                      selectedModelDetails.context_length >
                      0.9 &&
                    "text-destructive",
                  selectedModelDetails.context_length > 0 &&
                    activeChatSession.totalTokens /
                      selectedModelDetails.context_length >
                      0.75 &&
                    activeChatSession.totalTokens /
                      selectedModelDetails.context_length <=
                      0.9 &&
                    "text-yellow-500"
                )}
                title={t("aiPanel.sessionTokensTooltip")}
              >
                <BrainCircuit className="h-3 w-3" />
                <span>
                  {activeChatSession.totalTokens.toLocaleString()} /{" "}
                  {selectedModelDetails.context_length.toLocaleString()}
                </span>
              </div>
            )}
        </div>
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
                        if (isAiPanelLoading) {
                          stopAiResponse();
                        }
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
                      onClick={() => {
                        if (isAiPanelLoading) {
                          stopAiResponse();
                        }
                        setView("history");
                      }}
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
