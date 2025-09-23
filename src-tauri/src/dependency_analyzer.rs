// src-tauri/src/dependency_analyzer.rs
use crate::models::TsConfig;
use lazy_static::lazy_static;
use path_clean::PathClean;
use regex::Regex;
use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

lazy_static! {
    static ref IMPORT_EXPORT_REGEX: Regex = Regex::new(
        r#"(?:from|import|require)\s*\(?\s*['"](?P<path>(?:\.@/|/|\.\./|\./)[^'"]+)['"]\s*\)?"#
    ).unwrap();
}

/// Đọc tsconfig.json hoặc jsconfig.json để phân tích các path alias.
pub fn parse_config_aliases(root_path: &Path) -> BTreeMap<String, String> {
    let mut aliases = BTreeMap::new();
    let tsconfig_path = root_path.join("tsconfig.json");
    let jsconfig_path = root_path.join("jsconfig.json");

    let config_path = if tsconfig_path.exists() {
        Some(tsconfig_path)
    } else if jsconfig_path.exists() {
        Some(jsconfig_path)
    } else {
        None
    };

    if let Some(path) = config_path {
        if let Ok(content) = fs::read_to_string(path) {
            if let Ok(tsconfig) = serde_json::from_str::<TsConfig>(&content) {
                if let Some(options) = tsconfig.compiler_options {
                    let base_url = options.base_url.unwrap_or_else(|| ".".to_string());
                    if let Some(paths) = options.paths {
                        for (alias, replacements) in paths {
                            if let Some(first_replacement) = replacements.get(0) {
                                let clean_alias = alias.strip_suffix("/*").unwrap_or(&alias);
                                let clean_replacement = first_replacement
                                    .strip_suffix("/*")
                                    .unwrap_or(first_replacement);

                                let full_base_path =
                                    Path::new(&base_url).join(clean_replacement).clean();
                                aliases.insert(
                                    clean_alias.to_string(),
                                    full_base_path.to_string_lossy().to_string().replace("\\", "/"),
                                );
                            }
                        }
                    }
                }
            }
        }
    }
    aliases
}

/// Phân tích nội dung file để tìm các file phụ thuộc.
pub fn analyze_dependencies(
    content: &str,
    current_file_path: &Path,
    all_project_files: &HashSet<String>,
    aliases: &BTreeMap<String, String>,
) -> Vec<String> {
    let mut found_links = HashSet::new();
    for cap in IMPORT_EXPORT_REGEX.captures_iter(content) {
        if let Some(link_path_match) = cap.name("path") {
            let link_path = link_path_match.as_str();
            if let Some(resolved) =
                resolve_link(current_file_path, link_path, all_project_files, aliases)
            {
                found_links.insert(resolved);
            }
        }
    }
    found_links.into_iter().collect()
}

/// Phân giải một chuỗi import thành đường dẫn file thực tế trong dự án.
fn resolve_link(
    current_file_path: &Path,
    link_path_str: &str,
    all_project_files: &HashSet<String>,
    aliases: &BTreeMap<String, String>,
) -> Option<String> {
    let mut sorted_aliases: Vec<_> = aliases.iter().collect();
    sorted_aliases.sort_by(|(a, _), (b, _)| b.len().cmp(&a.len()));

    let mut cleaned_path: Option<PathBuf> = None;

    // Trường hợp 1: Kiểm tra xem đường dẫn có khớp với alias nào không
    for (alias, base_path) in sorted_aliases {
        if link_path_str.starts_with(alias.as_str()) {
            let stripped = &link_path_str[alias.len()..];
            let stripped_final = stripped.strip_prefix('/').unwrap_or(stripped);
            let full_path = Path::new(base_path.replace('\\', "/").as_str()).join(stripped_final);
            cleaned_path = Some(full_path.clean());
            break;
        }
    }

    if cleaned_path.is_none() {
        if link_path_str.starts_with('.') {
            // Trường hợp 2: Tương đối (nếu không có alias nào khớp)
            let current_dir = current_file_path.parent().unwrap_or_else(|| Path::new(""));
            cleaned_path = Some(current_dir.join(link_path_str).clean());
        } else {
            // Trường hợp 3: Package npm hoặc không hợp lệ, bỏ qua
            return None;
        }
    }

    let cleaned_path_str = cleaned_path.unwrap().to_string_lossy().replace("\\", "/");

    // Thử tìm file với các extension phổ biến
    let extensions = ["", ".ts", ".tsx", ".js", ".jsx", ".json", ".css"];
    for ext in extensions.iter() {
        // Trường hợp A: Đường dẫn trỏ thẳng đến file (có thể thiếu extension)
        let potential_path = format!("{}{}", cleaned_path_str, ext);
        if all_project_files.contains(&potential_path) {
            return Some(potential_path);
        }

        // Trường hợp B: Đường dẫn trỏ đến một thư mục, tìm file index bên trong
        let potential_index_path = format!("{}/index{}", cleaned_path_str, ext);
        if all_project_files.contains(&potential_index_path) {
            return Some(potential_index_path);
        }
    }

    None
}