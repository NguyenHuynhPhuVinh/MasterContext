// src/components/GroupManager.tsx
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  inlineEditingGroup: {
    mode: "create" | "rename";
    groupId?: string;
  } | null;
  onStartRename: (group: Group) => void;
  onConfirmRename: (newName: string) => void;
  onCancelEdit: () => void;
}

export function GroupManager({
  inlineEditingGroup,
  onStartRename,
  onConfirmRename,
  onCancelEdit,
}: GroupManagerProps) {
  const { t } = useTranslation();
  const {
    groups,
    rootPath,
    exportWithLineNumbers,
    exportWithoutComments,
    exportRemoveDebugLogs,
  } = useAppStore(
    useShallow((state) => ({
      groups: state.groups,
      rootPath: state.rootPath,
      exportWithLineNumbers: state.exportWithLineNumbers,
      // Lấy thêm các cài đặt export khác
      exportWithoutComments: state.exportWithoutComments,
      exportRemoveDebugLogs: state.exportRemoveDebugLogs,
    }))
  );
  const { deleteGroup, editGroupContent, attachItemToAi, updateGroup } =
    useAppActions();

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
        await message(t("errors.fileExportFailed", { error: event.payload }), {
          title: t("common.error"),
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
            title: t("dialogs.saveGroupContext.title", {
              name: pendingExportData.group.name,
            }),
            defaultPath: defaultName,
            filters: [{ name: t("dialogs.filters.text"), extensions: ["txt"] }],
          });
          if (filePath) {
            await writeTextFile(filePath, pendingExportData.context);
            await message(t("dialogs.saveSuccess.body"), {
              title: t("common.success"),
              kind: "info",
            });
          }
        } catch (error) {
          await message(t("errors.fileSaveFailed"), {
            title: t("common.error"),
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

  const handleExport = (group: Group) => {
    setExportingGroupId(group.id);
    invoke("start_group_export", {
      groupId: group.id,
      rootPathStr: rootPath,
    }).catch((err) => {
      message(t("errors.startExportFailed", { error: err }), {
        title: t("common.error"),
        kind: "error",
      });
      setExportingGroupId(null);
    });
  };
  const handleEditContentClick = (group: Group) => {
    editGroupContent(group.id);
  };
  const handleAttachToAi = (group: Group) => {
    attachItemToAi({
      id: group.id,
      type: "group",
      name: group.name,
    });
  };
  const handleCopyContext = (group: Group) => {
    if (!rootPath) return;
    setCopyingGroupId(group.id);
    invoke<string>("generate_group_context", {
      groupId: group.id,
      rootPathStr: rootPath,
      useFullTree: true,
      withLineNumbers: exportWithLineNumbers, // Sử dụng giá trị từ state
      withoutComments: exportWithoutComments, // Sử dụng giá trị từ state
      removeDebugLogs: exportRemoveDebugLogs, // Sử dụng giá trị từ state
      superCompressed: false, // Copy should not be compressed
    })
      .then((context) => {
        writeText(context);
        message(t("dialogs.copyGroupSuccess.body", { name: group.name }), {
          title: t("common.success"),
          kind: "info",
        });
      })
      .catch((error) => {
        message(t("errors.copyFailed", { error }), {
          title: t("common.error"),
          kind: "error",
        });
      })
      .finally(() => {
        setCopyingGroupId(null);
      });
  };
  const handleDeleteGroup = (group: Group) => {
    deleteGroup(group.id);
  };
  const handleSaveTokenLimit = (group: Group, limit?: number) => {
    // Chỉ gửi ID và trường cần cập nhật
    updateGroup({ id: group.id, tokenLimit: limit });
  };

  return (
    <>
      {groups.length === 0 &&
      (!inlineEditingGroup || inlineEditingGroup.mode !== "create") ? (
        <div className="text-left py-2 px-2">
          <p className="text-sm text-muted-foreground/80">
            {t("groupManager.noGroups")}
          </p>
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
                onAttachToAi={handleAttachToAi}
                onExport={handleExport}
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
