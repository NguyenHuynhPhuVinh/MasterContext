// src-tauri/src/commands/settings_commands.rs
use crate::{file_cache, models};
use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use tauri::{command, AppHandle, Manager};
use super::utils::perform_auto_export;

fn get_app_settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Không thể lấy thư mục cấu hình: {}", e))?;
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("Không thể tạo thư mục cấu hình: {}", e))?;
    }
    Ok(config_dir.join("app_settings.json"))
}

#[command]
pub fn get_app_settings(app: AppHandle) -> Result<models::AppSettings, String> {
    let path = get_app_settings_path(&app)?;
    if !path.exists() {
        return Ok(models::AppSettings::default());
    }
    let contents = fs::read_to_string(path).map_err(|e| e.to_string())?;
    if contents.is_empty() { return Ok(models::AppSettings::default()); }
    serde_json::from_str(&contents).map_err(|e| e.to_string())
}

#[command]
pub fn update_sync_settings(
    app: AppHandle,
    path: String,
    enabled: bool,
    sync_path: Option<String>,
) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&app, &path)?;
    project_data.sync_enabled = Some(enabled);
    project_data.sync_path = sync_path;

    if enabled && project_data.sync_path.is_some() {
        perform_auto_export(&path, &project_data);
    }

    file_cache::save_project_data(&app, &path, &project_data)
}

#[command]
pub fn update_custom_ignore_patterns(
    app: AppHandle,
    path: String,
    patterns: Vec<String>,
) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&app, &path)?;
    project_data.custom_ignore_patterns = Some(patterns);
    file_cache::save_project_data(&app, &path, &project_data)
}

#[command]
pub fn set_file_watching_setting(
    app: AppHandle,
    path: String,
    enabled: bool,
) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&app, &path)?;
    project_data.is_watching_files = Some(enabled);
    file_cache::save_project_data(&app, &path, &project_data)
}

#[command]
pub fn set_export_use_full_tree_setting(
    app: AppHandle,
    path: String,
    enabled: bool,
) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&app, &path)?;
    project_data.export_use_full_tree = Some(enabled);
    file_cache::save_project_data(&app, &path, &project_data)
}

#[command]
pub fn set_export_with_line_numbers_setting(
    app: AppHandle,
    path: String,
    enabled: bool,
) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&app, &path)?;
    project_data.export_with_line_numbers = Some(enabled);
    file_cache::save_project_data(&app, &path, &project_data)
}

#[command]
pub fn set_export_without_comments_setting(
    app: AppHandle,
    path: String,
    enabled: bool,
) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&app, &path)?;
    project_data.export_without_comments = Some(enabled);
    file_cache::save_project_data(&app, &path, &project_data)
}

#[command]
pub fn set_export_remove_debug_logs_setting(
    app: AppHandle,
    path: String,
    enabled: bool,
) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&app, &path)?;
    project_data.export_remove_debug_logs = Some(enabled);
    file_cache::save_project_data(&app, &path, &project_data)
}

#[command]
pub fn set_export_super_compressed_setting(
    app: AppHandle,
    path: String,
    enabled: bool,
) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&app, &path)?;
    project_data.export_super_compressed = Some(enabled);
    file_cache::save_project_data(&app, &path, &project_data)
}

#[command]
pub fn set_export_exclude_extensions_setting(
    app: AppHandle,
    path: String,
    extensions: Vec<String>,
) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&app, &path)?;
    project_data.export_exclude_extensions = Some(extensions);
    file_cache::save_project_data(&app, &path, &project_data)
}


#[command]
pub fn set_always_apply_text_setting(
    app: AppHandle,
    path: String,
    text: String,
) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&app, &path)?;
    project_data.always_apply_text = Some(text);
    file_cache::save_project_data(&app, &path, &project_data)
}

#[command]
pub fn set_recent_paths(app: AppHandle, paths: Vec<String>) -> Result<(), String> {
    let settings_path = get_app_settings_path(&app)?;
    let mut settings = get_app_settings(app).unwrap_or_default();
    settings.recent_paths = paths;
    let json_string = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    let mut file = File::create(settings_path).map_err(|e| e.to_string())?;
    file.write_all(json_string.as_bytes())
        .map_err(|e| e.to_string())
}

#[command]
pub fn set_git_export_mode_setting(
    app: AppHandle,
    path: String,
    enabled: bool,
) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&app, &path)?;
    project_data.git_export_mode_is_context = Some(enabled);
    file_cache::save_project_data(&app, &path, &project_data)
}

#[command]
pub fn update_app_settings(app: AppHandle, settings: models::AppSettings) -> Result<(), String> {
    let settings_path = get_app_settings_path(&app)?;
    let json_string = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    let mut file = File::create(settings_path).map_err(|e| e.to_string())?;
    file.write_all(json_string.as_bytes())
        .map_err(|e| e.to_string())?;
    Ok(())
}

// src-tauri/src/commands/settings_commands.rs