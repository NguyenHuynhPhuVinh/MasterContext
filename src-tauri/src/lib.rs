// src-tauri/src/lib.rs

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::fmt::Write as FmtWrite;
// --- THÊM MỚI: Cần SystemTime và UNIX_EPOCH để lấy timestamp ---
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Window, Emitter};
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

// --- STRUCT MỚI: Lưu metadata và token của từng file ---
#[derive(Serialize, Deserialize, Debug, Clone)]
struct FileMetadata {
    size: u64,
    mtime: u64, // Thời gian sửa đổi, tính bằng giây từ UNIX_EPOCH
    token_count: usize,
}

// Cấu trúc dữ liệu cache chính
#[derive(Serialize, Deserialize, Debug, Default, Clone)]
struct CachedProjectData {
    stats: ProjectStats, // Đã có thể Clone
    file_tree: Option<FileNode>,
    groups: Vec<Group>,
    // Trường mới để cache thông tin từng file
    file_metadata_cache: BTreeMap<String, FileMetadata>, // Key là đường dẫn tương đối (String)
}


// --- CÁC HÀM HELPER VÀ COMMAND ---

// Giữ nguyên các hàm: get_project_config_path, FsEntry, format_tree

fn get_project_config_path(project_path_str: &str) -> Result<PathBuf, String> {
    let project_path = Path::new(project_path_str);
    if !project_path.is_dir() {
        return Err(format!("'{}' không phải là một thư mục hợp lệ.", project_path_str));
    }
    // Tạo thư mục ẩn `.mastercontext` trong thư mục dự án
    let config_dir = project_path.join(".mastercontext");
    fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Không thể tạo thư mục cấu hình '.mastercontext': {}", e))?;
    
    // Trả về đường dẫn tới file `data.json` bên trong thư mục đó
    Ok(config_dir.join("data.json"))
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
    // app_handle không còn cần thiết nhưng vẫn giữ để không thay đổi signature
    let _ = app_handle; // Đánh dấu là không sử dụng
    let config_path = get_project_config_path(&path)?;

    if !config_path.exists() {
        return Ok(CachedProjectData::default());
    }

    let mut file = File::open(config_path).map_err(|e| format!("Không thể mở file dữ liệu dự án: {}", e))?;
    let mut contents = String::new();
    file.read_to_string(&mut contents).map_err(|e| format!("Không thể đọc file dữ liệu dự án: {}", e))?;
    
    if contents.is_empty() {
        return Ok(CachedProjectData::default());
    }
    
    // File này giờ chỉ chứa dữ liệu của một dự án, không cần HashMap
    serde_json::from_str(&contents).map_err(|e| format!("Lỗi phân tích cú pháp JSON: {}", e))
}

#[tauri::command]
fn save_project_data(app_handle: tauri::AppHandle, path: String, data: CachedProjectData) -> Result<(), String> {
    let _ = app_handle;
    let config_path = get_project_config_path(&path)?;
    
    // Serialize trực tiếp đối tượng data, không cần HashMap
    let json_string = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Không thể serialize dữ liệu dự án: {}", e))?;
        
    let mut file = File::create(config_path)
        .map_err(|e| format!("Không thể tạo/ghi file dữ liệu dự án: {}", e))?;
        
    file.write_all(json_string.as_bytes())
        .map_err(|e| format!("Lỗi khi ghi file dữ liệu dự án: {}", e))?;
        
    Ok(())
}

