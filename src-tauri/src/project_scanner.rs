// src-tauri/src/project_scanner.rs
use crate::group_updater;
use crate::models::{
    CachedProjectData, FileMetadata, FileNode, ProjectStats,
};
use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{mpsc, Arc};
use std::thread;
use std::time::UNIX_EPOCH;
use ignore::{overrides::OverrideBuilder, WalkBuilder};
use sha2::{Digest, Sha256};
use tiktoken_rs::cl100k_base;
use tauri::{Emitter, Window};
use lazy_static::lazy_static;
use num_cpus;

lazy_static! {
    // Define sets for files/extensions to skip during content analysis.
    // These files will still be listed, but we won't read their content,
    // count tokens, or analyze dependencies, saving significant time.
    
    static ref NON_ANALYZABLE_FILENAMES: HashSet<String> = [
        "Cargo.lock", "yarn.lock", "pnpm-lock.yaml",
    ].iter().map(|s| s.to_string()).collect();
}

pub struct ScanOptions {
    pub user_non_analyzable_extensions: Option<Vec<String>>,
}

pub fn perform_smart_scan_and_rebuild(
    window: &Window, // <-- THÊM THAM SỐ NÀY
    path: &str,
    old_data: CachedProjectData,
    options: ScanOptions,
) -> Result<(CachedProjectData, bool), String> {
    let root_path = Path::new(path);
    let bpe = Arc::new(cl100k_base().map_err(|e| e.to_string())?);

    // Dữ liệu cũ giờ được truyền vào trực tiếp, không cần đọc từ file ở đây
    // --- PHÁT HIỆN LẦN QUÉT ĐẦU TIÊN ---
    let is_first_scan = old_data.file_metadata_cache.is_empty();
    let old_metadata_cache = Arc::new(old_data.file_metadata_cache);

    let mut new_project_stats = ProjectStats::default();
    let mut new_metadata_cache = BTreeMap::new();
    let mut path_map = BTreeMap::new(); // Dùng để xây dựng cây thư mục

    // --- CHỈ SỬ DỤNG CÀI ĐẶT CỦA NGƯỜI DÙNG ---
    let final_non_analyzable_extensions: HashSet<String> = options
        .user_non_analyzable_extensions
        .unwrap_or_default()
        .into_iter()
        .collect();
    // --- KẾT THÚC THAY ĐỔI ---
    
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

    // --- BƯỚC 1: Quét nhanh để lấy danh sách file và cấu trúc thư mục ---
    // Điều này cần thiết để dependency analyzer có thể hoạt động chính xác.
    let mut files_to_process: Vec<(PathBuf, std::fs::Metadata)> = Vec::new();
    let mut all_valid_files = Arc::new(HashSet::new());

    for entry in WalkBuilder::new(root_path)
        .overrides(override_builder.clone())
        .build()
        .filter_map(Result::ok)
    {
        if let Ok(metadata) = entry.metadata() {
            let entry_path = entry.into_path();
            path_map.insert(entry_path.clone(), metadata.is_dir());

            if metadata.is_file() {
                if let Ok(relative_path) = entry_path.strip_prefix(root_path) {
                    let relative_path_str = relative_path.to_string_lossy().to_string().replace("\\", "/");
                    let _ = window.emit("scan_progress", &relative_path_str);
                    files_to_process.push((entry_path, metadata));
                    Arc::get_mut(&mut all_valid_files)
                        .unwrap()
                        .insert(relative_path_str);
                }
            }
        }
    }
    
    new_project_stats.total_files = files_to_process.len() as u64;
    new_project_stats.total_dirs = path_map.values().filter(|&&is_dir| is_dir).count() as u64;

    // --- BƯỚC 2: Phân tích file song song ---
    let num_workers = num_cpus::get();
    let (tx, rx) = mpsc::channel::<(String, FileMetadata)>();

    let mut worker_handles = Vec::new();

    let files_iter = files_to_process.into_iter();

    let (job_tx, job_rx) = mpsc::channel::<(PathBuf, std::fs::Metadata)>();
    let job_rx = Arc::new(std::sync::Mutex::new(job_rx));

    for _ in 0..num_workers {
        let rx = Arc::clone(&job_rx);
        let tx = tx.clone();
        let root_path = root_path.to_path_buf();
        let old_metadata_cache = Arc::clone(&old_metadata_cache);
        let bpe = Arc::clone(&bpe);
        let window = window.clone();
        let final_non_analyzable_extensions = final_non_analyzable_extensions.clone();

        let handle = thread::spawn(move || {
            while let Ok((absolute_path, metadata)) = rx.lock().unwrap().recv() {
                let relative_path = absolute_path.strip_prefix(&root_path).unwrap().to_path_buf();
                let _ = window.emit("analysis_progress", relative_path.to_string_lossy());

                let relative_path_str = relative_path.to_string_lossy().replace("\\", "/");

                let filename = relative_path.file_name().and_then(|s| s.to_str()).unwrap_or("");
                let extension = relative_path.extension().and_then(|s| s.to_str()).unwrap_or("");

                let should_skip_analysis = NON_ANALYZABLE_FILENAMES.contains(filename) 
                    || final_non_analyzable_extensions.contains(extension);

                let current_mtime = metadata
                    .modified()
                    .map(|t| t.duration_since(UNIX_EPOCH).unwrap_or_default().as_secs())
                    .unwrap_or(0);

                let mut token_count = 0;
                let mut excluded_ranges = None;

                // Kiểm tra cache trước
                if let Some(cached_meta) = old_metadata_cache.get(&relative_path_str) {
                    if cached_meta.size == metadata.len() && cached_meta.mtime == current_mtime {
                        token_count = cached_meta.token_count;
                        excluded_ranges = cached_meta.excluded_ranges.clone();
                    }
                }

                // If not cached (or changed) AND it's an analyzable file type, perform analysis.
                if token_count == 0 && !should_skip_analysis {
                    if let Ok(content) = fs::read_to_string(&absolute_path) {
                        token_count = bpe.encode_with_special_tokens(&content).len();
                    }
                }

                let file_meta = FileMetadata {
                    size: metadata.len(),
                    mtime: current_mtime,
                    token_count,
                    excluded_ranges,
                };

                tx.send((relative_path_str, file_meta)).unwrap();
            }
        });
        worker_handles.push(handle);
    }

    let num_jobs = files_iter.len();
    for job in files_iter {
        job_tx.send(job).unwrap();
    }
    drop(job_tx); // Quan trọng: Đóng sender để worker biết khi nào dừng

    // --- BƯỚC 3: Thu thập kết quả từ các worker ---
    for _ in 0..num_jobs {
        let (relative_path_str, meta) = rx.recv().unwrap();
        new_project_stats.total_size += meta.size;
        new_project_stats.total_tokens += meta.token_count;
        new_metadata_cache.insert(relative_path_str, meta);
    }

    for handle in worker_handles {
        handle.join().unwrap();
    }

    // --- BƯỚC 4: Xây dựng cây thư mục và cập nhật nhóm (giữ nguyên) ---
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

    // --- BƯỚC 5: Tính toán hash để theo dõi thay đổi ---
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
        export_without_comments: old_data.export_without_comments, // Giữ lại cài đặt cũ
        export_remove_debug_logs: old_data.export_remove_debug_logs, // Giữ lại cài đặt cũ
        export_super_compressed: old_data.export_super_compressed,
        always_apply_text: old_data.always_apply_text,
        export_exclude_extensions: old_data.export_exclude_extensions,
        git_export_mode_is_context: old_data.git_export_mode_is_context,
    };

    // --- THAY ĐỔI: Trả về dữ liệu thay vì lưu và emit ---
    Ok((final_data, is_first_scan))
}
