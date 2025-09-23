// src-tauri/src/commands/profile_commands.rs
use crate::{file_cache, models};
use sha2::{Digest, Sha256};
use std::fs;
use tauri::{command, AppHandle, Manager};

#[command]
pub fn list_profiles(app: AppHandle, project_path: String) -> Result<Vec<String>, String> {
    let app_config_dir = app.path()
        .app_config_dir()
        .map_err(|e| format!("Không thể xác định thư mục cấu hình ứng dụng: {}", e))?;

    let mut hasher = Sha256::new();
    hasher.update(project_path.as_bytes());
    let project_hash = hasher.finalize();
    let project_id = format!("{:x}", project_hash);

    let config_dir = app_config_dir.join("projects").join(project_id);

    let mut profiles = Vec::new();
    if config_dir.exists() {
        for entry in fs::read_dir(config_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.is_file() {
                if let Some(filename) = path.file_name().and_then(|s| s.to_str()) {
                    if filename.starts_with("data_") && filename.ends_with(".json") {
                        let profile_name = &filename[5..filename.len() - 5];
                        profiles.push(profile_name.to_string());
                    }
                }
            }
        }
    }
    if profiles.is_empty() {
        profiles.push("default".to_string());
    }
    Ok(profiles)
}

#[command]
pub fn create_profile(app: AppHandle, project_path: String, profile_name: String) -> Result<(), String> {
    let data = models::CachedProjectData::default();
    file_cache::save_project_data(&app, &project_path, &profile_name, &data)
}

#[command]
pub fn delete_profile(app: AppHandle, project_path: String, profile_name: String) -> Result<(), String> {
    if profile_name == "default" {
        return Err("Không thể xóa hồ sơ 'default'.".to_string());
    }
    let config_path = file_cache::get_project_config_path(&app, &project_path, &profile_name)?;
    if config_path.exists() {
        fs::remove_file(config_path).map_err(|e| e.to_string())
    } else {
        Err("Hồ sơ không tồn tại.".to_string())
    }
}

#[command]
pub fn rename_profile(
    app: AppHandle,
    project_path: String,
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    if old_name == "default" {
        return Err("Không thể đổi tên hồ sơ 'default'.".to_string());
    }
    let old_path = file_cache::get_project_config_path(&app, &project_path, &old_name)?;
    let new_path = file_cache::get_project_config_path(&app, &project_path, &new_name)?;
    if !old_path.exists() {
        return Err("Hồ sơ cũ không tồn tại.".to_string());
    }
    if new_path.exists() {
        return Err("Tên hồ sơ mới đã tồn tại.".to_string());
    }
    fs::rename(old_path, new_path).map_err(|e| e.to_string())
}

#[command]
pub fn list_groups_for_profile(
    app: AppHandle,
    project_path: String,
    profile_name: String,
) -> Result<Vec<models::Group>, String> {
    let project_data = file_cache::load_project_data(&app, &project_path, &profile_name)?;
    Ok(project_data.groups)
}

#[command]
pub fn clone_profile(
    app: AppHandle,
    project_path: String,
    source_profile_name: String,
    new_profile_name: String,
) -> Result<(), String> {
    let source_data = file_cache::load_project_data(&app, &project_path, &source_profile_name)?;

    let new_data = models::CachedProjectData {
        stats: source_data.stats,
        file_tree: source_data.file_tree,
        file_metadata_cache: source_data.file_metadata_cache,
        data_hash: source_data.data_hash,

        groups: vec![],
        sync_enabled: Some(false),
        sync_path: None,
        custom_ignore_patterns: Some(vec![]),
        is_watching_files: Some(false),
        export_use_full_tree: Some(false),
        export_with_line_numbers: Some(true),
    };

    file_cache::save_project_data(&app, &project_path, &new_profile_name, &new_data)
}

#[command]
pub fn load_profile_data(
    app: AppHandle,
    project_path: String,
    profile_name: String,
) -> Result<models::CachedProjectData, String> {
    file_cache::load_project_data(&app, &project_path, &profile_name)
}