// src/components/ai/ChatMessageList.tsx
import { useRef, useEffect, useState } from "react";
import { ArrowDownCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChatMessage, LoadingIndicator } from "./ChatMessage";
import { type ChatMessage as ChatMessageType } from "@/store/types";
import { cn } from "@/lib/utils";

interface ChatMessageListProps {
  chatMessages: ChatMessageType[];
  isAiPanelLoading: boolean;
}

export function ChatMessageList({
  chatMessages,
  isAiPanelLoading,
}: ChatMessageListProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const scrollToBottom = (behavior: "smooth" | "auto" = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
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
    const viewport = viewportRef.current;
    if (!viewport) return;

    const isNearBottom =
      viewport.scrollHeight - viewport.clientHeight <=
      viewport.scrollTop + 1000;

    setShowScrollButton(!isNearBottom);
  };

  return (
    <ScrollArea
      className="flex-1 p-4 min-h-0 relative" // Add relative positioning here
      viewportRef={viewportRef}
      onScroll={handleScroll}
    >
      <div className="space-y-4">
        {chatMessages.map((msg, index) => (
          <ChatMessage key={index} message={msg} />
        ))}
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
