// src-tauri/src/commands/git_commands.rs

use crate::models::{self, FsEntry};
use std::path::Path;
use tauri::command;
use std::collections::BTreeMap;
use git2::Repository;
use std::fmt::Write as FmtWrite;

#[command]
pub fn check_git_repository(path: String) -> Result<models::GitRepositoryInfo, String> {
    let repo = match git2::Repository::open(&path) {
        Ok(repo) => repo,
        Err(_) => {
            return Ok(models::GitRepositoryInfo {
                is_repository: false,
                current_branch: None,
                remote_url: None,
                current_sha: None,
                main_branch_head_sha: None,
            });
        }
    };

    let head = repo.head().ok();

    let current_branch = repo
        .head()
        .ok()
        .and_then(|head| head.shorthand().map(String::from));

    // --- LOGIC MỚI: Tìm commit đầu của nhánh chính ---
    let main_branch_head_sha = repo
        .find_branch("main", git2::BranchType::Local)
        .or_else(|_| repo.find_branch("master", git2::BranchType::Local))
        .ok()
        .and_then(|branch| {
            branch
                .get()
                .target()
                .map(|oid| oid.to_string())
        });
    // --- KẾT THÚC LOGIC MỚI ---

    let current_sha = head.and_then(|h| h.target().map(|oid| oid.to_string()));

    let remote_url = repo
        .find_remote("origin")
        .ok()
        .and_then(|remote| remote.url().map(String::from));

    Ok(models::GitRepositoryInfo {
        is_repository: true,
        current_branch,
        remote_url,
        current_sha,
        main_branch_head_sha,
    })
}

#[command]
pub fn get_git_commits(
    path: String,
    page: usize,
    page_size: usize,
) -> Result<Vec<models::GitCommit>, String> {
    let repo = git2::Repository::open(&path).map_err(|e| e.to_string())?;
    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
 
    // SỬA LỖI: Cấu hình sắp xếp TRƯỚC khi đẩy các tham chiếu vào.
    // Sử dụng `set_sorting` thay vì `sort` để đảm bảo hành vi nhất quán.
    revwalk.set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME).map_err(|e| e.to_string())?;
    revwalk.push_glob("refs/heads/*").map_err(|e| e.to_string())?; // Đẩy các nhánh vào sau khi đã cấu hình sắp xếp.

    let commits = revwalk
        .skip((page - 1) * page_size)
        .take(page_size)
        .filter_map(|id| id.ok())
        .filter_map(|oid| repo.find_commit(oid).ok())
        .map(|commit| {
            let author = commit.author();
            let name = author.name().unwrap_or("Unknown");

            let time = commit.time();
            let dt = chrono::DateTime::from_timestamp(time.seconds(), 0).unwrap();
            let date_str = dt.format("%Y-%m-%d %H:%M").to_string();

            models::GitCommit {
                sha: commit.id().to_string(),
                author: name.to_string(),
                date: date_str,
                message: commit.summary().unwrap_or("").to_string(),
            }
        })
        .collect();

    Ok(commits)
}

#[command]
pub fn get_commit_diff(path: String, commit_sha: String) -> Result<String, String> {
    let repo_path = Path::new(&path);
    let repo = git2::Repository::open(repo_path).map_err(|e| e.to_string())?;

    let oid = git2::Oid::from_str(&commit_sha).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;

    let parent = if commit.parent_count() > 0 {
        Some(commit.parent(0).map_err(|e| e.to_string())?)
    } else {
        None
    };

    let parent_tree = parent.as_ref().map(|p| p.tree()).transpose().map_err(|e| e.to_string())?;
    let commit_tree = commit.tree().map_err(|e| e.to_string())?;

    let diff = repo
        .diff_tree_to_tree(parent_tree.as_ref(), Some(&commit_tree), None)
        .map_err(|e| e.to_string())?;

    let mut diff_output = String::new();

    diff.print(git2::DiffFormat::Patch, |delta, _hunk, line| {
        let path = delta.new_file().path().unwrap_or_else(|| Path::new(""));

        // Custom header to be more explicit than standard git diff
        if line.origin_value() == git2::DiffLineType::FileHeader {
             if delta.status() == git2::Delta::Added {
                diff_output.push_str(&format!("--- /dev/null\n+++ b/{}\n", path.display()));
            } else if delta.status() == git2::Delta::Deleted {
                diff_output.push_str(&format!("--- a/{}\n+++ /dev/null\n", path.display()));
            } else { // Modified, Renamed, etc.
                diff_output.push_str(&format!("--- a/{}\n+++ b/{}\n", path.display(), path.display()));
            }
        }
        
        let prefix = match line.origin() {
            '+' | '-' | ' ' => line.origin(),
            _ => ' ',
        };
        diff_output.push(prefix);
        diff_output.push_str(std::str::from_utf8(line.content()).unwrap_or(""));
        true
    })
    .map_err(|e| e.to_string())?;

    Ok(diff_output)
}

