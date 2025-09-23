// src/components/GroupManager.tsx
import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAppStore, useAppActions } from "@/store/appStore";
import { type Group } from "@/store/types";
import { invoke } from "@tauri-apps/api/core";
import { save, message } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { cn } from "@/lib/utils";
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
  const { groups, activeProfile, rootPath } = useAppStore(
    useShallow((state) => ({
      groups: state.allGroups.get(profileName) || [],
      activeProfile: state.activeProfile,
      rootPath: state.rootPath,
    }))
  );

  const { deleteGroup, editGroupContent, setGroupCrossSync, switchProfile } =
    useAppActions();

  const [exportingGroupId, setExportingGroupId] = useState<string | null>(null);
  const [copyingGroupId, setCopyingGroupId] = useState<string | null>(null);
  // --- XÓA CÁC STATE LIÊN QUAN ĐẾN DIALOG ---
  // const [exportOptionsOpen, setExportOptionsOpen] = useState(false);
  // const [groupToExport, setGroupToExport] = useState<Group | null>(null);
  // const [useFullTree, setUseFullTree] = useState(false);
  // const [isConfirmingExport, setIsConfirmingExport] = useState(false);
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
        setExportingGroupId(null);
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
          setExportingGroupId(null);
        }
      };
      showSaveDialog();
    }
  }, [pendingExportData]);

  // --- HÀM XUẤT FILE ĐƯỢC ĐƠN GIẢN HÓA ---
  const handleExport = (group: Group) => {
    performActionAfterSwitch(() => {
      setExportingGroupId(group.id);
      invoke("start_group_export", {
        groupId: group.id,
        rootPathStr: rootPath,
        profileName: profileName,
        // Không cần truyền useFullTree nữa
      }).catch((err) => {
        message(`Không thể bắt đầu xuất file: ${err}`, {
          title: "Lỗi",
          kind: "error",
        });
        setExportingGroupId(null);
      });
    });
  };

  // --- LOGIC MỚI: Hàm trợ giúp để thực hiện hành động sau khi chuyển hồ sơ nếu cần ---
  const performActionAfterSwitch = useCallback(
    async (action: () => void) => {
      if (profileName !== activeProfile) {
        await switchProfile(profileName);
      }
      action();
    },
    [profileName, activeProfile, switchProfile]
  );

  // --- Cập nhật các handler để sử dụng logic mới ---
  const handleEditContentClick = (group: Group) => {
    performActionAfterSwitch(() => editGroupContent(group.id));
  };

  const handleEditGroupDetails = (group: Group) => {
    performActionAfterSwitch(() => onEditGroup(group));
  };

  const handleCopyContext = (group: Group) => {
    performActionAfterSwitch(async () => {
      if (!rootPath) return;
      setCopyingGroupId(group.id);
      try {
        const context = await invoke<string>("generate_group_context", {
          groupId: group.id,
          rootPathStr: rootPath,
          profileName: profileName,
          useFullTree: true,
        });
        await writeText(context);
        message(`Đã sao chép ngữ cảnh nhóm "${group.name}"`, {
          title: "Thành công",
          kind: "info",
        });
      } catch (error) {
        message(`Không thể sao chép: ${error}`, {
          title: "Lỗi",
          kind: "error",
        });
      } finally {
        setCopyingGroupId(null);
      }
    });
  };

  const handleDeleteGroup = (group: Group) => {
    performActionAfterSwitch(() => deleteGroup(group.id));
  };

  const handleToggleCrossSync = (group: Group, enabled: boolean) => {
    performActionAfterSwitch(() => setGroupCrossSync(group.id, enabled));
  };

  return (
    <>
      {groups.length === 0 ? (
        <div className="text-left py-2 px-2">
          <p className="text-sm text-muted-foreground/80">Không có nhóm nào.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {groups.map((group) => {
            const isLoading =
              exportingGroupId === group.id || copyingGroupId === group.id;
            return (
              <div
                key={group.id}
                className="group flex items-center justify-between p-2 rounded-md hover:bg-accent/50"
              >
                <div
                  className="flex-1 flex items-center gap-2 cursor-pointer"
                  onClick={() => handleEditContentClick(group)}
                >
                  <ListChecks className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-normal text-sm truncate">{group.name}</p>
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
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
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
                    <DropdownMenuItem
                      onClick={() => handleEditGroupDetails(group)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      <span>Chỉnh sửa Chi tiết</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleCopyContext(group)}>
                      <ClipboardCopy className="mr-2 h-4 w-4" />
                      <span>Sao chép Ngữ cảnh</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport(group)}>
                      <Download className="mr-2 h-4 w-4" />
                      <span>Xuất Ngữ cảnh</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={group.crossSyncEnabled ?? false}
                      onCheckedChange={(enabled) =>
                        handleToggleCrossSync(group, enabled)
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
                            " sẽ bị xóa vĩnh viễn khỏi hồ sơ "{profileName}".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Hủy</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteGroup(group)}
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

      {/* --- XÓA HOÀN TOÀN ALERTDIALOG CHO TÙY CHỌN XUẤT FILE --- */}
    </>
  );
}
