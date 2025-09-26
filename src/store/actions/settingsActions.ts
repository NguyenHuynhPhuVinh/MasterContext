// src/store/actions/settingsActions.ts
import { StateCreator } from "zustand";
import { AppState } from "../appStore";
import { invoke } from "@tauri-apps/api/core";
import { type AppSettings } from "../types";
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
  setExportWithoutComments: (enabled: boolean) => Promise<void>;
  setExportRemoveDebugLogs: (enabled: boolean) => Promise<void>;
  setExportSuperCompressed: (enabled: boolean) => Promise<void>;
  setAlwaysApplyText: (text: string) => Promise<void>;
  setExportExcludeExtensions: (extensions: string[]) => Promise<void>;
  setGitExportMode: (enabled: boolean) => Promise<void>;
  updateAppSettings: (settings: Partial<AppSettings>) => Promise<void>;
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
  setExportWithoutComments: async (enabled: boolean) => {
    const { rootPath, activeProfile } = get();
    if (!rootPath) return;
    set({ exportWithoutComments: enabled });
    try {
      await invoke("set_export_without_comments_setting", {
        path: rootPath,
        profileName: activeProfile,
        enabled,
      });
    } catch (error) {
      message(`Không thể lưu cài đặt loại bỏ chú thích: ${error}`, {
        title: "Lỗi",
        kind: "error",
      });
      set((state) => ({ exportWithoutComments: !state.exportWithoutComments }));
    }
  },
  setExportRemoveDebugLogs: async (enabled: boolean) => {
    const { rootPath, activeProfile } = get();
    if (!rootPath) return;
    set({ exportRemoveDebugLogs: enabled });
    try {
      await invoke("set_export_remove_debug_logs_setting", {
        path: rootPath,
        profileName: activeProfile,
        enabled,
      });
    } catch (error) {
      message(`Không thể lưu cài đặt loại bỏ debug logs: ${error}`, {
        title: "Lỗi",
        kind: "error",
      });
      set((state) => ({
        exportRemoveDebugLogs: !state.exportRemoveDebugLogs,
      }));
    }
  },
  setExportSuperCompressed: async (enabled: boolean) => {
    const { rootPath, activeProfile } = get();
    if (!rootPath) return;
    set({ exportSuperCompressed: enabled });
    try {
      await invoke("set_export_super_compressed_setting", {
        path: rootPath,
        profileName: activeProfile,
        enabled,
      });
    } catch (error) {
      message(`Không thể lưu cài đặt xuất siêu nén: ${error}`, {
        title: "Lỗi",
        kind: "error",
      });
      set((state) => ({ exportSuperCompressed: !state.exportSuperCompressed }));
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
  setExportExcludeExtensions: async (extensions: string[]) => {
    const { rootPath, activeProfile } = get();
    if (!rootPath) return;
    set({ exportExcludeExtensions: extensions });
    try {
      await invoke("set_export_exclude_extensions_setting", {
        path: rootPath,
        profileName: activeProfile,
        extensions,
      });
    } catch (error) {
      message(`Không thể lưu cài đặt loại trừ file: ${error}`, {
        title: "Lỗi",
        kind: "error",
      });
      // Revert on error? Or just log it. Let's just log and show message.
    }
  },
  setGitExportMode: async (enabled: boolean) => {
    const { rootPath, activeProfile } = get();
    if (!rootPath) return;
    set({ gitExportModeIsContext: enabled });
    try {
      await invoke("set_git_export_mode_setting", {
        path: rootPath,
        profileName: activeProfile,
        enabled,
      });
    } catch (error) {
      message(`Không thể lưu cài đặt Git: ${error}`, {
        title: "Lỗi",
        kind: "error",
      });
      set((state) => ({
        gitExportModeIsContext: !state.gitExportModeIsContext,
      }));
    }
  },
  updateAppSettings: async (newSettings) => {
    const {
      recentPaths,
      nonAnalyzableExtensions,
      openRouterApiKey,
      aiModels,
      streamResponse,
      systemPrompt,
      temperature,
      topP,
      topK,
      maxTokens,
    } = get();
    const fullSettings: AppSettings = {
      recentPaths: newSettings.recentPaths ?? recentPaths,
      nonAnalyzableExtensions:
        newSettings.nonAnalyzableExtensions ?? nonAnalyzableExtensions,
      openRouterApiKey: newSettings.openRouterApiKey ?? openRouterApiKey,
      aiModels: newSettings.aiModels ?? aiModels,
      streamResponse: newSettings.streamResponse ?? streamResponse,
      systemPrompt: newSettings.systemPrompt ?? systemPrompt,
      temperature: newSettings.temperature ?? temperature,
      topP: newSettings.topP ?? topP,
      topK: newSettings.topK ?? topK,
      maxTokens: newSettings.maxTokens ?? maxTokens,
    };

    try {
      await invoke("update_app_settings", { settings: fullSettings });
      set({
        recentPaths: fullSettings.recentPaths,
        nonAnalyzableExtensions: fullSettings.nonAnalyzableExtensions,
        openRouterApiKey: fullSettings.openRouterApiKey ?? "",
        aiModels: fullSettings.aiModels ?? ["openai/gpt-3.5-turbo"],
        systemPrompt: fullSettings.systemPrompt ?? "",
        streamResponse: fullSettings.streamResponse ?? true,
        temperature: fullSettings.temperature ?? 1.0,
        topP: fullSettings.topP ?? 1.0,
        topK: fullSettings.topK ?? 0,
        maxTokens: fullSettings.maxTokens ?? 0,
        // Cập nhật model được chọn nếu danh sách thay đổi
        selectedAiModel:
          fullSettings.aiModels?.find((m) => m === get().selectedAiModel) ||
          fullSettings.aiModels?.[0] ||
          "",
      });
    } catch (e) {
      console.error("Failed to update app settings:", e);
      message(`Không thể lưu cài đặt: ${e}`, { title: "Lỗi", kind: "error" });
    }
  },
});
