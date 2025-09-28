// src-tauri/src/commands/checkpoint_commands.rs
use crate::file_cache;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{command, AppHandle};
use uuid::Uuid;
use walkdir::WalkDir;

// Helper to get the base directory for a profile's checkpoints
fn get_checkpoints_dir(
    app: &AppHandle,
    project_path: &str,
    profile_name: &str,
) -> Result<PathBuf, String> {
    let project_dir = file_cache::get_project_config_dir(app, project_path)?;
    let checkpoints_dir = project_dir.join("checkpoints").join(profile_name);
    fs::create_dir_all(&checkpoints_dir)
        .map_err(|e| format!("Không thể tạo thư mục checkpoints: {}", e))?;
    Ok(checkpoints_dir)
}

#[command]
pub fn create_checkpoint(
    app: AppHandle,
    project_path: String,
    profile_name: String,
    files_to_backup: Vec<String>,
) -> Result<String, String> {
    let checkpoint_id = Uuid::new_v4().to_string();
    let checkpoints_dir = get_checkpoints_dir(&app, &project_path, &profile_name)?;
    let checkpoint_path = checkpoints_dir.join(&checkpoint_id);

    fs::create_dir_all(&checkpoint_path)
        .map_err(|e| format!("Không thể tạo thư mục checkpoint: {}", e))?;

    let project_root = Path::new(&project_path);

    for rel_path_str in files_to_backup {
        let source_path = project_root.join(&rel_path_str);
        if source_path.exists() {
            let dest_path = checkpoint_path.join(&rel_path_str);
            if let Some(parent) = dest_path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::copy(&source_path, &dest_path).map_err(|e| e.to_string())?;
        }
        // If the source file doesn't exist (e.g., it's a new file to be created),
        // we simply don't back it up. Reverting will involve deleting it.
    }

    Ok(checkpoint_id)
}

#[command]
pub fn revert_to_checkpoint(
    app: AppHandle,
    project_path: String,
    profile_name: String,
    checkpoint_id: String,
    created_files_in_turn: Vec<String>,
) -> Result<(), String> {
    let checkpoints_dir = get_checkpoints_dir(&app, &project_path, &profile_name)?;
    let checkpoint_path = checkpoints_dir.join(&checkpoint_id);

    if !checkpoint_path.is_dir() {
        return Err(format!("Checkpoint '{}' không tồn tại.", checkpoint_id));
    }

    let project_root = Path::new(&project_path);

    // 1. Restore backed-up files
    for entry in WalkDir::new(&checkpoint_path)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let src_path = entry.path();
        if src_path.is_file() {
            if let Ok(rel_path) = src_path.strip_prefix(&checkpoint_path) {
                let dest_path = project_root.join(rel_path);
                if let Some(parent) = dest_path.parent() {
                    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
                fs::copy(src_path, &dest_path).map_err(|e| e.to_string())?;
            }
        }
    }

    // 2. Delete files that were newly created during the turn
    for rel_path_str in created_files_in_turn {
        let file_to_delete = project_root.join(rel_path_str);
        if file_to_delete.exists() {
            let _ = fs::remove_file(file_to_delete);
        }
    }

    // 3. Clean up the checkpoint directory
    fs::remove_dir_all(&checkpoint_path).map_err(|e| e.to_string())?;

    Ok(())
}