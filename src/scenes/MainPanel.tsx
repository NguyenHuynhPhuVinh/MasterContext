// src/scenes/MainPanel.tsx
import { useAppStore } from "@/store/appStore";
import { GroupEditorPanel } from "./GroupEditorPanel";
import { EditorPanel } from "@/components/EditorPanel";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ListChecks, FileCode } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

export function MainPanel() {
  const { editingGroupId, activeEditorFile, isEditorPanelVisible } =
    useAppStore(
      useShallow((state) => ({
        editingGroupId: state.editingGroupId,
        activeEditorFile: state.activeEditorFile,
        isEditorPanelVisible: state.isEditorPanelVisible,
      }))
    );

  if (editingGroupId) {
    return (
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={50} minSize={30}>
          <GroupEditorPanel />
        </ResizablePanel>
        {isEditorPanelVisible && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={50} minSize={30}>
              {activeEditorFile ? (
                <EditorPanel />
              ) : (
                <Placeholder
                  message="Nhấp vào một file để xem nội dung"
                  icon={FileCode}
                />
              )}
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    );
  }

  if (activeEditorFile && isEditorPanelVisible) {
    return <EditorPanel />;
  }

  return (
    <Placeholder
      message="Chọn một nhóm để chỉnh sửa hoặc nhấp vào một file để xem trước"
      icon={ListChecks}
    />
  );
}

const Placeholder = ({
  message,
  icon: Icon,
}: {
  message: string;
  icon: React.ElementType;
}) => (
  <div className="flex flex-col items-center justify-center h-full text-center bg-muted/40 p-4">
    <Icon className="h-16 w-16 text-muted-foreground mb-4" />
    <h2 className="text-xl font-semibold">Bảng điều khiển Chính</h2>
    <p className="text-muted-foreground mt-2 max-w-md">{message}</p>
  </div>
);