fn perform_smart_scan_and_rebuild(window: &Window, app_handle: &tauri::AppHandle, path: &str) -> Result<(), String> {
    let root_path = Path::new(path);
    let bpe = cl100k_base().map_err(|e| e.to_string())?;

    // 1. Tải dữ liệu cũ để lấy cache metadata
    let old_data = load_project_data(app_handle.clone(), path.to_string()).unwrap_or_default();
    let old_metadata_cache = old_data.file_metadata_cache;
    
    // 2. Chuẩn bị các biến cho lần quét mới
    let mut new_project_stats = ProjectStats::default();
    let mut new_metadata_cache = BTreeMap::new();
    let mut path_map = BTreeMap::new(); // Để xây dựng cây thư mục
    // --- THÊM MỚI: Tạo một HashSet để kiểm tra sự tồn tại của file/thư mục một cách hiệu quả ---
    let mut existing_paths = HashSet::new();

    let override_builder = {
        let mut builder = OverrideBuilder::new(root_path);
        builder.add("!package-lock.json").map_err(|e| e.to_string())?;
        builder.add("!Cargo.lock").map_err(|e| e.to_string())?;
        builder.add("!yarn.lock").map_err(|e| e.to_string())?;
        builder.add("!pnpm-lock.yaml").map_err(|e| e.to_string())?;
        builder.build().map_err(|e| e.to_string())?
    };

    // 3. Bắt đầu quét hệ thống file
    for entry in WalkBuilder::new(root_path).overrides(override_builder.clone()).build().filter_map(Result::ok) {
        let entry_path = entry.path();
        if let (Ok(relative_path), Ok(metadata)) = (entry_path.strip_prefix(root_path), entry.metadata()) {
            if relative_path.as_os_str().is_empty() { continue; }
            let relative_path_str = relative_path.to_string_lossy().replace("\\", "/");

            // --- THÊM MỚI: Thêm tất cả các đường dẫn tìm thấy vào HashSet ---
            existing_paths.insert(relative_path_str.clone());

            let _ = window.emit("scan_progress", relative_path_str.clone());
            
            path_map.insert(entry_path.to_path_buf(), metadata.is_dir());

            if metadata.is_dir() {
                new_project_stats.total_dirs += 1;
            } else if metadata.is_file() {
                new_project_stats.total_files += 1;
                new_project_stats.total_size += metadata.len();
                
                let current_mtime = metadata.modified()
                    .map(|t| t.duration_since(UNIX_EPOCH).unwrap_or_default().as_secs())
                    .unwrap_or(0);
                
                let mut token_count = 0;

                // --- LOGIC "THÔNG MINH" NẰM Ở ĐÂY ---
                if let Some(cached_meta) = old_metadata_cache.get(&relative_path_str) {
                    // So sánh size và mtime để xem file có thay đổi không
                    if cached_meta.size == metadata.len() && cached_meta.mtime == current_mtime {
                        // File không đổi -> Lấy token từ cache
                        token_count = cached_meta.token_count;
                    }
                }
                
                // Nếu token_count vẫn là 0 (vì là file mới, hoặc file đã thay đổi)
                if token_count == 0 {
                    if let Ok(content) = fs::read_to_string(entry_path) {
                        token_count = bpe.encode_with_special_tokens(&content).len();
                    }
                }
                // --- KẾT THÚC LOGIC "THÔNG MINH" ---

                new_project_stats.total_tokens += token_count;
                
                // Cập nhật cache mới với thông tin của file này
                new_metadata_cache.insert(relative_path_str, FileMetadata {
                    size: metadata.len(),
                    mtime: current_mtime,
                    token_count,
                });
            }
        }
    }

    // 4. Xây dựng lại cây thư mục (logic này giữ nguyên)
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

    // 5. Dọn dẹp và tính toán lại stats cho các nhóm
    let mut updated_groups = old_data.groups;
    for group in &mut updated_groups {
        // --- ĐÂY LÀ BƯỚC QUAN TRỌNG NHẤT: LOẠI BỎ CÁC ĐƯỜNG DẪN KHÔNG CÒN TỒN TẠI ---
        // Phương thức `retain` sẽ duyệt qua vector và chỉ giữ lại những phần tử thỏa mãn điều kiện.
        group.paths.retain(|path| existing_paths.contains(path));
        
        // Bây giờ, `group.paths` đã "sạch", chúng ta có thể tính toán lại stats một cách an toàn.
        let mut new_group_stats = GroupStats::default();
        let mut all_files_in_group = HashSet::new();
        let mut all_dirs_in_group = HashSet::new();

        // Mở rộng các đường dẫn trong nhóm (ví dụ: thư mục -> các file con)
        for relative_path_str in &group.paths {
            let full_path = root_path.join(relative_path_str);
            if full_path.is_dir() {
                // Dùng WalkDir để tìm tất cả file/dir con
                 for entry in WalkBuilder::new(full_path).build().filter_map(Result::ok) {
                    if let Ok(rp) = entry.path().strip_prefix(root_path) {
                        let rp_str = rp.to_string_lossy().replace("\\", "/");
                        if entry.path().is_dir() {
                             all_dirs_in_group.insert(rp_str);
                        } else {
                             all_files_in_group.insert(rp_str);
                        }
                    }
                 }
            } else if full_path.is_file() {
                 all_files_in_group.insert(relative_path_str.clone());
            }
        }

        // Tính toán stats từ cache
        for file_path_str in &all_files_in_group {
            if let Some(meta) = new_metadata_cache.get(file_path_str) {
                new_group_stats.total_size += meta.size;
                new_group_stats.token_count += meta.token_count;
            }
        }
        new_group_stats.total_files = all_files_in_group.len() as u64;
        new_group_stats.total_dirs = all_dirs_in_group.len() as u64;
        
        group.stats = new_group_stats;
    }

    // 6. Tập hợp dữ liệu cuối cùng và gửi về frontend
    let final_data = CachedProjectData {
        stats: new_project_stats,
        file_tree: Some(file_tree),
        groups: updated_groups,
        file_metadata_cache: new_metadata_cache,
    };
    
    save_project_data(app_handle.clone(), path.to_string(), final_data.clone()).map_err(|e| e.to_string())?;
    let _ = window.emit("scan_complete", &final_data);
    
    Ok(())
}

