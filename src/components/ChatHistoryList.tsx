// src/components/ChatHistoryList.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore, useAppActions } from "@/store/appStore";
import { useShallow } from "zustand/react/shallow";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { MessageSquare, Trash2, Edit } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { Input } from "./ui/input";

interface ChatHistoryListProps {
  onSelectSession: (sessionId: string) => void;
}

export function ChatHistoryList({ onSelectSession }: ChatHistoryListProps) {
  const { t } = useTranslation();
  const { deleteChatSession, updateChatSessionTitle } = useAppActions();
  const { chatSessions, activeChatSessionId } = useAppStore(
    useShallow((state) => ({
      chatSessions: state.chatSessions,
      activeChatSessionId: state.activeChatSessionId,
    }))
  );

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(
    null
  );

  const handleStartEdit = (session: { id: string; title: string }) => {
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  const handleConfirmEdit = () => {
    if (editingSessionId && editingTitle.trim()) {
      updateChatSessionTitle(editingSessionId, editingTitle.trim());
    }
    setEditingSessionId(null);
    setEditingTitle("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleConfirmEdit();
    } else if (e.key === "Escape") {
      setEditingSessionId(null);
      setEditingTitle("");
    }
  };

  const handleConfirmDelete = () => {
    if (deletingSessionId) {
      deleteChatSession(deletingSessionId);
    }
    setDeletingSessionId(null);
  };

  return (
    <>
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-1">
          {chatSessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                "group flex items-center justify-between p-2 rounded-md cursor-pointer",
                activeChatSessionId === session.id
                  ? "bg-primary/10"
                  : "hover:bg-accent"
              )}
              onClick={() =>
                editingSessionId !== session.id && onSelectSession(session.id)
              }
            >
              <div className="flex items-center gap-2 min-w-0">
                <MessageSquare className="h-4 w-4 shrink-0" />
                {editingSessionId === session.id ? (
                  <Input
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleConfirmEdit}
                    autoFocus
                    className="h-7 text-sm"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="truncate text-sm">{session.title}</span>
                )}
              </div>
              <div
                className={cn(
                  "flex items-center opacity-0 group-hover:opacity-100",
                  editingSessionId === session.id && "opacity-100"
                )}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartEdit(session);
                  }}
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingSessionId(session.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <AlertDialog
        open={!!deletingSessionId}
        onOpenChange={(open) => !open && setDeletingSessionId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("aiPanel.deleteChatDialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("aiPanel.deleteChatDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
