// src/components/GroupManager.tsx
import { useState, useEffect, useRef } from "react"; // Thêm useEffect và useRef
import { listen } from "@tauri-apps/api/event"; // Thêm listen
import { useAppStore, useAppActions } from "@/store/appStore";
import { type Group } from "@/store/types";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { formatBytes } from "@/lib/utils"; // <-- Import hàm tiện ích
import { Label } from "@/components/ui/label"; // <-- THÊM IMPORT
import { Switch } from "@/components/ui/switch"; // <-- THÊM IMPORT
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

  // --- STATE MỚI CHO DIALOG XUẤT FILE ---
  const [exportOptionsOpen, setExportOptionsOpen] = useState(false);
  const [groupToExport, setGroupToExport] = useState<Group | null>(null);
  const [useFullTree, setUseFullTree] = useState(false);

  // Ref để lưu trữ giá trị mới nhất của exportingGroupId, có thể truy cập từ listener
  const exportingGroupIdRef = useRef<string | null>(null);

  // Đồng bộ ref với state mỗi khi state thay đổi
  useEffect(() => {
    exportingGroupIdRef.current = exportingGroupId;
  }, [exportingGroupId]);

  // --- LOGIC MỚI: Lắng nghe sự kiện để xử lý hộp thoại save ---
  useEffect(() => {
    const unlisten = listen<{ groupId: string; context: string }>(
      "group_export_complete",
      async (event) => {
        // LUÔN SỬ DỤNG GIÁ TRỊ TỪ REF BÊN TRONG LISTENER
        if (event.payload.groupId === exportingGroupIdRef.current) {
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
            // Cập nhật cả state và ref
            setExportingGroupId(null);
          }
        }
      }
    );

    const unlistenError = listen<string>("group_export_error", (event) => {
      console.error("Lỗi khi xuất nhóm từ backend:", event.payload);
      alert(`Đã xảy ra lỗi khi xuất file: ${event.payload}`);
      setExportingGroupId(null);
    });

    return () => {
      unlisten.then((f) => f());
      unlistenError.then((f) => f());
    };
    // Mảng dependency của useEffect này giờ có thể để trống,
    // vì listener không còn phụ thuộc vào giá trị `exportingGroupId` "cũ" nữa.
    // Nó sẽ chỉ được thiết lập một lần khi component mount.
  }, [groups]); // Thêm `groups` để listener có thể truy cập danh sách group mới nhất

  // Hàm này giờ chỉ mở dialog
  const handleOpenExportOptions = (group: Group) => {
    setGroupToExport(group);
    setExportOptionsOpen(true);
    setUseFullTree(false); // Reset về mặc định mỗi khi mở
  };

  // Hàm này thực sự gọi backend
  const handleConfirmExport = () => {
    if (!groupToExport || !rootPath) return;

    setExportingGroupId(groupToExport.id);
    setExportOptionsOpen(false); // Đóng dialog

    try {
      invoke("start_group_export", {
        groupId: groupToExport.id,
        rootPathStr: rootPath,
        useFullTree: useFullTree, // <-- TRUYỀN THAM SỐ MỚI
      });
    } catch (error) {
      console.error("Lỗi khi gọi command start_group_export:", error);
      alert("Không thể bắt đầu quá trình xuất file.");
      setExportingGroupId(null);
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
                  onClick={() => handleOpenExportOptions(group)} // <-- THAY ĐỔI Ở ĐÂY
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

      {/* --- DIALOG MỚI CHO TÙY CHỌN XUẤT FILE --- */}
      <AlertDialog open={exportOptionsOpen} onOpenChange={setExportOptionsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Tùy chọn xuất cho nhóm "{groupToExport?.name}"
            </AlertDialogTitle>
            <AlertDialogDescription>
              Chọn cách bạn muốn cấu trúc cây thư mục trong file ngữ cảnh được
              xuất ra.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex items-center space-x-2 my-4">
            <Switch
              id="full-tree-switch"
              checked={useFullTree}
              onCheckedChange={setUseFullTree}
            />
            <Label htmlFor="full-tree-switch" className="cursor-pointer">
              Sử dụng cây thư mục đầy đủ của dự án
            </Label>
          </div>
          <p className="text-sm text-muted-foreground -mt-2">
            {useFullTree
              ? "File xuất sẽ hiển thị toàn bộ cấu trúc dự án. Chỉ nội dung các tệp trong nhóm này được bao gồm."
              : "File xuất sẽ chỉ hiển thị cấu trúc thư mục chứa các tệp đã chọn trong nhóm này."}
          </p>

          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmExport}>
              Xác nhận và Xuất
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
