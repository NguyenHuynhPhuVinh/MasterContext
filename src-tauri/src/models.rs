// src-tauri/src/models.rs
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

// --- THÊM CÁC STRUCT MỚI Ở ĐẦU FILE ---
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TsConfig {
    pub compiler_options: Option<CompilerOptions>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CompilerOptions {
    pub base_url: Option<String>,
    pub paths: Option<BTreeMap<String, Vec<String>>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitRepositoryInfo {
    pub is_repository: bool,
    pub current_branch: Option<String>,
    pub remote_url: Option<String>,
    pub current_sha: Option<String>,
    pub main_branch_head_sha: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitCommit {
    pub sha: String,
    pub author: String,
    pub date: String,
    pub message: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub files: BTreeMap<String, String>, // Path -> Status Code (e.g., "M", "A", "D")
}

// --- STRUCTS FOR AI CHAT & TOOL CALLING ---
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ToolCallFunction {
    pub name: String,
    pub arguments: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ToolCall {
    pub id: String,
    // `type` is a reserved keyword in Rust, so we use `r#`
    pub r#type: String,
    pub function: ToolCallFunction,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct GenerationInfo {
    #[serde(default)]
    pub tokens_prompt: u32,
    #[serde(default)]
    pub tokens_completion: u32,
    #[serde(default)]
    pub total_cost: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub role: String, // "user" | "assistant" | "system"
    pub content: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(default)] // Dành cho khả năng tương thích ngược
    pub generation_info: Option<GenerationInfo>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AIChatSession {
    pub id: String,
    pub title: String,
    pub created_at: DateTime<Utc>,
    pub messages: Vec<ChatMessage>,
    #[serde(default)] // Dành cho khả năng tương thích ngược
    pub total_tokens: Option<u32>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AIChatSessionHeader {
    pub id: String,
    pub title: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub recent_paths: Vec<String>,
    pub non_analyzable_extensions: Option<Vec<String>>,
    pub open_router_api_key: Option<String>,
    pub ai_models: Option<Vec<String>>,
    pub stream_response: Option<bool>,
    pub system_prompt: Option<String>,
    pub temperature: Option<f64>,
    pub top_p: Option<f64>,
    pub top_k: Option<u32>,
    pub max_tokens: Option<u32>,
}
// --- KẾT THÚC PHẦN THÊM MỚI ---

#[derive(Serialize, Deserialize, Debug, Default, Clone, Copy)]
pub struct GroupStats {
    pub total_files: u64,
    pub total_dirs: u64,
    pub total_size: u64,
    pub token_count: usize,
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct ProjectStats {
    pub total_files: u64,
    pub total_dirs: u64,
    pub total_size: u64,
    pub total_tokens: usize,
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub children: Option<Vec<FileNode>>,
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Group {
    pub id: String,
    pub name: String,
    pub paths: Vec<String>,
    pub stats: GroupStats,
    pub cross_sync_enabled: Option<bool>,
    pub token_limit: Option<usize>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileMetadata {
    pub size: u64,
    pub mtime: u64,
    pub token_count: usize,
    pub links: Vec<String>,
    pub excluded_ranges: Option<Vec<(usize, usize)>>,
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct CachedProjectData {
    pub stats: ProjectStats,
    pub file_tree: Option<FileNode>,
    pub groups: Vec<Group>,
    pub file_metadata_cache: BTreeMap<String, FileMetadata>,
    pub sync_enabled: Option<bool>,
    pub sync_path: Option<String>,
    pub data_hash: Option<String>,
    pub custom_ignore_patterns: Option<Vec<String>>, // <-- THÊM TRƯỜNG NÀY
    pub is_watching_files: Option<bool>, // <-- THÊM TRƯỜNG MỚI
    pub export_use_full_tree: Option<bool>, // <-- THÊM TRƯỜNG MỚI NÀY
    pub export_with_line_numbers: Option<bool>, // <-- THÊM TRƯỜNG MỚI
    pub export_without_comments: Option<bool>, // <-- THÊM TRƯỜNG MỚI
    pub export_remove_debug_logs: Option<bool>, // <-- THÊM TRƯỜNG MỚI
    pub export_super_compressed: Option<bool>,
    pub always_apply_text: Option<String>,
    pub export_exclude_extensions: Option<Vec<String>>,
    pub git_export_mode_is_context: Option<bool>,
}

#[derive(Debug, Clone)]
pub enum FsEntry {
    File,
    Directory(BTreeMap<String, FsEntry>),
}
