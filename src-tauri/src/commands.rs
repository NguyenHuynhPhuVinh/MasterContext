// src-tauri/src/commands.rs
use crate::{models, file_cache, project_scanner, context_generator};
use tauri::{command, Window, Emitter}; // Bỏ AppHandle khỏi use list vì không cần nữa
use std::path::Path;

#[command]
pub fn open_project(window: Window, path: String) {
    std::thread::spawn(move || {
        // Gọi hàm không cần app_handle
        if let Err(e) = project_scanner::perform_smart_scan_and_rebuild(&window, &path) {
            let _ = window.emit("scan_error", e);
        }
    });
}

#[command]
// Bỏ _app_handle không cần thiết
pub fn update_groups_in_project_data(path: String, groups: Vec<models::Group>) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&path)?;
    project_data.groups = groups;
    file_cache::save_project_data(&path, &project_data)
}

#[command]
// Bỏ _app_handle không cần thiết
pub fn calculate_group_stats_from_cache(root_path_str: String, paths: Vec<String>) -> Result<models::GroupStats, String> {
    let project_data = file_cache::load_project_data(&root_path_str)?;
    let root_path = Path::new(&root_path_str);
    Ok(project_scanner::recalculate_stats_for_paths(&paths, &project_data.file_metadata_cache, root_path))
}

#[command]
// Bỏ app_handle không cần thiết
pub fn start_group_update(window: Window, group_id: String, root_path_str: String, paths: Vec<String>) {
    std::thread::spawn(move || {
        // Gọi hàm không cần app_handle
        let result = calculate_group_stats_from_cache(root_path_str.clone(), paths.clone());
        match result {
            Ok(new_stats) => {
                if let Ok(mut project_data) = file_cache::load_project_data(&root_path_str) {
                    if let Some(group) = project_data.groups.iter_mut().find(|g| g.id == group_id) {
                        group.paths = paths.clone();
                        group.stats = new_stats;
                    }
                    let _ = file_cache::save_project_data(&root_path_str, &project_data);
                }
                let _ = window.emit("group_update_complete", serde_json::json!({
                    "groupId": group_id,
                    "paths": paths,
                    "stats": new_stats
                }));
            }
            Err(e) => {
                let _ = window.emit("group_update_error", e);
            }
        }
    });
}

#[command]
// Chữ ký đã đúng, giữ nguyên
pub fn start_group_export(window: Window, group_id: String, root_path_str: String, use_full_tree: bool) { // <-- THÊM use_full_tree
    println!("[RUST] EXPORT: Nhận yêu cầu cho nhóm ID: {}, use_full_tree: {}", group_id, use_full_tree);
    std::thread::spawn(move || {
        let result: Result<String, String> = (|| {
            let project_data = file_cache::load_project_data(&root_path_str)?;
            let root_path = Path::new(&root_path_str);
            let group = project_data.groups.iter()
                .find(|g| g.id == group_id)
                .ok_or_else(|| format!("Không tìm thấy nhóm với ID: {}", group_id))?;
            
            println!("[RUST] EXPORT: Đã tìm thấy nhóm '{}'. Paths được lưu: {:?}", group.name, group.paths);
            let expanded_files = context_generator::expand_group_paths_to_files(&group.paths, &project_data.file_metadata_cache, root_path);
            
            println!("[RUST] EXPORT: Sau khi mở rộng, có {} files: {:?}", expanded_files.len(), expanded_files);
            if expanded_files.is_empty() {
                return Err("Nhóm này không chứa file nào để xuất.".to_string());
            }
            context_generator::generate_context_from_files(
                &root_path_str, 
                &expanded_files,
                use_full_tree, // <-- Truyền tham số
                &project_data.file_tree, // <-- Truyền cả cây thư mục đầy đủ
            )
        })();
        match result {
            Ok(context) => {
                println!("[RUST] EXPORT: Thành công! Đang gửi sự kiện group_export_complete.");
                let _ = window.emit("group_export_complete", serde_json::json!({ "groupId": group_id, "context": context }));
            }
            Err(e) => {
                println!("[RUST] EXPORT: Lỗi! Đang gửi sự kiện group_export_error: {}", e);
                let _ = window.emit("group_export_error", e);
            }
        }
    });
}

#[command]
// Bỏ app_handle không cần thiết
pub fn start_project_export(window: Window, path: String) {
    std::thread::spawn(move || {
        let result: Result<String, String> = (|| {
            let project_data = file_cache::load_project_data(&path)?;
            let all_files: Vec<String> = project_data.file_metadata_cache.keys().cloned().collect();
            if all_files.is_empty() {
                return Err("Dự án không có file nào để xuất.".to_string());
            }
            // --- SỬA LỖI Ở ĐÂY ---
            // Cung cấp 2 tham số còn thiếu
            context_generator::generate_context_from_files(
                &path, 
                &all_files,
                true, // Luôn dùng cây thư mục đầy đủ khi xuất toàn bộ dự án
                &project_data.file_tree // Cung cấp cây thư mục đầy đủ
            )
            // --- KẾT THÚC SỬA LỖI ---
        })();
        match result {
            Ok(context) => {
                let _ = window.emit("project_export_complete", context);
            }
            Err(e) => {
                let _ = window.emit("project_export_error", e);
            }
        }
    });
}