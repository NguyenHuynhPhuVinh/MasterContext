// src-tauri/src/models.rs
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

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
pub struct Group {
    pub id: String,
    pub name: String,
    pub description: String,
    pub paths: Vec<String>,
    pub stats: GroupStats,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileMetadata {
    pub size: u64,
    pub mtime: u64,
    pub token_count: usize,
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct CachedProjectData {
    pub stats: ProjectStats,
    pub file_tree: Option<FileNode>,
    pub groups: Vec<Group>,
    pub file_metadata_cache: BTreeMap<String, FileMetadata>,
}

#[derive(Debug, Clone)]
pub enum FsEntry {
    File,
    Directory(BTreeMap<String, FsEntry>),
}