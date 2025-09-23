// src/hooks/useDashboard.ts
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAppStore, useAppActions } from "@/store/appStore";
import { type Group } from "@/store/types";
import { useShallow } from "zustand/react/shallow";

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

const profileSchema = z.object({
  name: z
    .string()
    .min(1, "Tên hồ sơ không được để trống")
    .regex(/^[a-zA-Z0-9_-]+$/, "Chỉ cho phép chữ, số, gạch dưới và gạch nối"),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

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

  // State cục bộ
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  // --- THAY ĐỔI: Thêm state để theo dõi hồ sơ đang được sửa/xóa ---
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [profileDialogMode, setProfileDialogMode] = useState<
    "create" | "rename" | null
  >(null);
  const [isProfileDeleteDialogOpen, setIsProfileDeleteDialogOpen] =
    useState(false);

  // Forms
  const groupForm = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: { name: "", description: "", tokenLimit: undefined },
  });

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "" },
  });

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

  // --- THAY ĐỔI: Cập nhật handlers cho Profile ---
  const handleOpenProfileDialog = (
    mode: "create" | "rename",
    profile?: string
  ) => {
    setProfileDialogMode(mode);
    setEditingProfile(profile || null); // Lưu hồ sơ mục tiêu
    if (mode === "rename" && profile) {
      profileForm.setValue("name", profile);
    } else {
      profileForm.reset({ name: "" });
    }
  };

  const onProfileSubmit = async (data: ProfileFormValues) => {
    if (profileDialogMode === "create") {
      await createProfile(data.name);
    } else if (profileDialogMode === "rename" && editingProfile) {
      // Sử dụng `editingProfile` làm tên cũ
      await renameProfile(editingProfile, data.name);
    }
    setProfileDialogMode(null);
    setEditingProfile(null);
  };

  const handleOpenDeleteDialog = (profile: string) => {
    setEditingProfile(profile); // Lưu hồ sơ mục tiêu
    setIsProfileDeleteDialogOpen(true);
  };

  const handleConfirmDeleteProfile = async () => {
    if (editingProfile) {
      // Sử dụng `editingProfile` để xóa
      await deleteProfile(editingProfile);
    }
    setIsProfileDeleteDialogOpen(false);
    setEditingProfile(null);
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
    profileDialogMode,
    isProfileDeleteDialogOpen,
    editingProfile, // Trả về state mới
    // Forms
    groupForm,
    profileForm,
    // Handlers
    setIsGroupDialogOpen,
    handleOpenGroupDialog,
    onGroupSubmit,
    // Profile handlers đã được cập nhật
    switchProfile,
    handleOpenProfileDialog,
    setProfileDialogMode,
    onProfileSubmit,
    setIsProfileDeleteDialogOpen,
    handleOpenDeleteDialog, // Trả về handler mới
    handleConfirmDeleteProfile,
  };
}
