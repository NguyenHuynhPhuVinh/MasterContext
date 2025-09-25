// src/store/actions/uiActions.ts
import { StateCreator } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { AppState } from "../appStore";

export interface UIActions {
  reset: () => void;
  showDashboard: () => void;
  showSettingsScene: () => void;
  toggleProjectPanelVisibility: () => void;
  toggleGitPanelVisibility: () => void;
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
    });

    try {
      const content = await invoke<string>("get_file_content", {
        rootPathStr: rootPath,
        fileRelPath: filePath,
      });
      set({ activeEditorFileContent: content, isEditorLoading: false });
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
    });
  },
});
