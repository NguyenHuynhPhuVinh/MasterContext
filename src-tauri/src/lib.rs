// src-tauri/src/lib.rs

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet}; // <-- Thêm HashSet
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
    paths: Vec<String>, // <-- Thêm paths
    token_count: usize, // <-- Thêm token_count
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
struct ProjectData {
    groups: Vec<Group>,
}


// --- STRUCT MỚI CHO CÂY THƯ MỤC ---
#[derive(Serialize, Deserialize, Debug)]
struct FileNode {
    name: String,
    path: String,
    children: Option<Vec<FileNode>>,
}

// --- STRUCT MỚI CHO KẾT QUẢ NGỮ CẢNH NHÓM ---
#[derive(Serialize, Deserialize, Debug)]
struct GroupContextResult {
    context: String,
    token_count: usize,
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
#[derive(Debug, Clone)]
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


// --- COMMAND MỚI: LẤY CÂY THƯ MỤC DỰ ÁN ---
fn build_file_tree_recursive(path: &Path, root_path: &Path) -> Result<Option<FileNode>, std::io::Error> {
    let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
    let relative_path = path.strip_prefix(root_path).unwrap_or(path);
    let relative_path_str = relative_path.to_string_lossy().replace("\\", "/");

    if path.is_dir() {
        let mut children = Vec::new();
        // Sử dụng WalkBuilder để tôn trọng .gitignore
        let walker = WalkBuilder::new(path)
            .max_depth(Some(1)) // Chỉ duyệt cấp con trực tiếp
            .sort_by_file_path(|a, b| a.cmp(b))
            .build();

        for entry in walker.filter_map(Result::ok) {
            let entry_path = entry.path();
            if entry_path == path { continue; } // Bỏ qua chính thư mục gốc
            if let Some(child_node) = build_file_tree_recursive(entry_path, root_path)? {
                children.push(child_node);
            }
        }
        
        // Sắp xếp: thư mục trước, file sau, rồi theo alphabet
        children.sort_by(|a, b| {
            let a_is_dir = a.children.is_some();
            let b_is_dir = b.children.is_some();
            if a_is_dir != b_is_dir {
                b_is_dir.cmp(&a_is_dir)
            } else {
                a.name.cmp(&b.name)
            }
        });

        Ok(Some(FileNode {
            name,
            path: relative_path_str,
            children: Some(children),
        }))
    } else {
        Ok(Some(FileNode {
            name,
            path: relative_path_str,
            children: None,
        }))
    }
}

#[tauri::command]
fn get_project_file_tree(path: String) -> Result<FileNode, String> {
    let root_path = Path::new(&path);
    build_file_tree_recursive(root_path, root_path)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Không thể tạo cây thư mục gốc".to_string())
}


// --- COMMAND MỚI: TẠO NGỮ CẢNH CHO CÁC ĐƯỜNG DẪN CỤ THỂ ---
#[tauri::command]
fn generate_context_for_paths(root_path_str: String, paths: Vec<String>) -> Result<GroupContextResult, String> {
    let root_path = Path::new(&root_path_str);
    let mut all_files_to_include = HashSet::new();
    let mut file_contents_string = String::new();

    // --- PHẦN MỚI: Xây dựng cây thư mục từ các đường dẫn đã chọn ---
    let mut selected_tree_root = BTreeMap::new();
    for relative_path_str in &paths {
        let path = Path::new(relative_path_str);
        let mut current_level = &mut selected_tree_root;
        
        let full_path = root_path.join(path);
        let entry_type = if full_path.is_dir() { 
            FsEntry::Directory(BTreeMap::new()) 
        } else { 
            FsEntry::File 
        };

        for component in path.components() {
            let component_str = component.as_os_str().to_string_lossy().into_owned();
            
            // Nếu component này là cuối cùng trong path, dùng entry_type đã xác định
            if path.ends_with(component.as_os_str()) {
                 current_level.entry(component_str).or_insert(entry_type.clone());
                 break; // Đã chèn xong, thoát vòng lặp components
            } else {
                // Nếu không, nó phải là một thư mục trung gian
                let dir_entry = FsEntry::Directory(BTreeMap::new());
                current_level = match current_level.entry(component_str).or_insert(dir_entry) {
                    FsEntry::Directory(children) => children,
                    _ => break, // Lỗi logic, không nên xảy ra
                };
            }
        }
    }

    // "Vẽ" cây thư mục đã chọn
    let mut directory_structure = String::new();
    format_tree(&selected_tree_root, "", &mut directory_structure);
    // --- KẾT THÚC PHẦN MỚI ---


    for relative_path_str in paths {
        let full_path = root_path.join(&relative_path_str);
        if full_path.is_dir() {
            let walker = WalkBuilder::new(full_path).build();
            for entry in walker.filter_map(Result::ok) {
                if entry.file_type().map_or(false, |ft| ft.is_file()) {
                    all_files_to_include.insert(entry.path().to_path_buf());
                }
            }
        } else if full_path.is_file() {
            all_files_to_include.insert(full_path);
        }
    }

    let mut sorted_files: Vec<PathBuf> = all_files_to_include.into_iter().collect();
    sorted_files.sort();

    for file_path in sorted_files {
        if let Ok(content) = fs::read_to_string(&file_path) {
            if let Ok(relative_path) = file_path.strip_prefix(root_path) {
                let header = format!("================================================\nFILE: {}\n================================================\n", relative_path.display().to_string().replace("\\", "/"));
                file_contents_string.push_str(&header);
                file_contents_string.push_str(&content);
                file_contents_string.push_str("\n\n");
            }
        }
    }
    
    // --- CẬP NHẬT: Ghép cây thư mục và nội dung file ---
    let final_context = format!(
        "Selected directory structure:\n{}\n\n{}",
        directory_structure,
        file_contents_string
    );

    let bpe = cl100k_base().map_err(|e| e.to_string())?;
    let token_count = bpe.encode_with_special_tokens(&final_context).len();

    Ok(GroupContextResult {
        context: final_context,
        token_count,
    })
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
            generate_project_context,
            get_project_file_tree, // <-- THÊM MỚI
            generate_context_for_paths // <-- THÊM MỚI
        ]) 
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
