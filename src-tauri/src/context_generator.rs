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

pub fn expand_group_paths_to_files(
    group_paths: &[String],
    metadata_cache: &BTreeMap<String, crate::models::FileMetadata>,
    root_path: &Path,
) -> Vec<String> {
    let mut all_files_in_group: HashSet<String> = HashSet::new();
    for path_str in group_paths {
        let full_path = root_path.join(path_str);
        if full_path.is_dir() {
            for cached_path in metadata_cache.keys() {
                if cached_path.starts_with(path_str) && root_path.join(cached_path).is_file() {
                    all_files_in_group.insert(cached_path.clone());
                }
            }
        } else {
            all_files_in_group.insert(path_str.clone());
        }
    }
    all_files_in_group.into_iter().collect()
}

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