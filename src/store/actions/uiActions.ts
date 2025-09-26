// src/store/actions/uiActions.ts
import { StateCreator } from "zustand";
import { applyPatch, parsePatch } from "diff";
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
  applyVirtualPatch: (filePath: string, diff: string) => Promise<void>;
  discardVirtualPatch: (filePath: string) => void;
  applyPatchToRealFile: () => Promise<void>;
  applyMultiFilePatch: (multiDiff: string) => Promise<void>;
  clearAllVirtualPatches: () => void;
  applyAllPatchesToRealFiles: () => Promise<void>;
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
  applyVirtualPatch: async (filePath, diff) => {
    const { rootPath } = _get();
    if (!rootPath) return;

    try {
      // Lấy nội dung gốc của file cần vá lỗi trực tiếp từ backend
      const originalContent = await invoke<string>("get_file_content", {
        rootPathStr: rootPath,
        fileRelPath: filePath,
      });

      // Test the patch first
      const patched = applyPatch(originalContent, diff);
      if (patched === false) {
        // This case handles logical failures, e.g., hunk doesn't match
        await message(i18n.t("diffModal.invalidFormatError"), {
          title: "Error",
          kind: "error",
        });
        return;
      }

      set((state) => {
        const newPatches = new Map(state.virtualPatches);
        newPatches.set(filePath, diff);
        return { virtualPatches: newPatches };
      });
    } catch (e) {
      // This catches parsing errors or file read errors
      console.error("Failed to apply patch:", e);
      await message(i18n.t("diffModal.invalidFormatError"), {
        title: "Error",
        kind: "error",
      });
    }
  },
  discardVirtualPatch: (filePath) => {
    set((state) => {
      const newPatches = new Map(state.virtualPatches);
      newPatches.delete(filePath);
      return { virtualPatches: newPatches };
    });
  },
  applyPatchToRealFile: async () => {
    const { rootPath, activeEditorFile, virtualPatches, activeProfile } =
      _get();
    if (!rootPath || !activeEditorFile || !activeProfile) return;

    const patch = virtualPatches.get(activeEditorFile);
    if (!patch) return;

    try {
      const originalContent = await invoke<string>("get_file_content", {
        rootPathStr: rootPath,
        fileRelPath: activeEditorFile,
      });

      const newContent = applyPatch(originalContent, patch);
      if (newContent === false) {
        throw new Error("Patch could not be applied logically.");
      }

      await invoke("save_file_content", {
        rootPathStr: rootPath,
        fileRelPath: activeEditorFile,
        content: newContent,
      });

      // If successful, remove the virtual patch
      _get().actions.discardVirtualPatch(activeEditorFile);
    } catch (e) {
      console.error("Failed to apply patch to real file:", e);
      message(i18n.t("errors.fileSaveFailed", { error: e }), {
        title: i18n.t("common.error"),
        kind: "error",
      });
    }
  },
  applyMultiFilePatch: async (multiDiff: string) => {
    try {
      const patches = parsePatch(multiDiff);
      if (patches.length === 0) {
        throw new Error("No valid patch found in the provided text.");
      }

      // To add multiple patches, we need to reconstruct the individual diff strings
      // as the library doesn't expose them directly after parsing.
      const diffBlocks = multiDiff.split(/^--- a\//gm).slice(1);

      if (diffBlocks.length !== patches.length) {
        // Fallback or more robust parsing might be needed for complex cases,
        // but this handles standard `git diff` output well.
        console.warn(
          "Mismatch between parsed patches and split blocks. The diff might have an unusual format."
        );
      }

      set((state) => {
        const newPatches = new Map(state.virtualPatches);
        patches.forEach((patch, index) => {
          const filePath = patch.newFileName;
          const diffContent = "--- a/" + diffBlocks[index];
          if (filePath) {
            newPatches.set(filePath, diffContent);
          }
        });
        return { virtualPatches: newPatches };
      });

      await message(
        i18n.t("multiDiffModal.appliedSuccess", { count: patches.length }),
        { title: i18n.t("common.success"), kind: "info" }
      );
    } catch (e) {
      console.error("Failed to parse multi-file patch:", e);
      await message(i18n.t("diffModal.invalidFormatError"), {
        title: i18n.t("common.error"),
        kind: "error",
      });
    }
  },
  clearAllVirtualPatches: () => {
    set({ virtualPatches: new Map() });
  },
  applyAllPatchesToRealFiles: async () => {
    const { rootPath, virtualPatches } = _get();
    if (!rootPath || virtualPatches.size === 0) return;

    const updates = new Map<string, string>();
    const filePaths = Array.from(virtualPatches.keys());

    try {
      const promises = filePaths.map((path) =>
        invoke<string>("get_file_content", {
          rootPathStr: rootPath,
          fileRelPath: path,
        })
      );
      const originalContents = await Promise.all(promises);

      for (let i = 0; i < filePaths.length; i++) {
        const path = filePaths[i];
        const content = originalContents[i];
        const patch = virtualPatches.get(path)!;
        const newContent = applyPatch(content, patch);
        if (newContent === false) {
          throw new Error(`Failed to apply patch for file: ${path}`);
        }
        updates.set(path, newContent);
      }

      await invoke("apply_batch_update", {
        rootPathStr: rootPath,
        updates: Object.fromEntries(updates),
      });

      _get().actions.clearAllVirtualPatches();
    } catch (e) {
      console.error("Failed during batch apply:", e);
      await message(`Error applying patches to files: ${e}`, {
        title: "Error",
        kind: "error",
      });
    }
  },
});
