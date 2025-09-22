// src-tauri/src/commands.rs
use crate::{models, file_cache, project_scanner, context_generator};
use tauri::{command, Window, AppHandle, Emitter};
use std::path::Path;

#[command]
pub fn open_project(window: Window, path: String) {
    std::thread::spawn(move || {
        if let Err(e) = project_scanner::perform_smart_scan_and_rebuild(&window, &path) {
            let _ = window.emit("scan_error", e);
        }
    });
}

#[command]
pub fn update_groups_in_project_data(_app_handle: AppHandle, path: String, groups: Vec<models::Group>) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&path)?;
    project_data.groups = groups;
    file_cache::save_project_data(&path, &project_data)
}

#[command]
pub fn calculate_group_stats_from_cache(_app_handle: AppHandle, root_path_str: String, paths: Vec<String>) -> Result<models::GroupStats, String> {
    let project_data = file_cache::load_project_data(&root_path_str)?;
    let root_path = Path::new(&root_path_str);
    Ok(project_scanner::recalculate_stats_for_paths(&paths, &project_data.file_metadata_cache, root_path))
}

#[command]
pub fn start_group_update(window: Window, app_handle: AppHandle, group_id: String, root_path_str: String, paths: Vec<String>) {
    std::thread::spawn(move || {
        let result = calculate_group_stats_from_cache(app_handle.clone(), root_path_str.clone(), paths.clone());
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
pub fn start_group_export(window: Window, group_id: String, root_path_str: String) {
    std::thread::spawn(move || {
        let result: Result<String, String> = (|| {
            let project_data = file_cache::load_project_data(&root_path_str)?;
            let root_path = Path::new(&root_path_str);
            let group = project_data.groups.iter()
                .find(|g| g.id == group_id)
                .ok_or_else(|| format!("Không tìm thấy nhóm với ID: {}", group_id))?;
            let expanded_files = context_generator::expand_group_paths_to_files(&group.paths, &project_data.file_metadata_cache, root_path);
            if expanded_files.is_empty() {
                return Err("Nhóm này không chứa file nào để xuất.".to_string());
            }
            context_generator::generate_context_from_files(&root_path_str, &expanded_files)
        })();
        match result {
            Ok(context) => {
                let _ = window.emit("group_export_complete", serde_json::json!({ "groupId": group_id, "context": context }));
            }
            Err(e) => {
                let _ = window.emit("group_export_error", e);
            }
        }
    });
}

#[command]
pub fn start_project_export(window: Window, app_handle: AppHandle, path: String) {
    std::thread::spawn(move || {
        let result: Result<String, String> = (|| {
            let project_data = file_cache::load_project_data(&path)?;
            let all_files: Vec<String> = project_data.file_metadata_cache.keys().cloned().collect();
            if all_files.is_empty() {
                return Err("Dự án không có file nào để xuất.".to_string());
            }
            context_generator::generate_context_from_files(&path, &all_files)
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