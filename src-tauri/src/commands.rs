// src-tauri/src/commands.rs
use crate::{context_generator, file_cache, models, project_scanner};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{command, Emitter, Window};

fn sanitize_group_name(name: &str) -> String {
    name.replace(|c: char| !c.is_alphanumeric(), "_")
}

// --- CẬP NHẬT: Thêm profile_name vào tất cả các command liên quan đến dữ liệu ---

#[command]
pub fn open_project(window: Window, path: String, profile_name: String) {
    std::thread::spawn(move || {
        // Tải dữ liệu cũ để so sánh hash
        let old_data_result = file_cache::load_project_data(&path, &profile_name);
        let old_hash = old_data_result
            .as_ref()
            .ok()
            .and_then(|d| d.data_hash.clone());

        // Thực hiện quét
        match project_scanner::perform_smart_scan_and_rebuild(&path, &profile_name) {
            Ok(new_data) => {
                // Lưu dữ liệu mới vào cache
                if let Err(e) = file_cache::save_project_data(&path, &profile_name, &new_data) {
                    let _ = window.emit("scan_error", e);
                    return;
                }

                // Gửi dữ liệu mới về cho frontend
                let _ = window.emit("scan_complete", &new_data);

                // Kiểm tra và thực hiện đồng bộ TỰ ĐỘNG
                let sync_enabled = new_data.sync_enabled.unwrap_or(false);
                let has_changed = old_hash != new_data.data_hash;

                if sync_enabled && has_changed && new_data.sync_path.is_some() {
                    let _ = window.emit(
                        "auto_sync_started",
                        "Phát hiện thay đổi, bắt đầu đồng bộ...",
                    );
                    perform_auto_export(&path, &profile_name, &new_data);
                    let _ = window.emit("auto_sync_complete", "Đồng bộ hoàn tất.");
                }
            }
            Err(e) => {
                let _ = window.emit("scan_error", e);
            }
        }
    });
}

#[command]
pub fn update_groups_in_project_data(
    window: Window,
    path: String,
    profile_name: String,
    groups: Vec<models::Group>,
) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&path, &profile_name)?;
    let old_groups = project_data.groups.clone();

    if project_data.sync_enabled.unwrap_or(false) {
        if let Some(sync_path_str) = &project_data.sync_path {
            let sync_path = PathBuf::from(sync_path_str);
            let new_groups_map: HashMap<_, _> = groups.iter().map(|g| (g.id.clone(), g)).collect();
            let old_groups_map: HashMap<_, _> = old_groups.iter().map(|g| (g.id.clone(), g)).collect();

            // Xử lý xóa nhóm
            for old_group in &old_groups {
                if !new_groups_map.contains_key(&old_group.id) {
                    let safe_name = sanitize_group_name(&old_group.name);
                    let file_to_delete = sync_path.join(format!("{}_context.txt", safe_name));
                    if file_to_delete.exists() {
                        let _ = fs::remove_file(file_to_delete);
                    }
                }
            }

            // Xử lý đổi tên nhóm
            for new_group in &groups {
                if let Some(old_group) = old_groups_map.get(&new_group.id) {
                    if old_group.name != new_group.name {
                        let old_safe_name = sanitize_group_name(&old_group.name);
                        let new_safe_name = sanitize_group_name(&new_group.name);
                        let old_file = sync_path.join(format!("{}_context.txt", old_safe_name));
                        let new_file = sync_path.join(format!("{}_context.txt", new_safe_name));
                        if old_file.exists() {
                            let _ = fs::rename(old_file, new_file);
                        }
                    }
                }
            }
        }
    }

    project_data.groups = groups;

    if project_data.sync_enabled.unwrap_or(false) && project_data.sync_path.is_some() {
        let _ = window.emit(
            "auto_sync_started",
            "Cập nhật nhóm, bắt đầu đồng bộ...",
        );
        perform_auto_export(&path, &profile_name, &project_data);
        let _ = window.emit("auto_sync_complete", "Đồng bộ hoàn tất.");
    }

    file_cache::save_project_data(&path, &profile_name, &project_data)
}

#[command]
pub fn calculate_group_stats_from_cache(
    root_path_str: String,
    profile_name: String,
    paths: Vec<String>,
) -> Result<models::GroupStats, String> {
    let project_data = file_cache::load_project_data(&root_path_str, &profile_name)?;
    let root_path = Path::new(&root_path_str);
    Ok(project_scanner::recalculate_stats_for_paths(
        &paths,
        &project_data.file_metadata_cache,
        root_path,
    ))
}

