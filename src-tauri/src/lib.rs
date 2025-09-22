// src-tauri/src/lib.rs

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::fmt::Write as FmtWrite;
use tauri::{Manager, Window, Emitter};
use ignore::{WalkBuilder, overrides::OverrideBuilder};
use tiktoken_rs::cl100k_base;

// --- SỬA LỖI: SẮP XẾP LẠI THỨ TỰ CÁC STRUCT ĐỂ BIÊN DỊCH ĐÚNG ---

#[derive(Serialize, Deserialize, Debug, Default, Clone, Copy)]
struct GroupStats {
    total_files: u64,
    total_dirs: u64,
    total_size: u64, 
    token_count: usize,
}

// --- SỬA LỖI: THÊM `#[derive(Clone)]` ---
#[derive(Serialize, Deserialize, Debug, Default, Clone)]
struct ProjectStats {
    total_files: u64,
    total_dirs: u64,
    total_size: u64,
    total_tokens: usize,
}

// FileNode cần Clone và Default
#[derive(Serialize, Deserialize, Debug, Default, Clone)]
struct FileNode {
    name: String,
    path: String,
    children: Option<Vec<FileNode>>,
}

// --- SỬA LỖI: ĐỊNH NGHĨA GROUP TRƯỚC KHI DÙNG ---
#[derive(Serialize, Deserialize, Debug, Default, Clone)]
struct Group {
    id: String,
    name: String,
    description: String,
    paths: Vec<String>,
    stats: GroupStats,
}

#[derive(Serialize, Deserialize, Debug)]
struct GroupContextResult {
    context: String,
    stats: GroupStats,
}

// Cấu trúc dữ liệu cache chính
#[derive(Serialize, Deserialize, Debug, Default, Clone)]
struct CachedProjectData {
    stats: ProjectStats, // Đã có thể Clone
    file_tree: Option<FileNode>,
    groups: Vec<Group>,
}


// --- CÁC HÀM HELPER VÀ COMMAND ---

// Giữ nguyên các hàm: get_data_file_path, FsEntry, format_tree

fn get_data_file_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&app_data_dir).map_err(|e| format!("Không thể tạo thư mục dữ liệu: {}", e))?;
    Ok(app_data_dir.join("data.json"))
}

#[derive(Debug, Clone)]
enum FsEntry {
    File,
    Directory(BTreeMap<String, FsEntry>),
}

fn format_tree(tree: &BTreeMap<String, FsEntry>, prefix: &str, output: &mut String) {
    let mut entries = tree.iter().peekable();
    while let Some((name, entry)) = entries.next() {
        let is_last = entries.peek().is_none();
        let connector = if is_last { "└── " } else { "├── " };
        match entry {
            FsEntry::File => { let _ = writeln!(output, "{}{}{}", prefix, connector, name); }
            FsEntry::Directory(children) => {
                let _ = writeln!(output, "{}{}{}/", prefix, connector, name);
                let new_prefix = format!("{}{}", prefix, if is_last { "    " } else { "│   " });
                format_tree(children, &new_prefix, output);
            }
        }
    }
}

// --- CÁC COMMAND ĐÃ SỬA ---

#[tauri::command]
fn load_project_data(app_handle: tauri::AppHandle, path: String) -> Result<CachedProjectData, String> {
    let data_file_path = get_data_file_path(&app_handle)?;
    if !data_file_path.exists() { return Ok(CachedProjectData::default()); }
    let mut file = File::open(data_file_path).map_err(|e| format!("Không thể mở file dữ liệu: {}", e))?;
    let mut contents = String::new();
    file.read_to_string(&mut contents).map_err(|e| format!("Không thể đọc file dữ liệu: {}", e))?;
    if contents.is_empty() { return Ok(CachedProjectData::default()); }
    let all_data: std::collections::HashMap<String, CachedProjectData> = serde_json::from_str(&contents)
        .map_err(|e| format!("Lỗi phân tích cú pháp JSON: {}", e))?;
    Ok(all_data.get(&path).cloned().unwrap_or_default())
}

