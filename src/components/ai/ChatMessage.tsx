// src/components/ai/ChatMessage.tsx
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { useTranslation } from "react-i18next";
import { CheckCircle2, FileText, Paperclip, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { type ChatMessage as ChatMessageType } from "@/store/types";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const { t } = useTranslation();

  if (message.hidden) {
    return null;
  }

  const renderToolCall = (
    tool: NonNullable<ChatMessageType["tool_calls"]>[0]
  ) => {
    let toolContent: React.ReactNode;

    switch (tool.function.name) {
      case "get_project_file_tree":
        toolContent = (
          <p className="font-medium text-foreground">
            {t("aiPanel.toolCall.listingFiles")}
          </p>
        );
        break;

      case "read_file":
        try {
          const args = JSON.parse(tool.function.arguments);
          const filePath = args.file_path || "unknown file";
          const fileName = filePath.split("/").pop();
          let lineInfo = "";
          if (args.start_line && args.end_line) {
            lineInfo = `${args.start_line}-${args.end_line}`;
          } else if (args.start_line) {
            lineInfo = `${args.start_line}-...`;
          } else if (args.end_line) {
            lineInfo = `...-${args.end_line}`;
          }

          toolContent = (
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex items-baseline gap-1.5">
                <code className="font-medium text-foreground" title={filePath}>
                  {fileName}
                </code>
                {lineInfo && (
                  <span className="text-xs text-muted-foreground">
                    ({lineInfo})
                  </span>
                )}
              </div>
            </div>
          );
        } catch (e) {
          toolContent = <p>{t("aiPanel.toolCall.readingFile")}</p>;
        }
        break;

      case "get_current_context_group_files":
        toolContent = (
          <p className="font-medium text-foreground">
            {t("aiPanel.toolCall.listingGroupFiles")}
          </p>
        );
        break;

      case "modify_context_group":
        try {
          const args = JSON.parse(tool.function.arguments);
          const filesToAdd: string[] = args.files_to_add || [];
          const filesToRemove: string[] = args.files_to_remove || [];

          toolContent = (
            <div className="w-full">
              <p className="font-medium text-foreground">
                {t("aiPanel.toolCall.modifiedGroup")}
              </p>
              {filesToAdd.length > 0 || filesToRemove.length > 0 ? (
                <pre className="mt-2 bg-muted/30 dark:bg-muted/20 p-2 rounded-md text-xs font-mono max-h-40 overflow-auto custom-scrollbar">
                  <code>
                    {filesToAdd.map((file) => (
                      <div
                        key={`add-${file}`}
                        className="text-green-600 dark:text-green-500 whitespace-pre-wrap"
                      >
                        <span className="select-none">+ </span>
                        {file}
                      </div>
                    ))}
                    {filesToRemove.map((file) => (
                      <div
                        key={`remove-${file}`}
                        className="text-red-600 dark:text-red-500 whitespace-pre-wrap"
                      >
                        <span className="select-none">- </span>
                        {file}
                      </div>
                    ))}
                  </code>
                </pre>
              ) : (
                <p className="text-xs text-muted-foreground italic mt-1">
                  No files were added or removed.
                </p>
              )}
            </div>
          );
        } catch (e) {
          toolContent = (
            <p className="font-medium text-foreground">
              {t("aiPanel.toolCall.modifiedGroup")}
            </p>
          );
        }
        break;

      default:
        toolContent = <p>{tool.function.name}</p>;
        break;
    }

    return (
      <div
        key={tool.id}
        className="flex items-start gap-2.5 text-sm bg-muted/60 dark:bg-muted/30 rounded-lg p-3 border"
      >
        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
        {toolContent}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "flex w-full",
        message.role === "user" ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-xs md:max-w-md lg:max-w-lg text-sm rounded-lg",
          message.role === "user" ? "bg-muted px-3 py-2" : ""
        )}
      >
        {message.role === "user" ? (
          <div className="flex flex-col gap-2">
            {message.attachedFiles && message.attachedFiles.length > 0 && (
              <div className="border-b border-background/50 pb-2">
                <div className="flex flex-wrap gap-1.5">
                  {message.attachedFiles.map((file) => (
                    <Badge
                      key={file}
                      variant="outline"
                      className="font-normal bg-background/50"
                    >
                      <Paperclip className="h-3 w-3 mr-1.5" />
                      {file.split("/").pop()}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="whitespace-pre-wrap">{message.content}</div>
          </div>
        ) : message.role === "assistant" && message.tool_calls ? (
          <div className="space-y-2">
            {message.tool_calls.map(renderToolCall)}
          </div>
        ) : (
          <div className="markdown-content">
            {message.role === "assistant" ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {message.content || ""}
              </ReactMarkdown>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export function LoadingIndicator() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-start gap-2 text-muted-foreground italic text-sm">
      <Loader2 className="h-4 w-4 animate-spin" />
      <p>{t("aiPanel.responding")}</p>
    </div>
  );
}
