// src-tauri/src/commands.rs
use crate::{context_generator, file_cache, models, project_scanner};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{command, Emitter, Window};

// --- THÊM CÁC USE STATEMENTS NÀY ---
use std::collections::HashMap;

// --- HÀM HELPER MỚI: TÁCH RA ĐỂ TÁI SỬ DỤNG ---
fn sanitize_group_name(name: &str) -> String {
    name.replace(|c: char| !c.is_alphanumeric(), "_")
} // Bỏ AppHandle khỏi use list vì không cần nữa

#[command]
pub fn open_project(window: Window, path: String) {
    std::thread::spawn(move || {
        // --- LOGIC MỚI, KHÔNG CÒN VÒNG LẶP ---

        // 1. Tải dữ liệu cũ để so sánh hash sau này
        let old_data_result = file_cache::load_project_data(&path);
        let old_hash = old_data_result
            .as_ref()
            .ok()
            .and_then(|d| d.data_hash.clone());

        // 2. Thực hiện quét (hàm này giờ chỉ trả về dữ liệu, không ghi file)
        match project_scanner::perform_smart_scan_and_rebuild(&path) {
            Ok(new_data) => {
                // 3. Lưu dữ liệu mới vào cache
                if let Err(e) = file_cache::save_project_data(&path, &new_data) {
                    let _ = window.emit("scan_error", e);
                    return;
                }

                // 4. Gửi dữ liệu mới về cho frontend
                let _ = window.emit("scan_complete", &new_data);

                // 5. Kiểm tra và thực hiện đồng bộ TỰ ĐỘNG ngay tại đây
                let sync_enabled = new_data.sync_enabled.unwrap_or(false);
                let has_changed = old_hash != new_data.data_hash;

                if sync_enabled && has_changed && new_data.sync_path.is_some() {
                    let _ = window.emit(
                        "auto_sync_started",
                        "Phát hiện thay đổi, bắt đầu đồng bộ...",
                    );
                    perform_auto_export(&path, &new_data);
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
    groups: Vec<models::Group>,
) -> Result<(), String> {
    // 1. Tải dữ liệu dự án hiện tại từ đĩa
    let mut project_data = file_cache::load_project_data(&path)?;
    let old_groups = project_data.groups.clone();

    // 2. Nếu đồng bộ được bật, xử lý xóa/đổi tên file
    if project_data.sync_enabled.unwrap_or(false) {
        if let Some(sync_path_str) = &project_data.sync_path {
            let sync_path = PathBuf::from(sync_path_str);

            let new_groups_map: HashMap<_, _> =
                groups.iter().map(|g| (g.id.clone(), g)).collect();
            let old_groups_map: HashMap<_, _> =
                old_groups.iter().map(|g| (g.id.clone(), g)).collect();

            // 2a. Xử lý xóa nhóm
            for old_group in &old_groups {
                if !new_groups_map.contains_key(&old_group.id) {
                    // Nhóm này đã bị xóa
                    let safe_name = sanitize_group_name(&old_group.name);
                    let file_to_delete = sync_path.join(format!("{}_context.txt", safe_name));
                    if file_to_delete.exists() {
                        println!("[SYNC] Deleting file: {:?}", file_to_delete);
                        let _ = fs::remove_file(file_to_delete); // Bỏ qua lỗi nếu file không tồn tại
                    }
                }
            }

            // 2b. Xử lý đổi tên nhóm
            for new_group in &groups {
                if let Some(old_group) = old_groups_map.get(&new_group.id) {
                    if old_group.name != new_group.name {
                        // Nhóm này đã được đổi tên
                        let old_safe_name = sanitize_group_name(&old_group.name);
                        let new_safe_name = sanitize_group_name(&new_group.name);
                        let old_file = sync_path.join(format!("{}_context.txt", old_safe_name));
                        let new_file = sync_path.join(format!("{}_context.txt", new_safe_name));

                        if old_file.exists() {
                            println!("[SYNC] Renaming file: {:?} -> {:?}", old_file, new_file);
                            let _ = fs::rename(old_file, new_file); // Bỏ qua lỗi nếu không thành công
                        }
                    }
                }
            }
        }
    }

    // 3. Cập nhật danh sách nhóm trong dữ liệu
    project_data.groups = groups;

    // 4. Nếu đồng bộ được bật, chạy lại toàn bộ quá trình xuất
    // Điều này đảm bảo các nhóm mới được tạo và nội dung các nhóm được cập nhật
    if project_data.sync_enabled.unwrap_or(false) && project_data.sync_path.is_some() {
        let _ = window.emit(
            "auto_sync_started",
            "Cập nhật nhóm, bắt đầu đồng bộ...",
        );
        perform_auto_export(&path, &project_data);
        let _ = window.emit("auto_sync_complete", "Đồng bộ hoàn tất.");
    }

    // 5. Lưu lại dữ liệu dự án đã cập nhật
    file_cache::save_project_data(&path, &project_data)
}

#[command]
// Bỏ _app_handle không cần thiết
pub fn calculate_group_stats_from_cache(
    root_path_str: String,
    paths: Vec<String>,
) -> Result<models::GroupStats, String> {
    let project_data = file_cache::load_project_data(&root_path_str)?;
    let root_path = Path::new(&root_path_str);
    Ok(project_scanner::recalculate_stats_for_paths(
        &paths,
        &project_data.file_metadata_cache,
        root_path,
    ))
}

#[command]
// Bỏ app_handle không cần thiết
pub fn start_group_update(
    window: Window,
    group_id: String,
    root_path_str: String,
    paths: Vec<String>,
) {
    std::thread::spawn(move || {
        // Gọi hàm không cần app_handle
        let result = calculate_group_stats_from_cache(root_path_str.clone(), paths.clone());
        match result {
            Ok(new_stats) => {
                if let Ok(mut project_data) = file_cache::load_project_data(&root_path_str) {
                    if let Some(group) = project_data.groups.iter_mut().find(|g| g.id == group_id) {
                        group.paths = paths.clone();
                        group.stats = new_stats;

                        // --- LOGIC MỚI: KIỂM TRA VÀ KÍCH HOẠT ĐỒNG BỘ SAU KHI CẬP NHẬT NHÓM ---
                        let sync_enabled = project_data.sync_enabled.unwrap_or(false);
                        if sync_enabled && project_data.sync_path.is_some() {
                            let _ = window.emit(
                                "auto_sync_started",
                                "Phát hiện thay đổi nhóm, bắt đầu đồng bộ...",
                            );
                            perform_auto_export(&root_path_str, &project_data);
                            let _ = window.emit("auto_sync_complete", "Đồng bộ hoàn tất.");
                        }
                        // --- KẾT THÚC LOGIC MỚI ---
                    }
                    let _ = file_cache::save_project_data(&root_path_str, &project_data);
                }
                let _ = window.emit(
                    "group_update_complete",
                    serde_json::json!({
                        "groupId": group_id,
                        "paths": paths,
                        "stats": new_stats
                    }),
                );
            }
            Err(e) => {
                let _ = window.emit("group_update_error", e);
            }
        }
    });
}

#[command]
// Chữ ký đã đúng, giữ nguyên
pub fn start_group_export(
    window: Window,
    group_id: String,
    root_path_str: String,
    use_full_tree: bool,
) {
    // <-- THÊM use_full_tree
    println!(
        "[RUST] EXPORT: Nhận yêu cầu cho nhóm ID: {}, use_full_tree: {}",
        group_id, use_full_tree
    );
    std::thread::spawn(move || {
        let result: Result<String, String> = (|| {
            let project_data = file_cache::load_project_data(&root_path_str)?;
            let root_path = Path::new(&root_path_str);
            let group = project_data
                .groups
                .iter()
                .find(|g| g.id == group_id)
                .ok_or_else(|| format!("Không tìm thấy nhóm với ID: {}", group_id))?;

            println!(
                "[RUST] EXPORT: Đã tìm thấy nhóm '{}'. Paths được lưu: {:?}",
                group.name, group.paths
            );
            let expanded_files = context_generator::expand_group_paths_to_files(
                &group.paths,
                &project_data.file_metadata_cache,
                root_path,
            );

            println!(
                "[RUST] EXPORT: Sau khi mở rộng, có {} files: {:?}",
                expanded_files.len(),
                expanded_files
            );
            if expanded_files.is_empty() {
                return Err("Nhóm này không chứa file nào để xuất.".to_string());
            }
            context_generator::generate_context_from_files(
                &root_path_str,
                &expanded_files,
                use_full_tree,           // <-- Truyền tham số
                &project_data.file_tree, // <-- Truyền cả cây thư mục đầy đủ
            )
        })();
        match result {
            Ok(context) => {
                println!("[RUST] EXPORT: Thành công! Đang gửi sự kiện group_export_complete.");
                let _ = window.emit(
                    "group_export_complete",
                    serde_json::json!({ "groupId": group_id, "context": context }),
                );
            }
            Err(e) => {
                println!(
                    "[RUST] EXPORT: Lỗi! Đang gửi sự kiện group_export_error: {}",
                    e
                );
                let _ = window.emit("group_export_error", e);
            }
        }
    });
}

#[command]
// Bỏ app_handle không cần thiết
pub fn start_project_export(window: Window, path: String) {
    std::thread::spawn(move || {
        let result: Result<String, String> = (|| {
            let project_data = file_cache::load_project_data(&path)?;
            let all_files: Vec<String> = project_data.file_metadata_cache.keys().cloned().collect();
            if all_files.is_empty() {
                return Err("Dự án không có file nào để xuất.".to_string());
            }
            // --- SỬA LỖI Ở ĐÂY ---
            // Cung cấp 2 tham số còn thiếu
            context_generator::generate_context_from_files(
                &path,
                &all_files,
                true,                    // Luôn dùng cây thư mục đầy đủ khi xuất toàn bộ dự án
                &project_data.file_tree, // Cung cấp cây thư mục đầy đủ
            )
            // --- KẾT THÚC SỬA LỖI ---
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

// --- COMMAND MỚI: Chỉ tạo và trả về context cho một nhóm ---
#[command]
pub fn generate_group_context(group_id: String, root_path_str: String, use_full_tree: bool) -> Result<String, String> {
    let project_data = file_cache::load_project_data(&root_path_str)?;
    let root_path = Path::new(&root_path_str);
    let group = project_data.groups.iter()
        .find(|g| g.id == group_id)
        .ok_or_else(|| format!("Không tìm thấy nhóm với ID: {}", group_id))?;
    
    let expanded_files = context_generator::expand_group_paths_to_files(&group.paths, &project_data.file_metadata_cache, root_path);
    
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

// --- COMMAND MỚI: Chỉ tạo và trả về context cho toàn bộ dự án ---
#[command]
pub fn generate_project_context(path: String) -> Result<String, String> {
    let project_data = file_cache::load_project_data(&path)?;
    let all_files: Vec<String> = project_data.file_metadata_cache.keys().cloned().collect();
    if all_files.is_empty() {
        return Err("Dự án không có file nào để tạo ngữ cảnh.".to_string());
    }

    context_generator::generate_context_from_files(
        &path, 
        &all_files,
        true, // Luôn dùng cây thư mục đầy đủ
        &project_data.file_tree
    )
}

// --- COMMAND MỚI: Cập nhật cài đặt đồng bộ ---
#[command]
pub fn update_sync_settings(
    path: String,
    enabled: bool,
    sync_path: Option<String>,
) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&path)?;
    project_data.sync_enabled = Some(enabled);
    project_data.sync_path = sync_path;
    file_cache::save_project_data(&path, &project_data)
}

#[command]
pub fn set_group_cross_sync(path: String, group_id: String, enabled: bool) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&path)?;

    if let Some(group) = project_data.groups.iter_mut().find(|g| g.id == group_id) {
        group.cross_sync_enabled = Some(enabled);
    } else {
        return Err(format!("Không tìm thấy nhóm với ID: {}", group_id));
    }

    file_cache::save_project_data(&path, &project_data)
}

// --- COMMAND MỚI: Cập nhật các mẫu loại trừ ---
#[command]
pub fn update_custom_ignore_patterns(path: String, patterns: Vec<String>) -> Result<(), String> {
    let mut project_data = file_cache::load_project_data(&path)?;
    project_data.custom_ignore_patterns = Some(patterns);
    file_cache::save_project_data(&path, &project_data)
}

// --- HÀM HELPER: Lưu context, được sử dụng bởi auto_export ---
fn save_context_to_path_internal(path: String, content: String) -> Result<(), String> {
    let file_path = Path::new(&path);
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Không thể tạo thư mục cha: {}", e))?;
    }
    fs::write(file_path, content).map_err(|e| format!("Không thể ghi vào file: {}", e))
}

// --- HÀM HELPER MỚI: Logic xuất tự động ---
fn perform_auto_export(project_path: &str, data: &models::CachedProjectData) {
    let sync_path_base = PathBuf::from(data.sync_path.as_ref().unwrap());

    // 1. Xuất toàn bộ dự án
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

    // 2. Xuất từng nhóm
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
                // --- SỬA Ở ĐÂY: DÙNG HÀM HELPER ---
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
