// src/store/appStore.ts
import { create } from "zustand";
import {
  type FileNode,
  type ProjectStats,
  type ScanProgress,
  type Group,
  type FileMetadata,
  type GitRepositoryInfo,
  type GitCommit,
  type GitStatus,
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
import { createGitActions, type GitActions } from "./actions/gitActions";

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
  activeScene: "dashboard" | "settings"; // Deprecated by activeView
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
  isGroupEditorPanelVisible: boolean;
  isEditorPanelVisible: boolean;
  activeEditorFile: string | null;
  activeEditorFileContent: string | null;
  isEditorLoading: boolean;
  activeEditorFileExclusions: [number, number][] | null;
  virtualPatches: Map<string, string>; // filePath -> diff string

  // Dữ liệu riêng của hồ sơ active
  syncEnabled: boolean;
  syncPath: string | null;
  customIgnorePatterns: string[];
  isWatchingFiles: boolean;
  exportUseFullTree: boolean;
  exportWithLineNumbers: boolean;
  exportWithoutComments: boolean;
  exportRemoveDebugLogs: boolean;
  exportSuperCompressed: boolean;
  alwaysApplyText: string | null;
  exportExcludeExtensions: string[];
  gitExportModeIsContext: boolean;

  // Quản lý hồ sơ
  profiles: string[];
  activeProfile: string;
  isSidebarVisible: boolean;
  recentPaths: string[];
  nonAnalyzableExtensions: string[];

  // Git Panel
  isGitPanelVisible: boolean;
  gitRepoInfo: GitRepositoryInfo | null;
  gitStatus: GitStatus | null;
  gitCommits: GitCommit[];
  gitLogState: "idle" | "loading_repo" | "loading_commits" | "error";
  gitCurrentPage: number;
  hasMoreCommits: boolean;
  originalGitBranch: string | null; // <-- THÊM STATE MỚI

  actions: ProjectActions &
    GroupActions &
    ProfileActions &
    SettingsActions &
    UIActions &
    GitActions;
}

export const useAppStore = create<AppState>()((set, get, store) => ({
  ...initialState,
  actions: {
    ...createProjectActions(set, get, store),
    ...createGroupActions(set, get, store),
    ...createProfileActions(set, get, store),
    ...createSettingsActions(set, get, store),
    ...createUIActions(set, get, store),
    ...createGitActions(set, get, store),
  },
}));

export const useAppActions = () => useAppStore((state) => state.actions);
