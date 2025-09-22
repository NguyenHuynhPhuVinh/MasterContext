// src/hooks/useDashboard.ts
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { writeText } from "@tauri-apps/plugin-clipboard-manager"; // <-- THÊM IMPORT
import { toast } from "sonner"; // <-- THÊM IMPORT
import { useAppStore, useAppActions } from "@/store/appStore";
import { type Group } from "@/store/types";
import { useShallow } from "zustand/react/shallow"; // <-- BƯỚC 1: IMPORT useShallow

// Schema validation cho form
const groupSchema = z.object({
  name: z.string().min(1, "Tên nhóm không được để trống"),
  description: z.string().optional(),
});
type GroupFormValues = z.infer<typeof groupSchema>;

export function useDashboard() {
  // --- LẤY STATE VÀ ACTIONS TỪ STORE ---
  // BƯỚC 2: SỬ DỤNG useShallow
  const { rootPath, projectStats, selectedPath } = useAppStore(
    useShallow((state) => ({
      rootPath: state.rootPath,
      projectStats: state.projectStats,
      selectedPath: state.selectedPath,
    }))
  );
  const { addGroup, updateGroup, selectRootPath, rescanProject } =
    useAppActions();

  // --- STATE CỤC BỘ CỦA SCENE ---
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isCopying, setIsCopying] = useState(false); // <-- STATE MỚI

  // --- QUẢN LÝ FORM ---
  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: { name: "", description: "" },
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
            toast.success(`Đã lưu file thành công!`); // <-- THAY alert BẰNG TOAST
          }
        } catch (error) {
          console.error("Lỗi khi lưu file ngữ cảnh dự án:", error);
          toast.error("Đã xảy ra lỗi khi lưu file."); // <-- THAY alert BẰNG TOAST
        } finally {
          setIsExporting(false);
        }
      }
    );

    const unlistenError = listen<string>("project_export_error", (event) => {
      console.error("Lỗi khi xuất dự án:", event.payload);
      toast.error(`Đã xảy ra lỗi khi xuất file: ${event.payload}`); // <-- THAY alert BẰNG TOAST
      setIsExporting(false);
    });

    return () => {
      unlistenComplete.then((f) => f());
      unlistenError.then((f) => f());
    };
  }, []); // Chỉ chạy một lần

  // --- CÁC HÀM XỬ LÝ SỰ KIỆN (HANDLERS) ---
  const handleOpenDialog = (group: Group | null = null) => {
    setEditingGroup(group);
    form.reset(
      group
        ? { name: group.name, description: group.description || "" }
        : { name: "", description: "" }
    );
    setIsDialogOpen(true);
  };

  const onSubmit = (data: GroupFormValues) => {
    if (editingGroup) {
      updateGroup({ ...editingGroup, ...data });
    } else {
      addGroup({ name: data.name, description: data.description || "" });
    }
    // <-- THÊM TOAST PHẢN HỒI NGAY LẬP TỨC -->
    toast.success(
      editingGroup ? "Cập nhật nhóm thành công!" : "Tạo nhóm mới thành công!"
    );
    setIsDialogOpen(false);
  };

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
    // Không cần async nữa
    if (!rootPath) return;
    setIsExporting(true);
    // Chỉ "bắn" lệnh đi và không chờ đợi
    invoke("start_project_export", { path: rootPath });
    // Logic sẽ được tiếp tục trong listener sự kiện `project_export_complete`
  };

  // --- HÀM MỚI ---
  const handleCopyProject = async () => {
    if (!rootPath) return;
    setIsCopying(true);
    try {
      const context = await invoke<string>("generate_project_context", {
        path: rootPath,
      });
      await writeText(context);
      toast.success("Đã sao chép ngữ cảnh dự án vào clipboard!"); // <-- THÊM TOAST
    } catch (error) {
      console.error("Lỗi khi sao chép ngữ cảnh dự án:", error);
      toast.error(`Không thể sao chép: ${error}`); // <-- THAY alert BẰNG TOAST
    } finally {
      setIsCopying(false);
    }
  };

  const handleConfirmRescan = async () => {
    await rescanProject();
  };

  // --- TRẢ VỀ "API" CHO COMPONENT UI ---
  return {
    // Data
    selectedPath,
    projectStats,
    // Trạng thái UI
    isDialogOpen,
    isExporting,
    isCopying, // <-- Trả về state mới
    // --- XÓA `wasCopied` ---
    editingGroup,
    // Form
    form,
    // Handlers
    setIsDialogOpen,
    handleOpenDialog,
    onSubmit,
    handleOpenAnotherFolder,
    handleExportProject,
    handleCopyProject, // <-- Trả về handler mới
    handleConfirmRescan,
  };
}
