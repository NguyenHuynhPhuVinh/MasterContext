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

export interface ScanCompletePayload {
  projectData: CachedProjectData;
  isFirstScan: boolean;
}

export interface AppSettings {
  recentPaths: string[];
  nonAnalyzableExtensions?: string[];
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

export type GitLogState = "idle" | "loading_repo" | "loading_commits" | "error";
