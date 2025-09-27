// src-tauri/src/commands/project_commands.rs
use crate::{context_generator, file_cache, models, project_scanner};
use tauri::{command, AppHandle, Emitter, Manager, Window}; // Add models
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
                return Err("project.export_no_files".to_string());
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
                &project_data.file_metadata_cache,
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
        return Err("project.generate_context_no_files".to_string());
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
        &project_data.file_metadata_cache,
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

#[command]
pub fn get_file_content(root_path_str: String, file_rel_path: String) -> Result<String, String> {
    let root_path = std::path::Path::new(&root_path_str);
    let full_path = root_path.join(file_rel_path);
    fs::read_to_string(full_path).map_err(|e| format!("Không thể đọc file: {}", e))
}

#[command]
pub fn read_file_with_lines(
    root_path_str: String,
    file_rel_path: String,
    start_line: Option<usize>,
    end_line: Option<usize>,
) -> Result<String, String> {
    let root_path = std::path::Path::new(&root_path_str);
    let full_path = root_path.join(&file_rel_path);
    let content = fs::read_to_string(full_path)
        .map_err(|e| format!("Không thể đọc file '{}': {}", file_rel_path, e))?;

    if start_line.is_none() && end_line.is_none() {
        return Ok(content);
    }

    let lines: Vec<&str> = content.lines().collect();
    let total_lines = lines.len();

    // Line numbers from AI are 1-based, convert to 0-based index
    let start_index = start_line.map_or(0, |n| n.saturating_sub(1));
    let end_index = end_line.map_or(total_lines, |n| n).min(total_lines);

    if start_index >= end_index {
        return Ok("".to_string());
    }

    Ok(lines[start_index..end_index].join("\n"))
}

#[command]
pub fn save_file_content(
    root_path_str: String,
    file_rel_path: String,
    content: String,
) -> Result<(), String> {
    let root_path = std::path::Path::new(&root_path_str);
    let full_path = root_path.join(file_rel_path);
    fs::write(full_path, content).map_err(|e| format!("Không thể ghi file: {}", e))
}
#[command]
pub fn write_file_lines(
    root_path_str: String,
    file_rel_path: String,
    content_to_write: String,
    start_line: Option<usize>,
    end_line: Option<usize>,
) -> Result<(), String> {
    let root_path = std::path::Path::new(&root_path_str);
    let full_path = root_path.join(&file_rel_path);

    // Trường hợp 1: Ghi đè toàn bộ file (không có start_line)
    if start_line.is_none() {
        return fs::write(full_path, content_to_write)
            .map_err(|e| format!("Không thể ghi toàn bộ file: {}", e));
    }

    // Trường hợp 2: Ghi vào một khoảng dòng cụ thể
    let original_content = fs::read_to_string(&full_path)
        .map_err(|e| format!("Không thể đọc file gốc để ghi đè: {}", e))?;

    let mut original_lines: Vec<&str> = original_content.lines().collect();
    let new_lines: Vec<&str> = content_to_write.lines().collect();

    // AI cung cấp dòng 1-based, chuyển thành 0-based index
    let start_index = start_line.unwrap_or(1).saturating_sub(1);
    // Nếu không có end_line, mặc định là thay thế cho đến hết các dòng mới
    let end_index = end_line.unwrap_or(start_index + new_lines.len()).min(original_lines.len());

    // Đảm bảo start_index không vượt quá độ dài file
    let safe_start_index = start_index.min(original_lines.len());

    // Thay thế các dòng
    original_lines.splice(safe_start_index..end_index, new_lines);

    let final_content = original_lines.join("\n");

    fs::write(full_path, final_content)
        .map_err(|e| format!("Không thể ghi các dòng đã thay đổi vào file: {}", e))
}
#[command]
pub fn update_file_exclusions(
    app: AppHandle,
    path: String,
    profile_name: String,
    file_rel_path: String,
    ranges: Vec<(usize, usize)>,
) -> Result<models::FileMetadata, String> {
    let mut project_data = file_cache::load_project_data(&app, &path, &profile_name)?;

    let updated_metadata: models::FileMetadata;

    if let Some(metadata) = project_data.file_metadata_cache.get_mut(&file_rel_path)
    {
        metadata.excluded_ranges = if ranges.is_empty() { None } else { Some(ranges) };
        updated_metadata = metadata.clone();
    } else {
        // This case should ideally not happen if the frontend is correct
        return Err(format!(
            "File '{}' not found in metadata cache.",
            file_rel_path
        ));
    }

    file_cache::save_project_data(&app, &path, &profile_name, &project_data)?;

    Ok(updated_metadata)
}