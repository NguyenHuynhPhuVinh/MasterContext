// src-tauri/src/commands.rs
use crate::{context_generator, file_cache, models, project_scanner};
use lazy_static::lazy_static; // <-- THÊM IMPORT
use notify::{RecursiveMode, RecommendedWatcher, Watcher}; // <-- THÊM IMPORT
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex; // <-- THÊM IMPORT
use std::time::{Duration, Instant}; // <-- THÊM IMPORT
use tauri::{command, Emitter, Window, AppHandle, Manager}; // <-- THÊM AppHandle và Manager
use sha2::{Digest, Sha256}; // <-- THÊM IMPORT

// --- BẮT ĐẦU KHỐI MÃ MỚI: QUẢN LÝ TRẠNG THÁI WATCHER ---
lazy_static! {
    // Global state để giữ watcher. Dùng Mutex để đảm bảo an toàn luồng.
    // Option<RecommendedWatcher> cho phép chúng ta có trạng thái "không theo dõi".
    static ref FILE_WATCHER: Mutex<Option<RecommendedWatcher>> = Mutex::new(None);
    // State để debounce các sự kiện thay đổi file.
    static ref LAST_CHANGE_TIME: Mutex<Option<Instant>> = Mutex::new(None);
}
// --- KẾT THÚC KHỐI MÃ MỚI ---

fn sanitize_group_name(name: &str) -> String {
    name.replace(|c: char| !c.is_alphanumeric(), "_")
}

// --- CẬP NHẬT: Thêm profile_name vào tất cả các command liên quan đến dữ liệu ---

#[command]
pub fn scan_project(window: Window, path: String, profile_name: String) {
    let window_clone = window.clone();
    let path_clone = path.clone();
    let app = window.app_handle().clone();

    std::thread::spawn(move || {
        // Luôn load dữ liệu của hồ sơ đang active để thực hiện smart scan
        let old_data = file_cache::load_project_data(&app, &path, &profile_name).unwrap_or_default();
        let should_start_watching = old_data.is_watching_files.unwrap_or(false);

        // perform_smart_scan_and_rebuild sẽ trả về dữ liệu quét chung (cây thư mục, cache file)
        // và các nhóm đã được cập nhật cho hồ sơ hiện tại.
        match project_scanner::perform_smart_scan_and_rebuild(&window, &path, old_data) {
            Ok(new_data) => {
                // Lưu lại dữ liệu cho hồ sơ vừa quét
                if let Err(e) = file_cache::save_project_data(&app, &path, &profile_name, &new_data) {
                    let _ = window.emit("scan_error", e);
                    return;
                }

                // --- FIX: Kích hoạt auto-export sau khi quét lại nếu cần ---
                if new_data.sync_enabled.unwrap_or(false) && new_data.sync_path.is_some() {
                    perform_auto_export(&path, &profile_name, &new_data);
                }
                
                // Gửi toàn bộ dữ liệu quét về frontend
                let _ = window.emit("scan_complete", &new_data);

                // Logic watcher giữ nguyên
                if should_start_watching {
                    if let Err(e) = start_file_watching(window_clone, path_clone) {
                        println!("[Error] Auto-starting watcher failed: {}", e);
                    }
                }
            }
            Err(e) => {
                let _ = window.emit("scan_error", e);
            }
        }
    });
}

#[command]
pub fn load_profile_data(
    app: AppHandle,
    project_path: String,
    profile_name: String,
) -> Result<models::CachedProjectData, String> {
    file_cache::load_project_data(&app, &project_path, &profile_name)
}

