// src/store/actions/uiActions.ts
import { StateCreator } from "zustand";
import { diffLines } from "diff";
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
  stageFileChangeFromAI: (
    toolName: "write_file" | "create_file" | "delete_file",
    args: any
  ) => Promise<{
    success: boolean;
    message: string;
    stats: { added: number; removed: number };
  }>;
  discardStagedChange: (filePath: string) => void;
  discardAllStagedChanges: () => void;
  applyStagedChange: (filePath: string) => void;
  applyAllStagedChanges: () => void;
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
  stageFileChangeFromAI: async (toolName, args) => {
    const { rootPath } = _get();
    const { file_path } = args;
    if (!rootPath) {
      return {
        success: false,
        message: "Error: Project path not found.",
        stats: { added: 0, removed: 0 },
      };
    }

    let originalContent: string | null = null;
    let newContent: string | null = null;
    let changeType: "create" | "modify" | "delete" = "modify";

    try {
      // 1. Determine original and new content based on the tool
      if (toolName === "create_file") {
        changeType = "create";
        originalContent = null;
        newContent = args.content || "";
      } else if (toolName === "delete_file") {
        changeType = "delete";
        originalContent = await invoke<string>("get_file_content", {
          rootPathStr: rootPath,
          fileRelPath: file_path,
        });
        newContent = null;
      } else {
        // write_file
        changeType = "modify";
        originalContent = await invoke<string>("get_file_content", {
          rootPathStr: rootPath,
          fileRelPath: file_path,
        });

        const { content, start_line, end_line } = args;
        if (start_line) {
          const originalLines = originalContent.split("\n");
          const newLines = content.split("\n");
          const startIndex = start_line - 1;
          const endIndex = end_line ? end_line : startIndex;
          originalLines.splice(startIndex, endIndex - startIndex, ...newLines);
          newContent = originalLines.join("\n");
        } else {
          newContent = content;
        }
      }

      // 2. Perform the actual file operation
      if (newContent !== null) {
        await invoke("save_file_content", {
          rootPathStr: rootPath,
          fileRelPath: file_path,
          content: newContent,
        });
      } else {
        // This is a delete operation
        await invoke("delete_file", {
          rootPathStr: rootPath,
          fileRelPath: file_path,
        });
      }

      // 3. Calculate diff stats for UI feedback
      const diff = diffLines(originalContent ?? "", newContent ?? "");
      let added = 0;
      let removed = 0;
      diff.forEach((part) => {
        if (part.added) added += part.count ?? 0;
        if (part.removed) removed += part.count ?? 0;
      });
      const stats = { added, removed };

      // 4. Stage the change for potential revert
      set((state) => {
        const newChanges = new Map(state.stagedFileChanges);
        newChanges.set(file_path, { originalContent, changeType, stats });
        return { stagedFileChanges: newChanges };
      });

      return {
        success: true,
        message: `Successfully applied and staged change for ${file_path}.`,
        stats,
      };
    } catch (e) {
      return {
        success: false,
        message: `Error during file operation for ${file_path}: ${e}`,
        stats: { added: 0, removed: 0 },
      };
    }
  },
  discardStagedChange: (filePath) => {
    const { rootPath, stagedFileChanges } = _get();
    if (!rootPath) return;

    const change = stagedFileChanges.get(filePath);
    if (!change) return;

    const revertOperation = async () => {
      try {
        if (change.changeType === "create") {
          await invoke("delete_file", {
            rootPathStr: rootPath,
            fileRelPath: filePath,
          });
        } else {
          // Modify or Delete
          await invoke("save_file_content", {
            rootPathStr: rootPath,
            fileRelPath: filePath,
            content: change.originalContent ?? "",
          });
        }
        // If successful, remove from staging
        set((state) => {
          const newChanges = new Map(state.stagedFileChanges);
          newChanges.delete(filePath);
          return { stagedFileChanges: newChanges };
        });

        // After reverting, rescan to get the correct file tree state
        _get()
          .actions.rescanProject()
          .then(() => {
            _get().actions.openFileInEditor(filePath);
          });
      } catch (e) {
        console.error(`Failed to revert change for ${filePath}:`, e);
        message(`Failed to revert change for ${filePath}: ${e}`, {
          title: "Revert Error",
          kind: "error",
        });
      }
    };

    revertOperation();
  },
  discardAllStagedChanges: () => {
    set({ stagedFileChanges: new Map() });
  },
  applyStagedChange: (filePath: string) => {
    // This is now a "confirm" action. It just removes the ability to revert.
    set((state) => {
      const newChanges = new Map(state.stagedFileChanges);
      newChanges.delete(filePath);
      return { stagedFileChanges: newChanges };
    });
  },
  applyAllStagedChanges: () => {
    // "Accepts" all changes by clearing the staging map. The files are already modified on disk.
    set({ stagedFileChanges: new Map() });
    // Trigger a rescan to update metadata like token counts based on the new content.
    _get().actions.rescanProject();
  },
});
