// src/store/actions/uiActions.ts
import { StateCreator } from "zustand";
import { applyPatch, createPatch } from "diff";
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
  _clearRevertedPrompt: () => void;
  _setRecentPaths: (paths: string[]) => void;
  openFileInEditor: (filePath: string) => Promise<void>;
  closeEditor: () => void;
  addExclusionRange: (start: number, end: number) => Promise<void>;
  removeExclusionRange: (rangeToRemove: [number, number]) => Promise<void>;
  clearExclusionRanges: () => Promise<void>;
  addExclusionRangeFromAI: (
    filePath: string,
    startLine: number,
    endLine: number
  ) => Promise<{ success: boolean; message: string }>;
  stageFileChangeFromAI: (
    toolName: "write_file" | "create_file" | "delete_file",
    args: any
  ) => Promise<{
    success: boolean;
    message: string;
    incrementalStats: { added: number; removed: number };
    cumulativeStats: { added: number; removed: number };
  }>;
  discardStagedChange: (filePath: string) => void;
  discardAllStagedChanges: () => Promise<void>;
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
  _clearRevertedPrompt: () => set({ revertedPromptContent: null }),
  _setRecentPaths: (paths) => set({ recentPaths: paths }),
  openFileInEditor: async (filePath: string) => {
    const { rootPath, isEditorLoading } = _get();
    if (!rootPath || isEditorLoading) return; // Only prevent re-opening if it's already loading

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
  addExclusionRangeFromAI: async (filePath, startLine, endLine) => {
    const { rootPath, activeProfile, fileMetadataCache } = _get();
    if (!rootPath || !activeProfile) {
      return { success: false, message: "Error: Project path not found." };
    }
    if (startLine > endLine) {
      return {
        success: false,
        message: "Error: start_line cannot be greater than end_line.",
      };
    }

    try {
      const content = await invoke<string>("get_file_content", {
        rootPathStr: rootPath,
        fileRelPath: filePath,
      });

      const lines = content.split("\n");
      if (startLine > lines.length || endLine > lines.length) {
        return {
          success: false,
          message: `Error: Line numbers are out of bounds. File has ${lines.length} lines.`,
        };
      }

      let startOffset = 0;
      // Sum lengths of all lines BEFORE the start line, plus their newlines
      for (let i = 0; i < startLine - 1; i++) {
        startOffset += lines[i].length + 1;
      }

      let endOffset = startOffset;
      // Sum lengths of all lines WITHIN the range, plus their newlines
      for (let i = startLine - 1; i < endLine; i++) {
        endOffset += lines[i].length + 1;
      }
      // The range should not include the final newline, so subtract 1.
      endOffset = Math.max(startOffset, endOffset - 1);

      const existingRanges =
        fileMetadataCache?.[filePath]?.excluded_ranges || [];

      const newRanges = [
        ...existingRanges,
        [startOffset, endOffset] as [number, number],
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

      const updatedMetadata = await invoke<FileMetadata>(
        "update_file_exclusions",
        {
          path: rootPath,
          profileName: activeProfile,
          fileRelPath: filePath,
          ranges: mergedRanges,
        }
      );
      _get().actions._updateFileMetadata(filePath, updatedMetadata);
      // If the modified file is currently open in the editor, update its exclusion state
      if (_get().activeEditorFile === filePath) {
        set({ activeEditorFileExclusions: mergedRanges });
      }

      return {
        success: true,
        message: `Successfully added exclusion range ${startLine}-${endLine} to ${filePath}.`,
      };
    } catch (e) {
      return {
        success: false,
        message: `Error processing exclusion for ${filePath}: ${String(e)}`,
      };
    }
  },
  stageFileChangeFromAI: async (toolName, args) => {
    const { rootPath, stagedFileChanges } = _get();
    const { file_path } = args;
    if (!rootPath) {
      return {
        success: false,
        message: "Error: Project path not found.",
        incrementalStats: { added: 0, removed: 0 },
        cumulativeStats: { added: 0, removed: 0 },
      };
    }

    try {
      let newPatch: string;
      let incrementalStats: { added: number; removed: number };
      let cumulativeStats: { added: number; removed: number };
      let finalPatchedContent: string | false;
      let originalContentForStaging: string;
      let changeTypeForStaging: "create" | "modify" | "delete";

      const existingChange = stagedFileChanges.get(file_path);

      if (existingChange) {
        // --- LOGIC FOR MODIFYING AN ALREADY STAGED FILE ---
        const intermediateContent = applyPatch(
          existingChange.originalContent ?? "",
          existingChange.patch
        );
        if (intermediateContent === false)
          throw new Error("Could not apply existing patch.");

        const { content, start_line, end_line } = args; // Assuming write_file
        const finalContent = applyLineChanges(
          intermediateContent,
          content,
          start_line,
          end_line
        );

        // Incremental patch: from intermediate to final
        const incrementalPatch = createPatch(
          file_path,
          intermediateContent,
          finalContent,
          "",
          ""
        );
        incrementalStats = calculateStatsFromPatch(incrementalPatch);

        newPatch = createPatch(
          file_path,
          existingChange.originalContent ?? "",
          finalContent,
          "",
          ""
        );
        cumulativeStats = calculateStatsFromPatch(newPatch);
        finalPatchedContent = finalContent;
        originalContentForStaging = existingChange.originalContent ?? "";
        changeTypeForStaging = existingChange.changeType; // Type doesn't change
      } else {
        // --- LOGIC FOR A NEW CHANGE ---
        if (toolName === "create_file") {
          originalContentForStaging = "";
          finalPatchedContent = args.content || "";
          changeTypeForStaging = "create";
        } else {
          // delete or modify
          originalContentForStaging = await invoke<string>("get_file_content", {
            rootPathStr: rootPath,
            fileRelPath: file_path,
          });
          if (toolName === "delete_file") {
            finalPatchedContent = ""; // Represent deletion with empty content
            changeTypeForStaging = "delete";
          } else {
            // modify
            const { content, start_line, end_line } = args;
            finalPatchedContent = applyLineChanges(
              originalContentForStaging,
              content,
              start_line,
              end_line
            );
            changeTypeForStaging = "modify";
          }
        }
        newPatch = createPatch(
          file_path,
          originalContentForStaging,
          finalPatchedContent as string,
          "",
          ""
        );
        incrementalStats = calculateStatsFromPatch(newPatch);
        cumulativeStats = incrementalStats;
      }

      // 2. Perform the actual file operation
      if (changeTypeForStaging === "delete") {
        await invoke("delete_file", {
          rootPathStr: rootPath,
          fileRelPath: file_path,
        });
      } else {
        await invoke("save_file_content", {
          rootPathStr: rootPath,
          fileRelPath: file_path,
          content: finalPatchedContent as string, // It won't be false here
        });
      }

      // 3. Calculate CUMULATIVE diff stats for staging panel
      // cumulativeStats already calculated above

      // 4. Stage the change for potential revert
      set((state) => {
        const newChanges = new Map(state.stagedFileChanges);
        newChanges.set(file_path, {
          originalContent: originalContentForStaging,
          patch: newPatch,
          changeType: changeTypeForStaging,
          stats: cumulativeStats, // Store cumulative stats in the staging area
        });
        return { stagedFileChanges: newChanges };
      });

      return {
        success: true,
        message: `Successfully applied and staged change for ${file_path}.`,
        incrementalStats, // Return incremental stats for chat UI
        cumulativeStats,
      };
    } catch (e) {
      return {
        success: false,
        message: `Error during file operation for ${file_path}: ${String(e)}`,
        incrementalStats: { added: 0, removed: 0 },
        cumulativeStats: { added: 0, removed: 0 },
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
  discardAllStagedChanges: async () => {
    const { rootPath, stagedFileChanges } = _get();
    if (!rootPath || stagedFileChanges.size === 0) return;

    const revertPromises: Promise<void>[] = [];

    // Create a list of all revert operations
    for (const [filePath, change] of stagedFileChanges.entries()) {
      if (change.changeType === "create") {
        revertPromises.push(
          invoke("delete_file", {
            rootPathStr: rootPath,
            fileRelPath: filePath,
          })
        );
      } else {
        // For both Modify and Delete, we write back the original content.
        // For a deleted file, originalContent exists and writing it back effectively undeletes it.
        revertPromises.push(
          invoke("save_file_content", {
            rootPathStr: rootPath,
            fileRelPath: filePath,
            content: change.originalContent ?? "",
          })
        );
      }
    }

    try {
      // Execute all revert operations concurrently
      await Promise.all(revertPromises);

      // If all reverts succeed, clear the staging map
      set({ stagedFileChanges: new Map() });

      // After reverting all files, rescan the project to update the UI correctly
      await _get().actions.rescanProject();
    } catch (e) {
      console.error("Failed to revert all changes:", e);
      await message(`Lỗi khi hủy bỏ tất cả các thay đổi: ${e}`, {
        title: "Lỗi Hủy Bỏ",
        kind: "error",
      });
    }
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

// Helper function to apply line-based changes to content
const applyLineChanges = (
  originalContent: string,
  newContent: string,
  startLine?: number,
  endLine?: number
): string => {
  if (!startLine) {
    return newContent; // Overwrite whole file
  }
  const originalLines = originalContent.split("\n");
  const newLines = newContent.split("\n");
  const startIndex = startLine - 1;
  // If endLine is not provided, it means we are replacing from start_line until the end of the new content.
  // If endLine is provided, it's a replacement of a specific range.
  const endIndex = endLine ? endLine : startIndex;
  originalLines.splice(startIndex, endIndex - startIndex, ...newLines);
  return originalLines.join("\n");
};

// Helper to calculate stats from a patch string
const calculateStatsFromPatch = (patch: string) => {
  let added = 0;
  let removed = 0;
  patch.split("\n").forEach((line) => {
    if (line.startsWith("+") && !line.startsWith("+++")) added++;
    if (line.startsWith("-") && !line.startsWith("---")) removed++;
  });
  return { added, removed };
};
