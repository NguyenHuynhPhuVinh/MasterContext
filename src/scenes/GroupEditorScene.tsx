// src/scenes/GroupEditorScene.tsx
import { useCallback } from "react";
import { useAppStore, useAppActions } from "@/store/appStore";
import { useShallow } from "zustand/react/shallow"; // <-- THÊM IMPORT NÀY
import { FileTreeView, type FileNode } from "@/components/FileTreeView";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export function GroupEditorScene() {
  const { saveEditingGroup, cancelEditingGroup, toggleEditingPath } =
    useAppActions();

  // --- THAY ĐỔI: SỬ DỤNG useShallow ĐỂ NGĂN VÒNG LẶP VÔ HẠN ---
  const { group, fileTree, isSaving, tempSelectedPaths } = useAppStore(
    useShallow((state) => ({
      group: state.groups.find((g) => g.id === state.editingGroupId),
      fileTree: state.fileTree,
      isSaving: state.isUpdatingGroupId === state.editingGroupId,
      tempSelectedPaths: state.tempSelectedPaths,
    }))
  );

  // handleTogglePath giờ chỉ là một proxy gọi action trong store
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
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-2xl font-bold">
            Chỉnh sửa nội dung nhóm: {group.name}
          </h1>
          <p className="text-muted-foreground">
            Chọn các tệp và thư mục để đưa vào ngữ cảnh.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={cancelEditingGroup}
            disabled={isSaving}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại
          </Button>
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
