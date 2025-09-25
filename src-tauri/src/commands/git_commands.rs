// src-tauri/src/commands/git_commands.rs

use crate::models::{self, FsEntry};
use std::path::Path;
use tauri::command;
use std::collections::BTreeMap;
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
            });
        }
    };

    let current_branch = repo
        .head()
        .ok()
        .and_then(|head| head.shorthand().map(String::from));

    let remote_url = repo
        .find_remote("origin")
        .ok()
        .and_then(|remote| remote.url().map(String::from));

    Ok(models::GitRepositoryInfo {
        is_repository: true,
        current_branch,
        remote_url,
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
    revwalk.push_head().map_err(|e| e.to_string())?;

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