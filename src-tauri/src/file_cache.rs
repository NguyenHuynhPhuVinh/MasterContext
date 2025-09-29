// src-tauri/src/file_cache.rs
use crate::models::CachedProjectData;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::PathBuf;
use sha2::{Digest, Sha256}; // <-- THÊM IMPORT
use tauri::{AppHandle, Manager}; // <-- THÊM IMPORT

// --- HÀM MỚI: TÁCH RIÊNG LOGIC LẤY THƯ MỤC CẤU HÌNH ---
pub fn get_project_config_dir(app: &AppHandle, project_path_str: &str) -> Result<PathBuf, String> {
    // 1. Lấy thư mục cấu hình chung của ứng dụng
    let app_config_dir = app.path()
        .app_config_dir()
        .map_err(|e| format!("Không thể xác định thư mục cấu hình ứng dụng: {}", e))?;

    // 2. Băm (hash) đường dẫn dự án để tạo ID duy nhất
    let mut hasher = Sha256::new();
    hasher.update(project_path_str.as_bytes());
    let project_hash = hasher.finalize();
    let project_id = format!("{:x}", project_hash);

    // 3. Tạo đường dẫn cuối cùng: <app_config_dir>/projects/<project_id>
    let config_dir = app_config_dir.join("projects").join(project_id);

    // 4. Đảm bảo thư mục tồn tại
    fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Không thể tạo thư mục cấu hình cho dự án: {}", e))?;
    
    Ok(config_dir)
}

// --- CẬP NHẬT: Nhận thêm `app` và `profile_name` ---
pub fn get_project_config_path(
    app: &AppHandle,
    project_path_str: &str,
) -> Result<PathBuf, String> {
    let config_dir = get_project_config_dir(app, project_path_str)?;
    Ok(config_dir.join("project_data.json"))
}

// --- CẬP NHẬT: Nhận thêm `app` và `profile_name` ---
pub fn load_project_data(app: &AppHandle, path: &str) -> Result<CachedProjectData, String> {
    let config_path = get_project_config_path(app, path)?;
    if !config_path.exists() {
        // If file doesn't exist, return a default empty structure
        return Ok(CachedProjectData::default());
    }
    let mut file =
        File::open(config_path).map_err(|e| format!("Không thể mở file dữ liệu dự án: {}", e))?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)
        .map_err(|e| format!("Không thể đọc file dữ liệu dự án: {}", e))?;
    if contents.is_empty() {
        return Ok(CachedProjectData::default());
    }
    serde_json::from_str(&contents).map_err(|e| format!("Lỗi phân tích cú pháp JSON: {}", e))
}

// --- CẬP NHẬT: Nhận thêm `app` và `profile_name` ---
pub fn save_project_data(
    app: &AppHandle,
    path: &str,
    data: &CachedProjectData,
) -> Result<(), String> {
    let config_path = get_project_config_path(app, path)?;
    let json_string = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Không thể serialize dữ liệu dự án: {}", e))?;
    let mut file = File::create(config_path)
        .map_err(|e| format!("Không thể tạo/ghi file dữ liệu dự án: {}", e))?;
    file.write_all(json_string.as_bytes())
        .map_err(|e| format!("Lỗi khi ghi file dữ liệu dự án: {}", e))?;
    Ok(())
}
