// src-tauri/src/commands/group_commands.rs
use crate::{context_generator, file_cache, group_updater, models};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{command, AppHandle, Emitter, Window};
use super::utils::{perform_auto_export, sanitize_group_name};
use crate::models::AIGroupUpdateResult;

#[command]
pub fn update_groups_in_project_data(
    app: AppHandle,
    path: String,
    profile_name: String,
    groups: Vec<models::Group>,
) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&app, &path, &profile_name)?;
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
        perform_auto_export(&path, &profile_name, &project_data);
    }

    file_cache::save_project_data(&app, &path, &profile_name, &project_data)
}

#[command]
pub fn calculate_group_stats_from_cache(
    app: AppHandle,
    root_path_str: String,
    profile_name: String,
    paths: Vec<String>,
) -> Result<models::GroupStats, String> {
    let project_data = file_cache::load_project_data(&app, &root_path_str, &profile_name)?;
    let root_path = Path::new(&root_path_str);
    Ok(group_updater::recalculate_stats_for_paths(
        &paths,
        &project_data.file_metadata_cache,
        root_path,
    ))
}

#[command]
pub fn start_group_update(
    window: Window,
    app: AppHandle,
    group_id: String,
    root_path_str: String,
    profile_name: String,
    paths: Vec<String>,
) {
    let app_clone = app.clone();
    std::thread::spawn(move || {
        let result =
            calculate_group_stats_from_cache(app_clone, root_path_str.clone(), profile_name.clone(), paths.clone());
        match result {
            Ok(new_stats) => {
                if let Ok(mut project_data) =
                    file_cache::load_project_data(&app, &root_path_str, &profile_name)
                {
                    if let Some(group) = project_data.groups.iter_mut().find(|g| g.id == group_id) {
                        group.paths = paths.clone();
                        group.stats = new_stats;

                        if project_data.sync_enabled.unwrap_or(false) && project_data.sync_path.is_some() {
                            perform_auto_export(&root_path_str, &profile_name, &project_data);
                        }
                    }
                    let _ = file_cache::save_project_data(&app, &root_path_str, &profile_name, &project_data);
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
    app: AppHandle,
    group_id: String,
    root_path_str: String,
    profile_name: String,
) {
    std::thread::spawn(move || {
        let result: Result<String, String> = (|| {
            let project_data = file_cache::load_project_data(&app, &root_path_str, &profile_name)?;
            let use_full_tree = project_data.export_use_full_tree.unwrap_or(false);
            let with_line_numbers = project_data.export_with_line_numbers.unwrap_or(true);
            let without_comments = project_data.export_without_comments.unwrap_or(false);
            let remove_debug_logs = project_data.export_remove_debug_logs.unwrap_or(false);
            let super_compressed = project_data.export_super_compressed.unwrap_or(false);
            let always_apply_text = project_data.always_apply_text;
            let exclude_extensions = project_data.export_exclude_extensions;
            let root_path = Path::new(&root_path_str);
            let group = project_data
                .groups
                .iter()
                .find(|g| g.id == group_id)
                .ok_or_else(|| "group.not_found".to_string())?;
            let expanded_files = context_generator::expand_group_paths_to_files(
                &group.paths,
                &project_data.file_metadata_cache,
                root_path,
            );
            if expanded_files.is_empty() {
                return Err("group.export_no_files".to_string());
            }
            context_generator::generate_context_from_files(
                &root_path_str,
                &expanded_files,
                use_full_tree,
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
pub fn generate_group_context(
    app: AppHandle,
    group_id: String,
    root_path_str: String,
    profile_name: String,
    use_full_tree: bool,
    with_line_numbers: bool,
    without_comments: bool,
    remove_debug_logs: bool,
    super_compressed: bool,
) -> Result<String, String> {
    let project_data = file_cache::load_project_data(&app, &root_path_str, &profile_name)?;
    let always_apply_text = project_data.always_apply_text;
    let exclude_extensions = project_data.export_exclude_extensions;
    let root_path = Path::new(&root_path_str);
    let group = project_data
        .groups
        .iter()
        .find(|g| g.id == group_id)
        .ok_or_else(|| "group.not_found".to_string())?;
    let expanded_files = context_generator::expand_group_paths_to_files(
        &group.paths,
        &project_data.file_metadata_cache,
        root_path,
    );
    if expanded_files.is_empty() {
        return Err("group.generate_context_no_files".to_string());
    }
    context_generator::generate_context_from_files(
        &root_path_str,
        &expanded_files,
        use_full_tree,
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
pub fn generate_group_context_for_ai(
    app: AppHandle,
    group_id: String,
    root_path_str: String,
    profile_name: String,
) -> Result<String, String> {
    let project_data = file_cache::load_project_data(&app, &root_path_str, &profile_name)?;
    let root_path = Path::new(&root_path_str);
    let group = project_data
        .groups
        .iter()
        .find(|g| g.id == group_id)
        .ok_or_else(|| "group.not_found".to_string())?;

    let expanded_files = context_generator::expand_group_paths_to_files(
        &group.paths,
        &project_data.file_metadata_cache,
        root_path,
    );
    if expanded_files.is_empty() {
        return Err("group.generate_context_no_files".to_string());
    }

    // Generate context with specific, non-configurable settings for AI
    context_generator::generate_context_from_files(
        &root_path_str,
        &expanded_files,
        false, // use_full_tree: false (minimal tree)
        &project_data.file_tree,
        false, // with_line_numbers: false
        false, // without_comments: false
        false, // remove_debug_logs: false
        false, // super_compressed: false
        &None, // always_apply_text: None
        &project_data.export_exclude_extensions, // Keep user's exclude extensions
        &project_data.file_metadata_cache,
    )
}

#[command]
pub fn update_group_paths_from_ai(
    app: AppHandle,
    path: String,
    profile_name: String,
    group_id: String,
    paths_to_add: Vec<String>,
    paths_to_remove: Vec<String>,
) -> Result<AIGroupUpdateResult, String> {
    let mut project_data = file_cache::load_project_data(&app, &path, &profile_name)?;
    let root_path = Path::new(&path);
    let metadata_cache_clone = project_data.file_metadata_cache.clone();

    // Find the index of the group first to manage borrow scopes correctly.
    let group_index = project_data.groups.iter().position(|g| g.id == group_id);

    if let Some(index) = group_index {
        // Get a mutable reference to the group using its index.
        // The borrow on `group` is confined within this block.
        let group = &mut project_data.groups[index];

        // --- START OF NEW LOGIC ---
        // 1. Expand the current group paths into a full set of individual files.
        let mut final_paths: HashSet<String> = context_generator::expand_group_paths_to_files(
            &group.paths,
            &metadata_cache_clone,
            root_path,
        )
        .into_iter()
        .collect();

        // 2. Remove the requested files from the expanded set.
        for p in &paths_to_remove {
            final_paths.remove(p);
        }

        // 3. Add the new files/folders directly. The user/AI can add a folder back if needed.
        for p in &paths_to_add {
            final_paths.insert(p.clone());
        }

        // 4. The group's paths are now an explicit list of files.
        group.paths = final_paths.into_iter().collect();
        // --- END OF NEW LOGIC ---

        // Recalculate stats
        group.stats = group_updater::recalculate_stats_for_paths(
            &group.paths,
            &metadata_cache_clone,
            root_path,
        );

        // Clone the modified group to return it later. This ends the borrow on `group`.
        let updated_group_clone = group.clone();

        // Expand paths to get the final list of files in the group
        let final_expanded_files = context_generator::expand_group_paths_to_files(
            &updated_group_clone.paths,
            &metadata_cache_clone,
            root_path,
        );

        // Now that the borrow on `group` is finished, we can save the entire `project_data`.
        file_cache::save_project_data(&app, &path, &profile_name, &project_data)?;

        Ok(AIGroupUpdateResult {
            updated_group: updated_group_clone,
            final_expanded_files,
        })
    } else {
        Err("group.not_found".to_string())
    }
}

#[command]
pub fn get_expanded_files_for_group(
    app: AppHandle,
    path: String,
    profile_name: String,
    group_id: String,
) -> Result<Vec<String>, String> {
    let project_data = file_cache::load_project_data(&app, &path, &profile_name)?;
    let root_path = Path::new(&path);

    if let Some(group) = project_data.groups.iter().find(|g| g.id == group_id) {
        let expanded_files = context_generator::expand_group_paths_to_files(
            &group.paths,
            &project_data.file_metadata_cache,
            root_path,
        );
        Ok(expanded_files)
    } else {
        Err("group.not_found".to_string())
    }
}