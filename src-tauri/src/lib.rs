// src-tauri/src/lib.rs

// Khai báo các module mới
mod commands;
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
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::open_project,
            commands::update_groups_in_project_data,
            commands::start_group_update,
            commands::start_group_export,
            commands::start_project_export,
            commands::calculate_group_stats_from_cache,
            commands::update_sync_settings,
            commands::set_group_cross_sync,
            commands::generate_group_context,
            commands::generate_project_context
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