#[command]
pub fn update_groups_in_project_data(
    app: AppHandle, // <-- Thêm app
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
    app: AppHandle, // <-- Thêm app
    root_path_str: String,
    profile_name: String,
    paths: Vec<String>,
) -> Result<models::GroupStats, String> {
    let project_data = file_cache::load_project_data(&app, &root_path_str, &profile_name)?;
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
    app: AppHandle, // <-- Thêm app
    group_id: String,
    root_path_str: String,
    profile_name: String,
    paths: Vec<String>,
) {
    let app_clone = app.clone(); // Clone để dùng trong thread
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
    app: AppHandle, // <-- Thêm app
    group_id: String,
    root_path_str: String,
    profile_name: String,
    // --- XÓA tham số `use_full_tree` ---
) {
    std::thread::spawn(move || {
        let result: Result<String, String> = (|| {
            let project_data = file_cache::load_project_data(&app, &root_path_str, &profile_name)?;
            
            // --- LOGIC MỚI: Tự động đọc cài đặt từ dữ liệu hồ sơ ---
            let use_full_tree = project_data.export_use_full_tree.unwrap_or(false); // Mặc định là false (cây tối giản)
            let with_line_numbers = project_data.export_with_line_numbers.unwrap_or(true); // Mặc định là true

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
                use_full_tree, // <-- Sử dụng giá trị đã đọc
                &project_data.file_tree,
                with_line_numbers, // <-- Sử dụng giá trị đã đọc
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
pub fn start_project_export(window: Window, app: AppHandle, path: String, profile_name: String) {
    std::thread::spawn(move || {
        let result: Result<String, String> = (|| {
            let project_data = file_cache::load_project_data(&app, &path, &profile_name)?;
            // Đọc cài đặt từ profile
            let with_line_numbers = project_data.export_with_line_numbers.unwrap_or(true);
            let all_files: Vec<String> = project_data.file_metadata_cache.keys().cloned().collect();
            if all_files.is_empty() {
                return Err("Dự án không có file nào để xuất.".to_string());
            }
            context_generator::generate_context_from_files(
                &path,
                &all_files,
                true,
                &project_data.file_tree,
                with_line_numbers,
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
    app: AppHandle, // <-- Thêm app
    group_id: String,
    root_path_str: String,
    profile_name: String,
    use_full_tree: bool,
    with_line_numbers: bool, // <-- THAM SỐ MỚI
) -> Result<String, String> {
    let project_data = file_cache::load_project_data(&app, &root_path_str, &profile_name)?;
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
        with_line_numbers,
    )
}

#[command]
pub fn generate_project_context(app: AppHandle, path: String, profile_name: String, with_line_numbers: bool) -> Result<String, String> {
    let project_data = file_cache::load_project_data(&app, &path, &profile_name)?;
    let all_files: Vec<String> = project_data.file_metadata_cache.keys().cloned().collect();
    if all_files.is_empty() {
        return Err("Dự án không có file nào để tạo ngữ cảnh.".to_string());
    }
    context_generator::generate_context_from_files(
        &path,
        &all_files,
        true,
        &project_data.file_tree,
        with_line_numbers,
    )
}

// --- BẮT ĐẦU SỬA ĐỔI ---
#[command]
pub fn update_sync_settings(
    app: AppHandle, // <-- Thêm app
    path: String,
    profile_name: String,
    enabled: bool,
    sync_path: Option<String>,
) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&app, &path, &profile_name)?;
    project_data.sync_enabled = Some(enabled);
    project_data.sync_path = sync_path;

    // --- LOGIC MỚI: KÍCH HOẠT ĐỒNG BỘ NGAY LẬP TỨC KHI BẬT ---
    // Chỉ chạy khi `enabled` là true và có một đường dẫn hợp lệ.
    if enabled && project_data.sync_path.is_some() {
        // Gọi hàm xuất
        perform_auto_export(&path, &profile_name, &project_data);
    }
    // --- KẾT THÚC LOGIC MỚI ---

    // Lưu lại cài đặt vào file
    file_cache::save_project_data(&app, &path, &profile_name, &project_data)
}
// --- KẾT THÚC SỬA ĐỔI ---

#[command]
pub fn set_group_cross_sync(
    app: AppHandle, // <-- Thêm app
    path: String,
    profile_name: String,
    group_id: String,
    enabled: bool,
) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&app, &path, &profile_name)?;
    if let Some(group) = project_data.groups.iter_mut().find(|g| g.id == group_id) {
        group.cross_sync_enabled = Some(enabled);
    } else {
        return Err(format!("Không tìm thấy nhóm với ID: {}", group_id));
    }
    file_cache::save_project_data(&app, &path, &profile_name, &project_data)
}

#[command]
pub fn update_custom_ignore_patterns(
    app: AppHandle, // <-- Thêm app
    path: String,
    profile_name: String,
    patterns: Vec<String>,
) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&app, &path, &profile_name)?;
    project_data.custom_ignore_patterns = Some(patterns);
    file_cache::save_project_data(&app, &path, &profile_name, &project_data)
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
    let use_full_tree = data.export_use_full_tree.unwrap_or(false);
    let with_line_numbers = data.export_with_line_numbers.unwrap_or(true);
    let all_files: Vec<String> = data.file_metadata_cache.keys().cloned().collect();
    if let Ok(proj_context) = context_generator::generate_context_from_files(
        project_path,
        &all_files,
        use_full_tree,
        &data.file_tree,
        with_line_numbers,
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
pub fn list_profiles(app: AppHandle, project_path: String) -> Result<Vec<String>, String> {
    // Không cần get_project_config_dir nữa vì nó không trả về đường dẫn đúng
    // Logic sẽ dựa vào việc đọc thư mục do Tauri quản lý
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

// --- COMMAND MỚI: Lưu cài đặt theo dõi file ---
#[command]
pub fn set_file_watching_setting(app: AppHandle, path: String, profile_name: String, enabled: bool) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&app, &path, &profile_name)?;
    project_data.is_watching_files = Some(enabled);
    file_cache::save_project_data(&app, &path, &profile_name, &project_data)
}

// --- COMMAND MỚI: Lưu cài đặt xuất file ---
#[command]
pub fn set_export_use_full_tree_setting(app: AppHandle, path: String, profile_name: String, enabled: bool) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&app, &path, &profile_name)?;
    project_data.export_use_full_tree = Some(enabled);
    file_cache::save_project_data(&app, &path, &profile_name, &project_data)
}

// --- COMMAND MỚI: Lưu cài đặt xuất file có số dòng ---
#[command]
pub fn set_export_with_line_numbers_setting(app: AppHandle, path: String, profile_name: String, enabled: bool) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&app, &path, &profile_name)?;
    project_data.export_with_line_numbers = Some(enabled);
    file_cache::save_project_data(&app, &path, &profile_name, &project_data)
}

