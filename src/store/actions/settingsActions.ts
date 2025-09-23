// src/store/actions/settingsActions.ts
import { StateCreator } from "zustand";
import { AppState } from "../appStore";
import { invoke } from "@tauri-apps/api/core";
import { message } from "@tauri-apps/plugin-dialog";

export interface SettingsActions {
  setSyncSettings: (settings: {
    enabled: boolean;
    path: string | null;
  }) => Promise<void>;
  setGroupCrossSync: (groupId: string, enabled: boolean) => Promise<void>;
  setCustomIgnorePatterns: (patterns: string[]) => Promise<void>;
  setFileWatching: (enabled: boolean) => Promise<void>;
  setExportUseFullTree: (enabled: boolean) => Promise<void>;
  setExportWithLineNumbers: (enabled: boolean) => Promise<void>;
  setAlwaysApplyText: (text: string) => Promise<void>;
  setCrossLinkingEnabled: (enabled: boolean) => void;
}

export const createSettingsActions: StateCreator<
  AppState,
  [],
  [],
  SettingsActions
> = (set, get, _store) => ({
  setSyncSettings: async ({ enabled, path }) => {
    const { rootPath, activeProfile } = get();
    if (!rootPath) return;

    set({ syncEnabled: enabled, syncPath: path });

    try {
      await invoke("update_sync_settings", {
        path: rootPath,
        profileName: activeProfile,
        enabled,
        syncPath: path,
      });
    } catch (error) {
      console.error("Lỗi khi lưu cài đặt đồng bộ:", error);
      await message("Không thể lưu cài đặt đồng bộ.", {
        title: "Lỗi",
        kind: "error",
      });
    }
  },
  setGroupCrossSync: async (groupId, enabled) => {
    const { rootPath, activeProfile } = get();
    if (!rootPath) return;

    set((state) => {
      const newAllGroups = new Map(state.allGroups);
      const currentGroups = newAllGroups.get(activeProfile) || [];
      const updatedGroups = currentGroups.map((g) =>
        g.id === groupId ? { ...g, crossSyncEnabled: enabled } : g
      );
      newAllGroups.set(activeProfile, updatedGroups);
      return { allGroups: newAllGroups, groups: updatedGroups };
    });

    try {
      await invoke("set_group_cross_sync", {
        path: rootPath,
        profileName: activeProfile,
        groupId,
        enabled,
      });
    } catch (error) {
      message(`Không thể cập nhật đồng bộ chéo: ${error}`, {
        title: "Lỗi",
        kind: "error",
      });
    }
  },
  setCustomIgnorePatterns: async (patterns: string[]) => {
    const { rootPath, activeProfile } = get();
    if (!rootPath) return;

    set({ customIgnorePatterns: patterns });

    try {
      await invoke("update_custom_ignore_patterns", {
        path: rootPath,
        profileName: activeProfile,
        patterns,
      });
      await get().actions.rescanProject();
    } catch (error) {
      console.error("Lỗi khi lưu các mẫu loại trừ tùy chỉnh:", error);
      await message("Không thể lưu các mẫu loại trừ.", {
        title: "Lỗi",
        kind: "error",
      });
    }
  },
  setFileWatching: async (enabled: boolean) => {
    const { rootPath, activeProfile } = get();
    if (!rootPath) return;

    try {
      await invoke("set_file_watching_setting", {
        path: rootPath,
        profileName: activeProfile,
        enabled,
      });
    } catch (error) {
      await message(`Không thể lưu cài đặt: ${error}`, {
        title: "Lỗi",
        kind: "error",
      });
      return;
    }

    set({ isWatchingFiles: enabled });

    try {
      if (enabled) {
        await invoke("start_file_watching", { path: rootPath });
      } else {
        await invoke("stop_file_watching");
      }
    } catch (error) {
      await message(`Không thể ${enabled ? "bật" : "tắt"} theo dõi: ${error}`, {
        title: "Lỗi",
        kind: "error",
      });
      set({ isWatchingFiles: !enabled });
    }
  },
  setExportUseFullTree: async (enabled: boolean) => {
    const { rootPath, activeProfile } = get();
    if (!rootPath) return;
    set({ exportUseFullTree: enabled });
    try {
      await invoke("set_export_use_full_tree_setting", {
        path: rootPath,
        profileName: activeProfile,
        enabled,
      });
    } catch (error) {
      message(`Không thể lưu cài đặt xuất file: ${error}`, {
        title: "Lỗi",
        kind: "error",
      });
      set((state) => ({ exportUseFullTree: !state.exportUseFullTree }));
    }
  },
  setExportWithLineNumbers: async (enabled: boolean) => {
    const { rootPath, activeProfile } = get();
    if (!rootPath) return;
    set({ exportWithLineNumbers: enabled });
    try {
      await invoke("set_export_with_line_numbers_setting", {
        path: rootPath,
        profileName: activeProfile,
        enabled,
      });
    } catch (error) {
      message(`Không thể lưu cài đặt số dòng: ${error}`, {
        title: "Lỗi",
        kind: "error",
      });
      set((state) => ({ exportWithLineNumbers: !state.exportWithLineNumbers }));
    }
  },
  setAlwaysApplyText: async (text: string) => {
    const { rootPath, activeProfile } = get();
    if (!rootPath) return;
    set({ alwaysApplyText: text });
    try {
      await invoke("set_always_apply_text_setting", {
        path: rootPath,
        profileName: activeProfile,
        text,
      });
    } catch (error) {
      message(`Không thể lưu văn bản: ${error}`, {
        title: "Lỗi",
        kind: "error",
      });
    }
  },
  setCrossLinkingEnabled: (enabled: boolean) => {
    set({ isCrossLinkingEnabled: enabled });
  },
});
