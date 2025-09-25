// src-tauri/src/commands/git_commands.rs

use crate::{git_utils, models};
use std::path::Path;
use tauri::command;

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