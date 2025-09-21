// src-tauri/src/lib.rs

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap; // Sử dụng BTreeMap để các mục được sắp xếp theo alphabet
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::fmt::Write as FmtWrite; // Đổi tên để tránh xung đột với std::io::Write
use tauri::Manager;
use ignore::{WalkBuilder, overrides::OverrideBuilder};

// --- CÁC STRUCT GIỮ NGUYÊN ---
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

// --- CÁC COMMAND KHÁC GIỮ NGUYÊN ---
fn get_data_file_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    
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

    let all_data: std::collections::HashMap<String, ProjectData> = serde_json::from_str(&contents)
        .map_err(|e| format!("Lỗi phân tích cú pháp JSON: {}", e))?;

    Ok(all_data.get(&path).cloned().unwrap_or_default())
}

#[tauri::command]
fn save_project_data(app_handle: tauri::AppHandle, path: String, data: ProjectData) -> Result<(), String> {
    let data_file_path = get_data_file_path(&app_handle)?;
    
    let mut all_data: std::collections::HashMap<String, ProjectData> = if data_file_path.exists() {
        let mut file = File::open(&data_file_path).map_err(|e| format!("Không thể mở file: {}", e))?;
        let mut contents = String::new();
        file.read_to_string(&mut contents).map_err(|e| format!("Không thể đọc file: {}", e))?;
        if contents.is_empty() {
            std::collections::HashMap::new()
        } else {
            serde_json::from_str(&contents).map_err(|e| format!("Lỗi phân tích cú pháp: {}", e))?
        }
    } else {
        std::collections::HashMap::new()
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

    // --- THÊM LOGIC OVERRIDE VÀO ĐÂY ---
    let mut override_builder = OverrideBuilder::new(root_path);
    override_builder.add("!package-lock.json").map_err(|e| e.to_string())?;
    override_builder.add("!Cargo.lock").map_err(|e| e.to_string())?;
    override_builder.add("!yarn.lock").map_err(|e| e.to_string())?;
    override_builder.add("!pnpm-lock.yaml").map_err(|e| e.to_string())?;
    let overrides = override_builder.build().map_err(|e| e.to_string())?;

    let walker = WalkBuilder::new(root_path)
        .overrides(overrides.clone()) // <-- Áp dụng quy tắc
        .build();
    // --- KẾT THÚC THÊM LOGIC ---

    for result in walker {
        match result {
            Ok(entry) => {
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
                }
            }
            Err(e) => {
                eprintln!("[Master Context] Lỗi khi quét: {}", e);
            }
        }
    }

    Ok(stats)
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

// --- PHẦN CẢI TIẾN: Cấu trúc dữ liệu cho cây thư mục ---
#[derive(Debug)]
enum FsEntry {
    File,
    Directory(BTreeMap<String, FsEntry>),
}

// --- PHẦN CẢI TIẾN: Hàm đệ quy để "vẽ" cây thư mục ---
fn format_tree(
    tree: &BTreeMap<String, FsEntry>,
    prefix: &str,
    output: &mut String,
) {
    let mut entries = tree.iter().peekable();
    while let Some((name, entry)) = entries.next() {
        let is_last = entries.peek().is_none();
        let connector = if is_last { "└── " } else { "├── " };
        
        match entry {
            FsEntry::File => {
                let _ = writeln!(output, "{}{}{}", prefix, connector, name);
            }
            FsEntry::Directory(children) => {
                let _ = writeln!(output, "{}{}{}/", prefix, connector, name);
                let new_prefix = format!("{}{}", prefix, if is_last { "    " } else { "│   " });
                format_tree(children, &new_prefix, output);
            }
        }
    }
}


// --- VIẾT LẠI HOÀN TOÀN COMMAND `generate_project_context` ---
#[tauri::command]
fn generate_project_context(path: String) -> Result<String, String> {
    let root_path = Path::new(&path);
    if !root_path.is_dir() {
        return Err(format!("'{}' không phải là một thư mục hợp lệ.", path));
    }

    let mut override_builder = OverrideBuilder::new(root_path);
    override_builder.add("!package-lock.json").map_err(|e| e.to_string())?;
    override_builder.add("!Cargo.lock").map_err(|e| e.to_string())?;
    override_builder.add("!yarn.lock").map_err(|e| e.to_string())?;
    override_builder.add("!pnpm-lock.yaml").map_err(|e| e.to_string())?;
    let overrides = override_builder.build().map_err(|e| e.to_string())?;

    let mut root = BTreeMap::new();
    let mut file_contents = String::new();
    
    let walker = WalkBuilder::new(root_path)
        .overrides(overrides.clone())
        .sort_by_file_path(|a, b| a.cmp(b))
        .build();

    for result in walker {
        if let Ok(entry) = result {
            if let Ok(relative_path) = entry.path().strip_prefix(root_path) {
                if relative_path.as_os_str().is_empty() {
                    continue;
                }

                // 1. Xây dựng cây thư mục trong bộ nhớ (logic này không đổi)
                let mut current_level = &mut root;
                for component in relative_path.components().map(|c| c.as_os_str().to_string_lossy().into_owned()) {
                    let entry_type = if entry.path().is_dir() {
                        FsEntry::Directory(BTreeMap::new())
                    } else {
                        FsEntry::File
                    };
                    current_level = match current_level.entry(component).or_insert(entry_type) {
                        FsEntry::Directory(children) => children,
                        FsEntry::File => break,
                    };
                }

                // --- CẬP NHẬT LOGIC ĐỌC FILE ---
                // 2. Thu thập nội dung CHỈ KHI file là văn bản UTF-8 hợp lệ
                if entry.file_type().map_or(false, |ft| ft.is_file()) {
                    // Thử đọc file thành chuỗi. Nếu thành công, nó là UTF-8.
                    match fs::read_to_string(entry.path()) {
                        Ok(content) => {
                            // CHỈ KHI đọc thành công, chúng ta mới thêm header và nội dung
                            let header = format!(
                                "================================================\nFILE: {}\n================================================\n",
                                relative_path.display().to_string().replace("\\", "/")
                            );
                            file_contents.push_str(&header);
                            file_contents.push_str(&content);
                            file_contents.push_str("\n\n");
                        }
                        Err(_) => {
                            // Nếu file không phải UTF-8 (ví dụ: ảnh, binary), chúng ta không làm gì cả.
                            // File này sẽ chỉ xuất hiện trong cây thư mục.
                        }
                    }
                }
                // --- KẾT THÚC CẬP NHẬT LOGIC ĐỌC FILE ---
            }
        }
    }

    // "Vẽ" cây thư mục đã xây dựng (logic này không đổi)
    let mut directory_structure = String::new();
    format_tree(&root, "", &mut directory_structure);

    // Ghép tất cả lại (logic này không đổi)
    let final_context = format!(
        "Directory structure:\n└── {}\n{}\n\n{}",
        root_path.file_name().unwrap_or_default().to_string_lossy(),
        directory_structure,
        file_contents
    );

    Ok(final_context)
}
// --- KẾT THÚC VIẾT LẠI ---


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
            generate_project_context
        ]) 
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
