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
  type AiChatMode,
  type AIModel,
  type AIChatSessionHeader,
  type AIChatSession,
  type AttachedItem,
  type ChatMessage,
  type AiFileActions,
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
import {
  createAiSettingsActions,
  type AiSettingsActions,
} from "./actions/aiActions";
import {
  createAiChatActions,
  type AiChatActions,
} from "./actions/aiChatActions";
import {
  createAiSessionActions,
  type AiSessionActions,
} from "./actions/aiSessionActions";

import { createAiFileActions } from "./actions/aiFileActions";

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
  isRescanning: boolean;
  scanProgress: ScanProgress;
  isUpdatingGroupId: string | null;
  tempSelectedPaths: Set<string> | null;
  isGroupEditorPanelVisible: boolean;
  isEditorPanelVisible: boolean;
  activeEditorFile: string | null;
  activeEditorFileContent: string | null;
  isEditorLoading: boolean;
  activeEditorFileExclusions: [number, number][] | null;
  stagedFileChanges: Map<
    string,
    {
      originalContent: string | null; // The content before ANY staged changes
      patch: string; // The cumulative patch from the original content
      changeType: "create" | "modify" | "delete";
      stats: { added: number; removed: number };
    }
  >; // filePath -> { patch, stats, changeType }

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

  // AI Panel
  isAiPanelVisible: boolean;
  aiChatMode: AiChatMode;
  openRouterApiKey: string;
  googleApiKey: string;
  allAvailableModels: AIModel[];
  aiModels: AIModel[];
  chatMessages: ChatMessage[];
  isAiPanelLoading: boolean;
  chatSessions: AIChatSessionHeader[];
  activeChatSessionId: string | null;
  abortController: AbortController | null;
  activeChatSession: AIChatSession | null;
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  systemPrompt: string;
  streamResponse: boolean;
  selectedAiModel: string;
  editingMessageIndex: number | null;
  aiAttachedFiles: AttachedItem[];

  actions: ProjectActions &
    GroupActions &
    ProfileActions &
    SettingsActions &
    UIActions &
    GitActions &
    AiSettingsActions &
    AiChatActions &
    AiSessionActions &
    AiFileActions;
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
    ...createAiSettingsActions(set, get, store),
    ...createAiChatActions(set, get, store),
    ...createAiSessionActions(set, get, store),
    ...createAiFileActions(set, get, store),
  },
}));

export const useAppActions = () => useAppStore((state) => state.actions);
