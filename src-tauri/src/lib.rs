// src-tauri/src/lib.rs

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use tauri::Manager;

// --- CÁC ĐỊNH NGHĨA STRUCT TOÀN CỤC ---

#[derive(Serialize, Deserialize, Debug)]
struct DirEntry {
    name: String,
    is_directory: bool,
}

#[derive(Serialize, Deserialize, Debug, Default)]
struct ProjectStats {
    total_files: u64,
    total_dirs: u64,
    total_size: u64,
}

// --- FIX: Chuyển các struct này ra ngoài phạm vi toàn cục ---
#[derive(Serialize, Deserialize, Debug, Default, Clone)]
struct Group {
    id: String,
    name: String,
    description: String,
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
struct ProjectData {
    groups: Vec<Group>,
}
// --- KẾT THÚC FIX ---

fn recursive_scan(path: &Path, stats: &mut ProjectStats) -> std::io::Result<()> {
    for entry_result in fs::read_dir(path)? {
        let entry = entry_result?;
        let entry_path = entry.path();
        if entry_path.is_dir() {
            stats.total_dirs += 1;
            recursive_scan(&entry_path, stats)?;
        } else if entry_path.is_file() {
            stats.total_files += 1;
            if let Ok(metadata) = entry.metadata() {
                stats.total_size += metadata.len();
            }
        }
    }
    Ok(())
}

fn get_data_file_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    // --- FIX: Xử lý Result một cách chính xác bằng toán tử `?` ---
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?; // Chuyển đổi tauri::Error sang String
    
    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Không thể tạo thư mục dữ liệu: {}", e))?;
        
    Ok(app_data_dir.join("data.json"))
}

#[tauri::command]
fn load_project_data(app_handle: tauri::AppHandle, path: String) -> Result<ProjectData, String> {
    let data_file_path = get_data_file_path(&app_handle)?;

    if !data_file_path.exists() {
        return Ok(ProjectData::default());
    }

    let mut file = File::open(data_file_path)
        .map_err(|e| format!("Không thể mở file dữ liệu: {}", e))?;
    
    let mut contents = String::new();
    file.read_to_string(&mut contents)
        .map_err(|e| format!("Không thể đọc file dữ liệu: {}", e))?;

    if contents.is_empty() {
        return Ok(ProjectData::default());
    }

    let all_data: HashMap<String, ProjectData> = serde_json::from_str(&contents)
        .map_err(|e| format!("Lỗi phân tích cú pháp JSON: {}", e))?;

    Ok(all_data.get(&path).cloned().unwrap_or_default())
}

#[tauri::command]
fn save_project_data(app_handle: tauri::AppHandle, path: String, data: ProjectData) -> Result<(), String> {
    let data_file_path = get_data_file_path(&app_handle)?;
    
    let mut all_data: HashMap<String, ProjectData> = if data_file_path.exists() {
        let mut file = File::open(&data_file_path).map_err(|e| format!("Không thể mở file: {}", e))?;
        let mut contents = String::new();
        file.read_to_string(&mut contents).map_err(|e| format!("Không thể đọc file: {}", e))?;
        if contents.is_empty() {
            HashMap::new()
        } else {
            serde_json::from_str(&contents).map_err(|e| format!("Lỗi phân tích cú pháp: {}", e))?
        }
    } else {
        HashMap::new()
    };
    
    all_data.insert(path, data);
    
    let json_string = serde_json::to_string_pretty(&all_data)
        .map_err(|e| format!("Không thể serialize dữ liệu: {}", e))?;
        
    let mut file = File::create(data_file_path)
        .map_err(|e| format!("Không thể tạo/ghi file dữ liệu: {}", e))?;
        
    file.write_all(json_string.as_bytes())
        .map_err(|e| format!("Lỗi khi ghi file: {}", e))?;
        
    Ok(())
}

#[tauri::command]
fn get_project_stats(path: String) -> Result<ProjectStats, String> {
    let mut stats = ProjectStats::default();
    let root_path = Path::new(&path);
    if !root_path.is_dir() {
        return Err(format!("'{}' không phải là một thư mục hợp lệ.", path));
    }
    match recursive_scan(root_path, &mut stats) {
        Ok(_) => Ok(stats),
        Err(e) => Err(format!("Lỗi khi quét thư mục: {}", e)),
    }
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn read_directory(path: String) -> Result<Vec<DirEntry>, String> {
    let mut entries = Vec::new();
    let path_obj = Path::new(&path);
    if !path_obj.is_dir() { return Err(format!("'{}' không phải là một thư mục hợp lệ.", path)); }
    match fs::read_dir(path) {
        Ok(paths) => {
            for path_result in paths {
                if let Ok(path_entry) = path_result {
                    let file_name = path_entry.file_name().into_string().unwrap_or_else(|_| "Tên không hợp lệ".to_string());
                    let is_directory = path_entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false);
                    entries.push(DirEntry { name: file_name, is_directory });
                }
            }
            entries.sort_by(|a, b| { if a.is_directory != b.is_directory { b.is_directory.cmp(&a.is_directory) } else { a.name.cmp(&b.name) } });
            Ok(entries)
        }
        Err(e) => Err(format!("Lỗi khi đọc thư mục: {}", e)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet, 
            read_directory, 
            get_project_stats,
            load_project_data,
            save_project_data
        ]) 
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
