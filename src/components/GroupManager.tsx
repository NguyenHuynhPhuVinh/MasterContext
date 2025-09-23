// src/components/GroupManager.tsx
import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAppStore, useAppActions } from "@/store/appStore";
import { type Group } from "@/store/types";
import { invoke } from "@tauri-apps/api/core";
import { save, message } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useShallow } from "zustand/react/shallow";
import { GroupItem } from "./GroupItem";

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
  const { groups, activeProfile, rootPath, exportWithLineNumbers } =
    useAppStore(
      useShallow((state) => ({
        groups: state.allGroups.get(profileName) || [],
        activeProfile: state.activeProfile,
        rootPath: state.rootPath,
        exportWithLineNumbers: state.exportWithLineNumbers,
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
          withLineNumbers: exportWithLineNumbers,
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

            return (
              <GroupItem
                key={group.id}
                group={group}
                isLoading={isLoading}
                isEditing={isEditing}
                onEditContent={handleEditContentClick}
                onStartRename={onStartRename}
                onConfirmRename={onConfirmRename}
                onCancelEdit={onCancelEdit}
                onCopyContext={handleCopyContext}
                onExport={handleExport}
                onToggleCrossSync={handleToggleCrossSync}
                onSaveTokenLimit={handleSaveTokenLimit}
                onDelete={handleDeleteGroup}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