#[command]
pub fn start_group_update(
    window: Window,
    group_id: String,
    root_path_str: String,
    profile_name: String,
    paths: Vec<String>,
) {
    std::thread::spawn(move || {
        let result =
            calculate_group_stats_from_cache(root_path_str.clone(), profile_name.clone(), paths.clone());
        match result {
            Ok(new_stats) => {
                if let Ok(mut project_data) =
                    file_cache::load_project_data(&root_path_str, &profile_name)
                {
                    if let Some(group) = project_data.groups.iter_mut().find(|g| g.id == group_id) {
                        group.paths = paths.clone();
                        group.stats = new_stats;

                        if project_data.sync_enabled.unwrap_or(false) && project_data.sync_path.is_some() {
                            let _ = window.emit(
                                "auto_sync_started",
                                "Phát hiện thay đổi nhóm, bắt đầu đồng bộ...",
                            );
                            perform_auto_export(&root_path_str, &profile_name, &project_data);
                            let _ = window.emit("auto_sync_complete", "Đồng bộ hoàn tất.");
                        }
                    }
                    let _ = file_cache::save_project_data(&root_path_str, &profile_name, &project_data);
                }
                let _ = window.emit(
                    "group_update_complete",
                    serde_json::json!({ "groupId": group_id, "paths": paths, "stats": new_stats }),
                );
            }
            Err(e) => {
                let _ = window.emit("group_update_error", e);
            }
        }
    });
}

#[command]
pub fn start_group_export(
    window: Window,
    group_id: String,
    root_path_str: String,
    profile_name: String,
    use_full_tree: bool,
) {
    std::thread::spawn(move || {
        let result: Result<String, String> = (|| {
            let project_data = file_cache::load_project_data(&root_path_str, &profile_name)?;
            let root_path = Path::new(&root_path_str);
            let group = project_data
                .groups
                .iter()
                .find(|g| g.id == group_id)
                .ok_or_else(|| format!("Không tìm thấy nhóm với ID: {}", group_id))?;

            let expanded_files = context_generator::expand_group_paths_to_files(
                &group.paths,
                &project_data.file_metadata_cache,
                root_path,
            );

            if expanded_files.is_empty() {
                return Err("Nhóm này không chứa file nào để xuất.".to_string());
            }
            context_generator::generate_context_from_files(
                &root_path_str,
                &expanded_files,
                use_full_tree,
                &project_data.file_tree,
            )
        })();
        match result {
            Ok(context) => {
                let _ = window.emit(
                    "group_export_complete",
                    serde_json::json!({ "groupId": group_id, "context": context }),
                );
            }
            Err(e) => {
                let _ = window.emit("group_export_error", e);
            }
        }
    });
}

#[command]
pub fn start_project_export(window: Window, path: String, profile_name: String) {
    std::thread::spawn(move || {
        let result: Result<String, String> = (|| {
            let project_data = file_cache::load_project_data(&path, &profile_name)?;
            let all_files: Vec<String> = project_data.file_metadata_cache.keys().cloned().collect();
            if all_files.is_empty() {
                return Err("Dự án không có file nào để xuất.".to_string());
            }
            context_generator::generate_context_from_files(
                &path,
                &all_files,
                true,
                &project_data.file_tree,
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
pub fn generate_group_context(
    group_id: String,
    root_path_str: String,
    profile_name: String,
    use_full_tree: bool,
) -> Result<String, String> {
    let project_data = file_cache::load_project_data(&root_path_str, &profile_name)?;
    let root_path = Path::new(&root_path_str);
    let group = project_data
        .groups
        .iter()
        .find(|g| g.id == group_id)
        .ok_or_else(|| format!("Không tìm thấy nhóm với ID: {}", group_id))?;
    let expanded_files = context_generator::expand_group_paths_to_files(
        &group.paths,
        &project_data.file_metadata_cache,
        root_path,
    );
    if expanded_files.is_empty() {
        return Err("Nhóm này không chứa file nào để tạo ngữ cảnh.".to_string());
    }
    context_generator::generate_context_from_files(
        &root_path_str,
        &expanded_files,
        use_full_tree,
        &project_data.file_tree,
    )
}

#[command]
pub fn generate_project_context(path: String, profile_name: String) -> Result<String, String> {
    let project_data = file_cache::load_project_data(&path, &profile_name)?;
    let all_files: Vec<String> = project_data.file_metadata_cache.keys().cloned().collect();
    if all_files.is_empty() {
        return Err("Dự án không có file nào để tạo ngữ cảnh.".to_string());
    }
    context_generator::generate_context_from_files(
        &path,
        &all_files,
        true,
        &project_data.file_tree,
    )
}

#[command]
pub fn update_sync_settings(
    path: String,
    profile_name: String,
    enabled: bool,
    sync_path: Option<String>,
) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&path, &profile_name)?;
    project_data.sync_enabled = Some(enabled);
    project_data.sync_path = sync_path;
    file_cache::save_project_data(&path, &profile_name, &project_data)
}

#[command]
pub fn set_group_cross_sync(
    path: String,
    profile_name: String,
    group_id: String,
    enabled: bool,
) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&path, &profile_name)?;
    if let Some(group) = project_data.groups.iter_mut().find(|g| g.id == group_id) {
        group.cross_sync_enabled = Some(enabled);
    } else {
        return Err(format!("Không tìm thấy nhóm với ID: {}", group_id));
    }
    file_cache::save_project_data(&path, &profile_name, &project_data)
}

#[command]
pub fn update_custom_ignore_patterns(
    path: String,
    profile_name: String,
    patterns: Vec<String>,
) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&path, &profile_name)?;
    project_data.custom_ignore_patterns = Some(patterns);
    file_cache::save_project_data(&path, &profile_name, &project_data)
}

