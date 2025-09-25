// src-tauri/src/commands/git_commands.rs

use crate::{git_utils, models::{self, FsEntry}};
use std::path::{Path, PathBuf};
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
                remote_url: None,
            });
        }
    };

    let remote_url = repo
        .find_remote("origin")
        .ok()
        .and_then(|remote| remote.url().map(String::from));

    Ok(models::GitRepositoryInfo {
        is_repository: true,
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

    let mut changed_files = Vec::new();
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

    let mut all_files_content = String::new();
    let mut current_file_path: Option<PathBuf> = None;

    diff.print(git2::DiffFormat::Patch, |delta, _hunk, line| {
        let new_path = delta.new_file().path().map(PathBuf::from);
        
        if current_file_path.as_deref() != new_path.as_deref() {
            if let Some(p) = &new_path {
                let _ = write!(all_files_content, "\n================================================\nFILE: {}\n================================================\n", p.to_string_lossy().replace("\\", "/"));
            }
            current_file_path = new_path;
        }

        let origin = line.origin();
        let content = std::str::from_utf8(line.content()).unwrap_or("").trim_end_matches('\n');

        let line_num_str = match origin {
            '-' => line.old_lineno().map(|l| l.to_string()).unwrap_or_else(|| " ".to_string()),
            _ => line.new_lineno().map(|l| l.to_string()).unwrap_or_else(|| " ".to_string()),
        };

        let _ = writeln!(all_files_content, "{:>4} {} {}", line_num_str, origin, content);
        true
    })
    .map_err(|e| e.to_string())?;

    let final_context = format!("Directory structure of changed files:\n{}\n{}", tree_structure, all_files_content);

    Ok(final_context)
}