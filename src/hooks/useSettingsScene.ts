// src/hooks/useSettingsScene.ts
import { useState, useEffect } from "react";
import { useAppStore, useAppActions } from "@/store/appStore";
import { useShallow } from "zustand/react/shallow";
import { open, message } from "@tauri-apps/plugin-dialog";

export type SettingsTab = "appearance" | "project" | "profile" | "export";

export function useSettingsScene() {
  const {
    syncEnabled,
    syncPath,
    customIgnorePatterns,
    activeProfile,
    isWatchingFiles,
    rootPath,
    exportUseFullTree,
    exportWithLineNumbers,
    exportWithoutComments,
    alwaysApplyText,
    exportExcludeExtensions,
  } = useAppStore(
    useShallow((state) => ({
      syncEnabled: state.syncEnabled,
      syncPath: state.syncPath,
      customIgnorePatterns: state.customIgnorePatterns,
      activeProfile: state.activeProfile,
      isWatchingFiles: state.isWatchingFiles,
      rootPath: state.rootPath,
      exportUseFullTree: state.exportUseFullTree,
      exportWithLineNumbers: state.exportWithLineNumbers,
      exportWithoutComments: state.exportWithoutComments,
      alwaysApplyText: state.alwaysApplyText,
      exportExcludeExtensions: state.exportExcludeExtensions,
    }))
  );

  const {
    setSyncSettings,
    setCustomIgnorePatterns,
    setFileWatching,
    showDashboard,
    setExportUseFullTree,
    setExportWithLineNumbers,
    setExportWithoutComments,
    setAlwaysApplyText,
    setExportExcludeExtensions,
  } = useAppActions();

  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");
  const [ignoreText, setIgnoreText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIgnoreText((customIgnorePatterns || []).join("\n"));
  }, [customIgnorePatterns]);

  const handleToggleSync = async (enabled: boolean) => {
    if (enabled && !syncPath) {
      await message(
        "Bạn phải chọn một thư mục đồng bộ trước khi bật tính năng này.",
        { title: "Cảnh báo", kind: "warning" }
      );
      return;
    }
    setSyncSettings({ enabled, path: syncPath });
  };

  const handleChooseSyncPath = async () => {
    try {
      const result = await open({
        directory: true,
        multiple: false,
        title: "Chọn thư mục để tự động đồng bộ",
      });
      if (typeof result === "string") {
        setSyncSettings({ enabled: true, path: result });
      }
    } catch (error) {
      console.error("Lỗi khi chọn thư mục đồng bộ:", error);
    }
  };

  const handleSaveIgnorePatterns = async () => {
    setIsSaving(true);
    try {
      const patterns = ignoreText
        .split("\n")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      await setCustomIgnorePatterns(patterns);
      showDashboard();
    } finally {
      setIsSaving(false);
    }
  };

  return {
    activeTab,
    setActiveTab,
    syncEnabled,
    syncPath,
    customIgnorePatterns,
    activeProfile,
    isWatchingFiles,
    rootPath,
    exportUseFullTree,
    exportWithLineNumbers,
    exportWithoutComments,
    alwaysApplyText,
    exportExcludeExtensions,
    showDashboard,
    setSyncSettings,
    setCustomIgnorePatterns,
    setFileWatching,
    setExportUseFullTree,
    setExportWithLineNumbers,
    setExportWithoutComments,
    setAlwaysApplyText,
    setExportExcludeExtensions,
    handleToggleSync,
    handleChooseSyncPath,
    ignoreText,
    setIgnoreText,
    isSaving,
    handleSaveIgnorePatterns,
  };
}