#[tauri::command]
fn save_project_data(app_handle: tauri::AppHandle, path: String, data: CachedProjectData) -> Result<(), String> {
    let data_file_path = get_data_file_path(&app_handle)?;
    let mut all_data: std::collections::HashMap<String, CachedProjectData> = if data_file_path.exists() {
        let mut file = File::open(&data_file_path).map_err(|e| format!("Không thể mở file: {}", e))?;
        let mut contents = String::new();
        file.read_to_string(&mut contents).map_err(|e| format!("Không thể đọc file: {}", e))?;
        if contents.is_empty() { std::collections::HashMap::new() } 
        else { serde_json::from_str(&contents).map_err(|e| format!("Lỗi phân tích cú pháp: {}", e))? }
    } else { std::collections::HashMap::new() };
    all_data.insert(path, data);
    let json_string = serde_json::to_string(&all_data).map_err(|e| format!("Không thể serialize dữ liệu: {}", e))?;
    let mut file = File::create(data_file_path).map_err(|e| format!("Không thể tạo/ghi file dữ liệu: {}", e))?;
    file.write_all(json_string.as_bytes()).map_err(|e| format!("Lỗi khi ghi file: {}", e))?;
    Ok(())
}

fn perform_full_scan_and_build_tree(window: &Window, app_handle: &tauri::AppHandle, path: &str) -> Result<(), String> {
    let root_path = Path::new(path);
    let mut stats = ProjectStats::default();
    let override_builder = {
        let mut builder = OverrideBuilder::new(root_path);
        builder.add("!package-lock.json").map_err(|e| e.to_string())?;
        builder.add("!Cargo.lock").map_err(|e| e.to_string())?;
        builder.add("!yarn.lock").map_err(|e| e.to_string())?;
        builder.add("!pnpm-lock.yaml").map_err(|e| e.to_string())?;
        builder.build().map_err(|e| e.to_string())?
    };
    let bpe = cl100k_base().map_err(|e| e.to_string())?;
    let mut path_map = BTreeMap::new();
    for entry in WalkBuilder::new(root_path).overrides(override_builder.clone()).build().filter_map(Result::ok) {
        let entry_path = entry.path();
        if let Ok(relative_path) = entry_path.strip_prefix(root_path) {
            if relative_path.as_os_str().is_empty() { continue; }
            let _ = window.emit("scan_progress", relative_path.to_string_lossy().to_string());
            if let Ok(metadata) = entry.metadata() {
                path_map.insert(entry_path.to_path_buf(), metadata.is_dir());
                if metadata.is_dir() { stats.total_dirs += 1; } 
                else if metadata.is_file() {
                    stats.total_files += 1;
                    stats.total_size += metadata.len();
                    if let Ok(content) = fs::read_to_string(entry_path) {
                        stats.total_tokens += bpe.encode_with_special_tokens(&content).len();
                    }
                }
            }
        }
    }
    fn build_tree_from_map(parent: &Path, path_map: &BTreeMap<PathBuf, bool>, root_path: &Path) -> Vec<FileNode> {
        let mut children = Vec::new();
        for (path, is_dir) in path_map.range(parent.join("")..) {
            if path.parent() == Some(parent) {
                let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                let relative_path_str = path.strip_prefix(root_path).unwrap().to_string_lossy().replace("\\", "/");
                children.push(FileNode {
                    name,
                    path: relative_path_str,
                    children: if *is_dir { Some(build_tree_from_map(path, path_map, root_path)) } else { None },
                });
            }
        }
        children.sort_by(|a, b| {
            let a_is_dir = a.children.is_some(); let b_is_dir = b.children.is_some();
            if a_is_dir != b_is_dir { b_is_dir.cmp(&a_is_dir) } else { a.name.cmp(&b.name) }
        });
        children
    }
    let root_children = build_tree_from_map(root_path, &path_map, root_path);
    let file_tree = FileNode {
        name: root_path.file_name().unwrap_or_default().to_string_lossy().to_string(),
        path: "".to_string(),
        children: Some(root_children),
    };
    let mut cached_data = load_project_data(app_handle.clone(), path.to_string()).unwrap_or_default();
    cached_data.stats = stats.clone();
    cached_data.file_tree = Some(file_tree.clone());
    save_project_data(app_handle.clone(), path.to_string(), cached_data.clone()).map_err(|e| e.to_string())?;
    let _ = window.emit("scan_complete", &cached_data);
    Ok(())
}

#[tauri::command]
fn start_project_scan(window: Window, app_handle: tauri::AppHandle, path: String) {
    std::thread::spawn(move || {
        if let Err(e) = perform_full_scan_and_build_tree(&window, &app_handle, &path) {
            let _ = window.emit("scan_error", e);
        }
    });
}

