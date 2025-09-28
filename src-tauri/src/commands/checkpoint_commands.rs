// src-tauri/src/commands/checkpoint_commands.rs
use std::fs;
use std::path::Path;
use tauri::command;
use uuid::Uuid;
use walkdir::WalkDir;

#[command]
pub async fn create_checkpoint(
    project_path: String,
    profile_name: String,
    files_to_backup: Vec<String>,
) -> Result<String, String> {
    let checkpoint_id = Uuid::new_v4().to_string();
    let checkpoint_dir = Path::new(&project_path)
        .join(".mastercontext")
        .join("checkpoints")
        .join(&profile_name)
        .join(&checkpoint_id);

    // Create the checkpoint directory
    fs::create_dir_all(&checkpoint_dir).map_err(|e| format!("Failed to create checkpoint directory: {}", e))?;

    // Backup each file
    for file_path in files_to_backup {
        let full_path = Path::new(&project_path).join(&file_path);
        if full_path.exists() {
            let backup_path = checkpoint_dir.join(&file_path);
            // Create parent directories if needed
            if let Some(parent) = backup_path.parent() {
                fs::create_dir_all(parent).map_err(|e| format!("Failed to create backup directories: {}", e))?;
            }
            fs::copy(&full_path, &backup_path).map_err(|e| format!("Failed to backup file {}: {}", file_path, e))?;
        }
    }

    Ok(checkpoint_id)
}

#[command]
pub async fn revert_to_checkpoint(
    project_path: String,
    profile_name: String,
    checkpoint_id: String,
    created_files_in_turn: Vec<String>,
) -> Result<(), String> {
    let checkpoint_dir = Path::new(&project_path)
        .join(".mastercontext")
        .join("checkpoints")
        .join(&profile_name)
        .join(&checkpoint_id);

    if !checkpoint_dir.exists() {
        return Err(format!("Checkpoint {} does not exist", checkpoint_id));
    }

    // Restore backed up files
    for entry in WalkDir::new(&checkpoint_dir) {
        let entry = entry.map_err(|e| format!("Failed to read checkpoint directory: {}", e))?;
        if entry.file_type().is_file() {
            let relative_path = entry.path().strip_prefix(&checkpoint_dir).map_err(|e| format!("Failed to get relative path: {}", e))?;
            let original_path = Path::new(&project_path).join(relative_path);
            
            // Create parent directories if needed
            if let Some(parent) = original_path.parent() {
                fs::create_dir_all(parent).map_err(|e| format!("Failed to create directories: {}", e))?;
            }
            
            fs::copy(&entry.path(), &original_path).map_err(|e| format!("Failed to restore file {}: {}", relative_path.display(), e))?;
        }
    }

    // Delete created files
    for file_path in created_files_in_turn {
        let full_path = Path::new(&project_path).join(&file_path);
        if full_path.exists() {
            fs::remove_file(&full_path).map_err(|e| format!("Failed to delete created file {}: {}", file_path, e))?;
        }
    }

    // Remove the checkpoint directory
    fs::remove_dir_all(&checkpoint_dir).map_err(|e| format!("Failed to remove checkpoint directory: {}", e))?;

    Ok(())
}