// src/components/GroupManager.tsx
import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAppStore, useAppActions } from "@/store/appStore"; // <-- Sửa: Lấy trực tiếp useAppStore
import { type Group } from "@/store/types";
import { invoke } from "@tauri-apps/api/core";
import { save, message } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { formatBytes, cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
  File,
  Folder,
  HardDrive,
  Loader2,
  Link,
  ClipboardCopy,
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

interface GroupManagerProps {
  onEditGroup: (group: Group) => void;
}

export function GroupManager({ onEditGroup }: GroupManagerProps) {
  const groups = useAppStore((state) => state.groups);
  const rootPath = useAppStore((state) => state.rootPath);
  const activeProfile = useAppStore((state) => state.activeProfile); // <-- THÊM MỚI: Lấy hồ sơ đang hoạt động
  const { deleteGroup, editGroupContent, setGroupCrossSync } = useAppActions();

  // State quản lý nhóm nào đang trong quá trình xuất
  const [exportingGroupId, setExportingGroupId] = useState<string | null>(null);
  const [copyingGroupId, setCopyingGroupId] = useState<string | null>(null);

  // State quản lý dialog tùy chọn
  const [exportOptionsOpen, setExportOptionsOpen] = useState(false);
  const [groupToExport, setGroupToExport] = useState<Group | null>(null);
  const [useFullTree, setUseFullTree] = useState(false);

  // State loading BÊN TRONG dialog
  const [isConfirmingExport, setIsConfirmingExport] = useState(false);

  // State MỚI để lưu trữ context tạm thời từ backend
  const [pendingExportData, setPendingExportData] = useState<{
    context: string;
    group: Group;
  } | null>(null);

  // --- useEffect 1: Lắng nghe sự kiện từ Rust ---
  useEffect(() => {
    const unlistenComplete = listen<{ groupId: string; context: string }>(
      "group_export_complete",
      (event) => {
        const targetGroup = groups.find((g) => g.id === event.payload.groupId);
        if (targetGroup) {
          setPendingExportData({
            context: event.payload.context,
            group: targetGroup,
          });
        }
      }
    );

    const unlistenError = listen<string>(
      "group_export_error",
      async (event) => {
        console.error("Lỗi khi xuất nhóm từ backend:", event.payload);
        await message(`Đã xảy ra lỗi khi xuất file: ${event.payload}`, {
          title: "Lỗi",
          kind: "error",
        });
        setIsConfirmingExport(false);
        setExportingGroupId(null);
        setExportOptionsOpen(false);
      }
    );

    return () => {
      unlistenComplete.then((f) => f());
      unlistenError.then((f) => f());
    };
  }, [groups]);

  // --- useEffect 2: Xử lý việc mở dialog lưu file ---
  useEffect(() => {
    if (pendingExportData) {
      const showSaveDialog = async () => {
        try {
          const defaultName = `${pendingExportData.group.name.replace(
            /\s+/g,
            "_"
          )}_context.txt`;
          const filePath = await save({
            title: `Lưu Ngữ cảnh cho nhóm "${pendingExportData.group.name}"`,
            defaultPath: defaultName,
            filters: [{ name: "Text File", extensions: ["txt"] }],
          });

          if (filePath) {
            await writeTextFile(filePath, pendingExportData.context);
            await message(`Đã lưu file thành công!`, {
              title: "Thành công",
              kind: "info",
            });
          }
        } catch (error) {
          console.error("Lỗi khi lưu file ngữ cảnh:", error);
          await message("Đã xảy ra lỗi khi lưu file.", {
            title: "Lỗi",
            kind: "error",
          });
        } finally {
          setPendingExportData(null);
          setIsConfirmingExport(false);
          setExportingGroupId(null);
          setExportOptionsOpen(false);
        }
      };

      showSaveDialog();
    }
  }, [pendingExportData]);

  const handleOpenExportOptions = (group: Group) => {
    setGroupToExport(group);
    setExportOptionsOpen(true);
    setUseFullTree(false);
  };

  const handleConfirmExport = async () => {
    // <-- CẬP NHẬT: Thêm kiểm tra activeProfile
    if (!groupToExport || !rootPath || !activeProfile) return;

    setIsConfirmingExport(true);
    setExportingGroupId(groupToExport.id);

    try {
      // <-- CẬP NHẬT: Thêm `profileName` vào payload
      invoke("start_group_export", {
        groupId: groupToExport.id,
        rootPathStr: rootPath,
        profileName: activeProfile,
        useFullTree: useFullTree,
      });
    } catch (error) {
      console.error("Lỗi khi gọi command start_group_export:", error);
      await message("Không thể bắt đầu quá trình xuất file.", {
        title: "Lỗi",
        kind: "error",
      });
      setIsConfirmingExport(false);
      setExportingGroupId(null);
    }
  };

  const handleCloseDialog = () => {
    if (!isConfirmingExport) {
      setExportOptionsOpen(false);
    }
  };

  const handleCopyContext = async (group: Group) => {
    // <-- CẬP NHẬT: Thêm kiểm tra activeProfile
    if (!rootPath || !activeProfile) return;
    setCopyingGroupId(group.id);
    try {
      // <-- CẬP NHẬT: Thêm `profileName` vào payload
      const context = await invoke<string>("generate_group_context", {
        groupId: group.id,
        rootPathStr: rootPath,
        profileName: activeProfile,
        useFullTree: true,
      });
      await writeText(context);
      await message(`Đã sao chép ngữ cảnh nhóm "${group.name}"`, {
        title: "Thành công",
        kind: "info",
      });
    } catch (error) {
      console.error(`Lỗi khi sao chép ngữ cảnh nhóm ${group.name}:`, error);
      await message(`Không thể sao chép: ${error}`, {
        title: "Lỗi",
        kind: "error",
      });
    } finally {
      setCopyingGroupId(null);
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
                    <span
                      className={cn(
                        group.tokenLimit &&
                          group.stats.token_count > group.tokenLimit &&
                          "text-destructive font-bold"
                      )}
                    >
                      {group.stats.token_count.toLocaleString()}
                      {group.tokenLimit && group.tokenLimit > 0
                        ? ` / ${group.tokenLimit.toLocaleString()}`
                        : ""}
                      {" tokens"}
                    </span>
                  </div>
                </div>

                <div className="border-t mt-4 pt-4">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor={`cross-sync-${group.id}`}
                      className="flex flex-col cursor-pointer"
                    >
                      <span>
                        <Link className="inline-block h-4 w-4 mr-2" />
                        Đồng bộ chéo
                      </span>
                      <span className="text-xs text-muted-foreground font-normal">
                        Tự động thêm file liên quan khi quét lại.
                      </span>
                    </Label>
                    <Switch
                      id={`cross-sync-${group.id}`}
                      checked={group.crossSyncEnabled ?? false}
                      onCheckedChange={(enabled) =>
                        setGroupCrossSync(group.id, enabled)
                      }
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <Button
                  size="sm"
                  onClick={() => editGroupContent(group.id)}
                  className="w-full"
                >
                  <ListChecks className="mr-2 h-4 w-4" /> Quản lý nội dung
                </Button>
                <div className="flex gap-2 w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyContext(group)}
                    disabled={!!exportingGroupId || !!copyingGroupId}
                    className="flex-1"
                  >
                    {copyingGroupId === group.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ClipboardCopy className="mr-2 h-4 w-4" />
                    )}
                    Sao chép
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenExportOptions(group)}
                    disabled={!!exportingGroupId || !!copyingGroupId}
                    className="flex-1"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Xuất
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* --- DIALOG MỚI CHO TÙY CHỌN XUẤT FILE --- */}
      <AlertDialog open={exportOptionsOpen} onOpenChange={handleCloseDialog}>
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
              disabled={isConfirmingExport}
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
            <AlertDialogCancel disabled={isConfirmingExport}>
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmExport}
              disabled={isConfirmingExport}
            >
              {isConfirmingExport ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isConfirmingExport ? "Đang xử lý..." : "Xác nhận và Xuất"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