// --- HELPERS FOR TREE BUILDING (ADAPTED FROM context_generator.rs) ---
fn format_tree_helper(tree: &BTreeMap<String, FsEntry>, prefix: &str, output: &mut String) {
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
                format_tree_helper(children, &new_prefix, output);
            }
        }
    }
}

fn build_and_format_tree(paths: &[String]) -> String {
    let mut tree_builder_root = BTreeMap::new();
    for rel_path_str in paths {
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

    let mut directory_structure = String::new();
    format_tree_helper(&tree_builder_root, "", &mut directory_structure);
    directory_structure
}

#[command]
pub fn generate_commit_context(path: String, commit_sha: String) -> Result<String, String> {
    let repo_path = Path::new(&path);
    let repo = git2::Repository::open(repo_path).map_err(|e| e.to_string())?;

    let oid = git2::Oid::from_str(&commit_sha).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
    let commit_tree = commit.tree().map_err(|e| e.to_string())?;

    let parent = if commit.parent_count() > 0 {
        Some(commit.parent(0).map_err(|e| e.to_string())?)
    } else {
        None
    };
    let parent_tree = parent.as_ref().map(|p| p.tree()).transpose().map_err(|e| e.to_string())?;

    let diff = repo
        .diff_tree_to_tree(parent_tree.as_ref(), Some(&commit_tree), None)
        .map_err(|e| e.to_string())?;

    let mut changed_files = Vec::new();
    let mut file_contents_map = BTreeMap::new();

    diff.foreach(
        &mut |delta, _| {
            if let Some(path) = delta.new_file().path() {
                let path_str = path.to_string_lossy().to_string();
                // For new or modified files, get content from the current commit
                if delta.status() != git2::Delta::Deleted {
                    if let Ok(entry) = commit_tree.get_path(path) {
                        if let Ok(blob) = repo.find_blob(entry.id()) {
                            if let Ok(content_str) = std::str::from_utf8(blob.content()) {
                                file_contents_map.insert(path_str, content_str.lines().map(|s| s.to_string()).collect::<Vec<_>>());
                            }
                        }
                    }
                } else {
                    // For deleted files, content will be constructed from diff only
                    file_contents_map.insert(path_str, vec![]);
                }
            }
            true
        },
        None, None, None,
    ).map_err(|e| e.to_string())?;


    let mut diff_hunks_map: BTreeMap<String, Vec<(u32, Vec<(char, String)>)>> = BTreeMap::new();

    diff.print(git2::DiffFormat::Patch, |delta, hunk, line| {
        if let Some(path) = delta.new_file().path().or_else(|| delta.old_file().path()) {
            let path_str = path.to_string_lossy().to_string();
            let hunk_start_line = hunk.map(|h| h.new_start()).unwrap_or(0);

            let file_hunks = diff_hunks_map.entry(path_str).or_default();
            if file_hunks.last().map_or(true, |(start, _)| *start != hunk_start_line) {
                file_hunks.push((hunk_start_line, Vec::new()));
            }
            file_hunks.last_mut().unwrap().1.push((line.origin(), std::str::from_utf8(line.content()).unwrap_or("").to_string()));
        }
        true
    }).map_err(|e| e.to_string())?;


    diff.foreach(
        &mut |delta, _| {
            let path = delta.new_file().path().or_else(|| delta.old_file().path());
            if let Some(p) = path {
                changed_files.push(p.to_string_lossy().to_string());
            }
            true
        },
        None, None, None,
    ).map_err(|e| e.to_string())?;

    // Loại trừ các file lock khỏi ngữ cảnh commit
    let lock_files_to_exclude = [
        "package-lock.json",
        "Cargo.lock",
        "yarn.lock",
        "pnpm-lock.yaml",
    ];

    changed_files.retain(|path_str| {
        let file_name = Path::new(path_str).file_name().and_then(|s| s.to_str()).unwrap_or("");
        !lock_files_to_exclude.contains(&file_name)
    });

    file_contents_map.retain(|path_str, _| {
        let file_name = Path::new(path_str).file_name().and_then(|s| s.to_str()).unwrap_or("");
        !lock_files_to_exclude.contains(&file_name)
    });

    let tree_structure = build_and_format_tree(&changed_files);

    let mut final_content_string = String::new();

    for (path, content_lines) in file_contents_map {
        let _ = write!(final_content_string, "\n================================================\nFILE: {}\n================================================\n", path.replace("\\", "/"));

        if let Some(hunks) = diff_hunks_map.get(&path) {
            let mut current_line_idx = 0;
            let mut line_num = 1;

            for (hunk_start, hunk_lines) in hunks {
                // Print lines before the hunk
                while line_num < *hunk_start {
                    if let Some(line) = content_lines.get(current_line_idx) {
                        let _ = writeln!(final_content_string, "{:>4}   {}", line_num, line);
                        current_line_idx += 1;
                        line_num += 1;
                    } else {
                        break;
                    }
                }

                // Print the hunk lines
                for (origin, hunk_line_content) in hunk_lines {
                    let content = hunk_line_content.trim_end_matches('\n');
                    if *origin == '-' {
                        let _ = writeln!(final_content_string, "     - {}", content);
                    } else if *origin == '+' {
                        let _ = writeln!(final_content_string, "{:>4} + {}", line_num, content);
                        line_num += 1;
                        current_line_idx += 1;
                    } else if *origin == ' ' {
                        let _ = writeln!(final_content_string, "{:>4}   {}", line_num, content);
                        line_num += 1;
                        current_line_idx += 1;
                    }
                }
            }
            // Print remaining lines after the last hunk
            while let Some(line) = content_lines.get(current_line_idx) {
                let _ = writeln!(final_content_string, "{:>4}   {}", line_num, line);
                current_line_idx += 1;
                line_num += 1;
            }
        }
    }

    let final_context = format!("Directory structure of changed files:\n{}\n{}", tree_structure, final_content_string);

    Ok(final_context)
}

#[command]
pub fn checkout_commit(path: String, commit_sha: String) -> Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| format!("Failed to open repository: {}", e))?;

    // Check for uncommitted changes first to be safe. This provides a user-friendly error.
    let statuses = repo.statuses(Some(
        git2::StatusOptions::new()
            .include_untracked(true)
            .recurse_untracked_dirs(true)
    )).map_err(|e| format!("Failed to get repository status: {}", e))?;

    if !statuses.is_empty() {
        return Err(
            "You have uncommitted changes or untracked files. Please commit, stash, or clean your working directory before checking out a commit."
            .to_string()
        );
    }

    let oid = git2::Oid::from_str(&commit_sha).map_err(|e| format!("Invalid commit SHA: {}", e))?;
    
    // Set HEAD to point to the commit, which results in a detached HEAD state.
    repo.set_head_detached(oid).map_err(|e| format!("Failed to set detached HEAD: {}", e))?;

    // Now, checkout the new HEAD to update the working directory files.
    // We use `force` here because we've already confirmed the working directory is clean.
    // This ensures files are correctly overwritten to match the commit's state.
    repo.checkout_head(Some(
        git2::build::CheckoutBuilder::new().force()
    )).map_err(|e| format!("Failed to update working directory to match commit: {}", e))?;

    Ok(())
}

