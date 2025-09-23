// src/hooks/useDashboard.ts
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAppStore, useAppActions } from "@/store/appStore";
import { type Group } from "@/store/types";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";

// Schema validation cho form nhóm
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

// --- THÊM SCHEMA CHO FORM HỒ SƠ ---
const profileSchema = z.object({
  name: z
    .string()
    .min(1, "Tên hồ sơ không được để trống")
    .regex(/^[a-zA-Z0-9_-]+$/, "Chỉ cho phép chữ, số, gạch dưới và gạch nối"),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

export function useDashboard() {
  // --- LẤY STATE VÀ ACTIONS TỪ STORE ---
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
    // selectRootPath, // không cần gọi trực tiếp nữa
    // rescanProject, // không cần gọi trực tiếp nữa
    switchProfile, // <-- Action mới
    createProfile, // <-- Action mới
    renameProfile, // <-- Action mới
    deleteProfile, // <-- Action mới
  } = useAppActions();

  // --- STATE CỤC BỘ CỦA SCENE ---
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  // Xóa isExporting, isCopying

  // --- STATE MỚI CHO DIALOG HỒ SƠ ---
  const [profileDialogMode, setProfileDialogMode] = useState<
    "create" | "rename" | null
  >(null);
  const [isProfileDeleteDialogOpen, setIsProfileDeleteDialogOpen] =
    useState(false);

  // --- QUẢN LÝ FORM ---
  const groupForm = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: { name: "", description: "", tokenLimit: undefined },
  });

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "" },
  });

  // Xóa useEffect lắng nghe sự kiện export, vì nó đã được chuyển lên App.tsx

  // --- CÁC HÀM XỬ LÝ SỰ KIỆN (HANDLERS) CHO NHÓM ---
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

  const onGroupSubmit = (data: GroupFormValues) => {
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
    toast.success(
      editingGroup ? "Cập nhật nhóm thành công!" : "Tạo nhóm mới thành công!"
    );
    setIsGroupDialogOpen(false);
  };

  // --- CÁC HÀM XỬ LÝ SỰ KIỆN (HANDLERS) CHO DỰ ÁN ---
  // XÓA: handleOpenAnotherFolder và handleConfirmRescan
  // Các hàm này giờ được xử lý toàn cục qua menu

  // Xóa handleExportProject và handleCopyProject vì đã chuyển vào appStore

  // --- CÁC HÀM MỚI ĐỂ XỬ LÝ HỒ SƠ ---
  const handleOpenProfileDialog = (mode: "create" | "rename") => {
    setProfileDialogMode(mode);
    if (mode === "rename") {
      profileForm.setValue("name", activeProfile);
    } else {
      profileForm.reset({ name: "" });
    }
  };

  const onProfileSubmit = async (data: ProfileFormValues) => {
    if (profileDialogMode === "create") {
      await createProfile(data.name);
    } else if (profileDialogMode === "rename" && activeProfile) {
      await renameProfile(activeProfile, data.name);
    }
    setProfileDialogMode(null);
  };

  const handleConfirmDeleteProfile = async () => {
    if (activeProfile) {
      await deleteProfile(activeProfile);
    }
    setIsProfileDeleteDialogOpen(false);
  };

  // --- TRẢ VỀ "API" CHO COMPONENT UI ---
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
    // Forms
    groupForm,
    profileForm,
    // Handlers
    setIsGroupDialogOpen,
    handleOpenGroupDialog,
    onGroupSubmit,
    // Profile handlers
    switchProfile,
    handleOpenProfileDialog,
    setProfileDialogMode,
    onProfileSubmit,
    setIsProfileDeleteDialogOpen,
    handleConfirmDeleteProfile,
  };
}
