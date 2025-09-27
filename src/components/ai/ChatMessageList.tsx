// src/components/ai/ChatMessageList.tsx
import { useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage, LoadingIndicator } from "./ChatMessage";
import { type ChatMessage as ChatMessageType } from "@/store/types";

interface ChatMessageListProps {
  chatMessages: ChatMessageType[];
  isAiPanelLoading: boolean;
}

export function ChatMessageList({
  chatMessages,
  isAiPanelLoading,
}: ChatMessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  return (
    <ScrollArea className="flex-1 p-4 min-h-0">
      <div className="space-y-4">
        {chatMessages.map((msg, index) => (
          <ChatMessage key={index} message={msg} />
        ))}
        {isAiPanelLoading && <LoadingIndicator />}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}
