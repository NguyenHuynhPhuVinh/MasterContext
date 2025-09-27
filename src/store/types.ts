// src/store/types.ts

export interface CachedProjectData {
  stats: ProjectStats | null;
  file_tree: FileNode | null;
  groups: Group[];
  file_metadata_cache: Record<string, FileMetadata>;
  sync_enabled?: boolean | null;
  sync_path?: string | null;
  data_hash?: string | null;
  custom_ignore_patterns?: string[]; // <-- Sửa thành snake_case
  is_watching_files?: boolean | null; // <-- THÊM TRƯỜNG MỚI
  export_use_full_tree?: boolean | null; // <-- THÊM TRƯỜNG MỚI NÀY
  export_with_line_numbers?: boolean | null; // <-- THÊM TRƯỜNG MỚI
  export_without_comments?: boolean | null; // <-- THÊM TRƯỜNG MỚI
  export_remove_debug_logs?: boolean | null; // <-- THÊM TRƯỜNG MỚI
  export_super_compressed?: boolean | null;
  always_apply_text?: string | null;
  export_exclude_extensions?: string[];
  git_export_mode_is_context?: boolean | null;
}

export interface FileNode {
  name: string;
  path: string;
  children?: FileNode[] | null;
}

export interface GroupStats {
  total_files: number;
  total_dirs: number;
  total_size: number;
  token_count: number;
}

export interface FileMetadata {
  size: number;
  mtime: number;
  token_count: number;
  links: string[];
  excluded_ranges?: [number, number][];
}

export interface ProjectStats {
  total_files: number;
  total_dirs: number;
  total_size: number;
  total_tokens: number;
}

export interface ScanProgress {
  currentFile: string | null;
  currentPhase: "scanning" | "analyzing";
}

export interface Group {
  id: string;
  name: string;
  paths: string[];
  stats: GroupStats;
  crossSyncEnabled?: boolean;
  tokenLimit?: number; // <-- THÊM TRƯỜNG NÀY
}

export interface AIGroupUpdateResult {
  updatedGroup: Group;
  finalExpandedFiles: string[];
}

export interface ScanCompletePayload {
  projectData: CachedProjectData;
  isFirstScan: boolean;
}

export type AiChatMode = "ask" | "context" | "agent";

export interface AIModel {
  provider: "openrouter" | "google";
  id: string;
  name: string;
  context_length: number | null;
  pricing: {
    prompt: string;
    completion: string;
  };
}

export interface AppSettings {
  recentPaths: string[];
  nonAnalyzableExtensions?: string[];
  openRouterApiKey?: string;
  aiModels?: string[];
  googleApiKey?: string;
  streamResponse?: boolean;
  systemPrompt?: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  thinkingBudget?: number;
  reasoningEffort?: "low" | "medium" | "high";
  includeThoughts?: boolean;
}

export interface GitRepositoryInfo {
  isRepository: boolean;
  currentBranch: string | null;
  remoteUrl: string | null;
  currentSha: string | null;
  mainBranchHeadSha: string | null;
}

export interface GitCommit {
  sha: string;
  author: string;
  date: string;
  message: string;
}

export interface GitStatus {
  files: Record<string, string>; // path -> status code
}

export type GitLogState = "idle" | "loading_repo" | "loading_commits" | "error";

export interface GenerationInfo {
  tokens_prompt: number;
  tokens_completion: number;
  total_cost: number;
}

export interface AttachedItem {
  id: string; // file path, folder path, or group ID
  type: "file" | "folder" | "group";
  name: string; // display name
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string | null; // Allow null content for tool calls
  attachedFiles?: AttachedItem[]; // Files attached to this specific message
  hiddenContent?: string;
  reasoning?: string | null;
  generationInfo?: GenerationInfo;
  tool_calls?: ToolCall[]; // Add tool_calls
  hidden?: boolean; // For hidden user messages
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
  status?: "success" | "error"; // To track execution status for UI
  diffStats?: { added: number; removed: number };
}

export interface AIChatSessionHeader {
  id: string;
  title: string;
  createdAt: string; // ISO string from backend
}

export interface AIChatSession {
  id: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
  totalTokens?: number;
  totalCost?: number;
}

export interface AiFileActions {
  attachItemToAi: (item: AttachedItem) => void;
  detachItemFromAi: (itemId: string) => void;
  clearAttachedFilesFromAi: () => void;
}

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
  isCrossLinkingEnabled: boolean;
  isGroupEditorPanelVisible: boolean;
  isEditorPanelVisible: boolean;
  activeEditorFile: string | null;
  activeEditorFileContent: string | null;
  isEditorLoading: boolean;
  activeEditorFileExclusions: [number, number][] | null;
  stagedFileChanges: Map<
    string,
    {
      patch: string;
      stats: { added: number; removed: number };
      changeType: "create" | "modify" | "delete";
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
  thinkingBudget: number;
  reasoningEffort: "low" | "medium" | "high";
  includeThoughts: boolean;
  aiAttachedFiles: AttachedItem[];
}
