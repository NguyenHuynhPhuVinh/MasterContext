// src/scenes/MainPanel.tsx
import { useAppStore } from "@/store/appStore";
import { GroupEditorPanel } from "./GroupEditorPanel";
import { ListChecks } from "lucide-react";

export function MainPanel() {
  const editingGroupId = useAppStore((state) => state.editingGroupId);

  if (editingGroupId) {
    return <GroupEditorPanel />;
  }

  return (
    <div className="flex flex-col items-center justify-center h-full text-center bg-muted/40">
      <ListChecks className="h-16 w-16 text-muted-foreground mb-4" />
      <h2 className="text-2xl font-semibold">Quản lý Nội dung Nhóm</h2>
      <p className="text-muted-foreground mt-2 max-w-md">
        Chọn một nhóm và nhấp vào "Quản lý nội dung" để bắt đầu chọn các tệp và
        thư mục cho ngữ cảnh của bạn.
      </p>
    </div>
  );
}
