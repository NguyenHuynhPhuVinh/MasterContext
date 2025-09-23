// src/components/GroupManager.tsx
import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAppStore, useAppActions } from "@/store/appStore";
import { type Group } from "@/store/types";
import { invoke } from "@tauri-apps/api/core";
import { save, message } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
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
import {
  MoreHorizontal,
  Trash2,
  Pencil,
  Download,
  ListChecks,
  Loader2,
  Link,
  ClipboardCopy,
  BrainCircuit,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { useShallow } from "zustand/react/shallow";

interface GroupManagerProps {
  profileName: string;
  onEditGroup: (group: Group) => void;
}

export function GroupManager({ profileName, onEditGroup }: GroupManagerProps) {
  // Lấy nhóm cho hồ sơ cụ thể này từ state `allGroups`
  const { groups, activeProfile, rootPath } = useAppStore(
    useShallow((state) => ({
      groups: state.allGroups.get(profileName) || [],
      activeProfile: state.activeProfile,
      rootPath: state.rootPath,
    }))
  );

  const { deleteGroup, editGroupContent, setGroupCrossSync } = useAppActions();

  const [exportingGroupId, setExportingGroupId] = useState<string | null>(null);
  const [copyingGroupId, setCopyingGroupId] = useState<string | null>(null);
  const [exportOptionsOpen, setExportOptionsOpen] = useState(false);
  const [groupToExport, setGroupToExport] = useState<Group | null>(null);
  const [useFullTree, setUseFullTree] = useState(false);
  const [isConfirmingExport, setIsConfirmingExport] = useState(false);
  const [pendingExportData, setPendingExportData] = useState<{
    context: string;
    group: Group;
  } | null>(null);

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
            await message("Đã lưu file thành công!", {
              title: "Thành công",
              kind: "info",
            });
          }
        } catch (error) {
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
    if (!groupToExport || !rootPath || !activeProfile) return;
    setIsConfirmingExport(true);
    setExportingGroupId(groupToExport.id);
    invoke("start_group_export", {
      groupId: groupToExport.id,
      rootPathStr: rootPath,
      profileName: activeProfile,
      useFullTree: useFullTree,
    });
  };

  const handleCloseDialog = () => {
    if (!isConfirmingExport) setExportOptionsOpen(false);
  };

  const handleCopyContext = async (group: Group) => {
    if (!rootPath || !activeProfile) return;
    setCopyingGroupId(group.id);
    try {
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
        <div className="text-center py-10 border-2 border-dashed rounded-lg">
          <h3 className="text-md font-semibold text-muted-foreground">
            Chưa có nhóm nào
          </h3>
          <p className="text-sm text-muted-foreground/80 mt-1">
            Hãy tạo một nhóm để bắt đầu.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {groups.map((group) => {
            const isLoading =
              exportingGroupId === group.id || copyingGroupId === group.id;
            return (
              <div
                key={group.id}
                className="group flex items-center justify-between p-2 rounded-md hover:bg-accent"
              >
                <div
                  className="flex-1 flex items-center gap-3 cursor-pointer"
                  onClick={() => editGroupContent(group.id)}
                >
                  <ListChecks className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{group.name}</p>
                    <p
                      className={cn(
                        "text-xs text-muted-foreground truncate",
                        group.tokenLimit &&
                          group.stats.token_count > group.tokenLimit &&
                          "text-destructive font-semibold"
                      )}
                    >
                      <BrainCircuit className="inline-block h-3 w-3 mr-1" />
                      {group.stats.token_count.toLocaleString()}
                      {group.tokenLimit
                        ? ` / ${group.tokenLimit.toLocaleString()}`
                        : ""}{" "}
                      tokens
                    </p>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MoreHorizontal className="h-4 w-4" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEditGroup(group)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      <span>Chỉnh sửa Chi tiết</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleCopyContext(group)}>
                      <ClipboardCopy className="mr-2 h-4 w-4" />
                      <span>Sao chép Ngữ cảnh</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleOpenExportOptions(group)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      <span>Xuất Ngữ cảnh...</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={group.crossSyncEnabled ?? false}
                      onCheckedChange={(enabled) =>
                        setGroupCrossSync(group.id, enabled)
                      }
                    >
                      <Link className="mr-2 h-4 w-4" />
                      <span>Đồng bộ chéo</span>
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem
                          onSelect={(e) => e.preventDefault()}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span>Xóa nhóm</span>
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Bạn có chắc chắn muốn xóa?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Hành động này không thể hoàn tác. Nhóm "{group.name}
                            " sẽ bị xóa vĩnh viễn.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Hủy</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteGroup(group.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Xóa
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
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
