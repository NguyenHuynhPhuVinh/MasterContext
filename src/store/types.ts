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
}

export interface ProjectStats {
  total_files: number;
  total_dirs: number;
  total_size: number;
  total_tokens: number;
}

export interface ScanProgress {
  currentFile: string | null;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  paths: string[];
  stats: GroupStats;
  crossSyncEnabled?: boolean;
  tokenLimit?: number; // <-- THÊM TRƯỜNG NÀY
}
