// src-tauri/src/project_scanner.rs
use crate::context_generator; // <-- THÊM USE STATEMENT NÀY
use crate::file_cache;
use crate::models::{
    CachedProjectData, FileMetadata, FileNode, GroupStats, ProjectStats, TsConfig,
};
use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
// use tauri::{Emitter, Window}; // Không còn cần vì hàm không emit nữa
use ignore::{overrides::OverrideBuilder, WalkBuilder};
use lazy_static::lazy_static;
use path_clean::PathClean;
use regex::Regex;
use sha2::{Digest, Sha256};
use tiktoken_rs::cl100k_base;

pub fn recalculate_stats_for_paths(
    paths: &[String],
    metadata_cache: &BTreeMap<String, FileMetadata>,
    _root_path: &Path, // _root_path không còn cần thiết
) -> GroupStats {
    let mut stats = GroupStats::default();
    let mut all_files_in_group: HashSet<String> = HashSet::new();
    let mut all_dirs_in_group: HashSet<String> = HashSet::new();

    let all_cached_files: Vec<&String> = metadata_cache.keys().collect();

    // Mở rộng các đường dẫn tối thiểu thành một danh sách file đầy đủ
    for path_str in paths {
        // Xử lý trường hợp đường dẫn là MỘT FILE
        if metadata_cache.contains_key(path_str) {
            all_files_in_group.insert(path_str.clone());
        }

        // Xử lý trường hợp đường dẫn là MỘT THƯ MỤC
        let dir_prefix = format!("{}/", path_str);
        if !path_str.is_empty() {
            all_dirs_in_group.insert(path_str.clone());
        }

        for &cached_file in &all_cached_files {
            if path_str.is_empty() {
                all_files_in_group.insert(cached_file.clone());
            } else if cached_file.starts_with(&dir_prefix) {
                all_files_in_group.insert(cached_file.clone());
            }
        }
    }

    // Dùng cache để suy ra các thư mục cha từ đường dẫn file
    let mut subdirs_from_files = HashSet::new();
    for file_path in &all_files_in_group {
        let mut current = Path::new(file_path);
        while let Some(parent) = current.parent() {
            if parent.as_os_str().is_empty() {
                break;
            }
            let parent_str = parent.to_string_lossy().replace("\\", "/");
            subdirs_from_files.insert(parent_str);
            current = parent;
        }
    }
    all_dirs_in_group.extend(subdirs_from_files);

    // Tính toán stats từ danh sách file đã mở rộng và cache
    for file_path_str in &all_files_in_group {
        if let Some(meta) = metadata_cache.get(file_path_str) {
            stats.total_size += meta.size;
            stats.token_count += meta.token_count;
        }
    }

    stats.total_files = all_files_in_group.len() as u64;
    stats.total_dirs = all_dirs_in_group.len() as u64;

    stats
}

// --- THÊM KHỐI MÃ NÀY ---
// Biên dịch các regex một lần duy nhất để tăng hiệu suất
lazy_static! {
    // --- THAY THẾ BẰNG REGEX ĐƠN GIẢN HƠN VÀ MẠNH MẼ HƠN ---
    static ref IMPORT_EXPORT_REGEX: Regex = Regex::new(
        r#"(?:from|import|require)\s*\(?\s*['"](?P<path>[./@][^'"]+)['"]\s*\)?"#
    ).unwrap();
}

