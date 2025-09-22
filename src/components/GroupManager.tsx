// src/components/GroupManager.tsx
import { useState, useEffect } from "react"; // Thêm useEffect
import { listen } from "@tauri-apps/api/event"; // Thêm listen
import { useAppStore, useAppActions, type Group } from "@/store/appStore";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { formatBytes } from "@/lib/utils"; // <-- Import hàm tiện ích

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent, // <-- Thêm CardContent
  CardDescription,
  CardFooter, // <-- Thêm CardFooter
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  MoreHorizontal,
  Trash2,
  Pencil,
  Download,
  BrainCircuit,
  ListChecks,
  File, // <-- Thêm icon
  Folder, // <-- Thêm icon
  HardDrive, // <-- Thêm icon
  Loader2, // Thêm Loader2
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

// --- THAY ĐỔI: Component giờ nhận props để mở dialog từ bên ngoài ---
interface GroupManagerProps {
  onEditGroup: (group: Group) => void;
}

export function GroupManager({ onEditGroup }: GroupManagerProps) {
  const groups = useAppStore((state) => state.groups);
  const rootPath = useAppStore((state) => state.rootPath);
  const { deleteGroup, editGroupContent } = useAppActions();

  // State loading cục bộ
  const [exportingGroupId, setExportingGroupId] = useState<string | null>(null);

  // --- LOGIC MỚI: Lắng nghe sự kiện để xử lý hộp thoại save ---
  useEffect(() => {
    const unlisten = listen<{ groupId: string; context: string }>(
      "group_export_complete",
      async (event) => {
        // Chỉ xử lý nếu đúng là group đang chờ export
        if (event.payload.groupId === exportingGroupId) {
          const group = groups.find((g) => g.id === event.payload.groupId);
          const defaultName = group
            ? `${group.name.replace(/\s+/g, "_")}_context.txt`
            : "context.txt";

          try {
            // Hiển thị hộp thoại lưu file
            const filePath = await save({
              title: `Lưu Ngữ cảnh cho nhóm "${group?.name}"`,
              defaultPath: defaultName,
              filters: [{ name: "Text File", extensions: ["txt"] }],
            });
            // Nếu người dùng chọn một file (không bấm Hủy)
            if (filePath) {
              await writeTextFile(filePath, event.payload.context);
              alert(`Đã lưu file thành công!`);
            }
          } catch (error) {
            console.error("Lỗi khi lưu file ngữ cảnh:", error);
            alert("Đã xảy ra lỗi khi lưu file.");
          } finally {
            // TẮT LOADING sau khi hộp thoại đã được xử lý
            setExportingGroupId(null);
          }
        }
      }
    );

    const unlistenError = listen<string>("group_export_error", (event) => {
      console.error("Lỗi khi xuất nhóm từ backend:", event.payload);
      alert(`Đã xảy ra lỗi khi xuất file: ${event.payload}`);
      setExportingGroupId(null); // Tắt loading nếu có lỗi
    });

    return () => {
      unlisten.then((f) => f());
      unlistenError.then((f) => f());
    };
  }, [exportingGroupId, groups]); // Chạy lại effect khi exportingGroupId thay đổi

  const handleExportGroup = async (group: Group) => {
    if (!rootPath) {
      alert("Lỗi: Không tìm thấy đường dẫn gốc của dự án.");
      return;
    }
    // Không cần kiểm tra group.paths.length nữa vì backend sẽ xử lý

    setExportingGroupId(group.id); // Bật loading
    try {
      // Gọi command mới: chỉ cần groupId và rootPathStr
      // Không cần gửi 'paths' nữa, giúp giảm lượng dữ liệu truyền đi
      await invoke("start_group_export", {
        groupId: group.id,
        rootPathStr: rootPath,
      });
      // Logic còn lại sẽ được xử lý bởi listener trong useEffect
    } catch (error) {
      console.error("Lỗi khi gọi command start_group_export:", error);
      alert("Không thể bắt đầu quá trình xuất file.");
      setExportingGroupId(null); // Tắt loading nếu gọi command thất bại
    }
  };

  return (
    <>
      {groups.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-lg mt-6">
          <h3 className="text-xl font-semibold">Chưa có nhóm nào</h3>
          <p className="text-muted-foreground mt-2">
            Hãy bắt đầu bằng cách tạo một nhóm mới.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
          {groups.map((group) => (
            <Card key={group.id} className="flex flex-col">
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
                      {/* --- THAY ĐỔI: Gọi hàm prop onEditGroup --- */}
                      <DropdownMenuItem onClick={() => onEditGroup(group)}>
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
              <CardContent className="flex-grow">
                {/* --- PHẦN UI MỚI CHO STATS --- */}
                <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <File className="h-4 w-4" />
                    <span>
                      {group.stats.total_files.toLocaleString()} tệp tin
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4" />
                    <span>
                      {group.stats.total_dirs.toLocaleString()} thư mục
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4" />
                    <span>
                      Tổng dung lượng: {formatBytes(group.stats.total_size)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4" />
                    <span>
                      Ước tính: {group.stats.token_count.toLocaleString()}{" "}
                      tokens
                    </span>
                  </div>
                </div>
                {/* --- KẾT THÚC PHẦN UI MỚI --- */}
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportGroup(group)}
                  disabled={!!exportingGroupId} // Vô hiệu hóa tất cả nút khi đang export
                >
                  {exportingGroupId === group.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  {exportingGroupId === group.id ? "Đang xuất..." : "Xuất"}
                </Button>
                <Button size="sm" onClick={() => editGroupContent(group.id)}>
                  <ListChecks className="mr-2 h-4 w-4" /> Quản lý nội dung
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
