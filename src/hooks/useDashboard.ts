// src/hooks/useDashboard.ts
import { useState } from "react";
// --- BỎ IMPORT CỦA react-hook-form VÀ ZOD CHO GROUP ---
import { useAppStore, useAppActions } from "@/store/appStore";
import { useShallow } from "zustand/react/shallow";
import { message } from "@tauri-apps/plugin-dialog";

export function useDashboard() {
  const {
    projectStats,
    selectedPath,
    profiles,
    activeProfile,
    inlineEditingGroup,
  } = useAppStore(
    useShallow((state) => ({
      projectStats: state.projectStats,
      selectedPath: state.selectedPath,
      profiles: state.profiles,
      activeProfile: state.activeProfile,
      inlineEditingGroup: state.inlineEditingGroup,
    }))
  );
  const {
    addGroup,
    updateGroup,
    switchProfile,
    createProfile,
    renameProfile,
    deleteProfile,
    setInlineEditingGroup,
  } = useAppActions();

  // --- BỎ STATE DIALOG CỦA GROUP ---

  // State cho inline editing của Profile
  const [inlineEditingProfile, setInlineEditingProfile] = useState<{
    mode: "create" | "rename";
    name?: string;
  } | null>(null);

  // --- INLINE EDITING GROUP ĐƯỢC DI CHUYỂN VÀO STORE ---

  const [isProfileDeleteDialogOpen, setIsProfileDeleteDialogOpen] =
    useState(false);
  const [deletingProfile, setDeletingProfile] = useState<string | null>(null);

  // --- BỎ GROUP FORM ---

  // Handlers cho Profile Inline Editing
  const handleStartCreateProfile = () => {
    setInlineEditingGroup(null); // Đảm bảo chỉ có một inline edit tại một thời điểm
    setInlineEditingProfile({ mode: "create" });
  };
  const handleStartRenameProfile = (profile: string) => {
    setInlineEditingGroup(null);
    setInlineEditingProfile({ mode: "rename", name: profile });
  };
  const onCancelProfileEdit = () => {
    setInlineEditingProfile(null);
  };
  const onProfileSubmitInline = async (newName: string) => {
    // ... (logic này giữ nguyên)
    if (!inlineEditingProfile) return;
    if (!newName.trim()) {
      message("Tên hồ sơ không được để trống.", {
        title: "Lỗi",
        kind: "error",
      });
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(newName)) {
      message("Tên chỉ được chứa chữ, số, gạch dưới và gạch nối.", {
        title: "Lỗi",
        kind: "error",
      });
      return;
    }
    if (inlineEditingProfile.mode === "create") {
      await createProfile(newName);
    } else if (
      inlineEditingProfile.mode === "rename" &&
      inlineEditingProfile.name
    ) {
      await renameProfile(inlineEditingProfile.name, newName);
    }
    setInlineEditingProfile(null);
  };

  // --- HANDLERS MỚI CHO GROUP INLINE EDITING ---
  const handleStartCreateGroup = (profileName: string) => {
    setInlineEditingProfile(null); // Hủy edit profile nếu có
    setInlineEditingGroup({ mode: "create", profileName });
  };
  const handleStartRenameGroup = (
    profileName: string,
    group: { id: string }
  ) => {
    setInlineEditingProfile(null);
    setInlineEditingGroup({ mode: "rename", profileName, groupId: group.id });
  };
  const onCancelGroupEdit = () => {
    setInlineEditingGroup(null);
  };
  const onGroupSubmitInline = async (newName: string) => {
    if (!inlineEditingGroup) return;

    if (!newName.trim()) {
      message("Tên nhóm không được để trống.", { title: "Lỗi", kind: "error" });
      return;
    }

    // Chuyển sang profile cần thiết trước khi thực hiện action
    if (inlineEditingGroup.profileName !== activeProfile) {
      await switchProfile(inlineEditingGroup.profileName);
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

  const handleOpenDeleteDialog = (profile: string) => {
    setDeletingProfile(profile);
    setIsProfileDeleteDialogOpen(true);
  };

  const handleConfirmDeleteProfile = async () => {
    if (deletingProfile) {
      await deleteProfile(deletingProfile);
    }
    setIsProfileDeleteDialogOpen(false);
    setDeletingProfile(null);
  };

  return {
    // Data
    projectStats,
    selectedPath,
    profiles,
    activeProfile,
    // UI State
    isProfileDeleteDialogOpen,
    deletingProfile,
    inlineEditingProfile,
    inlineEditingGroup, // State mới
    // Profile Handlers
    switchProfile,
    handleOpenDeleteDialog,
    handleConfirmDeleteProfile,
    handleStartCreateProfile,
    handleStartRenameProfile,
    onCancelProfileEdit,
    onProfileSubmitInline,
    // Group Handlers (mới)
    handleStartCreateGroup,
    handleStartRenameGroup,
    onCancelGroupEdit,
    onGroupSubmitInline,
    setIsProfileDeleteDialogOpen,
  };
}
