// src/components/GroupManager.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAppStore, useAppActions } from "@/store/appStore";
import { type Group } from "@/store/types";
import { invoke } from "@tauri-apps/api/core";
import { save, message } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Tag,
  Save,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { useShallow } from "zustand/react/shallow";

// --- COMPONENT MỚI: Input inline cho nhóm ---
interface InlineGroupInputProps {
  defaultValue: string;
  onConfirm: (newValue: string) => void;
  onCancel: () => void;
}

function InlineGroupInput({
  defaultValue,
  onConfirm,
  onCancel,
}: InlineGroupInputProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onConfirm(value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = () => onCancel();

  return (
    <div className="flex items-center gap-2 p-2 rounded-md">
      <ListChecks className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="h-7 text-sm"
      />
    </div>
  );
}

// --- COMPONENT MỚI: Input sửa token trong dropdown ---
function TokenLimitEditor({
  group,
  onSave,
}: {
  group: Group;
  onSave: (limit?: number) => void;
}) {
  const [limit, setLimit] = useState(group.tokenLimit?.toString() ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleSave = () => {
    const num = limit.trim() === "" ? undefined : parseInt(limit, 10);
    onSave(isNaN(num as number) ? undefined : num);
  };

  // --- CẢI TIẾN UX: Lưu bằng phím Enter ---
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSave();
      // Đóng dropdown, cần có cơ chế phức tạp hơn, tạm thời chỉ save
      e.preventDefault();
    }
  };

  return (
    <div className="p-2 space-y-2">
      <p className="text-xs font-medium text-muted-foreground px-1">
        Giới hạn Token
      </p>
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          type="number"
          placeholder="Không giới hạn"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8"
        />
        <Button size="icon" className="h-8 w-8" onClick={handleSave}>
          <Save className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface GroupManagerProps {
  profileName: string;
  inlineEditingGroup: {
    mode: "create" | "rename";
    profileName: string;
    groupId?: string;
  } | null;
  onStartRename: (group: Group) => void;
  onConfirmRename: (newName: string) => void;
  onCancelEdit: () => void;
}

export function GroupManager({
  profileName,
  inlineEditingGroup,
  onStartRename,
  onConfirmRename,
  onCancelEdit,
}: GroupManagerProps) {
  const { groups, activeProfile, rootPath } = useAppStore(
    useShallow((state) => ({
      groups: state.allGroups.get(profileName) || [],
      activeProfile: state.activeProfile,
      rootPath: state.rootPath,
    }))
  );
  const {
    deleteGroup,
    editGroupContent,
    setGroupCrossSync,
    switchProfile,
    updateGroup,
  } = useAppActions();

  // ... (state và effects cho việc export/copy giữ nguyên)
  const [exportingGroupId, setExportingGroupId] = useState<string | null>(null);
  const [copyingGroupId, setCopyingGroupId] = useState<string | null>(null);
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

  const performActionAfterSwitch = useCallback(
    async (action: () => void) => {
      if (profileName !== activeProfile) {
        await switchProfile(profileName);
      }
      action();
    },
    [profileName, activeProfile, switchProfile]
  );

  const handleExport = (group: Group) => {
    performActionAfterSwitch(() => {
      setExportingGroupId(group.id);
      invoke("start_group_export", {
        groupId: group.id,
        rootPathStr: rootPath,
        profileName,
      }).catch((err) => {
        message(`Không thể bắt đầu xuất file: ${err}`, {
          title: "Lỗi",
          kind: "error",
        });
        setExportingGroupId(null);
      });
    });
  };
  const handleEditContentClick = (group: Group) => {
    performActionAfterSwitch(() => editGroupContent(group.id));
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
  const handleSaveTokenLimit = (group: Group, limit?: number) => {
    performActionAfterSwitch(() =>
      // Chỉ gửi ID và trường cần cập nhật
      updateGroup({ id: group.id, tokenLimit: limit })
    );
  };

  return (
    <>
      {groups.length === 0 &&
      (!inlineEditingGroup ||
        inlineEditingGroup.profileName !== profileName ||
        inlineEditingGroup.mode !== "create") ? (
        <div className="text-left py-2 px-2">
          <p className="text-sm text-muted-foreground/80">Không có nhóm nào.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {groups.map((group) => {
            const isLoading =
              exportingGroupId === group.id || copyingGroupId === group.id;
            const isEditing =
              inlineEditingGroup?.mode === "rename" &&
              inlineEditingGroup.groupId === group.id;

            if (isEditing) {
              return (
                <InlineGroupInput
                  key={`${group.id}-editing`}
                  defaultValue={group.name}
                  onConfirm={onConfirmRename}
                  onCancel={onCancelEdit}
                />
              );
            }

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
                  <DropdownMenuContent
                    align="end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenuItem onClick={() => onStartRename(group)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      <span>Đổi tên</span>
                    </DropdownMenuItem>

                    {/* --- TOKEN LIMIT EDITOR MỚI --- */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Tag className="mr-2 h-4 w-4" />
                        <span>Sửa giới hạn Token</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="p-0">
                        <TokenLimitEditor
                          group={group}
                          onSave={(limit) => handleSaveTokenLimit(group, limit)}
                        />
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

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
                            " sẽ bị xóa vĩnh viễn.
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
    </>
  );
}
