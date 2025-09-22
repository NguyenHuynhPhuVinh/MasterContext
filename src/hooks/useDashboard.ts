// src/hooks/useDashboard.ts
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { toast } from "sonner";
import { useAppStore, useAppActions } from "@/store/appStore";
import { type Group } from "@/store/types";
import { useShallow } from "zustand/react/shallow";

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
  const { rootPath, projectStats, selectedPath, profiles, activeProfile } =
    useAppStore(
      useShallow((state) => ({
        rootPath: state.rootPath,
        projectStats: state.projectStats,
        selectedPath: state.selectedPath,
        profiles: state.profiles,
        activeProfile: state.activeProfile,
      }))
    );
  const {
    addGroup,
    updateGroup,
    selectRootPath,
    rescanProject,
    switchProfile, // <-- Action mới
    createProfile, // <-- Action mới
    renameProfile, // <-- Action mới
    deleteProfile, // <-- Action mới
  } = useAppActions();

  // --- STATE CỤC BỘ CỦA SCENE ---
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

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

  // --- LOGIC LẮNG NGHE SỰ KIỆN TỪ BACKEND ---
  useEffect(() => {
    const unlistenComplete = listen<string>(
      "project_export_complete",
      async (event) => {
        try {
          const filePath = await save({
            title: "Lưu Ngữ cảnh Dự án",
            defaultPath: "project_context.txt",
            filters: [{ name: "Text File", extensions: ["txt"] }],
          });
          if (filePath) {
            await writeTextFile(filePath, event.payload);
            toast.success(`Đã lưu file thành công!`);
          }
        } catch (error) {
          console.error("Lỗi khi lưu file ngữ cảnh dự án:", error);
          toast.error("Đã xảy ra lỗi khi lưu file.");
        } finally {
          setIsExporting(false);
        }
      }
    );

    const unlistenError = listen<string>("project_export_error", (event) => {
      console.error("Lỗi khi xuất dự án:", event.payload);
      toast.error(`Đã xảy ra lỗi khi xuất file: ${event.payload}`);
      setIsExporting(false);
    });

    return () => {
      unlistenComplete.then((f) => f());
      unlistenError.then((f) => f());
    };
  }, []);

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
  const handleOpenAnotherFolder = async () => {
    try {
      const result = await open({
        directory: true,
        multiple: false,
        title: "Chọn một thư mục dự án khác",
      });
      if (typeof result === "string") {
        selectRootPath(result);
      }
    } catch (error) {
      console.error("Lỗi khi chọn thư mục khác:", error);
    }
  };

  const handleExportProject = () => {
    if (!rootPath || !activeProfile) return;
    setIsExporting(true);
    invoke("start_project_export", {
      path: rootPath,
      profileName: activeProfile,
    });
  };

  const handleCopyProject = async () => {
    if (!rootPath || !activeProfile) return;
    setIsCopying(true);
    try {
      const context = await invoke<string>("generate_project_context", {
        path: rootPath,
        profileName: activeProfile,
      });
      await writeText(context);
      toast.success("Đã sao chép ngữ cảnh dự án vào clipboard!");
    } catch (error) {
      console.error("Lỗi khi sao chép ngữ cảnh dự án:", error);
      toast.error(`Không thể sao chép: ${error}`);
    } finally {
      setIsCopying(false);
    }
  };

  const handleConfirmRescan = async () => {
    await rescanProject();
  };

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
    isExporting,
    isCopying,
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
    handleOpenAnotherFolder,
    handleExportProject,
    handleCopyProject,
    handleConfirmRescan,
    // Profile handlers
    switchProfile,
    handleOpenProfileDialog,
    setProfileDialogMode,
    onProfileSubmit,
    setIsProfileDeleteDialogOpen,
    handleConfirmDeleteProfile,
  };
}
