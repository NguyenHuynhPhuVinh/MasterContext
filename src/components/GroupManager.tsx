// src/components/GroupManager.tsx
import { useAppStore, useAppActions, type Group } from "@/store/appStore";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

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

  const handleExportGroup = async (group: Group) => {
    if (!rootPath || group.paths.length === 0) {
      alert("Nhóm này chưa có tệp/thư mục nào được chọn.");
      return;
    }
    try {
      const result = await invoke<{ context: string }>(
        "generate_context_for_paths",
        {
          rootPathStr: rootPath,
          paths: group.paths,
        }
      );
      const filePath = await save({
        title: `Lưu Ngữ cảnh cho nhóm "${group.name}"`,
        defaultPath: `${group.name.replace(/\s+/g, "_")}_context.txt`,
        filters: [{ name: "Text File", extensions: ["txt"] }],
      });
      if (filePath) {
        await writeTextFile(filePath, result.context);
        alert(`Đã lưu file thành công!`);
      }
    } catch (error) {
      console.error("Lỗi khi xuất ngữ cảnh nhóm:", error);
      alert("Đã xảy ra lỗi khi xuất file.");
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
                <div className="flex items-center text-sm text-muted-foreground">
                  <BrainCircuit className="h-4 w-4 mr-2" />
                  <span>
                    Ước tính: {group.tokenCount.toLocaleString()} tokens
                  </span>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportGroup(group)}
                >
                  <Download className="mr-2 h-4 w-4" /> Xuất
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
