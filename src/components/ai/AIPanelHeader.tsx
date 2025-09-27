// src/components/ai/AIPanelHeader.tsx
import { useTranslation } from "react-i18next";
import { Plus, History, X, BrainCircuit, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { type AIChatSession } from "@/store/types";
import { useAppStore } from "@/store/appStore";
import { useShallow } from "zustand/react/shallow";

interface AIPanelHeaderProps {
  view: "chat" | "history";
  setView: (view: "chat" | "history") => void;
  activeChatSession: AIChatSession | null;
  onNewChat: () => void;
  onStop: () => void;
  isLoading: boolean;
}

export function AIPanelHeader({
  view,
  setView,
  activeChatSession,
  onNewChat,
  onStop,
  isLoading,
}: AIPanelHeaderProps) {
  const { t } = useTranslation();
  const { aiModels, selectedAiModel } = useAppStore(
    useShallow((s) => ({
      aiModels: s.aiModels,
      selectedAiModel: s.selectedAiModel,
    }))
  );
  const selectedModelDetails = aiModels.find(
    (m) => m.id === (selectedAiModel || aiModels[0]?.id)
  );

  const handleNewChat = () => {
    if (isLoading) {
      onStop();
    }
    onNewChat();
    setView("chat");
  };

  const handleViewHistory = () => {
    if (isLoading) {
      onStop();
    }
    setView("history");
  };

  return (
    <header className="flex items-center p-4 pl-5 border-b shrink-0 gap-4">
      <div className="flex-1 min-w-0">
        <h1
          className="text-xl font-bold truncate"
          title={view === "chat" ? activeChatSession?.title : ""}
        >
          {view === "history"
            ? t("aiPanel.history")
            : activeChatSession?.title || t("aiPanel.title")}
        </h1>
        {view === "chat" && activeChatSession && (
          <div className="text-xs text-muted-foreground flex items-center gap-3 mt-1">
            {activeChatSession.totalTokens != null &&
              selectedModelDetails?.context_length != null && (
                <div
                  className={cn(
                    "flex items-center gap-1.5",
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
            {activeChatSession.totalCost != null &&
              activeChatSession.totalCost > 0 && (
                <div
                  className="flex items-center gap-1.5"
                  title="Total Session Cost"
                >
                  <Coins className="h-3 w-3" />
                  <span>${activeChatSession.totalCost.toFixed(6)}</span>
                </div>
              )}
          </div>
        )}
      </div>
      <Badge variant="outline" className="border-yellow-500 text-yellow-500">
        Beta
      </Badge>
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
                    onClick={handleNewChat}
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
                    onClick={handleViewHistory}
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
          <Button variant="outline" size="icon" onClick={() => setView("chat")}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </header>
  );
}
