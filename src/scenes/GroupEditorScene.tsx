// src/scenes/GroupEditorScene.tsx
import { useEffect, useState } from "react";
import { useAppStore, useAppActions } from "@/store/appStore";
import { invoke } from "@tauri-apps/api/core";
import { FileTreeView, type FileNode } from "@/components/FileTreeView"; // <-- Component mới
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export function GroupEditorScene() {
  const { showDashboard, updateGroupPaths } = useAppActions();
  const editingGroupId = useAppStore((state) => state.editingGroupId);
  const rootPath = useAppStore((state) => state.rootPath);
  const group = useAppStore((state) =>
    state.groups.find((g) => g.id === state.editingGroupId)
  );

  const [fileTree, setFileTree] = useState<FileNode | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (group) {
      setSelectedPaths(new Set(group.paths));
    }
    if (rootPath) {
      invoke<FileNode>("get_project_file_tree", { path: rootPath })
        .then(setFileTree)
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [rootPath, group]);

  const handleTogglePath = (
    path: string,
    isSelected: boolean,
    children?: FileNode[]
  ) => {
    const newSelectedPaths = new Set(selectedPaths);
    const allPathsToToggle = [path];

    // Nếu là thư mục, chọn/bỏ chọn tất cả các file/thư mục con
    const collectChildrenPaths = (nodes: FileNode[]) => {
      nodes.forEach((node) => {
        allPathsToToggle.push(node.path);
        if (node.children) {
          collectChildrenPaths(node.children);
        }
      });
    };
    if (children) {
      collectChildrenPaths(children);
    }

    allPathsToToggle.forEach((p) => {
      if (isSelected) newSelectedPaths.add(p);
      else newSelectedPaths.delete(p);
    });

    setSelectedPaths(newSelectedPaths);
  };

  const handleSave = async () => {
    if (editingGroupId) {
      await updateGroupPaths(editingGroupId, Array.from(selectedPaths));
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
          <Button variant="outline" onClick={showDashboard}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại
          </Button>
          <Button onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" /> Lưu thay đổi
          </Button>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full p-4">
          {isLoading ? (
            <p>Đang tải cây thư mục...</p>
          ) : fileTree ? (
            <FileTreeView
              node={fileTree}
              selectedPaths={selectedPaths}
              onToggle={handleTogglePath}
            />
          ) : (
            <p>Không thể tải cây thư mục.</p>
          )}
        </ScrollArea>
      </main>
    </div>
  );
}