// --- COMMAND MỚI: Bắt đầu theo dõi file ---
#[command]
pub fn start_file_watching(window: Window, path: String) -> Result<(), String> {
    // Dừng watcher cũ nếu có
    stop_file_watching()?;

    let window_clone = window.clone();
    let debounce_duration = Duration::from_secs(2);

    let mut watcher = notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
        match res {
            Ok(event) => {
                // Chỉ quan tâm đến các sự kiện thay đổi nội dung, tạo hoặc xóa file/thư mục.
                if event.kind.is_modify() || event.kind.is_create() || event.kind.is_remove() {
                    let mut last_change = LAST_CHANGE_TIME.lock().unwrap();
                    let now = Instant::now();

                    // Debounce: Nếu sự kiện mới đến quá nhanh, bỏ qua.
                    if last_change.is_none() || now.duration_since(last_change.unwrap()) > debounce_duration {
                        println!("[Watcher] Detected change: {:?}, triggering rescan.", event.paths);
                        // Gửi sự kiện về frontend để yêu cầu quét lại.
                        let _ = window_clone.emit("file_change_detected", ());
                        *last_change = Some(now);
                    }
                }
            }
            Err(e) => println!("[Watcher] Error: {:?}", e),
        }
    })
    .map_err(|e| format!("Không thể tạo watcher: {}", e))?;

    // Bắt đầu theo dõi thư mục dự án một cách đệ quy.
    watcher
        .watch(Path::new(&path), RecursiveMode::Recursive)
        .map_err(|e| format!("Không thể bắt đầu theo dõi thư mục: {}", e))?;

    // Lưu watcher vào global state để nó tiếp tục chạy.
    *FILE_WATCHER.lock().unwrap() = Some(watcher);
    println!("[Watcher] Started watching path: {}", path);
    Ok(())
}

// --- COMMAND MỚI: Dừng theo dõi file ---
#[command]
pub fn stop_file_watching() -> Result<(), String> {
    // Lấy watcher ra khỏi Mutex, hành động này sẽ drop (hủy) watcher cũ,
    // tự động dừng tiến trình theo dõi.
    if let Some(watcher) = FILE_WATCHER.lock().unwrap().take() {
        // Không cần làm gì với `watcher`, nó sẽ tự hủy khi ra khỏi scope.
        drop(watcher);
        println!("[Watcher] Stopped watching.");
    }
    Ok(())
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
    // 1. Đọc dữ liệu từ hồ sơ nguồn (ví dụ: "default")
    let source_data = file_cache::load_project_data(&app, &project_path, &source_profile_name)?;

    // 2. Tạo một cấu trúc dữ liệu mới, kế thừa các phần tốn kém để quét lại
    let new_data = models::CachedProjectData {
        // Kế thừa những dữ liệu này
        stats: source_data.stats,
        file_tree: source_data.file_tree,
        file_metadata_cache: source_data.file_metadata_cache,
        data_hash: source_data.data_hash,

        // Reset (dọn dẹp) các dữ liệu dành riêng cho hồ sơ
        groups: vec![], // Bắt đầu với danh sách nhóm rỗng
        sync_enabled: Some(false), // Tắt đồng bộ mặc định
        sync_path: None,
        custom_ignore_patterns: Some(vec![]), // Xóa các mẫu ignore tùy chỉnh
        is_watching_files: Some(false), // Tắt theo dõi file mặc định
        export_use_full_tree: Some(false), // <-- THÊM giá trị mặc định cho hồ sơ mới
        export_with_line_numbers: Some(true), // <-- THÊM giá trị mặc định cho hồ sơ mới
    };

    // 3. Lưu cấu trúc dữ liệu mới này thành hồ sơ mới
    file_cache::save_project_data(&app, &project_path, &new_profile_name, &new_data)
}