fn save_context_to_path_internal(path: String, content: String) -> Result<(), String> {
    let file_path = Path::new(&path);
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Không thể tạo thư mục cha: {}", e))?;
    }
    fs::write(file_path, content).map_err(|e| format!("Không thể ghi vào file: {}", e))
}

fn perform_auto_export(project_path: &str, _profile_name: &str, data: &models::CachedProjectData) {
    let sync_path_base = PathBuf::from(data.sync_path.as_ref().unwrap());
    let all_files: Vec<String> = data.file_metadata_cache.keys().cloned().collect();
    if let Ok(proj_context) = context_generator::generate_context_from_files(
        project_path,
        &all_files,
        true,
        &data.file_tree,
    ) {
        let file_name = sync_path_base.join("_PROJECT_CONTEXT.txt");
        let _ =
            save_context_to_path_internal(file_name.to_string_lossy().to_string(), proj_context);
    }
    for group in &data.groups {
        let expanded_files = context_generator::expand_group_paths_to_files(
            &group.paths,
            &data.file_metadata_cache,
            Path::new(project_path),
        );
        if !expanded_files.is_empty() {
            if let Ok(group_context) = context_generator::generate_context_from_files(
                project_path,
                &expanded_files,
                true,
                &data.file_tree,
            ) {
                let safe_name = sanitize_group_name(&group.name);
                let file_name = sync_path_base.join(format!("{}_context.txt", safe_name));
                let _ = save_context_to_path_internal(
                    file_name.to_string_lossy().to_string(),
                    group_context,
                );
            }
        }
    }
}

// --- COMMANDS MỚI ĐỂ QUẢN LÝ HỒ SƠ ---

#[command]
pub fn list_profiles(project_path: String) -> Result<Vec<String>, String> {
    let config_dir = file_cache::get_project_config_dir(&project_path)?;
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
pub fn create_profile(project_path: String, profile_name: String) -> Result<(), String> {
    let data = models::CachedProjectData::default();
    file_cache::save_project_data(&project_path, &profile_name, &data)
}

#[command]
pub fn delete_profile(project_path: String, profile_name: String) -> Result<(), String> {
    if profile_name == "default" {
        return Err("Không thể xóa hồ sơ 'default'.".to_string());
    }
    let config_path = file_cache::get_project_config_path(&project_path, &profile_name)?;
    if config_path.exists() {
        fs::remove_file(config_path).map_err(|e| e.to_string())
    } else {
        Err("Hồ sơ không tồn tại.".to_string())
    }
}

#[command]
pub fn rename_profile(
    project_path: String,
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    if old_name == "default" {
        return Err("Không thể đổi tên hồ sơ 'default'.".to_string());
    }
    let old_path = file_cache::get_project_config_path(&project_path, &old_name)?;
    let new_path = file_cache::get_project_config_path(&project_path, &new_name)?;
    if !old_path.exists() {
        return Err("Hồ sơ cũ không tồn tại.".to_string());
    }
    if new_path.exists() {
        return Err("Tên hồ sơ mới đã tồn tại.".to_string());
    }
    fs::rename(old_path, new_path).map_err(|e| e.to_string())
}
