// src/scenes/MainPanel.tsx
import { useAppStore } from "@/store/appStore";
import { GroupEditorPanel } from "./GroupEditorPanel";
import { EditorPanel } from "@/components/EditorPanel";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { LayoutGrid, ListChecks, FileCode } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

export function MainPanel() {
  const {
    editingGroupId,
    activeEditorFile,
    isEditorPanelVisible,
    isGroupEditorPanelVisible,
  } = useAppStore(
    useShallow((state) => ({
      editingGroupId: state.editingGroupId,
      activeEditorFile: state.activeEditorFile,
      isEditorPanelVisible: state.isEditorPanelVisible,
      isGroupEditorPanelVisible: state.isGroupEditorPanelVisible,
    }))
  );

  if (!isGroupEditorPanelVisible && !isEditorPanelVisible) {
    return (
      <Placeholder
        message="Chọn một nhóm để chỉnh sửa hoặc nhấp vào một file để xem trước"
        icon={LayoutGrid}
      />
    );
  }

  return (
    <ResizablePanelGroup direction="horizontal">
      {isGroupEditorPanelVisible && (
        <ResizablePanel defaultSize={50} minSize={30}>
          {editingGroupId ? (
            <GroupEditorPanel />
          ) : (
            <Placeholder
              message="Chưa có nhóm nào được chọn để chỉnh sửa"
              icon={ListChecks}
            />
          )}
        </ResizablePanel>
      )}
      {isGroupEditorPanelVisible && isEditorPanelVisible && (
        <ResizableHandle withHandle />
      )}
      {isEditorPanelVisible && (
        <ResizablePanel defaultSize={50} minSize={30}>
          {activeEditorFile ? (
            <EditorPanel />
          ) : (
            <Placeholder
              message="Chưa có file nào được chọn để xem"
              icon={FileCode}
            />
          )}
        </ResizablePanel>
      )}
    </ResizablePanelGroup>
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