// --- THAY ĐỔI HÀM NÀY ĐỂ NHẬN VÀO ALIAS MAP ---
fn resolve_link(
    current_file_path: &Path,
    link_path_str: &str,
    all_project_files: &HashSet<String>,
    aliases: &BTreeMap<String, String>, // <-- THAM SỐ MỚI
) -> Option<String> {
    let mut cleaned_path: Option<PathBuf> = None;

    // --- BẮT ĐẦU LOGIC PHÂN GIẢI MỚI, LINH HOẠT HƠN ---
    // Trường hợp 1: Kiểm tra xem đường dẫn có khớp với alias nào không
    for (alias, base_path) in aliases {
        if let Some(stripped) = link_path_str.strip_prefix(alias) {
            let full_path = Path::new(base_path).join(stripped);
            cleaned_path = Some(full_path.clean());
            break; // Tìm thấy alias đầu tiên khớp, thoát khỏi vòng lặp
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
    // --- KẾT THÚC LOGIC PHÂN GIẢI MỚI ---

    let cleaned_path_str = cleaned_path.unwrap().to_string_lossy().replace("\\", "/");

    // Thử tìm file với các extension phổ biến
    let extensions = ["", ".ts", ".tsx", ".js", ".jsx", ".json"];
    for ext in extensions.iter() {
        // Thử trường hợp 1: Đường dẫn chính xác (có thể có hoặc không có extension)
        // ví dụ: ./utils.ts -> utils.ts
        let potential_path = format!("{}{}", cleaned_path_str, ext);
        if all_project_files.contains(&potential_path) {
            return Some(potential_path);
        }

        // Thử trường hợp 2: Đường dẫn là một thư mục, tìm file index bên trong
        // ví dụ: ./components -> ./components/index.ts
        let potential_index_path = format!("{}/index{}", cleaned_path_str, ext);
        if all_project_files.contains(&potential_index_path) {
            return Some(potential_index_path);
        }
    }

    None
}

pub fn perform_smart_scan_and_rebuild(path: &str) -> Result<CachedProjectData, String> {
    let root_path = Path::new(path);
    let bpe = cl100k_base().map_err(|e| e.to_string())?;

    let old_data = file_cache::load_project_data(path).unwrap_or_default();
    let old_metadata_cache = old_data.file_metadata_cache;

    let mut new_project_stats = ProjectStats::default();
    let mut new_metadata_cache = BTreeMap::new();
    let mut path_map = BTreeMap::new(); // Dùng để xây dựng cây thư mục

    // --- BƯỚC MỚI: ĐỌC VÀ PHÂN TÍCH ALIAS ---
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
                            // Chỉ lấy replacement đầu tiên và đơn giản hóa nó
                            if let Some(first_replacement) = replacements.get(0) {
                                // Bỏ "/*" ở cuối alias và replacement
                                let clean_alias = alias.strip_suffix("/*").unwrap_or(&alias);
                                let clean_replacement = first_replacement
                                    .strip_suffix("/*")
                                    .unwrap_or(first_replacement);

                                // Tạo đường dẫn đầy đủ từ baseUrl
                                let full_base_path =
                                    Path::new(&base_url).join(clean_replacement).clean();
                                aliases.insert(
                                    clean_alias.to_string(),
                                    full_base_path.to_string_lossy().to_string(),
                                );
                            }
                        }
                    }
                }
            }
        }
    }
    // Hard-code alias mặc định nếu không tìm thấy trong tsconfig
    // Điều này giúp tương thích ngược với các dự án không có cấu hình rõ ràng
    aliases
        .entry("@/".to_string())
        .or_insert_with(|| "src/".to_string());
    println!("[INFO] Aliases đã phát hiện: {:?}", aliases);
    // --- KẾT THÚC PHẦN PHÂN TÍCH ALIAS ---

    // --- CẬP NHẬT: Xây dựng bộ lọc loại trừ ---
    let override_builder = {
        let mut builder = OverrideBuilder::new(root_path);
        // Luôn bao gồm các file lock
        builder
            .add("!package-lock.json")
            .map_err(|e| e.to_string())?;
        builder.add("!Cargo.lock").map_err(|e| e.to_string())?;
        builder.add("!yarn.lock").map_err(|e| e.to_string())?;
        builder.add("!pnpm-lock.yaml").map_err(|e| e.to_string())?;
        
        // Thêm các mẫu loại trừ tùy chỉnh từ người dùng
        if let Some(patterns) = &old_data.custom_ignore_patterns {
            for pattern in patterns {
                // Thêm tiền tố '!' để chỉ định đây là mẫu LOẠI TRỪ
                let ignore_pattern = format!("!{}", pattern);
                builder.add(&ignore_pattern).map_err(|e| e.to_string())?;
            }
        }

        builder.build().map_err(|e| e.to_string())?
    };

    // --- BƯỚC 1: Quét một lần duy nhất và thu thập thông tin thô ---
    struct RawFileInfo {
        relative_path: PathBuf,
        metadata: std::fs::Metadata,
        content: Option<String>,
    }
    let mut raw_files: Vec<RawFileInfo> = Vec::new();
    let mut all_valid_files = HashSet::new();

    for entry in WalkBuilder::new(root_path)
        .overrides(override_builder.clone())
        .build()
        .filter_map(Result::ok)
    {
        let entry_path = entry.path();
        if let (Ok(relative_path), Ok(metadata)) =
            (entry_path.strip_prefix(root_path), entry.metadata())
        {
            if relative_path.as_os_str().is_empty() {
                continue;
            }

            // Bỏ qua việc gửi progress trong lần refactor này để đơn giản hóa
            path_map.insert(entry_path.to_path_buf(), metadata.is_dir());

            if metadata.is_dir() {
                new_project_stats.total_dirs += 1;
            } else if metadata.is_file() {
                new_project_stats.total_files += 1;
                new_project_stats.total_size += metadata.len();

                let content = fs::read_to_string(entry_path).ok();
                raw_files.push(RawFileInfo {
                    relative_path: relative_path.to_path_buf(),
                    metadata,
                    content,
                });
                all_valid_files.insert(relative_path.to_string_lossy().replace("\\", "/"));
            }
        }
    }

    // --- BƯỚC 2: Xử lý thông tin thô để xây dựng metadata cache ---
    for file_info in raw_files {
        let relative_path_str = file_info.relative_path.to_string_lossy().replace("\\", "/");
        let current_mtime = file_info
            .metadata
            .modified()
            .map(|t| t.duration_since(UNIX_EPOCH).unwrap_or_default().as_secs())
            .unwrap_or(0);

        let mut token_count = 0;
        let mut links = Vec::new();

        if let Some(cached_meta) = old_metadata_cache.get(&relative_path_str) {
            if cached_meta.size == file_info.metadata.len() && cached_meta.mtime == current_mtime {
                token_count = cached_meta.token_count;
                links = cached_meta.links.clone();
            }
        }

        if token_count == 0 {
            // Nếu file mới/thay đổi, xử lý lại
            if let Some(content) = &file_info.content {
                // <-- Thêm & để borrow
                token_count = bpe.encode_with_special_tokens(content).len();

                let mut found_links = HashSet::new();

                // --- BẮT ĐẦU VÙNG DEBUG SÂU ---
                println!("\n[DEBUG] Đang phân tích file: {}", relative_path_str);

                for cap in IMPORT_EXPORT_REGEX.captures_iter(content) {
                    // Lấy group có tên "path" hoặc "path2"
                    let link_path_opt = cap.name("path");

                    if let Some(link_path_match) = link_path_opt {
                        let link_path = link_path_match.as_str();
                        println!("[DEBUG]   => Regex khớp: '{}'", link_path);

                        if let Some(resolved) = resolve_link(
                            &file_info.relative_path,
                            link_path,
                            &all_valid_files,
                            &aliases,
                        ) {
                            println!("[DEBUG]     => Phân giải thành công: '{}'", resolved);
                            found_links.insert(resolved);
                        } else {
                            println!("[DEBUG]     => Phân giải thất bại.");
                        }
                    } else {
                        // In ra toàn bộ capture để xem có gì sai không
                        println!("[DEBUG]   => Regex khớp nhưng không tìm thấy group 'path'. Full capture: {:?}", &cap);
                    }
                }
                // --- KẾT THÚC VÙNG DEBUG SÂU ---

                links = found_links.into_iter().collect();
            }
        }

        new_project_stats.total_tokens += token_count;
        new_metadata_cache.insert(
            relative_path_str,
            FileMetadata {
                size: file_info.metadata.len(),
                mtime: current_mtime,
                token_count,
                links,
            },
        );
    }

    // --- BƯỚC 3: Xây dựng cây thư mục và cập nhật nhóm (giữ nguyên) ---
    fn build_tree_from_map(
        parent: &Path,
        path_map: &BTreeMap<PathBuf, bool>,
        root_path: &Path,
    ) -> Vec<FileNode> {
        let mut children = Vec::new();
        for (path, is_dir) in path_map.range(parent.join("")..) {
            if path.parent() == Some(parent) {
                let name = path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                let relative_path_str = path
                    .strip_prefix(root_path)
                    .unwrap()
                    .to_string_lossy()
                    .replace("\\", "/");
                children.push(FileNode {
                    name,
                    path: relative_path_str,
                    children: if *is_dir {
                        Some(build_tree_from_map(path, path_map, root_path))
                    } else {
                        None
                    },
                });
            }
        }
        children.sort_by(|a, b| {
            let a_is_dir = a.children.is_some();
            let b_is_dir = b.children.is_some();
            if a_is_dir != b_is_dir {
                b_is_dir.cmp(&a_is_dir)
            } else {
                a.name.cmp(&b.name)
            }
        });
        children
    }
    let root_children = build_tree_from_map(root_path, &path_map, root_path);
    let file_tree = FileNode {
        name: root_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        path: "".to_string(),
        children: Some(root_children),
    };

    let mut updated_groups = old_data.groups;
    for group in &mut updated_groups {
        // 1. Giữ lại logic cũ: Xóa các file/thư mục không còn tồn tại
        group.paths.retain(|p| {
            new_metadata_cache.contains_key(p)
                || path_map
                    .get(&root_path.join(p))
                    .map_or(false, |is_dir| *is_dir)
        });

        // --- LOGIC MỚI: TỰ ĐỘNG ĐỒNG BỘ CHÉO ---
        // Kiểm tra xem tính năng có được bật cho nhóm này không (mặc định là false nếu không có)
        if group.cross_sync_enabled.unwrap_or(false) {
            // a. Mở rộng các đường dẫn tối thiểu thành một danh sách file đầy đủ
            let current_files = context_generator::expand_group_paths_to_files(
                &group.paths,
                &new_metadata_cache,
                root_path,
            );

            // b. Sử dụng đồ thị phụ thuộc để tìm tất cả các file liên quan
            let mut all_related_files = HashSet::new();
            let mut queue: Vec<String> = current_files.into_iter().collect();

            while let Some(file_path) = queue.pop() {
                if all_related_files.contains(&file_path) {
                    continue;
                }
                all_related_files.insert(file_path.clone());

                if let Some(metadata) = new_metadata_cache.get(&file_path) {
                    for linked_file in &metadata.links {
                        if !all_related_files.contains(linked_file) {
                            queue.push(linked_file.clone());
                        }
                    }
                }
            }

            // c. Tối ưu hóa lại danh sách file đã mở rộng này thành một danh sách `paths` mới.
            //    Đây là một bước phức tạp, chúng ta cần một hàm `prune_paths` ở Rust.
            //    Để đơn giản hóa, ta có thể chỉ thêm các file mới tìm thấy.
            //    Cách tốt hơn là tính toán lại toàn bộ.
            //    Ở đây, ta sẽ giả định một cách tiếp cận đơn giản: chỉ thêm các file đơn lẻ mới.
            //    Lưu ý: Cách tiếp cận này có thể không "tối ưu" danh sách paths.
            let mut new_paths_set: HashSet<String> = group.paths.iter().cloned().collect();
            for file in all_related_files {
                // Chỉ thêm nếu nó chưa được bao hàm bởi một thư mục cha đã có
                let is_covered = new_paths_set
                    .iter()
                    .any(|p| file.starts_with(&format!("{}/", p)));
                if !is_covered {
                    new_paths_set.insert(file);
                }
            }
            group.paths = new_paths_set.into_iter().collect();
        }
        // --- KẾT THÚC LOGIC MỚI ---

        // 2. Luôn tính toán lại stats sau khi đã cập nhật `paths`
        group.stats = recalculate_stats_for_paths(&group.paths, &new_metadata_cache, root_path);
    }

    // --- BƯỚC 4: Tính toán hash để theo dõi thay đổi ---
    let metadata_json = serde_json::to_string(&new_metadata_cache).unwrap_or_default();
    let mut hasher = Sha256::new();
    hasher.update(metadata_json.as_bytes());
    let hash_result = hasher.finalize();
    let data_hash = format!("{:x}", hash_result);

    let final_data = CachedProjectData {
        stats: new_project_stats,
        file_tree: Some(file_tree),
        groups: updated_groups,
        file_metadata_cache: new_metadata_cache,
        sync_enabled: old_data.sync_enabled, // Giữ lại cài đặt cũ
        sync_path: old_data.sync_path,       // Giữ lại cài đặt cũ
        data_hash: Some(data_hash),
        custom_ignore_patterns: old_data.custom_ignore_patterns, // Giữ lại cài đặt cũ
    };

    // --- THAY ĐỔI: Trả về dữ liệu thay vì lưu và emit ---
    Ok(final_data)
}
