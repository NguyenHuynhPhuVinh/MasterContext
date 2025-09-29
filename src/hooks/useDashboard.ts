// src/hooks/useDashboard.ts
import { useState } from "react";
import { type Group } from "@/store/types";
import { useAppStore, useAppActions } from "@/store/appStore";
import { useShallow } from "zustand/react/shallow";
import { message } from "@tauri-apps/plugin-dialog";

export function useDashboard() {
  const { projectStats, selectedPath, groups } = useAppStore(
    useShallow((state) => ({
      projectStats: state.projectStats,
      selectedPath: state.selectedPath,
      groups: state.groups,
    }))
  );
  const { addGroup, updateGroup } = useAppActions();

  const [inlineEditingGroup, setInlineEditingGroup] = useState<{
    mode: "create" | "rename";
    groupId?: string;
  } | null>(null);

  // --- HANDLERS MỚI CHO GROUP INLINE EDITING ---
  const handleStartCreateGroup = () => {
    setInlineEditingGroup({ mode: "create" });
  };
  const handleStartRenameGroup = (group: Group) => {
    setInlineEditingGroup({ mode: "rename", groupId: group.id });
  };
  const onCancelGroupEdit = () => {
    setInlineEditingGroup(null);
  };
  const onGroupSubmitInline = async (newName: string) => {
    if (!inlineEditingGroup) return;

    if (!newName.trim()) {
      message("Tên nhóm không được để trống.", {
        title: "Lỗi",
        kind: "error",
      });
      return;
    }

    if (inlineEditingGroup.mode === "create") {
      addGroup({ name: newName });
    } else if (
      inlineEditingGroup.mode === "rename" &&
      inlineEditingGroup.groupId
    ) {
      updateGroup({ id: inlineEditingGroup.groupId, name: newName });
    }
    setInlineEditingGroup(null);
  };

  return {
    // Data
    projectStats,
    selectedPath,
    groups,
    // UI State
    inlineEditingGroup, // State mới
    // Group Handlers (mới)
    handleStartCreateGroup,
    handleStartRenameGroup,
    onCancelGroupEdit,
    onGroupSubmitInline,
  };
}
