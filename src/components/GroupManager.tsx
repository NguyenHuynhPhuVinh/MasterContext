// src/scenes/GroupManager.tsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAppStore, useAppActions, type Group } from "@/store/appStore";
import { invoke } from "@tauri-apps/api/core"; // <-- Import invoke
import { save } from "@tauri-apps/plugin-dialog"; // <-- Import save dialog
import { writeTextFile } from "@tauri-apps/plugin-fs"; // <-- Import hàm ghi file

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  PlusCircle,
  MoreHorizontal,
  Trash2,
  Pencil,
  Download,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Schema validation cho form
const groupSchema = z.object({
  name: z.string().min(1, "Tên nhóm không được để trống"),
  description: z.string().optional(),
});
type GroupFormValues = z.infer<typeof groupSchema>;

export function GroupManager() {
  const rootPath = useAppStore((state) => state.rootPath); // Lấy rootPath từ store
  const groups = useAppStore((state) => state.groups);
  const { addGroup, updateGroup, deleteGroup } = useAppActions();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [isExporting, setIsExporting] = useState(false); // <-- State cho việc xuất file

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: { name: "", description: "" },
  });

  const handleOpenDialog = (group: Group | null = null) => {
    setEditingGroup(group);
    form.reset(
      group
        ? { name: group.name, description: group.description }
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
    setIsDialogOpen(false);
  };

  // --- PHẦN MỚI: Hàm xử lý xuất dự án ---
  const handleExportProject = async () => {
    if (!rootPath) {
      console.log("handleExportProject: Bị dừng vì rootPath không tồn tại.");
      return;
    }
    setIsExporting(true);
    console.log("Bắt đầu quá trình xuất file...");

    try {
      // 1. Gọi command Rust
      console.log("Gọi command 'generate_project_context' với path:", rootPath);
      const context = await invoke<string>("generate_project_context", {
        path: rootPath,
      });
      console.log(`Command trả về context có độ dài: ${context.length} ký tự.`);

      // 2. Mở hộp thoại "Save As..."
      console.log("Mở hộp thoại save dialog...");
      const filePath = await save({
        title: "Lưu Ngữ cảnh Dự án",
        defaultPath: "project_context.txt",
        filters: [{ name: "Text File", extensions: ["txt"] }],
      });

      // 3. Ghi file
      if (filePath) {
        console.log("Người dùng đã chọn đường dẫn:", filePath);
        console.log("Bắt đầu ghi file...");
        await writeTextFile(filePath, context);
        console.log("GHI FILE THÀNH CÔNG đến:", filePath);
        alert(`Đã lưu file thành công tại:\n${filePath}`); // Thêm alert để xác nhận
      } else {
        console.log("Người dùng đã hủy hộp thoại save.");
      }
    } catch (error) {
      // --- CẬP NHẬT: Log lỗi chi tiết hơn ---
      console.error("ĐÃ XẢY RA LỖI TRONG QUÁ TRÌNH XUẤT FILE:", error);
      alert(
        `Đã xảy ra lỗi khi xuất file. Vui lòng kiểm tra console (F12) để biết chi tiết.\n\nLỗi: ${error}`
      );
    } finally {
      setIsExporting(false);
      console.log("Kết thúc quá trình xuất file.");
    }
  };

  return (
    // --- CẬP NHẬT: Gỡ bỏ thẻ div với class "container" ---
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Quản lý Phân nhóm</h1>
          <p className="text-muted-foreground">
            Tạo và quản lý các nhóm ngữ cảnh cho dự án của bạn.
          </p>
        </div>
        {/* --- CẬP NHẬT: Thêm nút Xuất dự án --- */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExportProject}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {isExporting ? "Đang xuất..." : "Xuất dự án"}
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <PlusCircle className="mr-2 h-4 w-4" /> Tạo nhóm mới
          </Button>
        </div>
      </div>

      {/* Phần còn lại của component giữ nguyên y hệt */}
      {groups.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <h3 className="text-xl font-semibold">Chưa có nhóm nào</h3>
          <p className="text-muted-foreground mt-2">
            Hãy bắt đầu bằng cách tạo một nhóm mới.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <Card key={group.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{group.name}</CardTitle>
                    <CardDescription className="pt-2 line-clamp-3">
                      {group.description || "Không có mô tả"}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenDialog(group)}>
                        <Pencil className="mr-2 h-4 w-4" /> Chỉnh sửa
                      </DropdownMenuItem>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem
                            onSelect={(e: Event) => e.preventDefault()}
                            className="text-red-500"
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Xóa
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Bạn có chắc chắn muốn xóa?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Hành động này không thể hoàn tác. Nhóm "
                              {group.name}" sẽ bị xóa vĩnh viễn.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Hủy</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteGroup(group.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Xóa
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog cho việc Thêm/Sửa */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingGroup ? "Chỉnh sửa nhóm" : "Tạo nhóm mới"}
            </DialogTitle>
            <DialogDescription>
              Điền thông tin chi tiết cho nhóm của bạn.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tên nhóm</FormLabel>
                    <FormControl>
                      <Input placeholder="Ví dụ: Backend APIs" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mô tả</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Mô tả ngắn về chức năng của nhóm này..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    Hủy
                  </Button>
                </DialogClose>
                <Button type="submit">Lưu</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
    // --- KẾT THÚC CẬP NHẬT ---
  );
}
