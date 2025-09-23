// src-tauri/src/commands/settings_commands.rs
use crate::file_cache;
use tauri::{command, AppHandle};
use super::utils::perform_auto_export;

#[command]
pub fn update_sync_settings(
    app: AppHandle,
    path: String,
    profile_name: String,
    enabled: bool,
    sync_path: Option<String>,
) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&app, &path, &profile_name)?;
    project_data.sync_enabled = Some(enabled);
    project_data.sync_path = sync_path;

    if enabled && project_data.sync_path.is_some() {
        perform_auto_export(&path, &profile_name, &project_data);
    }

    file_cache::save_project_data(&app, &path, &profile_name, &project_data)
}

#[command]
pub fn update_custom_ignore_patterns(
    app: AppHandle,
    path: String,
    profile_name: String,
    patterns: Vec<String>,
) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&app, &path, &profile_name)?;
    project_data.custom_ignore_patterns = Some(patterns);
    file_cache::save_project_data(&app, &path, &profile_name, &project_data)
}

#[command]
pub fn set_file_watching_setting(
    app: AppHandle,
    path: String,
    profile_name: String,
    enabled: bool,
) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&app, &path, &profile_name)?;
    project_data.is_watching_files = Some(enabled);
    file_cache::save_project_data(&app, &path, &profile_name, &project_data)
}

#[command]
pub fn set_export_use_full_tree_setting(
    app: AppHandle,
    path: String,
    profile_name: String,
    enabled: bool,
) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&app, &path, &profile_name)?;
    project_data.export_use_full_tree = Some(enabled);
    file_cache::save_project_data(&app, &path, &profile_name, &project_data)
}

#[command]
pub fn set_export_with_line_numbers_setting(
    app: AppHandle,
    path: String,
    profile_name: String,
    enabled: bool,
) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&app, &path, &profile_name)?;
    project_data.export_with_line_numbers = Some(enabled);
    file_cache::save_project_data(&app, &path, &profile_name, &project_data)
}