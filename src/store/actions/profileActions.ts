// src/store/actions/profileActions.ts
import { StateCreator } from "zustand";
import { AppState } from "../appStore";
import { type CachedProjectData } from "../types";
import { invoke } from "@tauri-apps/api/core";
import { message } from "@tauri-apps/plugin-dialog";

export interface ProfileActions {
  switchProfile: (profileName: string) => Promise<void>;
  createProfile: (profileName: string) => Promise<void>;
  renameProfile: (oldName: string, newName: string) => Promise<void>;
  deleteProfile: (profileName: string) => Promise<void>;
}

export const createProfileActions: StateCreator<
  AppState,
  [],
  [],
  ProfileActions
> = (set, get, _store) => ({
  switchProfile: async (profileName: string) => {
    const { rootPath, activeProfile, fileTree } = get();
    if (!rootPath || profileName === activeProfile || !fileTree) return;

    set({
      editingGroupId: null,
      scanProgress: {
        currentFile: `Đang tải ${profileName}...`,
        currentPhase: "scanning",
      },
    });
    try {
      const profileData = await invoke<CachedProjectData>("load_profile_data", {
        projectPath: rootPath,
        profileName: profileName,
      });

      const loadedGroups = (profileData.groups || []).map((g) => ({ ...g }));
      set((state) => {
        const newAllGroups = new Map(state.allGroups);
        newAllGroups.set(profileName, loadedGroups);
        return {
          allGroups: newAllGroups,
          groups: loadedGroups,
          activeProfile: profileName,
          syncEnabled: profileData.sync_enabled ?? false,
          syncPath: profileData.sync_path ?? null,
          customIgnorePatterns: profileData.custom_ignore_patterns ?? [],
          isWatchingFiles: profileData.is_watching_files ?? false,
          exportUseFullTree: profileData.export_use_full_tree ?? false,
          exportWithLineNumbers: profileData.export_with_line_numbers ?? true,
          exportWithoutComments: profileData.export_without_comments ?? false,
          exportRemoveDebugLogs: profileData.export_remove_debug_logs ?? false,
          exportSuperCompressed: profileData.export_super_compressed ?? false,
          alwaysApplyText: profileData.always_apply_text ?? null,
          exportExcludeExtensions: profileData.export_exclude_extensions ?? [],
          gitExportModeIsContext:
            profileData.git_export_mode_is_context ?? false,
          scanProgress: { currentFile: null, currentPhase: "scanning" },
        };
      });
    } catch (error) {
      message(`Không thể tải hồ sơ ${profileName}: ${error}`, {
        title: "Lỗi",
        kind: "error",
      });
      set({ scanProgress: { currentFile: null, currentPhase: "scanning" } });
    }
  },
  createProfile: async (profileName: string) => {
    const { rootPath, profiles } = get();
    if (!rootPath || profiles.includes(profileName)) {
      message("Tên hồ sơ đã tồn tại.", { title: "Lỗi", kind: "error" });
      return;
    }
    try {
      await invoke("clone_profile", {
        projectPath: rootPath,
        sourceProfileName: "default",
        newProfileName: profileName,
      });

      set((state) => {
        const newAllGroups = new Map(state.allGroups);
        newAllGroups.set(profileName, []);
        return {
          profiles: [...state.profiles, profileName],
          allGroups: newAllGroups,
        };
      });

      get().actions.switchProfile(profileName);
    } catch (error) {
      message(`Không thể tạo hồ sơ: ${error}`, { title: "Lỗi", kind: "error" });
    }
  },
  renameProfile: async (oldName: string, newName: string) => {
    const { rootPath, profiles } = get();
    if (!rootPath || profiles.includes(newName)) {
      message("Tên hồ sơ mới đã tồn tại.", { title: "Lỗi", kind: "error" });
      return;
    }
    try {
      await invoke("rename_profile", {
        projectPath: rootPath,
        oldName,
        newName,
      });
      set((state) => {
        const newAllGroups = new Map(state.allGroups);
        if (newAllGroups.has(oldName)) {
          newAllGroups.set(newName, newAllGroups.get(oldName)!);
          newAllGroups.delete(oldName);
        }
        return {
          profiles: state.profiles.map((p) => (p === oldName ? newName : p)),
          activeProfile:
            state.activeProfile === oldName ? newName : state.activeProfile,
          allGroups: newAllGroups,
        };
      });
    } catch (error) {
      message(`Không thể đổi tên hồ sơ: ${error}`, {
        title: "Lỗi",
        kind: "error",
      });
    }
  },
  deleteProfile: async (profileName: string) => {
    const { rootPath } = get();
    if (!rootPath || profileName === "default") return;
    set({ inlineEditingGroup: null });
    try {
      await invoke("delete_profile", { projectPath: rootPath, profileName });
      set((state) => {
        const newAllGroups = new Map(state.allGroups);
        newAllGroups.delete(profileName);
        return {
          profiles: state.profiles.filter((p) => p !== profileName),
          allGroups: newAllGroups,
        };
      });
      get().actions.switchProfile("default");
    } catch (error) {
      message(`Không thể xóa hồ sơ: ${error}`, { title: "Lỗi", kind: "error" });
    }
  },
});
