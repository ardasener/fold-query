use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const DEFAULT_SCRIPT: &str = r#"import cadquery as cq

# A box with chamfered vertical edges
result = (
    cq.Workplane("XY")
    .box(40, 40, 20)
    .edges("|Z")
    .chamfer(4)
)

show_object(result)
"#;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub id: String,
    pub name: String,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectData {
    pub id: String,
    pub name: String,
    pub source: String,
    pub messages: Vec<Value>,
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn projects_root(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not resolve the app data directory: {e}"))?
        .join("projects");
    std::fs::create_dir_all(&dir).map_err(|e| format!("Could not create projects dir: {e}"))?;
    Ok(dir)
}

fn atomic_write(path: &std::path::Path, contents: &[u8]) -> Result<(), String> {
    let tmp = std::path::PathBuf::from(format!("{}.tmp", path.display()));
    std::fs::write(&tmp, contents).map_err(|e| format!("Could not write {}: {e}", tmp.display()))?;
    std::fs::rename(&tmp, path).map_err(|e| format!("Could not finalize {}: {e}", path.display()))?;
    Ok(())
}

fn read_meta(dir: &std::path::Path) -> Result<ProjectInfo, String> {
    let raw = std::fs::read(dir.join("meta.json"))
        .map_err(|e| format!("Could not read project meta: {e}"))?;
    serde_json::from_slice(&raw).map_err(|e| format!("Invalid project meta: {e}"))
}

fn write_meta(dir: &std::path::Path, info: &ProjectInfo) -> Result<(), String> {
    let raw = serde_json::to_vec(info).map_err(|e| e.to_string())?;
    atomic_write(&dir.join("meta.json"), &raw)
}

fn touch(dir: &std::path::Path, info: &mut ProjectInfo) -> Result<(), String> {
    info.updated_at = now_millis();
    write_meta(dir, info)
}

fn project_dir(root: &std::path::Path, id: &str) -> Result<PathBuf, String> {
    let dir = root.join(id);
    if !dir.is_dir() {
        return Err(format!("Project '{id}' does not exist"));
    }
    Ok(dir)
}

pub fn list_projects(app: &AppHandle) -> Result<Vec<ProjectInfo>, String> {
    let root = projects_root(app)?;
    let mut projects: Vec<ProjectInfo> = Vec::new();
    for entry in std::fs::read_dir(&root).map_err(|e| format!("Could not list projects: {e}"))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        if let Ok(info) = read_meta(&path) {
            projects.push(info);
        }
    }
    projects.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(projects)
}

pub fn create_project(app: &AppHandle, name: String) -> Result<ProjectInfo, String> {
    let root = projects_root(app)?;
    let id = Uuid::new_v4().to_string();
    let dir = root.join(&id);
    std::fs::create_dir_all(&dir).map_err(|e| format!("Could not create project dir: {e}"))?;

    let now = now_millis();
    let info = ProjectInfo {
        id: id.clone(),
        name,
        created_at: now,
        updated_at: now,
    };
    write_meta(&dir, &info)?;
    atomic_write(&dir.join("model.py"), DEFAULT_SCRIPT.as_bytes())?;
    atomic_write(&dir.join("chat.json"), b"[]")?;
    Ok(info)
}

pub fn load_project_data(app: &AppHandle, id: &str) -> Result<ProjectData, String> {
    let root = projects_root(app)?;
    let dir = project_dir(&root, id)?;
    let info = read_meta(&dir)?;
    let source = std::fs::read_to_string(dir.join("model.py"))
        .map_err(|e| format!("Could not read model script: {e}"))?;
    let messages: Vec<Value> = match std::fs::read(dir.join("chat.json")) {
        Ok(raw) => serde_json::from_slice(&raw).unwrap_or_default(),
        Err(_) => Vec::new(),
    };
    Ok(ProjectData {
        id: info.id.clone(),
        name: info.name,
        source,
        messages,
    })
}

pub fn save_source(app: &AppHandle, id: &str, source: &str) -> Result<(), String> {
    let root = projects_root(app)?;
    let dir = project_dir(&root, id)?;
    let mut info = read_meta(&dir)?;
    atomic_write(&dir.join("model.py"), source.as_bytes())?;
    touch(&dir, &mut info)
}

pub fn save_chat(app: &AppHandle, id: &str, messages: &[Value]) -> Result<(), String> {
    let root = projects_root(app)?;
    let dir = project_dir(&root, id)?;
    let mut info = read_meta(&dir)?;
    let raw = serde_json::to_vec(messages).map_err(|e| e.to_string())?;
    atomic_write(&dir.join("chat.json"), &raw)?;
    touch(&dir, &mut info)
}

pub fn rename_project(app: &AppHandle, id: &str, name: String) -> Result<ProjectInfo, String> {
    let root = projects_root(app)?;
    let dir = project_dir(&root, id)?;
    let mut info = read_meta(&dir)?;
    info.name = name;
    touch(&dir, &mut info)?;
    Ok(info)
}

pub fn delete_project(app: &AppHandle, id: &str) -> Result<(), String> {
    let root = projects_root(app)?;
    let dir = project_dir(&root, id)?;
    std::fs::remove_dir_all(&dir).map_err(|e| format!("Could not delete project: {e}"))
}
