// src-tauri/src/lib.rs

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap; // Sử dụng BTreeMap để các mục được sắp xếp theo alphabet
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::fmt::Write as FmtWrite; // Đổi tên để tránh xung đột với std::io::Write
use tauri::Manager;
use ignore::{WalkBuilder, overrides::OverrideBuilder};
use tiktoken_rs::cl100k_base; // <--- Import tiktoken

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
    total_tokens: usize, // Sử dụng usize vì kết quả từ .len() là usize
}

// Struct nội bộ để chứa kết quả quét
struct ScanResult {
    stats: ProjectStats,
    context_string: String,
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

// Hàm quét lõi, thực hiện tất cả công việc nặng nhọc CHỈ MỘT LẦN
fn perform_full_scan(path: String) -> Result<ScanResult, String> {
    let root_path = Path::new(&path);
    if !root_path.is_dir() {
        return Err(format!("'{}' không phải là một thư mục hợp lệ.", path));
    }

    let mut stats = ProjectStats::default();
    let mut root_tree = BTreeMap::new();
    let mut file_contents_string = String::new();

    let override_builder = {
        let mut builder = OverrideBuilder::new(root_path);
        builder.add("!package-lock.json").map_err(|e| e.to_string())?;
        builder.add("!Cargo.lock").map_err(|e| e.to_string())?;
        builder.add("!yarn.lock").map_err(|e| e.to_string())?;
        builder.add("!pnpm-lock.yaml").map_err(|e| e.to_string())?;
        builder.build().map_err(|e| e.to_string())?
    };

    let walker = WalkBuilder::new(root_path)
        .overrides(override_builder.clone())
        .sort_by_file_path(|a, b| a.cmp(b))
        .build();

    for entry in walker.filter_map(Result::ok) {
        let entry_path = entry.path();
        if let Ok(relative_path) = entry_path.strip_prefix(root_path) {
            if relative_path.as_os_str().is_empty() { continue; }

            // Cập nhật thống kê
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_dir() {
                    stats.total_dirs += 1;
                } else if metadata.is_file() {
                    stats.total_files += 1;
                    stats.total_size += metadata.len();
                }
            }
            
            // Xây dựng cây thư mục (cho context)
            let mut current_level = &mut root_tree;
            for component in relative_path.components().map(|c| c.as_os_str().to_string_lossy().into_owned()) {
                let entry_type = if entry_path.is_dir() { FsEntry::Directory(BTreeMap::new()) } else { FsEntry::File };
                current_level = match current_level.entry(component).or_insert(entry_type) {
                    FsEntry::Directory(children) => children,
                    FsEntry::File => break,
                };
            }

            // Thu thập nội dung file (cho context)
            if entry.file_type().map_or(false, |ft| ft.is_file()) {
                if let Ok(content) = fs::read_to_string(entry.path()) {
                    let header = format!("================================================\nFILE: {}\n================================================\n", relative_path.display().to_string().replace("\\", "/"));
                    file_contents_string.push_str(&header);
                    file_contents_string.push_str(&content);
                    file_contents_string.push_str("\n\n");
                }
            }
        }
    }

    // "Vẽ" cây thư mục
    let mut directory_structure = String::new();
    format_tree(&root_tree, "", &mut directory_structure);

    // Ghép context lại
    let final_context = format!(
        "Directory structure:\n└── {}\n{}\n\n{}",
        root_path.file_name().unwrap_or_default().to_string_lossy(),
        directory_structure,
        file_contents_string
    );
    
    // Đếm token
    let bpe = cl100k_base().map_err(|e| e.to_string())?;
    stats.total_tokens = bpe.encode_with_special_tokens(&final_context).len();

    Ok(ScanResult {
        stats,
        context_string: final_context,
    })
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

// Cập nhật command `get_project_stats` để sử dụng hàm quét lõi
#[tauri::command]
fn get_project_stats(path: String) -> Result<ProjectStats, String> {
    let scan_result = perform_full_scan(path)?;
    Ok(scan_result.stats)
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


// Cập nhật command `generate_project_context` để sử dụng hàm quét lõi
#[tauri::command]
fn generate_project_context(path: String) -> Result<String, String> {
    let scan_result = perform_full_scan(path)?;
    Ok(scan_result.context_string)
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
            generate_project_context
        ]) 
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
