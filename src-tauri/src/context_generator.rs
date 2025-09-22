// src-tauri/src/context_generator.rs
use crate::models::{FsEntry};
use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::path::Path;
use std::fmt::Write as FmtWrite;

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

// === BẮT ĐẦU PHẦN SỬA LỖI TRIỆT ĐỂ ===
pub fn expand_group_paths_to_files(
    group_paths: &[String],
    metadata_cache: &BTreeMap<String, crate::models::FileMetadata>,
    _root_path: &Path, // _root_path không còn cần thiết vì chúng ta chỉ dựa vào cache
) -> Vec<String> {
    let mut all_files_in_group: HashSet<String> = HashSet::new();
    let all_cached_files: Vec<&String> = metadata_cache.keys().collect();

    for path_str in group_paths {
        // Trường hợp 1: Đường dẫn đã lưu là một file chính xác.
        // Ví dụ: path_str = "src/App.tsx"
        if metadata_cache.contains_key(path_str) {
            all_files_in_group.insert(path_str.clone());
        }

        // Trường hợp 2: Đường dẫn đã lưu là một thư mục.
        // Ví dụ: path_str = "src"
        // Chúng ta cần tìm tất cả các file có tiền tố là "src/"
        let dir_prefix = format!("{}/", path_str);
        for &cached_file in &all_cached_files {
            if cached_file.starts_with(&dir_prefix) {
                all_files_in_group.insert(cached_file.clone());
            }
        }
    }
    all_files_in_group.into_iter().collect()
}
// === KẾT THÚC PHẦN SỬA LỖI TRIỆT ĐỂ ===


pub fn generate_context_from_files(root_path_str: &str, file_paths: &[String]) -> Result<String, String> {
    let root_path = Path::new(root_path_str);
    let mut tree_builder_root = BTreeMap::new();
    let mut file_contents_string = String::new();
    for rel_path_str in file_paths {
        let rel_path = Path::new(rel_path_str);
        let mut current_level = &mut tree_builder_root;
        if let Some(components) = rel_path.parent() {
            for component in components.components() {
                let component_str = component.as_os_str().to_string_lossy().into_owned();
                current_level = match current_level.entry(component_str).or_insert(FsEntry::Directory(BTreeMap::new())) {
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
    let mut directory_structure = String::new();
    format_tree(&tree_builder_root, "", &mut directory_structure);
    let mut sorted_files = file_paths.to_vec();
    sorted_files.sort();
    for file_rel_path in sorted_files {
        let file_path = root_path.join(&file_rel_path);
        if let Ok(content) = fs::read_to_string(&file_path) {
            let header = format!("================================================\nFILE: {}\n================================================\n", file_rel_path.replace("\\", "/"));
            file_contents_string.push_str(&header);
            file_contents_string.push_str(&content);
            file_contents_string.push_str("\n\n");
        }
    }
    let final_context = format!("Directory structure:\n{}\n\n{}", directory_structure, file_contents_string);
    Ok(final_context)
}