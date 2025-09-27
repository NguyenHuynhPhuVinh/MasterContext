// src/store/actions/uiActions.ts
import { StateCreator } from "zustand";
import { applyPatch } from "diff";
import i18n from "@/i18n"; // <-- THÊM DÒNG NÀY
import { invoke } from "@tauri-apps/api/core";
import { message } from "@tauri-apps/plugin-dialog";
import { type FileMetadata } from "../types";
import { AppState } from "../appStore";

export interface UIActions {
  reset: () => void;
  showDashboard: () => void;
  showSettingsScene: () => void;
  toggleProjectPanelVisibility: () => void;
  toggleGitPanelVisibility: () => void;
  toggleGroupEditorPanelVisibility: () => void;
  toggleAiPanelVisibility: () => void;
  toggleEditorPanelVisibility: () => void;
  setInlineEditingGroup: (
    state: {
      mode: "create" | "rename";
      profileName: string;
      groupId?: string;
    } | null
  ) => void;
  _setRecentPaths: (paths: string[]) => void;
  setCrossLinkingEnabled: (enabled: boolean) => void;
  openFileInEditor: (filePath: string) => Promise<void>;
  closeEditor: () => void;
  addExclusionRange: (start: number, end: number) => Promise<void>;
  removeExclusionRange: (rangeToRemove: [number, number]) => Promise<void>;
  clearExclusionRanges: () => Promise<void>;
  stageFileChange: (
    filePath: string,
    patch: string,
    stats: { added: number; removed: number }
  ) => Promise<void>;
  discardStagedChange: (filePath: string) => void;
  discardAllStagedChanges: () => void;
  applyStagedChange: (filePath: string) => Promise<void>;
  applyAllStagedChanges: () => Promise<void>;
}

