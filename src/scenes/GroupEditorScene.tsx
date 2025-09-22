// src/scenes/GroupEditorScene.tsx
import { useEffect, useState, useCallback, useMemo } from "react"; // <-- Thêm useMemo
import { useAppStore, useAppActions } from "@/store/appStore";
import { FileTreeView, type FileNode } from "@/components/FileTreeView";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Loader2 } from "lucide-react"; // Thêm Loader2
import { ScrollArea } from "@/components/ui/scroll-area";

const getDescendantAndSelfPaths = (node: FileNode): string[] => {
  const paths = [node.path];
  if (Array.isArray(node.children)) {
    node.children.forEach((child) => {
      paths.push(...getDescendantAndSelfPaths(child));
    });
  }
  return paths;
};

const expandPaths = (
  rootNode: FileNode,
  savedPaths: Set<string>
): Set<string> => {
  // Logic này đã đúng, không cần thay đổi
  const expanded = new Set<string>();

  function traverse(node: FileNode, isAncestorSelected: boolean) {
    let isSelected = isAncestorSelected || savedPaths.has(node.path);

    // Nếu node này là một thư mục được chọn, tất cả con cháu của nó cũng được chọn
    if (isSelected && Array.isArray(node.children)) {
      getDescendantAndSelfPaths(node).forEach((p) => expanded.add(p));
      return; // Dừng lại vì đã thêm tất cả con cháu
    }

    if (isSelected) {
      expanded.add(node.path);
    }

    // Nếu node là thư mục, tiếp tục duyệt con cháu
    if (Array.isArray(node.children)) {
      let hasSelectedDescendant = false;
      for (const child of node.children) {
        // Đệ quy và kiểm tra xem có con nào được chọn không
        if (traverse(child, isSelected)) {
          hasSelectedDescendant = true;
        }
      }
      // Nếu có con cháu được chọn, thư mục cha này cũng phải được thêm vào set (để hiển thị indeterminate)
      if (hasSelectedDescendant) {
        expanded.add(node.path);
        return true; // Báo cho cấp cha biết là có mục con được chọn
      }
    }

    return expanded.has(node.path);
  }

  traverse(rootNode, false);
  return expanded;
};

// --- HÀM HELPER MỚI VÀ CẢI TIẾN LOGIC LƯU ---

// Helper: Kiểm tra xem một node và TẤT CẢ con cháu của nó có được chọn không
const areAllDescendantsSelected = (
  node: FileNode,
  selectedPaths: Set<string>
): boolean => {
  if (!selectedPaths.has(node.path)) {
    return false;
  }
  if (Array.isArray(node.children)) {
    // every() sẽ trả về true nếu mảng rỗng, điều này là đúng
    return node.children.every((child) =>
      areAllDescendantsSelected(child, selectedPaths)
    );
  }
  // Nếu là file, chỉ cần kiểm tra chính nó
  return true;
};

