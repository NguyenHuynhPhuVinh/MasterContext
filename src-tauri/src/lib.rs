// src-tauri/src/lib.rs

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

// --- PHẦN THÊM MỚI ---
// Định nghĩa một struct để chứa thông tin về một mục trong thư mục.
// `Serialize` và `Deserialize` là cần thiết để chuyển dữ liệu giữa Rust và JS.
#[derive(Serialize, Deserialize, Debug)]
struct DirEntry {
    name: String,
    is_directory: bool,
}
// --- KẾT THÚC PHẦN THÊM MỚI ---

// Lệnh greet cũ, giữ lại để tham khảo
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// --- PHẦN THÊM MỚI ---
// Lệnh mới để đọc nội dung của một thư mục
#[tauri::command]
fn read_directory(path: String) -> Result<Vec<DirEntry>, String> {
    let mut entries = Vec::new();
    let path_obj = Path::new(&path);

    // Kiểm tra xem đường dẫn có tồn tại và là một thư mục không
    if !path_obj.is_dir() {
        return Err(format!("'{}' không phải là một thư mục hợp lệ.", path));
    }

    match fs::read_dir(path) {
        Ok(paths) => {
            for path_result in paths {
                if let Ok(path_entry) = path_result {
                    let file_name = path_entry
                        .file_name()
                        .into_string()
                        .unwrap_or_else(|_| "Tên không hợp lệ".to_string());
                    
                    let is_directory = path_entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false);

                    entries.push(DirEntry {
                        name: file_name,
                        is_directory,
                    });
                }
            }
            // Sắp xếp: thư mục lên trước, sau đó theo tên alphabet
            entries.sort_by(|a, b| {
                if a.is_directory != b.is_directory {
                    b.is_directory.cmp(&a.is_directory)
                } else {
                    a.name.cmp(&b.name)
                }
            });
            Ok(entries)
        }
        Err(e) => Err(format!("Lỗi khi đọc thư mục: {}", e)),
    }
}
// --- KẾT THÚC PHẦN THÊM MỚI ---


// --- PHẦN MỚI: Struct để chứa dữ liệu thống kê của toàn bộ dự án ---
#[derive(Serialize, Deserialize, Debug, Default)] // Thêm Default để dễ khởi tạo
struct ProjectStats {
    total_files: u64,
    total_dirs: u64,
    total_size: u64, // Lưu dưới dạng bytes
}

// --- PHẦN MỚI: Hàm trợ giúp đệ quy để quét thư mục ---
// Nó nhận vào một đường dẫn và một tham chiếu có thể thay đổi đến struct stats
fn recursive_scan(path: &Path, stats: &mut ProjectStats) -> std::io::Result<()> {
    for entry_result in fs::read_dir(path)? {
        let entry = entry_result?;
        let entry_path = entry.path();
        
        if entry_path.is_dir() {
            stats.total_dirs += 1;
            // Gọi đệ quy cho thư mục con
            recursive_scan(&entry_path, stats)?;
        } else if entry_path.is_file() {
            stats.total_files += 1;
            // Lấy metadata để biết dung lượng file
            if let Ok(metadata) = entry.metadata() {
                stats.total_size += metadata.len();
            }
        }
    }
    Ok(())
}

// --- PHẦN MỚI: Tauri command mới để lấy thống kê dự án ---
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


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        // --- PHẦN CẬP NHẬT ---
        // Thêm `read_directory` vào handler
        .invoke_handler(tauri::generate_handler![greet, read_directory, get_project_stats]) 
        // --- KẾT THÚC PHẦN CẬP NHẬT ---
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
