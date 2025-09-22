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
use regex::Regex;
use lazy_static::lazy_static;
use path_clean::PathClean;

pub fn recalculate_stats_for_paths(
    paths: &[String],
    metadata_cache: &BTreeMap<String, FileMetadata>,
    _root_path: &Path, // _root_path không còn cần thiết
) -> GroupStats {
    let mut stats = GroupStats::default();
    let mut all_files_in_group: HashSet<String> = HashSet::new();
    let mut all_dirs_in_group: HashSet<String> = HashSet::new();

    let all_cached_files: Vec<&String> = metadata_cache.keys().collect();

    // Mở rộng các đường dẫn tối thiểu thành một danh sách file đầy đủ
    for path_str in paths {
        // Xử lý trường hợp đường dẫn là MỘT FILE
        if metadata_cache.contains_key(path_str) {
            all_files_in_group.insert(path_str.clone());
        }

        // Xử lý trường hợp đường dẫn là MỘT THƯ MỤC
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

// --- THÊM KHỐI MÃ NÀY ---
// Biên dịch các regex một lần duy nhất để tăng hiệu suất
lazy_static! {
    static ref IMPORT_EXPORT_REGEX: Regex = Regex::new(
        r#"(?m)^.*(?:import|export)\s+.*?\s+from\s+['"](?P<path>.*?)['"];?|require\(['"](?P<path2>.*?)['"]\)"#
    ).unwrap();
}

// --- THÊM HÀM HELPER NÀY ---
fn resolve_link(
    current_file_path: &Path,
    link_path_str: &str,
    all_project_files: &HashSet<String>
) -> Option<String> {
    // Bỏ qua các package từ node_modules (không bắt đầu bằng '.' hoặc '/')
    if !link_path_str.starts_with('.') && !link_path_str.starts_with('/') {
        return None;
    }

    let current_dir = current_file_path.parent().unwrap_or_else(|| Path::new(""));
    let resolved_path = current_dir.join(link_path_str);
    
    // Chuẩn hóa đường dẫn (ví dụ: a/b/../c -> a/c)
    let cleaned_path = resolved_path.clean();
    let cleaned_path_str = cleaned_path.to_string_lossy().replace("\\", "/");

    // Thử tìm file với các extension phổ biến
    let extensions = ["", ".ts", ".tsx", ".js", ".jsx", ".json"];
    for ext in extensions.iter() {
        let potential_path = format!("{}{}", cleaned_path_str, ext);
        if all_project_files.contains(&potential_path) {
            return Some(potential_path);
        }
        // Thử trường hợp index file (ví dụ: ./components -> ./components/index.ts)
        let potential_index_path = format!("{}/index{}", cleaned_path_str, ext);
        if all_project_files.contains(&potential_index_path) {
            return Some(potential_index_path);
        }
    }

    None
}

pub fn perform_smart_scan_and_rebuild(window: &Window, path: &str) -> Result<(), String> {
    let root_path = Path::new(path);
    let bpe = cl100k_base().map_err(|e| e.to_string())?;

    let old_data = file_cache::load_project_data(path).unwrap_or_default();
    let old_metadata_cache = old_data.file_metadata_cache;

    let mut new_project_stats = ProjectStats::default();
    let mut new_metadata_cache = BTreeMap::new();
    let mut path_map = BTreeMap::new();

    let override_builder = {
        let mut builder = OverrideBuilder::new(root_path);
        builder.add("!package-lock.json").map_err(|e| e.to_string())?;
        builder.add("!Cargo.lock").map_err(|e| e.to_string())?;
        builder.add("!yarn.lock").map_err(|e| e.to_string())?;
        builder.add("!pnpm-lock.yaml").map_err(|e| e.to_string())?;
        builder.build().map_err(|e| e.to_string())?
    };

    // --- THAY ĐỔI: Quét 2 lần. Lần 1 để lấy tất cả đường dẫn file ---
    let mut all_project_files = HashSet::new();
    for entry in WalkBuilder::new(root_path).build().filter_map(Result::ok) {
        if let Ok(relative_path) = entry.path().strip_prefix(root_path) {
            if entry.metadata().map(|m| m.is_file()).unwrap_or(false) {
                 all_project_files.insert(relative_path.to_string_lossy().replace("\\", "/"));
            }
        }
    }

    // Lần 2: Quét lại để xử lý metadata và liên kết
    let mut existing_paths = HashSet::new();
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
                let mut links = Vec::new(); // <-- Biến lưu trữ links

                if let Some(cached_meta) = old_metadata_cache.get(&relative_path_str) {
                    if cached_meta.size == metadata.len() && cached_meta.mtime == current_mtime {
                        token_count = cached_meta.token_count;
                        links = cached_meta.links.clone(); // <-- Lấy links từ cache
                    }
                }

                if token_count == 0 { // Nếu file mới hoặc đã thay đổi, quét lại
                    if let Ok(content) = fs::read_to_string(entry_path) {
                        token_count = bpe.encode_with_special_tokens(&content).len();
                        
                        // --- THÊM MỚI: Trích xuất liên kết ---
                        let mut found_links = HashSet::new();
                        for cap in IMPORT_EXPORT_REGEX.captures_iter(&content) {
                            let link_path = cap.name("path").or_else(|| cap.name("path2")).map(|m| m.as_str());
                            if let Some(link_path) = link_path {
                                if let Some(resolved) = resolve_link(relative_path, link_path, &all_project_files) {
                                    found_links.insert(resolved);
                                }
                            }
                        }
                        links = found_links.into_iter().collect();
                        // --- KẾT THÚC PHẦN MỚI ---
                    }
                }

                new_project_stats.total_tokens += token_count;
                new_metadata_cache.insert(relative_path_str, FileMetadata {
                    size: metadata.len(),
                    mtime: current_mtime,
                    token_count,
                    links, // <-- Lưu links vào metadata
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