// src/scenes/GroupEditorPanel.tsx
import { useCallback } from "react";
import { useAppStore, useAppActions } from "@/store/appStore";
import { useShallow } from "zustand/react/shallow";
import { FileTreeView, type FileNode } from "@/components/FileTreeView";
import { Button } from "@/components/ui/button";
import {
  Save,
  Loader2,
  Link,
  Link2Off,
  CheckCheck,
  XCircle,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function GroupEditorPanel() {
  // <-- Đổi tên component
  const {
    saveEditingGroup,
    toggleEditingPath,
    setCrossLinkingEnabled,
    selectAllFiles,
    deselectAllFiles,
  } = useAppActions();

  const {
    group,
    fileTree,
    isSaving,
    tempSelectedPaths,
    isCrossLinkingEnabled,
  } = useAppStore(
    useShallow((state) => ({
      group: state.groups.find((g) => g.id === state.editingGroupId),
      fileTree: state.fileTree,
      isSaving: state.isUpdatingGroupId === state.editingGroupId,
      tempSelectedPaths: state.tempSelectedPaths,
      isCrossLinkingEnabled: state.isCrossLinkingEnabled,
    }))
  );

  const handleTogglePath = useCallback(
    (toggledNode: FileNode, isSelected: boolean) => {
      toggleEditingPath(toggledNode, isSelected);
    },
    [toggleEditingPath]
  );

  if (!group || !fileTree || tempSelectedPaths === null) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between p-4 border-b shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">Chỉnh sửa: {group.name}</h1>
          <p className="text-muted-foreground">
            Chọn các tệp và thư mục để đưa vào ngữ cảnh.
          </p>
        </div>
        <div className="flex flex-shrink-0 gap-2 ml-4">
          <Button onClick={saveEditingGroup} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>
      </header>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b shrink-0 bg-muted/50">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={selectAllFiles}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Chọn tất cả
          </Button>
          <Button variant="outline" size="sm" onClick={deselectAllFiles}>
            <XCircle className="mr-2 h-4 w-4" />
            Bỏ chọn tất cả
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="cross-linking-toggle"
            checked={isCrossLinkingEnabled}
            onCheckedChange={setCrossLinkingEnabled}
          />
          <Label
            htmlFor="cross-linking-toggle"
            className="flex items-center gap-2 text-sm cursor-pointer"
          >
            {isCrossLinkingEnabled ? (
              <Link className="h-4 w-4" />
            ) : (
              <Link2Off className="h-4 w-4" />
            )}
            Tự động chọn file liên quan
          </Label>
        </div>
      </div>
      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full p-4">
          <FileTreeView
            node={fileTree}
            selectedPaths={tempSelectedPaths}
            onToggle={handleTogglePath}
          />
        </ScrollArea>
      </main>
    </div>
  );
}
