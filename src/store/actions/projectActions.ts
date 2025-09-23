// src/store/actions/projectActions.ts
import { StateCreator } from "zustand";
import { AppState } from "../appStore";
import { type CachedProjectData, type Group } from "../types";
import { invoke } from "@tauri-apps/api/core";
import { open, message } from "@tauri-apps/plugin-dialog";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";

export interface ProjectActions {
  selectRootPath: (path: string) => Promise<void>;
  openFolderFromMenu: () => Promise<void>;
  rescanProject: () => Promise<void>;
  _setScanProgress: (file: string) => void;
  _setScanComplete: (payload: CachedProjectData) => void;
  _setScanError: (error: string) => void;
  exportProject: () => void;
  copyProjectToClipboard: () => Promise<void>;
}

export const createProjectActions: StateCreator<
  AppState,
  [],
  [],
  ProjectActions
> = (set, get, _store) => ({
  selectRootPath: async (path) => {
    set({
      rootPath: path,
      selectedPath: path,
      isScanning: true,
      scanProgress: { currentFile: "Bắt đầu quét dự án..." },
      editingGroupId: null,
    });

    // Update recent paths
    const { recentPaths } = get();
    const newRecentPaths = [
      path,
      ...recentPaths.filter((p) => p !== path),
    ].slice(0, 10); // Limit to 10 recent paths

    get().actions._setRecentPaths(newRecentPaths);

    invoke("set_recent_paths", { paths: newRecentPaths }).catch((e) => {
      console.error("Failed to save recent paths:", e);
    });
    invoke("scan_project", { path, profileName: "default" });
  },
  openFolderFromMenu: async () => {
    try {
      const result = await open({
        directory: true,
        multiple: false,
        title: "Chọn một thư mục dự án",
      });
      if (typeof result === "string") {
        get().actions.selectRootPath(result);
      }
    } catch (error) {
      console.error("Lỗi khi chọn thư mục từ menu:", error);
      await message("Không thể mở thư mục.", { title: "Lỗi", kind: "error" });
    }
  },
  rescanProject: async () => {
    const { rootPath, activeProfile } = get();
    if (!rootPath) return;
    set({
      isScanning: true,
      scanProgress: { currentFile: "Quét lại dự án..." },
    });
    invoke("scan_project", { path: rootPath, profileName: activeProfile });
  },
  _setScanProgress: (file) => {
    set({ scanProgress: { currentFile: file } });
  },
  _setScanComplete: async (payload: CachedProjectData) => {
    const { rootPath, activeProfile } = get();
    set({
      projectStats: payload.stats,
      fileTree: payload.file_tree,
      fileMetadataCache: payload.file_metadata_cache,
      isScanning: false,
    });

    const loadedGroups = (payload.groups || []).map((g) => ({ ...g }));
    set((state) => {
      const newAllGroups = new Map(state.allGroups);
      newAllGroups.set(activeProfile, loadedGroups);
      return {
        allGroups: newAllGroups,
        groups: loadedGroups,
        syncEnabled: payload.sync_enabled ?? false,
        syncPath: payload.sync_path ?? null,
        customIgnorePatterns: payload.custom_ignore_patterns ?? [],
        isWatchingFiles: payload.is_watching_files ?? false,
        exportUseFullTree: payload.export_use_full_tree ?? false,
        exportWithLineNumbers: payload.export_with_line_numbers ?? true,
        alwaysApplyText: payload.always_apply_text ?? null,
      };
    });

    if (rootPath) {
      try {
        const profiles = await invoke<string[]>("list_profiles", {
          projectPath: rootPath,
        });
        set({ profiles });

        const otherProfiles = profiles.filter((p) => p !== activeProfile);
        const groupPromises = otherProfiles.map((p) =>
          invoke<Group[]>("list_groups_for_profile", {
            projectPath: rootPath,
            profileName: p,
          }).then((groups) => [p, groups] as [string, Group[]])
        );

        const otherProfileGroups = await Promise.all(groupPromises);
        set((state) => {
          const newAllGroups = new Map(state.allGroups);
          otherProfileGroups.forEach(([profileName, groups]) => {
            newAllGroups.set(profileName, groups);
          });
          return { allGroups: newAllGroups };
        });
      } catch (e) {
        console.error("Không thể tải danh sách các hồ sơ khác:", e);
      }
    }
  },
  _setScanError: (error) => {
    console.error("Scan error from Rust:", error);
    set({ isScanning: false });
  },
  exportProject: async () => {
    const { rootPath, activeProfile } = get();
    if (!rootPath || !activeProfile) return;
    invoke("start_project_export", {
      path: rootPath,
      profileName: activeProfile,
    });
  },
  copyProjectToClipboard: async () => {
    const { rootPath, activeProfile, exportWithLineNumbers } = get();
    if (!rootPath || !activeProfile) return;
    try {
      const context = await invoke<string>("generate_project_context", {
        path: rootPath,
        profileName: activeProfile,
        withLineNumbers: exportWithLineNumbers,
      });
      await writeText(context);
      await message("Đã sao chép ngữ cảnh dự án vào clipboard!", {
        title: "Thành công",
        kind: "info",
      });
    } catch (error) {
      console.error("Lỗi khi sao chép ngữ cảnh dự án:", error);
      await message(`Không thể sao chép: ${error}`, {
        title: "Lỗi",
        kind: "error",
      });
    }
  },
});
