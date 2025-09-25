// src-tauri/src/commands/project_commands.rs
use crate::{context_generator, file_cache, project_scanner};
use tauri::{command, AppHandle, Emitter, Manager, Window};
use super::start_file_watching;
use super::utils::perform_auto_export;
use std::fs;

#[command]
pub fn scan_project(window: Window, path: String, profile_name: String) {
    let window_clone = window.clone();
    let path_clone = path.clone();
    let app = window.app_handle().clone();

    std::thread::spawn(move || {
        let old_data = file_cache::load_project_data(&app, &path, &profile_name).unwrap_or_default();
        let should_start_watching = old_data.is_watching_files.unwrap_or(false);

        // --- THÊM LOGIC ĐỌC CÀI ĐẶT ---
        // Lấy cài đặt ứng dụng để truyền vào scanner
        let app_settings = super::settings_commands::get_app_settings(app.clone()).unwrap_or_default();
        
        match project_scanner::perform_smart_scan_and_rebuild(
            &window, 
            &path, 
            old_data,
            project_scanner::ScanOptions {
                user_non_analyzable_extensions: app_settings.non_analyzable_extensions,
            }
        ) {
            Ok((new_data, is_first_scan)) => { // <-- Nhận thêm cờ is_first_scan
                if let Err(e) = file_cache::save_project_data(&app, &path, &profile_name, &new_data) {
                    let _ = window.emit("scan_error", e);
                    return;
                }

                if new_data.sync_enabled.unwrap_or(false) && new_data.sync_path.is_some() {
                    perform_auto_export(&path, &profile_name, &new_data);
                }
                
                // --- GỬI PAYLOAD MỚI VỀ FRONTEND ---
                let _ = window.emit("scan_complete", serde_json::json!({
                    "projectData": new_data,
                    "isFirstScan": is_first_scan
                }));

                if should_start_watching {
                    if let Err(e) = start_file_watching(window_clone, path_clone) {
                        println!("[Error] Auto-starting watcher failed: {}", e);
                    }
                }
            }
            Err(e) => {
                let _ = window.emit("scan_error", e);
            }
        }
    });
}

#[command]
pub fn start_project_export(window: Window, app: AppHandle, path: String, profile_name: String) {
    std::thread::spawn(move || {
        let result: Result<String, String> = (|| {
            let project_data = file_cache::load_project_data(&app, &path, &profile_name)?;
            let with_line_numbers = project_data.export_with_line_numbers.unwrap_or(true);
            let without_comments = project_data.export_without_comments.unwrap_or(false);
            let remove_debug_logs = project_data.export_remove_debug_logs.unwrap_or(false);
            let super_compressed = project_data.export_super_compressed.unwrap_or(false);
            let always_apply_text = project_data.always_apply_text;
            let exclude_extensions = project_data.export_exclude_extensions;
            let all_files: Vec<String> = project_data.file_metadata_cache.keys().cloned().collect();
            if all_files.is_empty() {
                return Err("Dự án không có file nào để xuất.".to_string());
            }
            context_generator::generate_context_from_files(
                &path,
                &all_files,
                true,
                &project_data.file_tree,
                with_line_numbers,
                without_comments,
                remove_debug_logs,
                super_compressed,
                &always_apply_text,
                &exclude_extensions,
            )
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

#[command]
pub fn generate_project_context(app: AppHandle, path: String, profile_name: String, with_line_numbers: bool, without_comments: bool, remove_debug_logs: bool, super_compressed: bool) -> Result<String, String> {
    let project_data = file_cache::load_project_data(&app, &path, &profile_name)?;
    let always_apply_text = project_data.always_apply_text;
    let exclude_extensions = project_data.export_exclude_extensions;
    let all_files: Vec<String> = project_data.file_metadata_cache.keys().cloned().collect();
    if all_files.is_empty() {
        return Err("Dự án không có file nào để tạo ngữ cảnh.".to_string());
    }
    context_generator::generate_context_from_files(
        &path,
        &all_files,
        true,
        &project_data.file_tree,
        with_line_numbers,
        without_comments,
        remove_debug_logs,
        super_compressed,
        &always_apply_text,
        &exclude_extensions,
    )
}

#[command]
pub fn delete_project_data(app: AppHandle, path: String) -> Result<(), String> {
    let project_config_dir = file_cache::get_project_config_dir(&app, &path)?;
    if project_config_dir.exists() {
        fs::remove_dir_all(&project_config_dir)
            .map_err(|e| format!("Không thể xóa dữ liệu dự án: {}", e))?;
    }
    Ok(())
}