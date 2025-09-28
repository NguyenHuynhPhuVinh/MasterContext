// src-tauri/src/commands/project_commands.rs
use crate::{context_generator, file_cache, models, project_scanner};
use tauri::{command, AppHandle, Emitter, Manager, Window}; // Add models
use super::start_file_watching;
use super::utils::perform_auto_export;
use std::fs;
use ignore::WalkBuilder;
use std::collections::BTreeMap;
use crate::models::FsEntry;
use std::fmt::Write as FmtWrite;
use std::path::Path;

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
    if let Some(parent_dir) = full_path.parent() {
        fs::create_dir_all(parent_dir)
            .map_err(|e| format!("Không thể tạo thư mục cha: {}", e))?;
    }
    fs::write(full_path, content).map_err(|e| format!("Không thể ghi file: {}", e))
}
#[command]
pub fn generate_directory_tree(
    root_path_str: String,
    dir_rel_path: String,
) -> Result<String, String> {
    let root_path = Path::new(&root_path_str);
    let full_dir_path = root_path.join(&dir_rel_path);

    if !full_dir_path.is_dir() {
        return Err(format!("'{}' không phải là một thư mục.", dir_rel_path));
    }

    let mut tree_builder_root = BTreeMap::new();

    // Sử dụng ignore::WalkBuilder để tôn trọng các file .gitignore
    for result in WalkBuilder::new(&full_dir_path).build().skip(1) { // bỏ qua thư mục gốc
        let entry = result.map_err(|e| e.to_string())?;
        let path = entry.path();
        
        // Lấy đường dẫn tương đối so với thư mục đang quét
        let rel_path = path.strip_prefix(&full_dir_path).map_err(|e| e.to_string())?;

        let mut current_level = &mut tree_builder_root;

        if let Some(parent_components) = rel_path.parent() {
            for component in parent_components.components() {
                let component_str = component.as_os_str().to_string_lossy().into_owned();
                current_level = match current_level
                    .entry(component_str)
                    .or_insert(FsEntry::Directory(BTreeMap::new()))
                {
                    FsEntry::Directory(children) => children,
                    _ => unreachable!(),
                };
            }
        }
        
        if let Some(file_name) = rel_path.file_name() {
             let file_name_str = file_name.to_string_lossy().into_owned();
             if path.is_dir() {
                current_level.entry(file_name_str).or_insert(FsEntry::Directory(BTreeMap::new()));
             } else {
                current_level.insert(file_name_str, FsEntry::File);
             }
        }
    }
    
    // Hàm helper để định dạng cây, có thể đã tồn tại ở nơi khác
    fn format_tree_helper(tree: &BTreeMap<String, FsEntry>, prefix: &str, output: &mut String) {
        let mut entries = tree.iter().peekable();
        while let Some((name, entry)) = entries.next() {
            let is_last = entries.peek().is_none();
            let connector = if is_last { "└── " } else { "├── " };
            match entry {
                FsEntry::File => { let _ = writeln!(output, "{}{}{}", prefix, connector, name); }
                FsEntry::Directory(children) => {
                    let _ = writeln!(output, "{}{}{}/", prefix, connector, name);
                    let new_prefix = format!("{}{}", prefix, if is_last { "    " } else { "│   " });
                    format_tree_helper(children, &new_prefix, output);
                }
            }
        }
    }
    
    let mut directory_structure = String::new();
    format_tree_helper(&tree_builder_root, "", &mut directory_structure);
    
    let root_name = Path::new(&dir_rel_path).file_name().unwrap_or_default().to_string_lossy();
    Ok(format!("{}/\n{}", root_name, directory_structure))
}
#[command]
pub fn create_file(
    root_path_str: String,
    file_rel_path: String,
    content: String,
) -> Result<(), String> {
    let root_path = std::path::Path::new(&root_path_str);
    let full_path = root_path.join(&file_rel_path);
    if let Some(parent_dir) = full_path.parent() {
        fs::create_dir_all(parent_dir)
            .map_err(|e| format!("Không thể tạo thư mục cha: {}", e))?;
    }
    fs::write(full_path, content).map_err(|e| format!("Không thể tạo file: {}", e))
}

#[command]
pub fn delete_file(root_path_str: String, file_rel_path: String) -> Result<(), String> {
    let root_path = std::path::Path::new(&root_path_str);
    let full_path = root_path.join(file_rel_path);
    if full_path.exists() {
        fs::remove_file(full_path).map_err(|e| format!("Không thể xóa file: {}", e))
    } else {
        Ok(()) // File không tồn tại, coi như đã xóa thành công
    }
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