// src/components/EditorPanel.tsx
import { useState, useRef, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore, useAppActions } from "@/store/appStore";
import { useShallow } from "zustand/react/shallow";
import { applyPatch, diffLines } from "diff";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Loader2,
  Scissors,
  FileX,
  Undo,
  RotateCcw,
  FilePlus,
  FileMinus,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

export function EditorPanel() {
  const { t } = useTranslation();
  const {
    closeEditor,
    addExclusionRange,
    removeExclusionRange,
    clearExclusionRanges,
    discardStagedChange,
  } = useAppActions();
  const {
    activeEditorFile,
    activeEditorFileContent,
    isEditorLoading,
    activeEditorFileExclusions,
    stagedFileChanges,
  } = useAppStore(
    useShallow((state) => ({
      activeEditorFile: state.activeEditorFile,
      activeEditorFileContent: state.activeEditorFileContent,
      isEditorLoading: state.isEditorLoading,
      activeEditorFileExclusions: state.activeEditorFileExclusions,
      stagedFileChanges: state.stagedFileChanges,
    }))
  );

  const [selection, setSelection] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const codeContainerRef = useRef<HTMLElement>(null);

  const activeChange =
    activeEditorFile && stagedFileChanges.get(activeEditorFile);

  let badgeContent: ReactNode = null;
  if (activeChange) {
    switch (activeChange.changeType) {
      case "create":
        badgeContent = (
          <Badge variant="outline" className="text-green-500">
            <FilePlus className="h-3 w-3 mr-1" />
            {t("editorPanel.newFileBadge")}
          </Badge>
        );
        break;
      case "delete":
        badgeContent = (
          <Badge variant="destructive">
            <FileMinus className="h-3 w-3 mr-1" />
            {t("editorPanel.deletedFileBadge")}
          </Badge>
        );
        break;
      case "modify":
        badgeContent = (
          <span className="text-yellow-500 font-bold text-xs animate-pulse">
            [PATCHED]
          </span>
        );
        break;
    }
  }

  const patchedContent = useMemo(() => {
    if (!activeChange || !activeEditorFileContent) {
      return null;
    }
    // Sửa đổi: sử dụng `patch` từ `activeChange`
    const result = applyPatch(activeEditorFileContent, activeChange.patch);
    return result === false ? null : result;
  }, [activeEditorFileContent, activeChange]);

  const handleMouseUp = () => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && codeContainerRef.current) {
      const range = sel.getRangeAt(0);
      const preSelectionRange = document.createRange();
      preSelectionRange.selectNodeContents(codeContainerRef.current);
      preSelectionRange.setEnd(range.startContainer, range.startOffset);
      const start = preSelectionRange.toString().length;
      const end = start + range.toString().length;

      if (start < end) {
        setSelection({ start, end });
      }
    } else {
      setSelection(null);
    }
  };

  const handleExcludeClick = () => {
    if (selection) {
      addExclusionRange(selection.start, selection.end);
      setSelection(null);
      window.getSelection()?.removeAllRanges();
    }
  };

  const renderContentWithExclusions = (
    content: string | null
  ): React.ReactNode => {
    if (!content) return null;

    // If a patch is active, we don't show exclusions to avoid visual clutter.
    // The patch is a temporary override.
    if (activeChange) {
      return renderContent();
    }

    if (
      !activeEditorFileExclusions ||
      activeEditorFileExclusions.length === 0
    ) {
      return <span>{content}</span>;
    }

    const sortedRanges = [...activeEditorFileExclusions].sort(
      (a, b) => a[0] - b[0]
    );
    const parts = [];
    let lastIndex = 0;

    sortedRanges.forEach((range, i) => {
      if (range[0] > lastIndex) {
        parts.push(
          <span key={`incl-${i}`}>
            {content.substring(lastIndex, range[0])}
          </span>
        );
      }
      parts.push(
        <TooltipProvider key={`excl-tip-${i}`} delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="bg-destructive/20 cursor-pointer hover:bg-destructive/40 rounded-sm"
                onClick={() => removeExclusionRange(range)}
              >
                {content.substring(range[0], range[1])}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="flex items-center gap-2">
                <Undo className="h-3 w-3" /> {t("editorPanel.undoExclude")}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
      lastIndex = range[1];
    });

    if (lastIndex < content.length) {
      parts.push(<span key="final-incl">{content.substring(lastIndex)}</span>);
    }

    return parts;
  };

  const renderContent = (): React.ReactNode => {
    if (isEditorLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (activeChange) {
      switch (activeChange.changeType) {
        case "create": {
          const newContent = applyPatch("", activeChange.patch) as string;
          return newContent.split("\n").map((line, index) => (
            <div key={index} className="flex bg-green-500/10">
              <span className="w-8 text-right pr-2 select-none text-muted-foreground">
                +
              </span>
              <span className="flex-1">{line}</span>
            </div>
          ));
        }
        case "delete": {
          return (activeEditorFileContent || "")
            .split("\n")
            .map((line, index) => (
              <div key={index} className="flex bg-red-500/10">
                <span className="w-8 text-right pr-2 select-none text-muted-foreground">
                  -
                </span>
                <span className="flex-1">{line}</span>
              </div>
            ));
        }
        case "modify": {
          if (!patchedContent || !activeEditorFileContent) return null;
          const diff = diffLines(activeEditorFileContent, patchedContent);
          let lineNum = 1;
          return diff.flatMap((part, index) => {
            const className = part.added
              ? "bg-green-500/20"
              : part.removed
              ? "bg-red-500/20"
              : "";
            const lines = part.value.split("\n").slice(0, -1); // remove last empty line
            return lines.map((line, lineIndex) => {
              const prefix = part.added ? "+" : part.removed ? "-" : " ";
              const currentLineNum = part.removed ? "" : lineNum++;
              return (
                <div key={`${index}-${lineIndex}`} className={className}>
                  <span className="inline-block w-8 text-right pr-2 select-none text-muted-foreground">
                    {currentLineNum}
                  </span>
                  <span className="inline-block w-4 text-center select-none text-muted-foreground">
                    {prefix}
                  </span>
                  <span>{line}</span>
                </div>
              );
            });
          });
        }
      }
    }

    return renderContentWithExclusions(activeEditorFileContent);
  };

  if (!activeEditorFile) {
    return null;
  }

  return (
    <div className="flex flex-col h-full bg-muted/20">
      <header className="flex items-center justify-between p-2 pl-4 border-b shrink-0 h-14">
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-mono text-sm truncate" title={activeEditorFile}>
            {activeEditorFile}
          </p>
          {activeChange && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>{badgeContent}</div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("editorPanel.patchedTooltip")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex items-center gap-1">
          {activeChange && activeEditorFile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => discardStagedChange(activeEditorFile)}
              title={t("editorPanel.resetPatch")}
            >
              <RotateCcw className="h-4 w-4 text-destructive" />
            </Button>
          )}
          {!activeChange &&
            activeEditorFileExclusions &&
            activeEditorFileExclusions.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearExclusionRanges}
                title={t("editorPanel.clearExclusionsTooltip")}
              >
                <FileX className="h-4 w-4 text-destructive" />
              </Button>
            )}
          <Button variant="ghost" size="icon" onClick={closeEditor}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <main className="flex-1 overflow-auto relative">
        {!activeChange && selection && (
          <Button
            className="absolute z-10 top-2 right-2 animate-in fade-in"
            size="sm"
            onClick={handleExcludeClick}
          >
            <Scissors className="mr-2 h-4 w-4" />
            {t("editorPanel.excludeSelection")}
          </Button>
        )}
        {isEditorLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea
            className="h-full"
            onMouseUp={handleMouseUp}
            onMouseDown={() => setSelection(null)}
          >
            <pre className="p-4 text-xs">
              <code ref={codeContainerRef}>{renderContent()}</code>
            </pre>
          </ScrollArea>
        )}
      </main>
    </div>
  );
}