// Giữ lại hàm này vì nó là logic lõi, không phải là command
#[tauri::command]
fn generate_context_for_paths(root_path_str: String, paths: Vec<String>) -> Result<GroupContextResult, String> {
    // ... (logic của hàm này giữ nguyên như phiên bản đã sửa lỗi ở lần trước)
    let root_path = Path::new(&root_path_str);
    let mut all_files_to_include = HashSet::new();
    let mut all_dirs_to_include = HashSet::new();
    let mut file_contents_string = String::new();
    let mut stats = GroupStats::default();
    for relative_path_str in paths.clone() {
        let full_path = root_path.join(&relative_path_str);
        if full_path.is_dir() {
            all_dirs_to_include.insert(full_path.clone());
            let walker = WalkBuilder::new(full_path).build();
            for entry in walker.filter_map(Result::ok) {
                let entry_path = entry.path();
                if let Ok(metadata) = entry.metadata() {
                    if metadata.is_file() {
                        if all_files_to_include.insert(entry_path.to_path_buf()) {
                            stats.total_size += metadata.len();
                        }
                    } else if metadata.is_dir() {
                        all_dirs_to_include.insert(entry_path.to_path_buf());
                    }
                }
            }
        } else if full_path.is_file() {
            if all_files_to_include.insert(full_path.clone()) {
                if let Ok(metadata) = fs::metadata(full_path) {
                    stats.total_size += metadata.len();
                }
            }
        }
    }
    stats.total_files = all_files_to_include.len() as u64;
    stats.total_dirs = all_dirs_to_include.len() as u64;
    let mut selected_tree_root = BTreeMap::new();
    let all_paths_to_render: HashSet<PathBuf> = all_dirs_to_include.union(&all_files_to_include).cloned().collect();
    for full_path in all_paths_to_render {
        if let Ok(relative_path) = full_path.strip_prefix(root_path) {
            if relative_path.as_os_str().is_empty() { continue; }
            let mut current_level = &mut selected_tree_root;
            for component in relative_path.components() {
                let component_str = component.as_os_str().to_string_lossy().into_owned();
                let component_full_path = root_path.join(relative_path.ancestors().find(|a| a.ends_with(component.as_os_str())).unwrap_or(relative_path));
                let entry_type = if component_full_path.is_dir() { FsEntry::Directory(BTreeMap::new()) } else { FsEntry::File };
                current_level = match current_level.entry(component_str).or_insert(entry_type) {
                    FsEntry::Directory(children) => children,
                    FsEntry::File => break,
                };
            }
        }
    }
    let mut directory_structure = String::new();
    format_tree(&selected_tree_root, "", &mut directory_structure);
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
    let final_context = format!("Selected directory structure:\n{}\n\n{}", directory_structure, file_contents_string);
    let bpe = cl100k_base().map_err(|e| e.to_string())?;
    stats.token_count = bpe.encode_with_special_tokens(&final_context).len();
    Ok(GroupContextResult { context: final_context, stats })
}


#[tauri::command]
fn start_group_update(window: Window, app_handle: tauri::AppHandle, group_id: String, root_path_str: String, paths: Vec<String>) {
    std::thread::spawn(move || {
        let result = generate_context_for_paths(root_path_str.clone(), paths.clone());
        match result {
            Ok(context_result) => {
                if let Ok(mut project_data) = load_project_data(app_handle.clone(), root_path_str.clone()) {
                    if let Some(group) = project_data.groups.iter_mut().find(|g| g.id == group_id) {
                        group.paths = paths;
                        group.stats = context_result.stats;
                    }
                    let _ = save_project_data(app_handle, root_path_str, project_data);
                }
                let _ = window.emit("group_update_complete", serde_json::json!({ "groupId": group_id, "paths": Vec::<String>::new(), "stats": context_result.stats }));
            }
            Err(e) => { let _ = window.emit("group_update_error", e); }
        }
    });
}

#[tauri::command]
fn start_group_export(window: Window, group_id: String, root_path_str: String, paths: Vec<String>) {
    std::thread::spawn(move || {
        let result = generate_context_for_paths(root_path_str, paths);
        match result {
            Ok(context_result) => {
                let _ = window.emit("group_export_complete", serde_json::json!({ "groupId": group_id, "context": context_result.context }));
            }
            Err(e) => { let _ = window.emit("group_export_error", e); }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            // --- SỬA LỖI: XÓA CÁC COMMAND CŨ, CHỈ GIỮ LẠI CÁC COMMAND CẦN THIẾT ---
            load_project_data,
            save_project_data,
            generate_context_for_paths,
            start_project_scan,
            start_group_update,
            start_group_export
        ]) 
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
