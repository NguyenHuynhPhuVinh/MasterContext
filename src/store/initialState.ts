// src/store/initialState.ts
import { type GroupStats } from "./types";

export const defaultGroupStats = (): GroupStats => ({
  total_files: 0,
  total_dirs: 0,
  total_size: 0,
  token_count: 0,
});

export const initialState = {
  rootPath: null,
  selectedPath: null,
  allGroups: new Map(),
  groups: [],
  projectStats: null,
  fileTree: null,
  fileMetadataCache: null,
  activeScene: "dashboard" as "dashboard" | "settings",
  editingGroupId: null,
  inlineEditingGroup: null,
  isScanning: false,
  scanProgress: { currentFile: null },
  isUpdatingGroupId: null,
  tempSelectedPaths: null,
  isCrossLinkingEnabled: false,
  syncEnabled: false,
  syncPath: null,
  customIgnorePatterns: [],
  isWatchingFiles: false,
  exportUseFullTree: false,
  exportWithLineNumbers: true,
  alwaysApplyText: null,
  profiles: ["default"],
  activeProfile: "default",
  isSidebarVisible: true,
  recentPaths: [],
};

export type InitialState = typeof initialState;
