// src-tauri/src/commands/ai_commands.rs
use crate::{file_cache, models};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use tauri::{command, AppHandle};

// Helper to get the directory for a profile's chats
fn get_chats_dir(
    app: &AppHandle,
    project_path: &str,
    profile_name: &str,
) -> Result<PathBuf, String> {
    let project_dir = file_cache::get_project_config_dir(app, project_path)?;
    let chats_dir = project_dir.join("chats").join(profile_name);
    fs::create_dir_all(&chats_dir)
        .map_err(|e| format!("Không thể tạo thư mục chats: {}", e))?;
    Ok(chats_dir)
}

#[command]
pub fn list_chat_sessions(
    app: AppHandle,
    project_path: String,
    profile_name: String,
) -> Result<Vec<models::AIChatSessionHeader>, String> {
    let chats_dir = get_chats_dir(&app, &project_path, &profile_name)?;
    let mut sessions = Vec::new();

    for entry in fs::read_dir(chats_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
            let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
            if let Ok(session) = serde_json::from_str::<models::AIChatSession>(&content) {
                sessions.push(models::AIChatSessionHeader {
                    id: session.id,
                    title: session.title,
                    created_at: session.created_at,
                });
            }
        }
    }

    // Sort by creation date, newest first
    sessions.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(sessions)
}

#[command]
pub fn save_chat_session(
    app: AppHandle,
    project_path: String,
    profile_name: String,
    session: models::AIChatSession,
) -> Result<(), String> {
    let chats_dir = get_chats_dir(&app, &project_path, &profile_name)?;
    let file_path = chats_dir.join(format!("{}.json", session.id));
    let json_string =
        serde_json::to_string_pretty(&session).map_err(|e| e.to_string())?;
    let mut file = fs::File::create(file_path).map_err(|e| e.to_string())?;
    file.write_all(json_string.as_bytes())
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub fn load_chat_session(
    app: AppHandle,
    project_path: String,
    profile_name: String,
    session_id: String,
) -> Result<models::AIChatSession, String> {
    let chats_dir = get_chats_dir(&app, &project_path, &profile_name)?;
    let file_path = chats_dir.join(format!("{}.json", session_id));
    let content = fs::read_to_string(file_path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[command]
pub fn delete_chat_session(
    app: AppHandle,
    project_path: String,
    profile_name: String,
    session_id: String,
) -> Result<(), String> {
    let chats_dir = get_chats_dir(&app, &project_path, &profile_name)?;
    let file_path = chats_dir.join(format!("{}.json", session_id));
    if file_path.exists() {
        fs::remove_file(file_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[command]
pub fn delete_all_chat_sessions(
    app: AppHandle,
    project_path: String,
    profile_name: String,
) -> Result<(), String> {
    let chats_dir = get_chats_dir(&app, &project_path, &profile_name)?;
    if chats_dir.exists() {
        fs::remove_dir_all(&chats_dir)
            .map_err(|e| format!("Không thể xóa thư mục chats: {}", e))?;
    }
    // Recreate the directory so new chats can be saved
    fs::create_dir_all(&chats_dir)
        .map_err(|e| format!("Không thể tạo lại thư mục chats: {}", e))?;
    Ok(())
}

#[command]
pub fn update_chat_session_title(
    app: AppHandle,
    project_path: String,
    profile_name: String,
    session_id: String,
    new_title: String,
) -> Result<(), String> {
    let mut session =
        load_chat_session(app.clone(), project_path.clone(), profile_name.clone(), session_id)?;
    session.title = new_title;
    save_chat_session(app, project_path, profile_name, session)
}

#[command]
pub fn create_chat_session(
    app: AppHandle,
    project_path: String,
    profile_name: String,
    title: String,
) -> Result<models::AIChatSession, String> {
    let new_session = models::AIChatSession {
        id: uuid::Uuid::new_v4().to_string(),
        title,
        created_at: chrono::Utc::now(),
        messages: Vec::new(),
        total_tokens: None,
        total_cost: None,
    };

    save_chat_session(
        app,
        project_path,
        profile_name,
        new_session.clone(),
    )?;
    Ok(new_session)
}