#[command]
pub fn checkout_branch(path: String, branch: String) -> Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| format!("Không thể mở kho Git: {}", e))?;

    // Luôn kiểm tra các thay đổi chưa commit để đảm bảo an toàn
    let statuses = repo.statuses(Some(
        git2::StatusOptions::new()
            .include_untracked(true)
            .recurse_untracked_dirs(true)
    )).map_err(|e| format!("Không thể lấy trạng thái kho Git: {}", e))?;

    if !statuses.is_empty() {
        return Err(
            "Bạn có các thay đổi chưa được commit. Vui lòng commit, stash, hoặc dọn dẹp thư mục làm việc của bạn trước."
            .to_string()
        );
    }

    // Checkout nhánh
    repo.set_head(&format!("refs/heads/{}", branch)).map_err(|e| format!("Không thể set HEAD cho nhánh '{}': {}", branch, e))?;

    repo.checkout_head(Some(
        git2::build::CheckoutBuilder::new().force()
    )).map_err(|e| format!("Không thể checkout nhánh '{}': {}", branch, e))?;

    Ok(())
}

#[command]
pub fn clone_git_repository(url: String, path: String) -> Result<(), String> {
    // The path is the full destination path.
    // The `git2::Repository::clone` function will create this directory.
    // It will fail if the directory already exists and is not empty.
    Repository::clone(&url, &path).map_err(|e| format!("Không thể clone kho Git: {}", e.message()))?;
    Ok(())
}