// src-tauri/src/lib.rs

// Khai báo các module mới
mod models;
mod file_cache;
mod context_generator;
mod project_scanner;
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::open_project,
            commands::update_groups_in_project_data,
            commands::start_group_update,
            commands::start_group_export,
            commands::start_project_export,
            commands::calculate_group_stats_from_cache
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}