#[tauri::command]
fn start_project_scan(window: Window, app_handle: tauri::AppHandle, path: String) {
    std::thread::spawn(move || {
        // Gọi hàm "thông minh" mới
        if let Err(e) = perform_smart_scan_and_rebuild(&window, &app_handle, &path) {
            let _ = window.emit("scan_error", e);
        }
    });
}

#[tauri::command]
fn open_project(window: Window, app_handle: tauri::AppHandle, path: String) {
    // Luôn chạy hàm quét thông minh trong một thread nền khi mở dự án
    std::thread::spawn(move || {
        if let Err(e) = perform_smart_scan_and_rebuild(&window, &app_handle, &path) {
            // Gửi lỗi nếu quá trình quét gặp sự cố
            let _ = window.emit("scan_error", e);
        }
    });
}

// Giữ lại hàm này vì nó là logic lõi, không phải là command
#[tauri::command]
fn generate_context_for_paths(root_path_str: String, paths: Vec<String>) -> Result<GroupContextResult, String> {
    let root_path = Path::new(&root_path_str);
    let mut all_files_to_include = HashSet::new();
    let mut all_dirs_to_include = HashSet::new();
    let mut file_contents_string = String::new();
    let mut stats = GroupStats::default();

    // --- PHẦN MỚI (TỐI ƯU HÓA) ---
    // 1. Tạo một OverrideBuilder tại thư mục gốc của dự án.
    let mut override_builder = OverrideBuilder::new(root_path);

    // 2. Thêm tất cả các đường dẫn từ nhóm vào builder.
    //    Các đường dẫn này hoạt động như các quy tắc "bao gồm".
    for relative_path_str in &paths {
        override_builder.add(relative_path_str).map_err(|e| e.to_string())?;
    }

    // 3. Xây dựng các quy tắc override.
    let overrides = override_builder.build().map_err(|e| e.to_string())?;

    // 4. Tạo MỘT WalkBuilder DUY NHẤT và áp dụng các quy tắc override.
    //    Thao tác này sẽ chỉ duyệt qua các tệp/thư mục khớp với quy tắc.
    let walker = WalkBuilder::new(root_path).overrides(overrides).build();

    // 5. Duyệt qua kết quả và thu thập thông tin.
    for entry in walker.filter_map(Result::ok) {
        let entry_path = entry.path();
        // Bỏ qua chính thư mục gốc
        if entry_path == root_path { continue; }

        if let Ok(metadata) = entry.metadata() {
            if metadata.is_dir() {
                all_dirs_to_include.insert(entry_path.to_path_buf());
            } else if metadata.is_file() {
                // Phương thức `insert` trả về true nếu giá trị được chèn mới.
                // Điều này đảm bảo chúng ta chỉ cộng dồn kích thước một lần cho mỗi tệp.
                if all_files_to_include.insert(entry_path.to_path_buf()) {
                    stats.total_size += metadata.len();
                }
            }
        }
    }
    // --- KẾT THÚC PHẦN MỚI ---

    // Phần logic còn lại của hàm không thay đổi, vì nó hoạt động dựa trên
    // các HashSet `all_files_to_include` và `all_dirs_to_include` đã được điền ở trên.

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
fn calculate_group_stats_from_cache(app_handle: tauri::AppHandle, root_path_str: String, paths: Vec<String>) -> Result<GroupStats, String> {
    // 1. Tải dữ liệu dự án hiện tại, bao gồm cả cache metadata
    let project_data = load_project_data(app_handle, root_path_str.clone())?;
    let metadata_cache = project_data.file_metadata_cache;
    let root_path = Path::new(&root_path_str);

    let mut new_group_stats = GroupStats::default();
    let mut all_files_in_group: HashSet<String> = HashSet::new();
    let mut all_dirs_in_group: HashSet<String> = HashSet::new();

    // 2. Mở rộng các đường dẫn được chọn thành một danh sách file đầy đủ
    for path_str in &paths {
        let full_path = root_path.join(path_str);
        if full_path.is_dir() {
            // Nếu là thư mục
            all_dirs_in_group.insert(path_str.clone());
            // Duyệt qua cache để tìm các file/dir con
            for (cached_path, _) in metadata_cache.iter() {
                if cached_path.starts_with(path_str) && cached_path != path_str {
                    all_files_in_group.insert(cached_path.clone());
                }
            }
            // Cũng cần thêm các thư mục con vào all_dirs_in_group
            // Vì cache không chứa dirs, chúng ta cần suy ra từ các file paths
            let mut subdirs = HashSet::new();
            for cached_path in metadata_cache.keys() {
                if cached_path.starts_with(path_str) && cached_path != path_str {
                    let mut current = Path::new(cached_path);
                    while let Some(parent) = current.parent() {
                        let parent_str = parent.to_string_lossy().to_string().replace("\\", "/");
                        if parent_str.starts_with(path_str) && parent_str != *path_str {
                            subdirs.insert(parent_str.clone());
                        }
                        current = parent;
                        if parent_str == *path_str {
                            break;
                        }
                    }
                }
            }
            all_dirs_in_group.extend(subdirs);
        } else {
            // Nếu là file
            all_files_in_group.insert(path_str.clone());
        }
    }

    // 3. Tính toán stats từ danh sách file đã mở rộng
    for file_path_str in &all_files_in_group {
        if let Some(meta) = metadata_cache.get(file_path_str) {
            new_group_stats.total_size += meta.size;
            new_group_stats.token_count += meta.token_count;
        }
    }

    new_group_stats.total_files = all_files_in_group.len() as u64;
    new_group_stats.total_dirs = all_dirs_in_group.len() as u64;

    Ok(new_group_stats)
}

#[tauri::command]
fn update_groups_in_project_data(app_handle: tauri::AppHandle, path: String, groups: Vec<Group>) -> Result<(), String> {
    // 1. Tải toàn bộ dữ liệu dự án hiện có (bao gồm cả cache).
    let mut project_data = load_project_data(app_handle.clone(), path.clone())?;
    
    // 2. Chỉ cập nhật trường `groups`.
    project_data.groups = groups;
    
    // 3. Lưu lại toàn bộ đối tượng `project_data` đã được cập nhật.
    //    Thao tác này sẽ bảo toàn `stats`, `file_tree`, và quan trọng nhất là `file_metadata_cache`.
    save_project_data(app_handle, path, project_data)
}


#[tauri::command]
fn start_group_update(window: Window, app_handle: tauri::AppHandle, group_id: String, root_path_str: String, paths: Vec<String>) {
    std::thread::spawn(move || {
        // SỬ DỤNG HÀM TÍNH TOÁN MỚI TỪ CACHE
        let result = calculate_group_stats_from_cache(app_handle.clone(), root_path_str.clone(), paths.clone());
        
        match result {
            Ok(new_stats) => {
                // Logic lưu và gửi sự kiện vẫn như cũ
                if let Ok(mut project_data) = load_project_data(app_handle.clone(), root_path_str.clone()) {
                    if let Some(group) = project_data.groups.iter_mut().find(|g| g.id == group_id) {
                        group.paths = paths.clone();
                        group.stats = new_stats; // Cập nhật stats mới
                    }
                    // Lưu lại toàn bộ dữ liệu dự án
                    let _ = save_project_data(app_handle, root_path_str, project_data);
                }
                
                // Gửi sự kiện về frontend
                let _ = window.emit("group_update_complete", serde_json::json!({ 
                    "groupId": group_id, 
                    "paths": paths, 
                    "stats": new_stats 
                }));
            }
            Err(e) => { 
                // Gửi lỗi nếu có vấn đề (ví dụ không load được cache)
                let _ = window.emit("group_update_error", e); 
            }
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

// --- COMMAND MỚI: TÁI SỬ DỤNG LOGIC QUÉT ĐỂ XUẤT TOÀN BỘ DỰ ÁN ---
// Hàm này sẽ không gửi sự kiện tiến trình, chỉ trả về context
fn generate_full_project_context(path: String) -> Result<String, String> {
    let root_path = Path::new(&path);
    if !root_path.is_dir() {
        return Err(format!("'{}' không phải là một thư mục hợp lệ.", path));
    }

    let mut directory_structure = String::new();
    let mut file_contents_string = String::new();
    let mut root_tree = BTreeMap::new();

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
            
            let mut current_level = &mut root_tree;
            for component in relative_path.components().map(|c| c.as_os_str().to_string_lossy().into_owned()) {
                let entry_type = if entry_path.is_dir() { FsEntry::Directory(BTreeMap::new()) } else { FsEntry::File };
                current_level = match current_level.entry(component).or_insert(entry_type) {
                    FsEntry::Directory(children) => children,
                    FsEntry::File => break,
                };
            }

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

    format_tree(&root_tree, "", &mut directory_structure);

    let final_context = format!(
        "Directory structure:\n└── {}\n{}\n\n{}",
        root_path.file_name().unwrap_or_default().to_string_lossy(),
        directory_structure,
        file_contents_string
    );
    
    Ok(final_context)
}

#[tauri::command]
fn start_project_export(window: Window, path: String) {
    std::thread::spawn(move || {
        match generate_full_project_context(path) {
            Ok(context) => {
                let _ = window.emit("project_export_complete", context);
            }
            Err(e) => {
                let _ = window.emit("project_export_error", e);
            }
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
            save_project_data,
            generate_context_for_paths,
            open_project,
            start_group_update,
            start_group_export,
            start_project_export, // <-- THÊM COMMAND MỚI
            calculate_group_stats_from_cache,
            update_groups_in_project_data
        ]) 
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
