// src/components/ai/AIPromptInput.tsx
import { useTranslation } from "react-i18next";
import {
  Send,
  X,
  Square,
  AlignJustify,
  HelpCircle,
  Link as LinkIcon,
  FileDiff,
  Folder,
  FileText,
  ListChecks,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatPrice } from "@/lib/utils";
import { type AIModel, type AttachedItem } from "@/store/types";

interface AIPromptInputProps {
  prompt: string;
  setPrompt: (value: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onStop: () => void;
  isLoading: boolean;
  attachedFiles: AttachedItem[];
  onDetachFile: (itemId: string) => void;
  chatMode: "ask" | "context" | "agent";
  setChatMode: (mode: "ask" | "context" | "agent") => void;
  models: AIModel[];
  selectedModel: string;
  setSelectedModel: (modelId: string) => void;
}

export function AIPromptInput({
  prompt,
  setPrompt,
  onSend,
  onKeyDown,
  onStop,
  isLoading,
  attachedFiles,
  onDetachFile,
  chatMode,
  setChatMode,
  models,
  selectedModel,
  setSelectedModel,
}: AIPromptInputProps) {
  const { t } = useTranslation();
  const selectedModelDetails = models.find(
    (m) => m.id === (selectedModel || models[0]?.id)
  );

  return (
    <div className="p-4 border-t">
      <div className="relative flex flex-col min-h-[80px] max-h-48 w-full rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 overflow-hidden">
        {attachedFiles.length > 0 && (
          <div className="flex-shrink-0 px-3 py-2 text-xs text-muted-foreground border-b bg-muted/50">
            <ScrollArea className="max-h-16 custom-scrollbar">
              <div className="flex flex-wrap gap-2">
                {attachedFiles.map((item) => (
                  <Badge
                    key={item.id}
                    variant="secondary"
                    className="pl-2 pr-1"
                  >
                    {item.type === "file" && (
                      <FileText className="h-3 w-3 mr-1.5" />
                    )}
                    {item.type === "folder" && (
                      <Folder className="h-3 w-3 mr-1.5" />
                    )}
                    {item.type === "group" && (
                      <ListChecks className="h-3 w-3 mr-1.5" />
                    )}
                    {item.name}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-1 h-4 w-4 rounded-full"
                      onClick={() => onDetachFile(item.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
        <Textarea
          placeholder={t("aiPanel.placeholder")}
          className="flex-1 w-full !rounded-none resize-none border-none bg-transparent px-3 py-3 shadow-none focus-visible:ring-0 custom-scrollbar"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="flex-shrink-0 flex h-12 items-center justify-between px-3 pt-1">
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-8 gap-2 px-2 text-muted-foreground"
                >
                  {chatMode === "ask" ? (
                    <HelpCircle className="h-4 w-4 shrink-0" />
                  ) : chatMode === "context" ? (
                    <LinkIcon className="h-4 w-4 shrink-0" />
                  ) : (
                    <FileDiff className="h-4 w-4 shrink-0" />
                  )}
                  <span className="capitalize text-xs font-medium">
                    {t(`aiPanel.modes.${chatMode}`)}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[180px]">
                <DropdownMenuRadioGroup
                  value={chatMode}
                  onValueChange={(value) =>
                    setChatMode(value as "ask" | "context" | "agent")
                  }
                >
                  <DropdownMenuRadioItem value="ask">
                    {t("aiPanel.modes.ask")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="context">
                    {t("aiPanel.modes.context")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="agent">
                    {t("aiPanel.modes.agent")}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            {models.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-8 gap-2 px-2 text-muted-foreground"
                  >
                    <div className="flex items-center gap-2">
                      <AlignJustify className="h-4 w-4 shrink-0" />
                      <span className="truncate max-w-[100px] text-xs font-medium">
                        {selectedModelDetails?.name.split(":").pop() || "..."}
                      </span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[350px]">
                  <DropdownMenuRadioGroup
                    value={selectedModel || models[0]?.id}
                    onValueChange={setSelectedModel}
                  >
                    {models.map((model) => (
                      <DropdownMenuRadioItem
                        key={`${model.provider}-${model.id}`}
                        value={model.id}
                      >
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                model.provider === "google"
                                  ? "font-semibold text-blue-600 dark:text-blue-400"
                                  : ""
                              }
                            >
                              {model.name}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {model.provider}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground flex gap-2">
                            {model.provider === "openrouter" ? (
                              <>
                                <span>
                                  {model.context_length?.toLocaleString()} ctx
                                </span>
                                <span>
                                  In: {formatPrice(model.pricing.prompt)}/M
                                </span>
                                <span>
                                  Out: {formatPrice(model.pricing.completion)}
                                  /M
                                </span>
                              </>
                            ) : (
                              <span>
                                {model.context_length?.toLocaleString()} context
                              </span>
                            )}
                          </div>
                        </div>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <Button
            variant={isLoading ? "destructive" : "default"}
            size="icon"
            className="h-8 w-8"
            onClick={isLoading ? onStop : onSend}
            disabled={!isLoading && !prompt.trim()}
          >
            {isLoading ? (
              <Square className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
