// src/scenes/MainPanel.tsx
import { useAppStore } from "@/store/appStore";
import { useTranslation } from "react-i18next";
import { GroupEditorPanel } from "./GroupEditorPanel";
import { EditorPanel } from "@/components/EditorPanel";
import { StagingPanel } from "@/components/StagingPanel";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { LayoutGrid, ListChecks, FileCode } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

export function MainPanel() {
  const { t } = useTranslation();
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
        message={t("mainPanel.placeholder.selectGroupOrFile")}
        icon={LayoutGrid}
        t={t}
      />
    );
  }

  return (
    <div className="relative h-full w-full">
      <ResizablePanelGroup direction="horizontal">
        {isGroupEditorPanelVisible && (
          <ResizablePanel defaultSize={50} minSize={30} order={1}>
            {editingGroupId ? (
              <GroupEditorPanel />
            ) : (
              <Placeholder
                message={t("mainPanel.placeholder.noGroupSelected")}
                icon={ListChecks}
                t={t}
              />
            )}
          </ResizablePanel>
        )}
        {isGroupEditorPanelVisible && isEditorPanelVisible && (
          <ResizableHandle withHandle />
        )}
        {isEditorPanelVisible && (
          <ResizablePanel defaultSize={50} minSize={30} order={2}>
            {activeEditorFile ? (
              <EditorPanel />
            ) : (
              <Placeholder
                message={t("mainPanel.placeholder.noFileSelected")}
                icon={FileCode}
                t={t}
              />
            )}
          </ResizablePanel>
        )}
      </ResizablePanelGroup>
      <StagingPanel />
    </div>
  );
}

const Placeholder = ({
  message,
  icon: Icon,
  t,
}: {
  message: string;
  icon: React.ElementType;
  t: (key: string) => string;
}) => (
  <div className="flex flex-col items-center justify-center h-full text-center bg-muted/40 p-4">
    <Icon className="h-16 w-16 text-muted-foreground mb-4" />
    <h2 className="text-xl font-semibold">
      {t("mainPanel.placeholder.title")}
    </h2>
    <p className="text-muted-foreground mt-2 max-w-md">{message}</p>
  </div>
);
