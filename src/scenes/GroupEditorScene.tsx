// src/scenes/GroupEditorScene.tsx
import { useEffect, useCallback, useMemo } from "react";
import { useAppStore, useAppActions } from "@/store/appStore";
import { FileTreeView, type FileNode } from "@/components/FileTreeView";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

// --- CHUYỂN CÁC HÀM HELPER RA NGOÀI HOẶC VÀO utils.ts NẾU CẦN ---
const getDescendantAndSelfPaths = (node: FileNode): string[] => {
  const paths = [node.path];
  if (Array.isArray(node.children)) {
    node.children.forEach((child) => {
      paths.push(...getDescendantAndSelfPaths(child));
    });
  }
  return paths;
};

const areAllDescendantsSelected = (
  node: FileNode,
  selectedPaths: Set<string>
): boolean => {
  if (!selectedPaths.has(node.path)) return false;
  if (Array.isArray(node.children)) {
    return node.children.every((child) =>
      areAllDescendantsSelected(child, selectedPaths)
    );
  }
  return true;
};

const prunePathsForSave = (
  rootNode: FileNode,
  selectedPaths: Set<string>
): string[] => {
  const pruned: string[] = [];
  function traverse(node: FileNode) {
    if (!selectedPaths.has(node.path)) return;
    if (areAllDescendantsSelected(node, selectedPaths)) {
      pruned.push(node.path);
      return;
    }
    if (!Array.isArray(node.children) && selectedPaths.has(node.path)) {
      pruned.push(node.path);
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }
  if (Array.isArray(rootNode.children)) {
    for (const child of rootNode.children) {
      traverse(child);
    }
  }
  return pruned;
};

const expandPaths = (
  rootNode: FileNode,
  savedPaths: Set<string>
): Set<string> => {
  const expanded = new Set<string>();
  function traverse(node: FileNode, isAncestorSelected: boolean): boolean {
    let isSelected = isAncestorSelected || savedPaths.has(node.path);
    if (isSelected && Array.isArray(node.children)) {
      getDescendantAndSelfPaths(node).forEach((p) => expanded.add(p));
      return true;
    }
    if (isSelected) {
      expanded.add(node.path);
    }
    if (Array.isArray(node.children)) {
      let hasSelectedDescendant = false;
      for (const child of node.children) {
        if (traverse(child, isSelected)) {
          hasSelectedDescendant = true;
        }
      }
      if (hasSelectedDescendant) {
        expanded.add(node.path);
        return true;
      }
    }
    return expanded.has(node.path);
  }
  traverse(rootNode, false);
  return expanded;
};

export function GroupEditorScene() {
  const {
    showDashboard,
    updateGroupPaths,
    startEditingGroupPaths,
    updateEditingPaths,
    clearEditingPaths,
  } = useAppActions();

  const editingGroupId = useAppStore((state) => state.editingGroupId);
  const group = useAppStore((state) =>
    state.groups.find((g) => g.id === state.editingGroupId)
  );
  const fileTree = useAppStore((state) => state.fileTree);
  const isSaving = useAppStore(
    (state) => state.isUpdatingGroupId === state.editingGroupId
  );

  // Lấy state chỉnh sửa tạm thời từ store
  const editingPaths = useAppStore((state) => state.editingPaths);

  // Khởi tạo state chỉnh sửa khi component được mount hoặc editingGroupId thay đổi
  useEffect(() => {
    if (editingGroupId) {
      startEditingGroupPaths(editingGroupId);
    }
    // Dọn dẹp khi unmount
    return () => {
      // Không clear ở đây để giữ trạng thái khi chuyển tab
    };
  }, [editingGroupId, startEditingGroupPaths]);

  // Tính toán các đường dẫn cần hiển thị (bao gồm cả node cha) từ state chỉnh sửa
  const displayedPaths = useMemo(() => {
    if (editingPaths && fileTree) {
      return expandPaths(fileTree, editingPaths);
    }
    return new Set<string>();
  }, [editingPaths, fileTree]);

  const handleTogglePath = useCallback(
    (toggledNode: FileNode, isSelected: boolean) => {
      if (!editingPaths) return;
      const newEditingPaths = new Set(editingPaths);
      const pathsToToggle = getDescendantAndSelfPaths(toggledNode);
      if (isSelected) {
        pathsToToggle.forEach((p) => newEditingPaths.add(p));
      } else {
        pathsToToggle.forEach((p) => newEditingPaths.delete(p));
      }
      updateEditingPaths(newEditingPaths);
    },
    [editingPaths, updateEditingPaths]
  );

  const handleSave = async () => {
    if (editingGroupId && editingPaths && fileTree) {
      const pathsToSave = prunePathsForSave(fileTree, displayedPaths);
      await updateGroupPaths(editingGroupId, pathsToSave);
      handleGoBack(); // Quay lại và dọn dẹp
    }
  };

  const handleGoBack = () => {
    showDashboard();
    clearEditingPaths();
  };

  if (!group || !fileTree || editingPaths === null) {
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
          <Button variant="outline" onClick={handleGoBack} disabled={isSaving}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
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
            selectedPaths={displayedPaths}
            onToggle={handleTogglePath}
          />
        </ScrollArea>
      </main>
    </div>
  );
}
