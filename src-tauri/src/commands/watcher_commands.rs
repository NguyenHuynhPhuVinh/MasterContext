// src-tauri/src/commands/watcher_commands.rs
use lazy_static::lazy_static;
use notify::{RecursiveMode, RecommendedWatcher, Watcher};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use std::path::Path;
use tauri::{command, Emitter, Window};

lazy_static! {
    static ref FILE_WATCHER: Mutex<Option<RecommendedWatcher>> = Mutex::new(None);
    static ref LAST_CHANGE_TIME: Mutex<Option<Instant>> = Mutex::new(None);
}

#[command]
pub fn start_file_watching(window: Window, path: String) -> Result<(), String> {
    stop_file_watching()?;

    let window_clone = window.clone();
    let debounce_duration = Duration::from_secs(2);

    let mut watcher = notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
        match res {
            Ok(event) => {
                if event.kind.is_modify() || event.kind.is_create() || event.kind.is_remove() {
                    let mut last_change = LAST_CHANGE_TIME.lock().unwrap();
                    let now = Instant::now();

                    if last_change.is_none() || now.duration_since(last_change.unwrap()) > debounce_duration {
                        println!("[Watcher] Detected change: {:?}, triggering rescan.", event.paths);
                        let _ = window_clone.emit("file_change_detected", ());
                        *last_change = Some(now);
                    }
                }
            }
            Err(e) => println!("[Watcher] Error: {:?}", e),
        }
    })
    .map_err(|e| format!("Không thể tạo watcher: {}", e))?;

    watcher
        .watch(Path::new(&path), RecursiveMode::Recursive)
        .map_err(|e| format!("Không thể bắt đầu theo dõi thư mục: {}", e))?;

    *FILE_WATCHER.lock().unwrap() = Some(watcher);
    println!("[Watcher] Started watching path: {}", path);
    Ok(())
}

#[command]
pub fn stop_file_watching() -> Result<(), String> {
    if let Some(watcher) = FILE_WATCHER.lock().unwrap().take() {
        drop(watcher);
        println!("[Watcher] Stopped watching.");
    }
    Ok(())
}