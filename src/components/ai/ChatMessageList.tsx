// src/components/ai/ChatMessageList.tsx
import { useRef, useEffect, useState } from "react";
import { ArrowDownCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChatMessage, LoadingIndicator } from "./ChatMessage";
import { type ChatMessage as ChatMessageType } from "@/store/types";
import { cn } from "@/lib/utils";
import { useAppActions } from "@/store/appStore";

interface ChatMessageListProps {
  chatMessages: ChatMessageType[];
  isAiPanelLoading: boolean;
  editingMessageIndex: number | null;
  onStartEdit: (index: number) => void;
}

export function ChatMessageList({
  chatMessages,
  isAiPanelLoading,
  editingMessageIndex,
  onStartEdit,
}: ChatMessageListProps) {
  const { initiateRegenerate } = useAppActions();
  const viewportRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const scrollToBottom = (behavior: "smooth" | "auto" = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Recalculate scroll button visibility
  const updateScrollButtonVisibility = () => {
    const viewport = viewportRef.current;
    if (!viewport) {
      setShowScrollButton(false);
      return;
    }
    const isScrollable = viewport.scrollHeight > viewport.clientHeight + 1; // +1 for tolerance
    const isNearBottom =
      viewport.scrollHeight - viewport.clientHeight <= viewport.scrollTop + 10;

    setShowScrollButton(isScrollable && !isNearBottom);
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    // Only auto-scroll if the user is already near the bottom
    const isScrolledToBottom =
      viewport.scrollHeight - viewport.clientHeight <= viewport.scrollTop + 100; // 100px threshold

    if (isScrolledToBottom) {
      scrollToBottom("smooth");
    }
  }, [chatMessages, isAiPanelLoading]); // Rerun when messages or loading state changes

  const handleScroll = () => {
    updateScrollButtonVisibility();
  };

  // Effect to re-evaluate scroll button when messages change (e.g., after revert/edit)
  useEffect(() => {
    updateScrollButtonVisibility();
  }, [chatMessages]);

  const handleRegenerate = (index: number) => {
    initiateRegenerate(index);
  };

  // Find the index of the last assistant message for EACH turn.
  // A "turn" consists of a user message followed by one or more assistant messages.
  const lastAssistantMessageIndices = new Set<number>();
  for (let i = 0; i < chatMessages.length; i++) {
    // If the current message is from the user, look ahead for the last assistant message before the next user message.
    if (chatMessages[i].role === "user" && !chatMessages[i].hidden) {
      let lastAsstInTurn = -1;
      for (let j = i + 1; j < chatMessages.length; j++) {
        if (chatMessages[j].role === "assistant") {
          lastAsstInTurn = j;
        } else if (chatMessages[j].role === "user" && !chatMessages[j].hidden) {
          // Found the next user message, so the turn ends here.
          break;
        }
      }
      if (lastAsstInTurn !== -1) {
        lastAssistantMessageIndices.add(lastAsstInTurn);
      }
    }
  }

  return (
    <ScrollArea
      className="flex-1 p-4 min-h-0 relative" // Add relative positioning here
      viewportRef={viewportRef}
      onScroll={handleScroll}
    >
      <div className="space-y-4">
        {chatMessages.map((msg, index) =>
          msg.hidden ? null : (
            <ChatMessage
              key={index}
              message={msg}
              index={index}
              onRegenerate={handleRegenerate}
              isAiPanelLoading={isAiPanelLoading}
              isLastAssistantMessageInTurn={lastAssistantMessageIndices.has(
                index
              )}
              editingMessageIndex={editingMessageIndex}
              onStartEdit={onStartEdit}
            />
          )
        )}
        {isAiPanelLoading && <LoadingIndicator />}
        <div ref={messagesEndRef} />
      </div>
      <Button
        variant="outline"
        size="icon"
        className={cn(
          "absolute bottom-2 right-2 z-10 rounded-full h-10 w-10 transition-opacity duration-300", // Positioned relative to the ScrollArea
          showScrollButton ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => scrollToBottom()}
      >
        <ArrowDownCircle className="h-5 w-5" />
      </Button>
    </ScrollArea>
  );
}
