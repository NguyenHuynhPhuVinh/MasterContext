// src/store/actions/projectActions.ts
import { StateCreator } from "zustand";
import { AppState } from "../appStore";
import { type CachedProjectData, type Group } from "../types";
import { invoke } from "@tauri-apps/api/core";
import { open, message } from "@tauri-apps/plugin-dialog";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { join } from "@tauri-apps/api/path";

export interface ProjectActions {
  selectRootPath: (path: string) => Promise<void>;
  openFolderFromMenu: () => Promise<void>;
  cloneAndOpenProject: (url: string) => Promise<void>;
  rescanProject: () => Promise<void>;
  _setScanProgress: (file: string) => void;
  _setAnalysisProgress: (file: string) => void;
  _setScanComplete: (payload: CachedProjectData) => void;
  _setScanError: (error: string) => void;
  exportProject: () => void;
  copyProjectToClipboard: () => Promise<void>;
  deleteCurrentProjectData: () => Promise<void>;
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
      scanProgress: {
        currentFile: "Bắt đầu quét dự án...",
        currentPhase: "scanning",
      },
      editingGroupId: null,
      // Reset Git state khi mở dự án mới
      isGitPanelVisible: false,
      gitRepoInfo: null,
      gitCommits: [],
      gitLogState: "idle",
      gitCurrentPage: 0,
      hasMoreCommits: true,
      originalGitBranch: null, // QUAN TRỌNG: Reset khi mở dự án mới
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
  cloneAndOpenProject: async (url: string) => {
    // 1. Ask user for parent directory
    const parentDir = await open({
      directory: true,
      multiple: false,
      title: "Chọn thư mục để clone dự án vào",
    });

    if (typeof parentDir !== "string") {
      return; // User cancelled
    }

    // 2. Derive repo name and construct full path
    try {
      const repoName =
        url.split("/").pop()?.replace(".git", "") || "cloned-repo";
      const destPath = await join(parentDir, repoName);

      // 3. Show loading state
      set({
        isScanning: true,
        scanProgress: {
          currentFile: `Đang clone từ ${url}...`,
          currentPhase: "scanning",
        },
      });

      // 4. Call backend command
      await invoke("clone_git_repository", { url, path: destPath });

      // 5. If successful, open the project
      await get().actions.selectRootPath(destPath);
    } catch (e) {
      console.error("Lỗi khi clone dự án:", e);
      await message(`Không thể clone dự án: ${e}`, {
        title: "Lỗi",
        kind: "error",
      });
      set({ isScanning: false });
    }
  },
  rescanProject: async () => {
    const { rootPath, activeProfile } = get();
    if (!rootPath) return;
    set({
      isScanning: true,
      scanProgress: {
        currentFile: "Quét lại dự án...",
        currentPhase: "scanning",
      },
    });
    invoke("scan_project", { path: rootPath, profileName: activeProfile });
  },
  _setScanProgress: (file) => {
    set({ scanProgress: { currentFile: file, currentPhase: "scanning" } });
  },
  _setAnalysisProgress: (file) => {
    set({ scanProgress: { currentFile: file, currentPhase: "analyzing" } });
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
        exportWithoutComments: payload.export_without_comments ?? false,
        exportRemoveDebugLogs: payload.export_remove_debug_logs ?? false,
        exportSuperCompressed: payload.export_super_compressed ?? false,
        alwaysApplyText: payload.always_apply_text ?? null,
        exportExcludeExtensions: payload.export_exclude_extensions ?? [],
        gitExportModeIsContext: payload.git_export_mode_is_context ?? false,
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

    // Luôn làm mới trạng thái Git sau khi quét xong
    await get().actions.checkGitRepo();
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
    const {
      rootPath,
      activeProfile,
      exportWithLineNumbers,
      exportWithoutComments,
      exportRemoveDebugLogs,
    } = get();
    if (!rootPath || !activeProfile) return;
    try {
      const context = await invoke<string>("generate_project_context", {
        path: rootPath,
        profileName: activeProfile,
        withLineNumbers: exportWithLineNumbers,
        withoutComments: exportWithoutComments,
        removeDebugLogs: exportRemoveDebugLogs,
        superCompressed: false, // Copy should not be compressed
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
  deleteCurrentProjectData: async () => {
    const { rootPath } = get();
    if (!rootPath) return;

    try {
      await invoke("delete_project_data", { path: rootPath });
      await message("Đã xóa toàn bộ dữ liệu cho dự án này.", {
        title: "Thành công",
        kind: "info",
      });
      get().actions.reset();
    } catch (e) {
      console.error("Failed to delete project data:", e);
      await message(`Không thể xóa dữ liệu dự án: ${e}`, {
        title: "Lỗi",
        kind: "error",
      });
    }
  },
});
