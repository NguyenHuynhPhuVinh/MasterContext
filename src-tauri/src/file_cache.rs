// src-tauri/src/file_cache.rs
use crate::models::CachedProjectData;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

pub fn get_project_config_path(project_path_str: &str) -> Result<PathBuf, String> {
    let project_path = Path::new(project_path_str);
    if !project_path.is_dir() {
        return Err(format!(
            "'{}' không phải là một thư mục hợp lệ.",
            project_path_str
        ));
    }
    let config_dir = project_path.join(".mastercontext");
    fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Không thể tạo thư mục cấu hình '.mastercontext': {}", e))?;
    Ok(config_dir.join("data.json"))
}

pub fn load_project_data(path: &str) -> Result<CachedProjectData, String> {
    let config_path = get_project_config_path(path)?;
    if !config_path.exists() {
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

pub fn save_project_data(path: &str, data: &CachedProjectData) -> Result<(), String> {
    let config_path = get_project_config_path(path)?;
    let json_string = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Không thể serialize dữ liệu dự án: {}", e))?;
    let mut file = File::create(config_path)
        .map_err(|e| format!("Không thể tạo/ghi file dữ liệu dự án: {}", e))?;
    file.write_all(json_string.as_bytes())
        .map_err(|e| format!("Lỗi khi ghi file dữ liệu dự án: {}", e))?;
    Ok(())
}
