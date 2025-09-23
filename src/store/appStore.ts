// src/store/appStore.ts
import { create } from "zustand";
import {
  type FileNode,
  type ProjectStats,
  type ScanProgress,
  type Group,
  type FileMetadata,
} from "./types";
import { initialState } from "./initialState";
import {
  createProjectActions,
  type ProjectActions,
} from "./actions/projectActions";
import { createGroupActions, type GroupActions } from "./actions/groupActions";
import {
  createProfileActions,
  type ProfileActions,
} from "./actions/profileActions";
import {
  createSettingsActions,
  type SettingsActions,
} from "./actions/settingsActions";
import { createUIActions, type UIActions } from "./actions/uiActions";

export interface AppState {
  rootPath: string | null;
  selectedPath: string | null;
  allGroups: Map<string, Group[]>;
  groups: Group[]; // Derived state

  // Dữ liệu quét chung
  projectStats: ProjectStats | null;
  fileTree: FileNode | null;
  fileMetadataCache: Record<string, FileMetadata> | null;

  // State giao diện
  activeScene: "dashboard" | "settings";
  editingGroupId: string | null;
  inlineEditingGroup: {
    mode: "create" | "rename";
    profileName: string;
    groupId?: string;
  } | null;
  isScanning: boolean;
  scanProgress: ScanProgress;
  isUpdatingGroupId: string | null;
  tempSelectedPaths: Set<string> | null;
  isCrossLinkingEnabled: boolean;

  // Dữ liệu riêng của hồ sơ active
  syncEnabled: boolean;
  syncPath: string | null;
  customIgnorePatterns: string[];
  isWatchingFiles: boolean;
  exportUseFullTree: boolean;
  exportWithLineNumbers: boolean;
  exportWithoutComments: boolean;
  exportRemoveDebugLogs: boolean;
  alwaysApplyText: string | null;
  exportExcludeExtensions: string[];

  // Quản lý hồ sơ
  profiles: string[];
  activeProfile: string;
  isSidebarVisible: boolean;
  recentPaths: string[];
  nonAnalyzableExtensions: string[];

  actions: ProjectActions &
    GroupActions &
    ProfileActions &
    SettingsActions &
    UIActions;
}

export const useAppStore = create<AppState>()((set, get, store) => ({
  ...initialState,
  actions: {
    ...createProjectActions(set, get, store),
    ...createGroupActions(set, get, store),
    ...createProfileActions(set, get, store),
    ...createSettingsActions(set, get, store),
    ...createUIActions(set, get, store),
  },
}));

export const useAppActions = () => useAppStore((state) => state.actions);