// Hàm "cắt tỉa" thông minh hơn
const prunePathsForSave = (
  rootNode: FileNode,
  selectedPaths: Set<string>
): string[] => {
  const pruned: string[] = [];

  function traverse(node: FileNode) {
    // Nếu node này không được chọn (dù chỉ một phần), bỏ qua nhánh này
    if (!selectedPaths.has(node.path)) {
      return;
    }

    // Nếu node này và TẤT CẢ con cháu của nó được chọn,
    // chỉ cần thêm node này và không cần đi sâu hơn.
    if (areAllDescendantsSelected(node, selectedPaths)) {
      pruned.push(node.path);
      return;
    }

    // Nếu là file và được chọn (trường hợp cha của nó không được chọn hoàn toàn)
    if (!Array.isArray(node.children) && selectedPaths.has(node.path)) {
      pruned.push(node.path);
    }

    // Nếu là thư mục (và không được chọn hoàn toàn), tiếp tục duyệt các con
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  // Bắt đầu duyệt từ các con của node gốc, vì node gốc thường là container
  if (Array.isArray(rootNode.children)) {
    for (const child of rootNode.children) {
      traverse(child);
    }
  }

  return pruned;
};

export function GroupEditorScene() {
  const { showDashboard, updateGroupPaths } = useAppActions();
  const editingGroupId = useAppStore((state) => state.editingGroupId);
  const group = useAppStore((state) =>
    state.groups.find((g) => g.id === state.editingGroupId)
  );
  const fileTree = useAppStore((state) => state.fileTree); // <-- LẤY TỪ STORE
  const isSaving = useAppStore(
    (state) => state.isUpdatingGroupId === state.editingGroupId
  ); // <-- KIỂM TRA LOADING

  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  // --- THAY ĐỔI LỚN: SỬ DỤNG useMemo ĐỂ TÍNH TOÁN LẠI selectedPaths MỘT CÁCH HIỆU QUẢ ---
  const initialSelectedPaths = useMemo(() => {
    if (group && fileTree) {
      console.log("Recalculating initial paths for group:", group.name);
      const savedPaths = new Set(group.paths);
      // expandPaths sẽ tính toán tất cả các node cha và con cần được tick/indeterminate
      return expandPaths(fileTree, savedPaths);
    }
    return new Set<string>();
  }, [group, fileTree]);

  // Đồng bộ state khi initialSelectedPaths thay đổi (khi mở một group khác)
  useEffect(() => {
    setSelectedPaths(initialSelectedPaths);
  }, [initialSelectedPaths]);

  const handleTogglePath = useCallback(
    (toggledNode: FileNode, isSelected: boolean) => {
      const newSelectedPaths = new Set(selectedPaths);
      const pathsToToggle = getDescendantAndSelfPaths(toggledNode);

      if (isSelected) {
        pathsToToggle.forEach((p) => newSelectedPaths.add(p));
      } else {
        pathsToToggle.forEach((p) => newSelectedPaths.delete(p));
      }

      // Logic cập nhật node cha (để thành indeterminate)
      let parent = findParent(fileTree, toggledNode);
      while (parent) {
        const allChildren = getDescendantAndSelfPaths(parent!).filter(
          (p) => p !== parent!.path
        );
        const selectedChildren = allChildren.filter((p) =>
          newSelectedPaths.has(p)
        );
        if (selectedChildren.length > 0) {
          newSelectedPaths.add(parent!.path);
        } else {
          newSelectedPaths.delete(parent!.path);
        }
        parent = findParent(fileTree, parent!);
      }

      setSelectedPaths(newSelectedPaths);
    },
    [selectedPaths, fileTree]
  );

  // Helper function to find parent (cần thiết cho logic indeterminate khi bỏ chọn)
  function findParent(
    root: FileNode | null,
    nodeToFind: FileNode
  ): FileNode | null {
    if (!root || !root.children) return null;
    for (const child of root.children) {
      if (child.path === nodeToFind.path) return root;
      const found = findParent(child, nodeToFind);
      if (found) return found;
    }
    return null;
  }

  const handleSave = async () => {
    if (editingGroupId && fileTree) {
      const pathsToSave = prunePathsForSave(fileTree, selectedPaths);
      // Gọi action bất đồng bộ, không cần await
      updateGroupPaths(editingGroupId, pathsToSave);
      // Chuyển về dashboard ngay lập tức
      showDashboard();
    }
  };

  if (!group) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p>Lỗi: Không tìm thấy nhóm để chỉnh sửa.</p>
        <Button onClick={showDashboard}>Quay lại</Button>
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
          <Button variant="outline" onClick={showDashboard} disabled={isSaving}>
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
          {/* --- THAY ĐỔI: Bỏ isLoading, kiểm tra trực tiếp fileTree --- */}
          {fileTree ? (
            <FileTreeView
              node={fileTree}
              selectedPaths={selectedPaths}
              onToggle={handleTogglePath}
            />
          ) : (
            <p>Đang tải cây thư mục...</p> // Hoặc một spinner
          )}
        </ScrollArea>
      </main>
    </div>
  );
}
