// src/components/StagingPanel.tsx
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore, useAppActions } from "@/store/appStore";
import { useShallow } from "zustand/react/shallow";
import {
  ChevronUp,
  GitMerge,
  FilePlus,
  FileMinus,
  FileDiff,
  Check,
  X,
  CheckCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function StagingPanel() {
  const { t } = useTranslation();
  const { stagedFileChanges } = useAppStore(
    useShallow((state) => ({
      stagedFileChanges: state.stagedFileChanges,
    }))
  );
  const {
    openFileInEditor,
    applyStagedChange,
    discardStagedChange,
    applyAllStagedChanges,
    discardAllStagedChanges,
  } = useAppActions();

  const [isExpanded, setIsExpanded] = useState(false);

  const totalStats = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const change of stagedFileChanges.values()) {
      if (change.changeType === "create") {
        // For new files, all lines are additions. We need to get the content.
        // This is a simplification; a better approach would be to read the file content here.
        // For now, we rely on the stats calculated at staging time.
        added += change.stats.added;
      } else if (change.changeType === "delete") {
        removed += change.stats.removed;
      } else if (change.changeType === "modify" && change.originalContent) {
        // This part is tricky as we don't have the *current* content here without reading the file.
        // We'll rely on the stats passed during staging.
        added += change.stats.added;
        removed += change.stats.removed;
      }
    }
    return { added, removed, count: stagedFileChanges.size };
  }, [stagedFileChanges]);

  if (totalStats.count === 0) {
    if (isExpanded) {
      setIsExpanded(false); // Auto-collapse when empty
    }
    return null;
  }

  // Auto-expand when changes appear
  useState(() => {
    if (totalStats.count > 0 && !isExpanded) {
      setIsExpanded(true);
    }
  });

  const StagedFileItem = ({
    filePath,
    changeType,
    stats,
  }: {
    filePath: string;
    changeType: "create" | "modify" | "delete";
    stats: { added: number; removed: number };
  }) => {
    const colorClass =
      changeType === "create"
        ? "text-green-600 dark:text-green-500"
        : changeType === "delete"
        ? "text-destructive"
        : "";

    return (
      <div className="flex items-center gap-2 p-2 rounded-md hover:bg-muted">
        {changeType === "create" ? (
          <FilePlus
            className={cn("h-4 w-4 shrink-0 text-muted-foreground", colorClass)}
          />
        ) : changeType === "delete" ? (
          <FileMinus
            className={cn("h-4 w-4 shrink-0 text-muted-foreground", colorClass)}
          />
        ) : (
          <FileDiff
            className={cn("h-4 w-4 shrink-0 text-muted-foreground", colorClass)}
          />
        )}
        <span
          className={cn(
            "flex-1 font-mono text-sm truncate cursor-pointer hover:underline",
            colorClass
          )}
          onClick={() => openFileInEditor(filePath)}
          title={filePath}
        >
          {filePath}
        </span>
        <Badge
          variant="outline"
          className="font-mono text-xs text-green-600 dark:text-green-500 border-green-500/50"
        >
          +{stats.added}
        </Badge>
        <Badge
          variant="outline"
          className="font-mono text-xs text-red-600 dark:text-red-500 border-red-500/50"
        >
          -{stats.removed}
        </Badge>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => applyStagedChange(filePath)}
          title={t("stagingPanel.acceptChange")}
        >
          <Check className="h-4 w-4 text-green-500" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => discardStagedChange(filePath)}
          title={t("stagingPanel.discardChange")}
        >
          <X className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    );
  };

  return (
    <div
      className={cn(
        "absolute bottom-0 left-0 right-0 z-20 bg-card border-t transition-all duration-300 ease-in-out",
        isExpanded ? "h-1/2" : "h-12"
      )}
    >
      <div className="flex flex-col h-full">
        {/* Collapsed Bar / Expanded Header */}
        <div
          className="flex items-center justify-between px-4 h-12 shrink-0 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <GitMerge className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">
              {t("stagingPanel.title", { count: totalStats.count })}
            </h3>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="font-mono text-sm text-green-600 dark:text-green-500 border-green-500/50"
              >
                +{totalStats.added}
              </Badge>
              <Badge
                variant="outline"
                className="font-mono text-sm text-red-600 dark:text-red-500 border-red-500/50"
              >
                -{totalStats.removed}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isExpanded && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    applyAllStagedChanges();
                  }}
                  className="text-green-600 dark:text-green-500 hover:bg-green-500/10 hover:text-green-600"
                >
                  <CheckCheck className="mr-2 h-4 w-4" />
                  {t("stagingPanel.acceptAll")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    discardAllStagedChanges();
                  }}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  {t("stagingPanel.discardAll")}
                </Button>
              </>
            )}
            <ChevronUp
              className={cn(
                "h-5 w-5 text-muted-foreground transition-transform",
                !isExpanded && "rotate-180"
              )}
            />
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <ScrollArea className="flex-1 min-h-0 bg-muted/30">
            <div className="p-2 space-y-1">
              {Array.from(stagedFileChanges.entries()).map(
                ([filePath, change]) => (
                  <StagedFileItem
                    key={filePath}
                    filePath={filePath}
                    changeType={change.changeType}
                    stats={change.stats}
                  />
                )
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