export const createUIActions: StateCreator<AppState, [], [], UIActions> = (
  set,
  _get,
  _store
) => ({
  reset: () =>
    set({
      rootPath: null,
      selectedPath: null,
      allGroups: new Map(),
      groups: [],
      activeScene: "dashboard",
      editingGroupId: null,
      profiles: ["default"],
      activeProfile: "default",
      isGroupEditorPanelVisible: false,
    }),
  showDashboard: () => {
    set({ activeScene: "dashboard" });
  },
  showSettingsScene: () => {
    set({ activeScene: "settings" });
  },
  toggleProjectPanelVisibility: () => {
    set((state) => ({ isSidebarVisible: !state.isSidebarVisible }));
  },
  toggleGitPanelVisibility: () => {
    set((state) => ({ isGitPanelVisible: !state.isGitPanelVisible }));
  },
  toggleGroupEditorPanelVisibility: () => {
    set((state) => ({
      isGroupEditorPanelVisible: !state.isGroupEditorPanelVisible,
    }));
  },
  toggleAiPanelVisibility: () => {
    set((state) => ({
      isAiPanelVisible: !state.isAiPanelVisible,
    }));
  },
  toggleEditorPanelVisibility: () => {
    set((state) => ({ isEditorPanelVisible: !state.isEditorPanelVisible }));
  },
  setInlineEditingGroup: (state) => set({ inlineEditingGroup: state }),
  _setRecentPaths: (paths) => set({ recentPaths: paths }),
  setCrossLinkingEnabled: (enabled: boolean) => {
    set({ isCrossLinkingEnabled: enabled });
  },
  openFileInEditor: async (filePath: string) => {
    const { rootPath, activeEditorFile } = _get();
    if (!rootPath || filePath === activeEditorFile) return;

    set({
      isEditorLoading: true,
      activeEditorFile: filePath,
      activeEditorFileContent: null,
      isEditorPanelVisible: true,
    });

    try {
      const content = await invoke<string>("get_file_content", {
        rootPathStr: rootPath,
        fileRelPath: filePath,
      });
      const fileMeta = _get().fileMetadataCache?.[filePath];
      set({
        activeEditorFileContent: content,
        isEditorLoading: false,
        activeEditorFileExclusions: fileMeta?.excluded_ranges || [],
      });
    } catch (e) {
      console.error(`Failed to load file content for ${filePath}:`, e);
      set({
        activeEditorFileContent: `Error loading file: ${e}`,
        isEditorLoading: false,
      });
    }
  },
  closeEditor: () => {
    set({
      activeEditorFile: null,
      activeEditorFileContent: null,
      isEditorLoading: false,
      activeEditorFileExclusions: null,
      isEditorPanelVisible: false,
    });
  },
  addExclusionRange: async (start, end) => {
    const {
      rootPath,
      activeProfile,
      activeEditorFile,
      activeEditorFileExclusions,
    } = _get();
    if (!rootPath || !activeProfile || !activeEditorFile || start >= end)
      return;

    const newRanges = [
      ...(activeEditorFileExclusions || []),
      [start, end] as [number, number],
    ].sort((a, b) => a[0] - b[0]);

    const mergedRanges: [number, number][] = [];
    if (newRanges.length > 0) {
      let currentMerge = newRanges[0];
      for (let i = 1; i < newRanges.length; i++) {
        const nextRange = newRanges[i];
        if (nextRange[0] <= currentMerge[1]) {
          currentMerge[1] = Math.max(currentMerge[1], nextRange[1]);
        } else {
          mergedRanges.push(currentMerge);
          currentMerge = nextRange;
        }
      }
      mergedRanges.push(currentMerge);
    }

    set({ activeEditorFileExclusions: mergedRanges });

    try {
      const updatedMetadata = await invoke<FileMetadata>(
        "update_file_exclusions",
        {
          path: rootPath,
          profileName: activeProfile,
          fileRelPath: activeEditorFile,
          ranges: mergedRanges,
        }
      );
      _get().actions._updateFileMetadata(activeEditorFile, updatedMetadata);
    } catch (e) {
      console.error("Failed to save exclusion range:", e);
      // Optionally revert state on error
    }
  },
  removeExclusionRange: async (rangeToRemove) => {
    const {
      rootPath,
      activeProfile,
      activeEditorFile,
      activeEditorFileExclusions,
    } = _get();
    if (
      !rootPath ||
      !activeProfile ||
      !activeEditorFile ||
      !activeEditorFileExclusions
    )
      return;
    const newRanges = activeEditorFileExclusions.filter(
      (r) => r[0] !== rangeToRemove[0] || r[1] !== rangeToRemove[1]
    );
    set({ activeEditorFileExclusions: newRanges });
    try {
      const updatedMetadata = await invoke<FileMetadata>(
        "update_file_exclusions",
        {
          path: rootPath,
          profileName: activeProfile,
          fileRelPath: activeEditorFile,
          ranges: newRanges,
        }
      );
      _get().actions._updateFileMetadata(activeEditorFile, updatedMetadata);
    } catch (e) {
      console.error("Failed to remove exclusion range:", e);
    }
  },
  clearExclusionRanges: async () => {
    set({ activeEditorFileExclusions: [] });
    const { rootPath, activeProfile, activeEditorFile } = _get();
    if (!rootPath || !activeProfile || !activeEditorFile) return;
    try {
      const updatedMetadata = await invoke<FileMetadata>(
        "update_file_exclusions",
        {
          path: rootPath,
          profileName: activeProfile,
          fileRelPath: activeEditorFile,
          ranges: [],
        }
      );
      _get().actions._updateFileMetadata(activeEditorFile, updatedMetadata);
    } catch (e) {
      console.error("Failed to clear exclusion ranges:", e);
    }
  },
  stageFileChange: async (filePath, patch, stats) => {
    set((state) => {
      const newChanges = new Map(state.stagedFileChanges);
      newChanges.set(filePath, { patch, stats });
      return { stagedFileChanges: newChanges };
    });
  },
  discardStagedChange: (filePath) => {
    set((state) => {
      const newChanges = new Map(state.stagedFileChanges);
      newChanges.delete(filePath);
      return { stagedFileChanges: newChanges };
    });
  },
  discardAllStagedChanges: () => {
    set({ stagedFileChanges: new Map() });
  },
  applyStagedChange: async (filePath: string) => {
    const { rootPath, stagedFileChanges } = _get();
    if (!rootPath) return;

    const change = stagedFileChanges.get(filePath);
    if (!change) return;

    try {
      const originalContent = await invoke<string>("get_file_content", {
        rootPathStr: rootPath,
        fileRelPath: filePath,
      });

      const newContent = applyPatch(originalContent, change.patch);
      if (newContent === false) {
        throw new Error("Patch could not be applied logically.");
      }

      await invoke("save_file_content", {
        rootPathStr: rootPath,
        fileRelPath: filePath,
        content: newContent,
      });

      // If successful, remove the change from staging
      _get().actions.discardStagedChange(filePath);

      // If this file is currently in the editor, refresh its content
      if (_get().activeEditorFile === filePath) {
        _get().actions.openFileInEditor(filePath);
      }
    } catch (e) {
      console.error(`Failed to apply staged change for ${filePath}:`, e);
      message(i18n.t("errors.fileSaveFailed", { error: e }), {
        title: i18n.t("common.error"),
        kind: "error",
      });
    }
  },
  applyAllStagedChanges: async () => {
    const { stagedFileChanges } = _get();
    const allFiles = Array.from(stagedFileChanges.keys());
    for (const filePath of allFiles) {
      // We await each one to ensure they are processed sequentially
      // and to avoid race conditions if multiple changes affect the same file (unlikely but possible).
      await _get().actions.applyStagedChange(filePath);
    }
  },
});
