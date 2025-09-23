// src-tauri/src/context_generator.rs
use crate::models::{FileNode, FsEntry}; // <-- Thêm FileNode
use std::collections::{BTreeMap, HashSet};
use std::fmt::Write as FmtWrite;
use std::fs;
use std::path::Path;

fn format_tree(tree: &BTreeMap<String, FsEntry>, prefix: &str, output: &mut String) {
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

// --- HÀM HELPER MỚI: Chuyển đổi từ FileNode (của cache) sang FsEntry (của builder) ---
fn convert_file_node_to_fs_entry(node: &FileNode) -> FsEntry {
    if let Some(children) = &node.children {
        let mut child_map = BTreeMap::new();
        for child in children {
            child_map.insert(child.name.clone(), convert_file_node_to_fs_entry(child));
        }
        FsEntry::Directory(child_map)
    } else {
        FsEntry::File
    }
}

// === BẮT ĐẦU PHẦN SỬA LỖI DỨT ĐIỂM ===
pub fn expand_group_paths_to_files(
    group_paths: &[String],
    metadata_cache: &BTreeMap<String, crate::models::FileMetadata>,
    _root_path: &Path, // Không cần truy cập đĩa nữa
) -> Vec<String> {
    let mut all_files_in_group: HashSet<String> = HashSet::new();

    // Lấy danh sách tất cả các file đã được quét để duyệt hiệu quả hơn
    let all_cached_files: Vec<&String> = metadata_cache.keys().collect();

    for path_str in group_paths {
        // Xử lý trường hợp đường dẫn đã lưu là MỘT FILE cụ thể
        // Ví dụ: path_str = "src/App.tsx"
        if metadata_cache.contains_key(path_str) {
            all_files_in_group.insert(path_str.clone());
        }

        // Xử lý trường hợp đường dẫn đã lưu là MỘT THƯ MỤC
        // Ví dụ: path_str = "src" -> tìm các file bắt đầu bằng "src/"
        let dir_prefix = format!("{}/", path_str);
        for &cached_file in &all_cached_files {
            // Nếu path_str là thư mục gốc ("") thì dir_prefix sẽ là "/"
            // và cached_file cũng sẽ bắt đầu bằng "/", điều này không đúng.
            // Do đó, cần xử lý trường hợp thư mục gốc một cách đặc biệt.
            if path_str.is_empty() {
                all_files_in_group.insert(cached_file.clone());
            } else if cached_file.starts_with(&dir_prefix) {
                all_files_in_group.insert(cached_file.clone());
            }
        }
    }

    all_files_in_group.into_iter().collect()
}
// === KẾT THÚC PHẦN SỬA LỖI DỨT ĐIỂM ===

// --- CẬP NHẬT CHỮ KÝ VÀ LOGIC CỦA HÀM NÀY ---
pub fn generate_context_from_files(
    root_path_str: &str,
    file_paths: &[String],
    use_full_tree: bool,
    full_project_tree: &Option<FileNode>,
    with_line_numbers: bool, // <-- THAM SỐ MỚI
) -> Result<String, String> {
    let root_path = Path::new(root_path_str);
    let mut tree_builder_root = BTreeMap::new();

    // --- LOGIC IF/ELSE MỚI ĐỂ XÂY DỰNG CÂY THƯ MỤC ---
    if use_full_tree {
        if let Some(tree_node) = full_project_tree {
            if let FsEntry::Directory(root_children) = convert_file_node_to_fs_entry(tree_node) {
                tree_builder_root = root_children;
            }
        } else {
            return Err("Không tìm thấy cây thư mục đầy đủ trong cache.".to_string());
        }
    } else {
        // Giữ lại logic cũ để xây dựng cây thư mục tối giản
        for rel_path_str in file_paths {
            let rel_path = Path::new(rel_path_str);
            let mut current_level = &mut tree_builder_root;
            if let Some(components) = rel_path.parent() {
                for component in components.components() {
                    let component_str = component.as_os_str().to_string_lossy().into_owned();
                    current_level = match current_level
                        .entry(component_str)
                        .or_insert(FsEntry::Directory(BTreeMap::new()))
                    {
                        FsEntry::Directory(children) => children,
                        _ => unreachable!(),
                    };
                }
            }
            if let Some(file_name) = rel_path.file_name() {
                let file_name_str = file_name.to_string_lossy().into_owned();
                current_level.insert(file_name_str, FsEntry::File);
            }
        }
    }

    let mut directory_structure = String::new();
    format_tree(&tree_builder_root, "", &mut directory_structure);

    // Phần xử lý nội dung file giữ nguyên, không thay đổi
    let mut file_contents_string = String::new();
    let mut sorted_files = file_paths.to_vec();
    sorted_files.sort();
    for file_rel_path in sorted_files {
        let file_path = root_path.join(&file_rel_path);
        if let Ok(content) = fs::read_to_string(&file_path) {
        let header = format!("================================================\nFILE: {}\n================================================\n", file_rel_path.replace("\\", "/"));
        file_contents_string.push_str(&header);
        // --- LOGIC MỚI: DỰA VÀO THAM SỐ ĐỂ THÊM SỐ DÒNG ---
        if with_line_numbers {
            for (i, line) in content.lines().enumerate() {
                let _ = writeln!(file_contents_string, "{}: {}", i + 1, line);
            }
        } else {
            file_contents_string.push_str(&content);
        }
        file_contents_string.push_str("\n\n");
    }
    }
    let final_context = format!(
        "Directory structure:\n{}\n\n{}",
        directory_structure, file_contents_string
    );
    Ok(final_context)
}
