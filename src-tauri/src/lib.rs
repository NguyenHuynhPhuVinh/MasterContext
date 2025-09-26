// src-tauri/src/lib.rs

// Khai báo các module
pub mod commands;
pub mod git_utils;
pub mod dependency_analyzer;
pub mod group_updater;
mod context_generator;
mod file_cache;
mod models;
mod project_scanner;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            // THAY THẾ DÒNG NÀY
            // commands::open_project,
            commands::scan_project, // <-- COMMAND MỚI
            commands::delete_project_data,
            commands::load_profile_data, // <-- COMMAND MỚI
            // ... (các command còn lại)
            commands::get_file_content,
            commands::save_file_content,
            commands::update_groups_in_project_data,
            commands::start_group_update,
            commands::start_group_export,
            commands::start_project_export,
            commands::calculate_group_stats_from_cache,
            commands::update_file_exclusions,
            commands::update_sync_settings,
            commands::set_group_cross_sync,
            commands::generate_group_context,
            commands::generate_project_context,
            commands::update_custom_ignore_patterns,
            // Các command mới để quản lý hồ sơ
            commands::list_profiles,
            commands::create_profile,
            commands::delete_profile,
            commands::rename_profile,
            commands::set_file_watching_setting,
            commands::start_file_watching,
            commands::stop_file_watching,
            commands::list_groups_for_profile,
            commands::clone_profile,
            commands::set_export_use_full_tree_setting,
            commands::set_export_with_line_numbers_setting,
            commands::set_export_without_comments_setting, // <-- COMMAND MỚI
            commands::set_export_remove_debug_logs_setting, // <-- COMMAND MỚI
            commands::set_export_super_compressed_setting,
            commands::set_export_exclude_extensions_setting, // <-- COMMAND MỚI
            commands::set_always_apply_text_setting,
            commands::get_app_settings,
            commands::set_recent_paths,
            commands::update_app_settings, // <-- COMMAND MỚI
            commands::check_git_repository,
            commands::get_git_commits,
            commands::get_commit_diff,
            commands::generate_commit_context,
            commands::set_git_export_mode_setting,
            commands::checkout_commit,
            commands::checkout_branch,
            commands::clone_git_repository,
            commands::get_git_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
