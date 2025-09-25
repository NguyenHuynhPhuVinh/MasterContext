// src/components/EditorPanel.tsx
import { useAppStore, useAppActions } from "@/store/appStore";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Loader2 } from "lucide-react";

export function EditorPanel() {
  const { closeEditor } = useAppActions();
  const { activeEditorFile, activeEditorFileContent, isEditorLoading } =
    useAppStore(
      useShallow((state) => ({
        activeEditorFile: state.activeEditorFile,
        activeEditorFileContent: state.activeEditorFileContent,
        isEditorLoading: state.isEditorLoading,
      }))
    );

  if (!activeEditorFile) {
    return null;
  }

  return (
    <div className="flex flex-col h-full bg-muted/20">
      <header className="flex items-center justify-between p-2 pl-4 border-b shrink-0 h-14">
        <p className="font-mono text-sm truncate" title={activeEditorFile}>
          {activeEditorFile}
        </p>
        <Button variant="ghost" size="icon" onClick={closeEditor}>
          <X className="h-4 w-4" />
        </Button>
      </header>
      <main className="flex-1 overflow-auto">
        {isEditorLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="h-full">
            <pre className="p-4 text-xs">
              <code>{activeEditorFileContent}</code>
            </pre>
          </ScrollArea>
        )}
      </main>
    </div>
  );
}
