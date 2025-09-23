// src-tauri/src/project_scanner.rs
use crate::dependency_analyzer;
use crate::group_updater;
use crate::models::{
    CachedProjectData, FileMetadata, FileNode, ProjectStats,
};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::{Emitter, Window};
use ignore::{overrides::OverrideBuilder, WalkBuilder};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use tiktoken_rs::cl100k_base;

pub fn perform_smart_scan_and_rebuild(
    window: &Window, // <-- THÊM THAM SỐ NÀY
    path: &str,
    old_data: CachedProjectData,
) -> Result<CachedProjectData, String> {
    let root_path = Path::new(path);
    let bpe = cl100k_base().map_err(|e| e.to_string())?;

    // Dữ liệu cũ giờ được truyền vào trực tiếp, không cần đọc từ file ở đây
    let old_metadata_cache = old_data.file_metadata_cache;

    let mut new_project_stats = ProjectStats::default();
    let mut new_metadata_cache = BTreeMap::new();
    let mut path_map = BTreeMap::new(); // Dùng để xây dựng cây thư mục
    
    let aliases = dependency_analyzer::parse_config_aliases(root_path);

    // --- CẬP NHẬT: Xây dựng bộ lọc loại trừ ---
    let override_builder = {
        let mut builder = OverrideBuilder::new(root_path);
        // Luôn bao gồm các file lock
        builder
            .add("!package-lock.json")
            .map_err(|e| e.to_string())?;
        builder.add("!Cargo.lock").map_err(|e| e.to_string())?;
        builder.add("!yarn.lock").map_err(|e| e.to_string())?;
        builder.add("!pnpm-lock.yaml").map_err(|e| e.to_string())?;
        
        // Thêm các mẫu loại trừ tùy chỉnh từ người dùng
        if let Some(patterns) = &old_data.custom_ignore_patterns {
            for pattern in patterns {
                // Thêm tiền tố '!' để chỉ định đây là mẫu LOẠI TRỪ
                let ignore_pattern = format!("!{}", pattern);
                builder.add(&ignore_pattern).map_err(|e| e.to_string())?;
            }
        }

        builder.build().map_err(|e| e.to_string())?
    };

    // --- BƯỚC 1: Quét một lần duy nhất và thu thập thông tin thô ---
    struct RawFileInfo {
        relative_path: PathBuf,
        metadata: std::fs::Metadata,
        content: Option<String>,
    }
    let mut raw_files: Vec<RawFileInfo> = Vec::new();
    let mut all_valid_files = HashSet::new();

    for entry in WalkBuilder::new(root_path)
        .overrides(override_builder.clone())
        .build()
        .filter_map(Result::ok)
    {
        let entry_path = entry.path();
        if let (Ok(relative_path), Ok(metadata)) =
            (entry_path.strip_prefix(root_path), entry.metadata())
        {
            if relative_path.as_os_str().is_empty() {
                continue;
            }

            // Bỏ qua việc gửi progress trong lần refactor này để đơn giản hóa

            // --- THÊM LẠI LOGIC GỬI PROGRESS ---
            // Gửi đường dẫn tương đối về cho frontend
            let _ = window.emit("scan_progress", relative_path.to_string_lossy());
            // --- KẾT THÚC THAY ĐỔI ---

            path_map.insert(entry_path.to_path_buf(), metadata.is_dir());

            if metadata.is_dir() {
                new_project_stats.total_dirs += 1;
            } else if metadata.is_file() {
                new_project_stats.total_files += 1;
                new_project_stats.total_size += metadata.len();

                let content = fs::read_to_string(entry_path).ok();
                raw_files.push(RawFileInfo {
                    relative_path: relative_path.to_path_buf(),
                    metadata,
                    content,
                });
                all_valid_files.insert(relative_path.to_string_lossy().replace("\\", "/"));
            }
        }
    }

    // --- BƯỚC 2: Xử lý thông tin thô để xây dựng metadata cache ---
    for file_info in raw_files {
        let relative_path_str = file_info.relative_path.to_string_lossy().replace("\\", "/");
        let current_mtime = file_info
            .metadata
            .modified()
            .map(|t| t.duration_since(UNIX_EPOCH).unwrap_or_default().as_secs())
            .unwrap_or(0);

        let mut token_count = 0;
        let mut links = Vec::new();

        if let Some(cached_meta) = old_metadata_cache.get(&relative_path_str) {
            if cached_meta.size == file_info.metadata.len() && cached_meta.mtime == current_mtime {
                token_count = cached_meta.token_count;
                links = cached_meta.links.clone();
            }
        }

        if token_count == 0 {
            // Nếu file mới/thay đổi, xử lý lại
            if let Some(content) = &file_info.content {
                // <-- Thêm & để borrow
                token_count = bpe.encode_with_special_tokens(content).len();

                links = dependency_analyzer::analyze_dependencies(
                    content,
                    &file_info.relative_path,
                    &all_valid_files,
                    &aliases,
                );
            }
        }

        new_project_stats.total_tokens += token_count;
        new_metadata_cache.insert(
            relative_path_str,
            FileMetadata {
                size: file_info.metadata.len(),
                mtime: current_mtime,
                token_count,
                links,
            },
        );
    }

    // --- BƯỚC 3: Xây dựng cây thư mục và cập nhật nhóm (giữ nguyên) ---
    fn build_tree_from_map(
        parent: &Path,
        path_map: &BTreeMap<PathBuf, bool>,
        root_path: &Path,
    ) -> Vec<FileNode> {
        let mut children = Vec::new();
        for (path, is_dir) in path_map.range(parent.join("")..) {
            if path.parent() == Some(parent) {
                let name = path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                let relative_path_str = path
                    .strip_prefix(root_path)
                    .unwrap()
                    .to_string_lossy()
                    .replace("\\", "/");
                children.push(FileNode {
                    name,
                    path: relative_path_str,
                    children: if *is_dir {
                        Some(build_tree_from_map(path, path_map, root_path))
                    } else {
                        None
                    },
                });
            }
        }
        children.sort_by(|a, b| {
            let a_is_dir = a.children.is_some();
            let b_is_dir = b.children.is_some();
            if a_is_dir != b_is_dir {
                b_is_dir.cmp(&a_is_dir)
            } else {
                a.name.cmp(&b.name)
            }
        });
        children
    }
    let root_children = build_tree_from_map(root_path, &path_map, root_path);
    let file_tree = FileNode {
        name: root_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        path: "".to_string(),
        children: Some(root_children),
    };

    let mut updated_groups = old_data.groups;
    group_updater::update_groups_after_scan(
        &mut updated_groups,
        &new_metadata_cache,
        &path_map,
        root_path,
    );

    // --- BƯỚC 4: Tính toán hash để theo dõi thay đổi ---
    let metadata_json = serde_json::to_string(&new_metadata_cache).unwrap_or_default();
    let mut hasher = Sha256::new();
    hasher.update(metadata_json.as_bytes());
    let hash_result = hasher.finalize();
    let data_hash = format!("{:x}", hash_result);

    let final_data = CachedProjectData {
        stats: new_project_stats,
        file_tree: Some(file_tree),
        groups: updated_groups,
        file_metadata_cache: new_metadata_cache,
        sync_enabled: old_data.sync_enabled, // Giữ lại cài đặt cũ
        sync_path: old_data.sync_path,       // Giữ lại cài đặt cũ
        data_hash: Some(data_hash),
        custom_ignore_patterns: old_data.custom_ignore_patterns, // Giữ lại cài đặt cũ
        is_watching_files: old_data.is_watching_files, // Giữ lại cài đặt cũ
        export_use_full_tree: old_data.export_use_full_tree, // Giữ lại cài đặt cũ
        export_with_line_numbers: old_data.export_with_line_numbers, // Giữ lại cài đặt cũ
        always_apply_text: old_data.always_apply_text,
    };

    // --- THAY ĐỔI: Trả về dữ liệu thay vì lưu và emit ---
    Ok(final_data)
}
