// src-tauri/src/commands/utils.rs
use crate::{context_generator, models};
use std::fs;
use std::path::{Path, PathBuf};

pub fn sanitize_group_name(name: &str) -> String {
    name.replace(|c: char| !c.is_alphanumeric(), "_")
}

fn save_context_to_path_internal(path: String, content: String) -> Result<(), String> {
    let file_path = Path::new(&path);
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Không thể tạo thư mục cha: {}", e))?;
    }
    fs::write(file_path, content).map_err(|e| format!("Không thể ghi vào file: {}", e))
}

pub fn perform_auto_export(project_path: &str, _profile_name: &str, data: &models::CachedProjectData) {
    let sync_path_base = PathBuf::from(data.sync_path.as_ref().unwrap());
    let use_full_tree = data.export_use_full_tree.unwrap_or(false);
    let with_line_numbers = data.export_with_line_numbers.unwrap_or(true);
    let always_apply_text = &data.always_apply_text;
    let all_files: Vec<String> = data.file_metadata_cache.keys().cloned().collect();

    if let Ok(proj_context) = context_generator::generate_context_from_files(
        project_path,
        &all_files,
        use_full_tree,
        &data.file_tree,
        with_line_numbers,
        always_apply_text,
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
                use_full_tree,
                &data.file_tree,
                with_line_numbers,
                always_apply_text,
            ) {
                let safe_name = sanitize_group_name(&group.name);
                let file_name = sync_path_base.join(format!("{}_context.txt", safe_name));
                let _ = save_context_to_path_internal(file_name.to_string_lossy().to_string(), group_context);
            }
        }
    }
}