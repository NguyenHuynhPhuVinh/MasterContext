// src-tauri/src/lib.rs

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::fmt::Write as FmtWrite; // Thêm use này để tránh xung đột với std::io::Write
use tauri::Manager;
use ignore::WalkBuilder; // <--- Import WalkBuilder từ crate ignore

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

// --- XÓA HOÀN TOÀN HÀM `recursive_scan` CŨ ---

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

// --- VIẾT LẠI HOÀN TOÀN COMMAND `get_project_stats` ---
#[tauri::command]
fn get_project_stats(path: String) -> Result<ProjectStats, String> {
    let mut stats = ProjectStats::default();
    let root_path = Path::new(&path);

    if !root_path.is_dir() {
        return Err(format!("'{}' không phải là một thư mục hợp lệ.", path));
    }

    // Sử dụng WalkBuilder từ crate 'ignore'
    // Nó sẽ tự động đọc .gitignore, .ignore, etc.
    let walker = WalkBuilder::new(root_path).build();

    for result in walker {
        match result {
            Ok(entry) => {
                // Bỏ qua thư mục gốc mà chúng ta bắt đầu quét
                if entry.depth() == 0 {
                    continue;
                }

                if let Some(file_type) = entry.file_type() {
                    if file_type.is_dir() {
                        stats.total_dirs += 1;
                    } else if file_type.is_file() {
                        stats.total_files += 1;
                        if let Ok(metadata) = entry.metadata() {
                            stats.total_size += metadata.len();
                        }
                    }
                    // Các loại khác như symlinks sẽ được bỏ qua
                }
            }
            Err(e) => {
                // Ghi lại lỗi nhưng không làm dừng quá trình quét
                eprintln!("[Master Context] Lỗi khi quét: {}", e);
            }
        }
    }

    Ok(stats)
}
// --- KẾT THÚC VIẾT LẠI ---

// --- VIẾT LẠI HOÀN TOÀN COMMAND `generate_project_context` ---
#[tauri::command]
fn generate_project_context(path: String) -> Result<String, String> {
    let root_path = Path::new(&path);
    if !root_path.is_dir() {
        return Err(format!("'{}' không phải là một thư mục hợp lệ.", path));
    }

    let mut directory_structure = String::new();
    let mut file_contents = String::new();
    
    // Sử dụng WalkBuilder để duyệt qua tất cả các file và thư mục hợp lệ
    // .sort_by_file_path() để đảm bảo thứ tự nhất quán
    let walker = WalkBuilder::new(root_path).sort_by_file_path(|a, b| a.cmp(b)).build();

    for result in walker {
        match result {
            Ok(entry) => {
                let entry_path = entry.path();
                if let Ok(relative_path) = entry_path.strip_prefix(root_path) {
                    // Bỏ qua thư mục gốc (đường dẫn rỗng)
                    if relative_path.as_os_str().is_empty() {
                        continue;
                    }
                    
                    let depth = entry.depth();
                    let indent = "    ".repeat(depth.saturating_sub(1));
                    let file_name = entry.file_name().to_string_lossy();
                    
                    // Xây dựng cây thư mục
                    if entry.file_type().map_or(false, |ft| ft.is_dir()) {
                        let _ = writeln!(directory_structure, "{}└── {}/", indent, file_name);
                    } else {
                        let _ = writeln!(directory_structure, "{}├── {}", indent, file_name);
                    }

                    // Nếu là file, đọc và thêm vào phần nội dung
                    if entry_path.is_file() {
                        let header = format!(
                            "================================================\nFILE: {}\n================================================\n",
                            relative_path.display().to_string().replace("\\", "/")
                        );
                        file_contents.push_str(&header);

                        match fs::read_to_string(entry_path) {
                            Ok(content) => {
                                file_contents.push_str(&content);
                                file_contents.push_str("\n\n");
                            }
                            Err(_) => {
                                file_contents.push_str("[Nội dung không thể đọc dưới dạng văn bản (không phải UTF-8)]\n\n");
                            }
                        }
                    }
                }
            }
            Err(e) => {
                eprintln!("[Master Context] Lỗi khi quét file để xuất: {}", e);
            }
        }
    }

    // Ghép tất cả lại
    let final_context = format!(
        "--- START OF FILE project_context.txt ---\n\nDirectory structure:\n└── {}\n{}\n\n{}",
        root_path.file_name().unwrap_or_default().to_string_lossy(),
        directory_structure,
        file_contents
    );

    Ok(final_context)
}
// --- KẾT THÚC VIẾT LẠI ---

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
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet, 
            read_directory, 
            get_project_stats,
            load_project_data,
            save_project_data,
            // --- CẬP NHẬT: Thêm command mới vào handler ---
            generate_project_context
        ]) 
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
