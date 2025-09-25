// src/components/EditorPanel.tsx
import { useState, useRef } from "react";
import { useAppStore, useAppActions } from "@/store/appStore";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Loader2, Scissors, FileX, Undo } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

export function EditorPanel() {
  const {
    closeEditor,
    addExclusionRange,
    removeExclusionRange,
    clearExclusionRanges,
  } = useAppActions();
  const {
    activeEditorFile,
    activeEditorFileContent,
    isEditorLoading,
    activeEditorFileExclusions,
  } = useAppStore(
    useShallow((state) => ({
      activeEditorFile: state.activeEditorFile,
      activeEditorFileContent: state.activeEditorFileContent,
      isEditorLoading: state.isEditorLoading,
      activeEditorFileExclusions: state.activeEditorFileExclusions,
    }))
  );

  const [selection, setSelection] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const codeContainerRef = useRef<HTMLElement>(null);

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

  const renderContentWithExclusions = () => {
    if (!activeEditorFileContent) return null;
    if (
      !activeEditorFileExclusions ||
      activeEditorFileExclusions.length === 0
    ) {
      return <span>{activeEditorFileContent}</span>;
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
            {activeEditorFileContent.substring(lastIndex, range[0])}
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
                {activeEditorFileContent.substring(range[0], range[1])}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="flex items-center gap-2">
                <Undo className="h-3 w-3" /> Bỏ loại trừ
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
      lastIndex = range[1];
    });

    if (lastIndex < activeEditorFileContent.length) {
      parts.push(
        <span key="final-incl">
          {activeEditorFileContent.substring(lastIndex)}
        </span>
      );
    }

    return parts;
  };

  if (!activeEditorFile) {
    return null;
  }

  return (
    <div className="flex flex-col h-full bg-muted/20">
      <header className="flex items-center justify-between p-2 pl-4 border-b shrink-0 h-14">
        <p className="font-mono text-sm truncate" title={activeEditorFile}>
          {activeEditorFile}
        </p>
        <div className="flex items-center gap-1">
          {activeEditorFileExclusions &&
            activeEditorFileExclusions.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearExclusionRanges}
                title="Xóa tất cả các vùng loại trừ"
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
        {selection && (
          <Button
            className="absolute z-10 top-2 right-2 animate-in fade-in"
            size="sm"
            onClick={handleExcludeClick}
          >
            <Scissors className="mr-2 h-4 w-4" />
            Loại trừ vùng đã chọn
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
              <code ref={codeContainerRef}>
                {renderContentWithExclusions()}
              </code>
            </pre>
          </ScrollArea>
        )}
      </main>
    </div>
  );
}
