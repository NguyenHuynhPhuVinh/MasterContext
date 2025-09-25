// src/store/actions/uiActions.ts
import { StateCreator } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { type FileMetadata } from "../types";
import { AppState } from "../appStore";

export interface UIActions {
  reset: () => void;
  showDashboard: () => void;
  showSettingsScene: () => void;
  toggleProjectPanelVisibility: () => void;
  toggleGitPanelVisibility: () => void;
  toggleGroupEditorPanelVisibility: () => void;
  toggleEditorPanelVisibility: () => void;
  setInlineEditingGroup: (
    state: {
      mode: "create" | "rename";
      profileName: string;
      groupId?: string;
    } | null
  ) => void;
  _setRecentPaths: (paths: string[]) => void;
  openFileInEditor: (filePath: string) => Promise<void>;
  closeEditor: () => void;
  addExclusionRange: (start: number, end: number) => Promise<void>;
  removeExclusionRange: (rangeToRemove: [number, number]) => Promise<void>;
  clearExclusionRanges: () => Promise<void>;
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
    set({ activeScene: "dashboard", editingGroupId: null });
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
  toggleEditorPanelVisibility: () => {
    set((state) => ({ isEditorPanelVisible: !state.isEditorPanelVisible }));
  },
  setInlineEditingGroup: (state) => set({ inlineEditingGroup: state }),
  _setRecentPaths: (paths) => set({ recentPaths: paths }),
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
});
