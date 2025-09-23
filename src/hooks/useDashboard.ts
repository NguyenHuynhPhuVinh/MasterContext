// src/hooks/useDashboard.ts
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAppStore, useAppActions } from "@/store/appStore";
import { type Group } from "@/store/types";
import { useShallow } from "zustand/react/shallow";
import { message } from "@tauri-apps/plugin-dialog";

const groupSchema = z.object({
  name: z.string().min(1, "Tên nhóm không được để trống"),
  description: z.string().optional(),
  tokenLimit: z
    .union([z.string(), z.number()])
    .optional()
    .refine((val) => {
      if (val === undefined || val === "") return true;
      const num = typeof val === "string" ? Number(val) : val;
      return num > 0;
    }, "Giới hạn token phải là số dương"),
});
type GroupFormValues = z.infer<typeof groupSchema>;

// --- BỎ PROFILE SCHEMA VÌ SẼ VALIDATE THỦ CÔNG ---

export function useDashboard() {
  const { projectStats, selectedPath, profiles, activeProfile } = useAppStore(
    useShallow((state) => ({
      projectStats: state.projectStats,
      selectedPath: state.selectedPath,
      profiles: state.profiles,
      activeProfile: state.activeProfile,
    }))
  );
  const {
    addGroup,
    updateGroup,
    switchProfile,
    createProfile,
    renameProfile,
    deleteProfile,
  } = useAppActions();

  // State cục bộ cho Group Dialog
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  // --- THAY ĐỔI: STATE MỚI CHO INLINE EDITING ---
  const [inlineEditingProfile, setInlineEditingProfile] = useState<{
    mode: "create" | "rename";
    name?: string; // Tên cũ khi rename
  } | null>(null);

  const [isProfileDeleteDialogOpen, setIsProfileDeleteDialogOpen] =
    useState(false);
  const [deletingProfile, setDeletingProfile] = useState<string | null>(null);

  // Form cho Group Dialog
  const groupForm = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: { name: "", description: "", tokenLimit: undefined },
  });

  // --- BỎ PROFILE FORM ---

  // Handlers cho Group
  const handleOpenGroupDialog = (group: Group | null = null) => {
    setEditingGroup(group);
    groupForm.reset(
      group
        ? {
            name: group.name,
            description: group.description || "",
            tokenLimit: group.tokenLimit,
          }
        : { name: "", description: "", tokenLimit: undefined }
    );
    setIsGroupDialogOpen(true);
  };

  const onGroupSubmit = async (data: GroupFormValues) => {
    const groupData = {
      name: data.name,
      description: data.description || "",
      tokenLimit:
        data.tokenLimit === "" || data.tokenLimit === undefined
          ? undefined
          : typeof data.tokenLimit === "string"
          ? Number(data.tokenLimit)
          : data.tokenLimit,
    };
    if (editingGroup) {
      updateGroup({ ...editingGroup, ...groupData });
    } else {
      addGroup(groupData);
    }
    setIsGroupDialogOpen(false);
  };

  // --- CÁC HANDLER MỚI CHO PROFILE INLINE EDITING ---

  const handleStartCreateProfile = () => {
    setInlineEditingProfile({ mode: "create" });
  };

  const handleStartRenameProfile = (profile: string) => {
    setInlineEditingProfile({ mode: "rename", name: profile });
  };

  const onCancelProfileEdit = () => {
    setInlineEditingProfile(null);
  };

  const onProfileSubmitInline = async (newName: string) => {
    if (!inlineEditingProfile) return;

    // Validation
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
    selectedPath,
    projectStats,
    profiles,
    activeProfile,
    // Trạng thái UI
    isGroupDialogOpen,
    editingGroup,
    isProfileDeleteDialogOpen,
    deletingProfile,
    inlineEditingProfile, // State mới
    // Form
    groupForm,
    // Handlers
    setIsGroupDialogOpen,
    handleOpenGroupDialog,
    onGroupSubmit,
    switchProfile,
    setIsProfileDeleteDialogOpen,
    handleOpenDeleteDialog,
    handleConfirmDeleteProfile,
    // Handlers inline mới
    handleStartCreateProfile,
    handleStartRenameProfile,
    onCancelProfileEdit,
    onProfileSubmitInline,
  };
}
