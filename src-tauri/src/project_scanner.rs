// src-tauri/src/project_scanner.rs
use crate::models::{CachedProjectData, FileMetadata, FileNode, GroupStats, ProjectStats};
use crate::file_cache;
use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::{Emitter, Window};
use ignore::{WalkBuilder, overrides::OverrideBuilder};
use tiktoken_rs::cl100k_base;

pub fn recalculate_stats_for_paths(
    paths: &[String],
    metadata_cache: &BTreeMap<String, FileMetadata>,
    root_path: &Path,
) -> GroupStats {
    let mut stats = GroupStats::default();
    let mut all_files_in_group: HashSet<String> = HashSet::new();
    let mut all_dirs_in_group: HashSet<String> = HashSet::new();

    // Mở rộng các đường dẫn tối thiểu thành một danh sách file đầy đủ
    for path_str in paths {
        // Trường hợp 1: Đường dẫn là một file cụ thể và tồn tại trong cache.
        if metadata_cache.contains_key(path_str) {
            all_files_in_group.insert(path_str.clone());
            continue;
        }
        
        // Trường hợp 2: Đường dẫn có thể là một thư mục.
        let full_path = root_path.join(path_str);
        if full_path.is_dir() {
            all_dirs_in_group.insert(path_str.clone());

            // === BẮT ĐẦU PHẦN SỬA LỖI QUAN TRỌNG ===
            // Thêm dấu "/" vào sau tên thư mục để đảm bảo so sánh chính xác.
            // Ví dụ: "src/" sẽ chỉ khớp với các file trong thư mục `src`,
            // mà không khớp với thư mục `src-tauri`.
            let dir_prefix = if path_str.is_empty() {
                // Xử lý trường hợp chọn toàn bộ dự án
                "".to_string()
            } else {
                format!("{}/", path_str)
            };

            for cached_path in metadata_cache.keys() {
                // Chỉ thêm các file có tiền tố là `dir_prefix`
                if path_str.is_empty() || cached_path.starts_with(&dir_prefix) {
                    all_files_in_group.insert(cached_path.clone());
                }
            }
            // === KẾT THÚC PHẦN SỬA LỖI QUAN TRỌNG ===

        } else {
            // Nếu đường dẫn không phải là thư mục, nó vẫn có thể là file (đã được xử lý ở trên).
            // Nếu nó không có trong cache và không phải là thư mục, ta bỏ qua một cách an toàn.
        }
    }

    // Dùng cache để suy ra các thư mục cha từ đường dẫn file
    let mut subdirs_from_files = HashSet::new();
    for file_path in &all_files_in_group {
        let mut current = Path::new(file_path);
        while let Some(parent) = current.parent() {
            if parent.as_os_str().is_empty() { break; }
            let parent_str = parent.to_string_lossy().replace("\\", "/");
            subdirs_from_files.insert(parent_str);
            current = parent;
        }
    }
    all_dirs_in_group.extend(subdirs_from_files);

    // Tính toán stats từ danh sách file đã mở rộng và cache
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

pub fn perform_smart_scan_and_rebuild(window: &Window, path: &str) -> Result<(), String> {
    let root_path = Path::new(path);
    let bpe = cl100k_base().map_err(|e| e.to_string())?;

    let old_data = file_cache::load_project_data(path).unwrap_or_default();
    let old_metadata_cache = old_data.file_metadata_cache;

    let mut new_project_stats = ProjectStats::default();
    let mut new_metadata_cache = BTreeMap::new();
    let mut path_map = BTreeMap::new();
    let mut existing_paths = HashSet::new();

    let override_builder = {
        let mut builder = OverrideBuilder::new(root_path);
        builder.add("!package-lock.json").map_err(|e| e.to_string())?;
        builder.add("!Cargo.lock").map_err(|e| e.to_string())?;
        builder.add("!yarn.lock").map_err(|e| e.to_string())?;
        builder.add("!pnpm-lock.yaml").map_err(|e| e.to_string())?;
        builder.build().map_err(|e| e.to_string())?
    };

    for entry in WalkBuilder::new(root_path).overrides(override_builder.clone()).build().filter_map(Result::ok) {
        let entry_path = entry.path();
        if let (Ok(relative_path), Ok(metadata)) = (entry_path.strip_prefix(root_path), entry.metadata()) {
            if relative_path.as_os_str().is_empty() { continue; }
            let relative_path_str = relative_path.to_string_lossy().replace("\\", "/");
            existing_paths.insert(relative_path_str.clone());
            let _ = window.emit("scan_progress", relative_path_str.clone());
            path_map.insert(entry_path.to_path_buf(), metadata.is_dir());

            if metadata.is_dir() {
                new_project_stats.total_dirs += 1;
            } else if metadata.is_file() {
                new_project_stats.total_files += 1;
                new_project_stats.total_size += metadata.len();
                let current_mtime = metadata.modified()
                    .map(|t| t.duration_since(UNIX_EPOCH).unwrap_or_default().as_secs())
                    .unwrap_or(0);
                let mut token_count = 0;
                if let Some(cached_meta) = old_metadata_cache.get(&relative_path_str) {
                    if cached_meta.size == metadata.len() && cached_meta.mtime == current_mtime {
                        token_count = cached_meta.token_count;
                    }
                }
                if token_count == 0 {
                    if let Ok(content) = fs::read_to_string(entry_path) {
                        token_count = bpe.encode_with_special_tokens(&content).len();
                    }
                }
                new_project_stats.total_tokens += token_count;
                new_metadata_cache.insert(relative_path_str, FileMetadata {
                    size: metadata.len(),
                    mtime: current_mtime,
                    token_count,
                });
            }
        }
    }

    fn build_tree_from_map(parent: &Path, path_map: &BTreeMap<PathBuf, bool>, root_path: &Path) -> Vec<FileNode> {
        let mut children = Vec::new();
        for (path, is_dir) in path_map.range(parent.join("")..) {
            if path.parent() == Some(parent) {
                let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                let relative_path_str = path.strip_prefix(root_path).unwrap().to_string_lossy().replace("\\", "/");
                children.push(FileNode {
                    name,
                    path: relative_path_str,
                    children: if *is_dir { Some(build_tree_from_map(path, path_map, root_path)) } else { None },
                });
            }
        }
        children.sort_by(|a, b| {
            let a_is_dir = a.children.is_some(); let b_is_dir = b.children.is_some();
            if a_is_dir != b_is_dir { b_is_dir.cmp(&a_is_dir) } else { a.name.cmp(&b.name) }
        });
        children
    }
    let root_children = build_tree_from_map(root_path, &path_map, root_path);
    let file_tree = FileNode {
        name: root_path.file_name().unwrap_or_default().to_string_lossy().to_string(),
        path: "".to_string(),
        children: Some(root_children),
    };

    let mut updated_groups = old_data.groups;
    for group in &mut updated_groups {
        group.paths.retain(|path| existing_paths.contains(path));
        group.stats = recalculate_stats_for_paths(&group.paths, &new_metadata_cache, root_path);
    }

    let final_data = CachedProjectData {
        stats: new_project_stats,
        file_tree: Some(file_tree),
        groups: updated_groups,
        file_metadata_cache: new_metadata_cache,
    };

    file_cache::save_project_data(path, &final_data).map_err(|e| e.to_string())?;
    let _ = window.emit("scan_complete", &final_data);

    Ok(())
}