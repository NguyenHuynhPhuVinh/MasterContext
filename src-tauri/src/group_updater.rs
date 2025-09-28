// src-tauri/src/group_updater.rs
use crate::models::{FileMetadata, Group, GroupStats};
use std::collections::{BTreeMap, HashSet};
use std::path::{Path, PathBuf};

/// Cập nhật các nhóm sau khi quét, thực hiện đồng bộ chéo và tính toán lại stats.
pub fn update_groups_after_scan(
    groups: &mut Vec<Group>,
    new_metadata_cache: &BTreeMap<String, FileMetadata>,
    path_map: &BTreeMap<PathBuf, bool>,
    root_path: &Path,
) {
    for group in groups {
        // 1. Xóa các file/thư mục không còn tồn tại
        group.paths.retain(|p| {
            new_metadata_cache.contains_key(p)
                || path_map
                    .get(&root_path.join(p))
                    .map_or(false, |is_dir| *is_dir)
        });

        // 2. Luôn tính toán lại stats sau khi đã cập nhật `paths`
        group.stats = recalculate_stats_for_paths(&group.paths, new_metadata_cache, root_path);
    }
}

/// Tính toán lại stats cho một danh sách các đường dẫn dựa trên cache.
pub fn recalculate_stats_for_paths(
    paths: &[String],
    metadata_cache: &BTreeMap<String, FileMetadata>,
    _root_path: &Path,
) -> GroupStats {
    let mut stats = GroupStats::default();
    let mut all_files_in_group: HashSet<String> = HashSet::new();
    let mut all_dirs_in_group: HashSet<String> = HashSet::new();

    let all_cached_files: Vec<&String> = metadata_cache.keys().collect();

    for path_str in paths {
        if metadata_cache.contains_key(path_str) {
            all_files_in_group.insert(path_str.clone());
        }

        let dir_prefix = format!("{}/", path_str);
        if !path_str.is_empty() {
            all_dirs_in_group.insert(path_str.clone());
        }

        for &cached_file in &all_cached_files {
            if path_str.is_empty() {
                all_files_in_group.insert(cached_file.clone());
            } else if cached_file.starts_with(&dir_prefix) {
                all_files_in_group.insert(cached_file.clone());
            }
        }
    }

    let mut subdirs_from_files = HashSet::new();
    for file_path in &all_files_in_group {
        let mut current = Path::new(file_path);
        while let Some(parent) = current.parent() {
            if parent.as_os_str().is_empty() {
                break;
            }
            subdirs_from_files.insert(parent.to_string_lossy().replace("\\", "/"));
            current = parent;
        }
    }
    all_dirs_in_group.extend(subdirs_from_files);

    for file_path_str in &all_files_in_group {
        if let Some(meta) = metadata_cache.get(file_path_str) {
            stats.total_size += meta.size;
            stats.token_count += meta.token_count;
        }
    }

    stats.total_files = all_files_in_group.len() as u64;
    stats.total_dirs = all_dirs_in_group.len() as u64;

    stats
}